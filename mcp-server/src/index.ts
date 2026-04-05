#!/usr/bin/env node
/**
 * Krexa MCP Server
 *
 * Exposes Krexa agent-credit operations as MCP tools so any LLM can:
 *   - check balances and credit status
 *   - make x402 payments
 *   - execute token trades
 *   - draw from / repay a credit line
 *   - retrieve credit score
 *
 * Configuration via environment variables:
 *   KREXA_API_KEY      — Krexa API key
 *   KREXA_BASE_URL     — Override API base (default: https://api.krexa.xyz)
 *   KREXA_AGENT_ADDRESS — Agent wallet address / pubkey
 *   KREXA_CHAIN        — "solana" | "base" (default: solana)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { KrexaSDK, KrexaError } from '@krexa/sdk';
import type { Chain, TradeParams } from '@krexa/sdk';

// ---------------------------------------------------------------------------
// SDK initialisation
// ---------------------------------------------------------------------------

// BUG-041: validate agent address format at startup
const SOLANA_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const EVM_ADDR_RE = /^0x[a-fA-F0-9]{40}$/;
const chain = (process.env.KREXA_CHAIN ?? 'solana') as Chain;
const agentAddress = process.env.KREXA_AGENT_ADDRESS;
if (agentAddress) {
  if (chain === 'solana' && !SOLANA_ADDR_RE.test(agentAddress)) {
    process.stderr.write(`[krexa-mcp] FATAL: invalid Solana address: ${agentAddress}\n`);
    process.exit(1);
  }
  if (chain === 'base' && !EVM_ADDR_RE.test(agentAddress)) {
    process.stderr.write(`[krexa-mcp] FATAL: invalid EVM address: ${agentAddress}\n`);
    process.exit(1);
  }
}

const sdk = new KrexaSDK({
  apiKey:       process.env.KREXA_API_KEY,
  baseUrl:      process.env.KREXA_BASE_URL,
  chain,
  agentAddress,
});

// ---------------------------------------------------------------------------
// REST API helpers (for tools that call backend directly)
// ---------------------------------------------------------------------------

const API_URL = process.env.KREXA_BASE_URL ?? 'https://tcredit-backend.onrender.com/api/v1';
const agentAddr = agentAddress ?? '';

async function apiGet(path: string) {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text().catch(() => '')}`);
  return res.json();
}

async function apiPost(path: string, body: unknown) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text().catch(() => '')}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const TOOLS: Tool[] = [
  {
    name: 'krexa_register_agent',
    description:
      'Register a new Krexa agent wallet on-chain. ' +
      'Choose agent type: 0 = Trader (DeFi bots), 1 = Service (API providers), 2 = Hybrid (both). ' +
      'Returns an unsigned transaction for the owner to sign.',
    inputSchema: {
      type: 'object',
      properties: {
        ownerAddress: {
          type: 'string',
          description: 'The Solana public key of the agent owner.',
        },
        agentType: {
          type: 'number',
          description: 'Agent type: 0 = Trader, 1 = Service, 2 = Hybrid. Defaults to 0.',
        },
        dailySpendLimitUsdc: {
          type: 'number',
          description: 'Daily spend limit in USDC (default: 500).',
        },
      },
      required: ['ownerAddress'],
    },
  },

  {
    name: 'krexa_check_balance',
    description:
      'Check the USDC balance and overall status of the Krexa agent wallet. ' +
      'Returns wallet balance, credit line details, health factor, and KYA tier.',
    inputSchema: {
      type: 'object',
      properties: {
        detailed: {
          type: 'boolean',
          description:
            'If true, returns full status (wallet, credit line, eligibility, KYA). ' +
            'If false (default), returns just the USDC balance.',
        },
      },
    },
  },

  {
    name: 'krexa_pay',
    description:
      'Send a USDC x402 payment to a recipient address. ' +
      'Builds an unsigned transaction for the agent to sign, or calls the oracle to settle on-chain.',
    inputSchema: {
      type: 'object',
      properties: {
        recipient: {
          type: 'string',
          description: 'Recipient wallet address (Solana pubkey or EVM address).',
        },
        amount: {
          type: 'number',
          description: 'Amount in USDC (e.g. 5.00 for five dollars).',
          minimum: 0.001,
          maximum: 500000,
        },
        paymentId: {
          type: 'string',
          description: 'Optional idempotency / reference ID for the payment.',
        },
      },
      required: ['recipient', 'amount'],
    },
  },

  {
    name: 'krexa_trade',
    description:
      'Execute a token swap through a whitelisted venue (e.g. Jupiter on Solana). ' +
      'Returns an unsigned transaction that the agent\'s owner must sign.',
    inputSchema: {
      type: 'object',
      properties: {
        venue: {
          type: 'string',
          description: 'Trade venue identifier, e.g. "jupiter" or "orca".',
        },
        from: {
          type: 'string',
          description: 'Source token symbol or mint address, e.g. "USDC".',
        },
        to: {
          type: 'string',
          description: 'Destination token symbol or mint address, e.g. "SOL".',
        },
        amount: {
          type: 'number',
          description: 'Amount of the source token to swap (in human units).',
          minimum: 0.001,
          maximum: 500000,
        },
        ownerAddress: {
          type: 'string',
          description: 'Owner wallet public key (must match on-chain agent wallet owner).',
        },
      },
      required: ['venue', 'from', 'to', 'amount', 'ownerAddress'],
    },
  },

  {
    name: 'krexa_draw_credit',
    description:
      'Request a draw from the agent\'s credit line. ' +
      'Checks eligibility first, then returns the unsigned credit-draw transaction.',
    inputSchema: {
      type: 'object',
      properties: {
        ownerPubkey: {
          type: 'string',
          description: 'Owner wallet public key (must match on-chain agent wallet owner).',
        },
        ownerSignature: {
          type: 'string',
          description: 'Base64 signature of raw agent pubkey bytes by owner wallet.',
        },
        amount: {
          type: 'number',
          description: 'Amount of USDC to draw from the credit line.',
          minimum: 0.01,
          maximum: 500000,
        },
        rateBps: {
          type: 'number',
          description: 'Interest rate in basis points, e.g. 150 for 1.5%.',
          minimum: 0,
          maximum: 10000,
        },
      },
      required: ['ownerPubkey', 'ownerSignature', 'amount'],
    },
  },

  {
    name: 'krexa_repay',
    description:
      'Repay outstanding credit drawn from the Krexa credit line. ' +
      'Returns an unsigned repay transaction.',
    inputSchema: {
      type: 'object',
      properties: {
        amount: {
          type: 'number',
          description: 'Amount of USDC to repay.',
        },
        callerAddress: {
          type: 'string',
          description: 'Optional: override the signer address (Solana only).',
        },
      },
      required: ['amount'],
    },
  },

  {
    name: 'krexa_swap',
    description:
      'Execute a token swap via Jupiter aggregator (best route across all Solana DEXs). ' +
      'Returns an unsigned transaction. Supports SOL, USDC, BONK, JUP, and any Solana token mint.',
    inputSchema: {
      type: 'object',
      properties: {
        from: {
          type: 'string',
          description: 'Source token symbol or mint address, e.g. "USDC" or "SOL".',
        },
        to: {
          type: 'string',
          description: 'Destination token symbol or mint address, e.g. "SOL" or "USDC".',
        },
        amount: {
          type: 'number',
          description: 'Amount of the source token to swap (in human units, e.g. 50 for 50 USDC).',
        },
        slippageBps: {
          type: 'number',
          description: 'Slippage tolerance in basis points (default: 50 = 0.5%).',
        },
        ownerAddress: {
          type: 'string',
          description: 'The Solana public key that will sign the swap transaction.',
        },
      },
      required: ['from', 'to', 'amount', 'ownerAddress'],
    },
  },

  {
    name: 'krexa_quote',
    description:
      'Get a swap quote without executing. Shows best route, output amount, and price impact. ' +
      'Use this to preview a trade before committing.',
    inputSchema: {
      type: 'object',
      properties: {
        from: {
          type: 'string',
          description: 'Source token symbol or mint address.',
        },
        to: {
          type: 'string',
          description: 'Destination token symbol or mint address.',
        },
        amount: {
          type: 'number',
          description: 'Amount of the source token (human units).',
        },
        slippageBps: {
          type: 'number',
          description: 'Slippage tolerance in basis points (default: 50).',
        },
      },
      required: ['from', 'to', 'amount'],
    },
  },

  {
    name: 'krexa_portfolio',
    description:
      'Get the agent\'s full token portfolio with USD values. ' +
      'Shows all token balances, prices, and total portfolio value.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  {
    name: 'krexa_yield_scan',
    description:
      'Scan for the best yield opportunities on Solana. ' +
      'Returns top DeFi protocols sorted by APY with TVL data.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Number of results to return (default: 20, max: 100).',
        },
        minTvl: {
          type: 'number',
          description: 'Minimum TVL in USD to filter by.',
        },
        token: {
          type: 'string',
          description: 'Filter by token symbol (e.g. "SOL", "USDC").',
        },
      },
    },
  },

  {
    name: 'krexa_get_score',
    description:
      'Retrieve the agent\'s current credit score, level, and score history. ' +
      'Also checks eligibility for credit draws.',
    inputSchema: {
      type: 'object',
      properties: {
        includeEligibility: {
          type: 'boolean',
          description: 'If true (default), also return current credit eligibility details.',
        },
      },
    },
  },

  // --- New tools (v2.0) ---

  {
    name: 'krexa_price',
    description:
      'Get the current USD price of any Solana token via Jupiter Price API with CoinGecko fallback. ' +
      'Accepts token symbol (SOL, USDC, BONK) or mint address.',
    inputSchema: {
      type: 'object',
      properties: {
        token: {
          type: 'string',
          description: 'Token symbol (e.g. "SOL") or mint address.',
        },
      },
      required: ['token'],
    },
  },

  {
    name: 'krexa_positions',
    description:
      'View all token positions held in the agent\'s PDA wallet with current USD values. ' +
      'Alias for portfolio focused on position management and rebalancing decisions.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  {
    name: 'krexa_limit_order',
    description:
      'Set a limit order via Jupiter Limit Orders. The order executes automatically when the target price is reached.',
    inputSchema: {
      type: 'object',
      properties: {
        fromToken: {
          type: 'string',
          description: 'Token to sell (symbol or mint).',
        },
        toToken: {
          type: 'string',
          description: 'Token to buy (symbol or mint).',
        },
        amount: {
          type: 'number',
          description: 'Amount of fromToken to sell.',
        },
        targetPrice: {
          type: 'number',
          description: 'Target price at which to execute the order.',
        },
        expiry: {
          type: 'string',
          description: 'Expiry duration (e.g. "24h", "7d"). Defaults to "24h".',
        },
      },
      required: ['fromToken', 'toToken', 'amount', 'targetPrice'],
    },
  },

  {
    name: 'krexa_cancel_order',
    description:
      'Cancel an active limit order by its order ID.',
    inputSchema: {
      type: 'object',
      properties: {
        orderId: {
          type: 'string',
          description: 'The ID of the limit order to cancel.',
        },
      },
      required: ['orderId'],
    },
  },

  {
    name: 'krexa_lp_add',
    description:
      'Add liquidity to a DEX pool on Meteora, Orca, or Raydium. ' +
      'Specify "auto" for protocol to let the system pick the best venue.',
    inputSchema: {
      type: 'object',
      properties: {
        pool: {
          type: 'string',
          description: 'Pool address or pair identifier (e.g. "SOL-USDC").',
        },
        amount: {
          type: 'number',
          description: 'Amount of base token to deposit.',
        },
        protocol: {
          type: 'string',
          enum: ['meteora', 'orca', 'raydium', 'auto'],
          description: 'DEX protocol. Defaults to "auto".',
        },
        rangePercent: {
          type: 'number',
          description: 'Concentrated liquidity range as percentage (default: 10).',
        },
      },
      required: ['pool', 'amount'],
    },
  },

  {
    name: 'krexa_lp_remove',
    description:
      'Remove liquidity from an active LP position. Optionally remove only a percentage.',
    inputSchema: {
      type: 'object',
      properties: {
        positionId: {
          type: 'string',
          description: 'The LP position ID or address.',
        },
        percentage: {
          type: 'number',
          description: 'Percentage of the position to remove (1-100, default: 100).',
        },
      },
      required: ['positionId'],
    },
  },

  {
    name: 'krexa_lp_positions',
    description:
      'View all active LP positions across Meteora, Orca, and Raydium. ' +
      'Shows fees earned, current value, and impermanent loss.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  {
    name: 'krexa_lp_pools',
    description:
      'List available liquidity pools with APY, TVL, and 24h volume. ' +
      'Filter by token, protocol, or minimum APY.',
    inputSchema: {
      type: 'object',
      properties: {
        token: {
          type: 'string',
          description: 'Filter pools containing this token symbol.',
        },
        protocol: {
          type: 'string',
          description: 'Filter by protocol (meteora, orca, raydium).',
        },
        minApy: {
          type: 'number',
          description: 'Minimum APY percentage to filter by.',
        },
        limit: {
          type: 'number',
          description: 'Number of results (default: 20).',
        },
      },
    },
  },

  {
    name: 'krexa_history',
    description:
      'View the agent\'s transaction history including swaps, LP operations, credit draws, and revenue.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Number of transactions to return (default: 20).',
        },
        type: {
          type: 'string',
          enum: ['all', 'swaps', 'lp', 'credit', 'revenue'],
          description: 'Filter by transaction type (default: "all").',
        },
      },
    },
  },

  {
    name: 'krexa_vault_deposit',
    description:
      'Deposit USDC into a Krexa vault tranche to earn yield. ' +
      'Choose senior (lowest risk), mezzanine, or junior (highest yield) tranche.',
    inputSchema: {
      type: 'object',
      properties: {
        amount: {
          type: 'number',
          description: 'Amount of USDC to deposit.',
        },
        tranche: {
          type: 'string',
          enum: ['senior', 'mezzanine', 'junior'],
          description: 'Vault tranche (default: "senior").',
        },
      },
      required: ['amount'],
    },
  },

  {
    name: 'krexa_vault_stats',
    description:
      'Get Krexa vault statistics including TVL, utilization rate, and APR for each tranche.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

type Args = Record<string, unknown>;

async function handleRegisterAgent(args: Args) {
  const ownerAddress = requireString(args.ownerAddress, 'ownerAddress');
  const agentType = typeof args.agentType === 'number' ? requireNumber(args.agentType, 'agentType') : 0;
  const dailySpendLimitUsdc =
    typeof args.dailySpendLimitUsdc === 'number'
      ? requireNumber(args.dailySpendLimitUsdc, 'dailySpendLimitUsdc')
      : undefined;
  return sdk.agent.createWallet({ ownerAddress, agentType, dailySpendLimitUsdc });
}

async function handleCheckBalance(args: Args) {
  const detailed = args.detailed === true;
  if (detailed) {
    const status = await sdk.agent.getStatus();
    return {
      wallet:      status.wallet,
      credit:      status.credit,
      eligibility: status.eligibility,
      kya:         status.kya,
      balance:     status.balance,
    };
  }
  return sdk.agent.getBalance();
}

// BUG-095 fix: runtime type validation before casting
function requireNumber(val: unknown, name: string): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) throw new Error(`${name} must be a finite number`);
  return val;
}
function requireString(val: unknown, name: string): string {
  if (typeof val !== 'string' || val.length === 0) throw new Error(`${name} must be a non-empty string`);
  return val;
}

async function handlePay(args: Args) {
  const recipient = requireString(args.recipient, 'recipient');
  const amount    = requireNumber(args.amount, 'amount');
  const paymentId = typeof args.paymentId === 'string' ? args.paymentId : undefined;
  return sdk.agent.payX402({ recipient, amount, paymentId });
}

async function handleTrade(args: Args) {
  const params: TradeParams = {
    venue:  requireString(args.venue, 'venue'),
    from:   requireString(args.from, 'from'),
    to:     requireString(args.to, 'to'),
    amount: requireNumber(args.amount, 'amount'),
    ownerAddress: requireString(args.ownerAddress, 'ownerAddress'),
  };
  return sdk.agent.trade(params);
}

async function handleSwap(args: Args) {
  return sdk.agent.swap({
    from:         requireString(args.from, 'from'),
    to:           requireString(args.to, 'to'),
    amount:       requireNumber(args.amount, 'amount'),
    slippageBps:  typeof args.slippageBps === 'number' ? args.slippageBps : undefined,
    ownerAddress: requireString(args.ownerAddress, 'ownerAddress'),
  });
}

async function handleQuote(args: Args) {
  return sdk.agent.quote({
    from:        requireString(args.from, 'from'),
    to:          requireString(args.to, 'to'),
    amount:      requireNumber(args.amount, 'amount'),
    slippageBps: typeof args.slippageBps === 'number' ? args.slippageBps : undefined,
  });
}

async function handlePortfolio() {
  return sdk.agent.portfolio();
}

async function handleYieldScan(args: Args) {
  return sdk.agent.yieldScan({
    limit:  typeof args.limit === 'number' ? args.limit : undefined,
    minTvl: typeof args.minTvl === 'number' ? args.minTvl : undefined,
    token:  typeof args.token === 'string' ? args.token : undefined,
  });
}

async function handleDrawCredit(args: Args) {
  const rateBps = args.rateBps != null ? requireNumber(args.rateBps, 'rateBps') : undefined;
  return sdk.agent.requestCredit({
    ownerPubkey: requireString(args.ownerPubkey, 'ownerPubkey'),
    ownerSignature: requireString(args.ownerSignature, 'ownerSignature'),
    amount:  requireNumber(args.amount, 'amount'),
    rateBps,
  });
}

async function handleRepay(args: Args) {
  return sdk.agent.repay({
    amount:        requireNumber(args.amount, 'amount'),
    callerAddress: typeof args.callerAddress === 'string' ? args.callerAddress : undefined,
  });
}

async function handleGetScore(args: Args) {
  const includeEligibility = args.includeEligibility !== false; // default true
  const [score, eligibility] = await Promise.all([
    sdk.credit.getScore(),
    includeEligibility ? sdk.credit.checkEligibility().catch(() => null) : Promise.resolve(null),
  ]);
  return { score, eligibility };
}

// --- New handlers (v2.0) ---

async function handlePrice(args: Args) {
  const token = requireString(args.token, 'token');
  return apiGet(`/solana/trading/price/${encodeURIComponent(token)}`);
}

async function handlePositions() {
  return sdk.agent.portfolio();
}

async function handleLimitOrder(args: Args) {
  return apiPost(`/solana/trading/${agentAddr}/limit-order`, {
    fromToken: requireString(args.fromToken, 'fromToken'),
    toToken: requireString(args.toToken, 'toToken'),
    amount: requireNumber(args.amount, 'amount'),
    targetPrice: requireNumber(args.targetPrice, 'targetPrice'),
    expiry: typeof args.expiry === 'string' ? args.expiry : '24h',
  });
}

async function handleCancelOrder(args: Args) {
  return apiPost(`/solana/trading/${agentAddr}/cancel-order`, {
    orderId: requireString(args.orderId, 'orderId'),
  });
}

async function handleLpAdd(args: Args) {
  return apiPost(`/solana/trading/${agentAddr}/lp/add`, {
    pool: requireString(args.pool, 'pool'),
    amount: requireNumber(args.amount, 'amount'),
    protocol: typeof args.protocol === 'string' ? args.protocol : 'auto',
    rangePercent: typeof args.rangePercent === 'number' ? requireNumber(args.rangePercent, 'rangePercent') : 10,
  });
}

async function handleLpRemove(args: Args) {
  return apiPost(`/solana/trading/${agentAddr}/lp/remove`, {
    positionId: requireString(args.positionId, 'positionId'),
    percentage: typeof args.percentage === 'number' ? requireNumber(args.percentage, 'percentage') : 100,
  });
}

async function handleLpPositions() {
  return apiGet(`/solana/trading/${agentAddr}/lp/positions`);
}

async function handleLpPools(args: Args) {
  const params = new URLSearchParams();
  if (typeof args.token === 'string') params.set('token', args.token);
  if (typeof args.protocol === 'string') params.set('protocol', args.protocol);
  if (typeof args.minApy === 'number') params.set('minApy', String(requireNumber(args.minApy, 'minApy')));
  if (typeof args.limit === 'number') params.set('limit', String(requireNumber(args.limit, 'limit')));
  const qs = params.toString();
  return apiGet(`/solana/trading/pools${qs ? `?${qs}` : ''}`);
}

async function handleHistory(args: Args) {
  const params = new URLSearchParams();
  if (typeof args.limit === 'number') params.set('limit', String(requireNumber(args.limit, 'limit')));
  if (typeof args.type === 'string' && args.type !== 'all') params.set('type', args.type);
  const qs = params.toString();
  return apiGet(`/solana/wallets/${agentAddr}/trades${qs ? `?${qs}` : ''}`);
}

async function handleVaultDeposit(args: Args) {
  return sdk.agent.deposit({
    amount: requireNumber(args.amount, 'amount'),
    ownerAddress: agentAddr,
  });
}

async function handleVaultStats() {
  return apiGet('/solana/vault/stats');
}

// ---------------------------------------------------------------------------
// MCP Server wiring
// ---------------------------------------------------------------------------

const server = new Server(
  { name: 'krexa-mcp', version: '2.0.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

// BUG-063: audit logging
function auditLog(tool: string, args: Args, status: 'ok' | 'error', detail?: string) {
  const s = { ...args }; if ('paymentId' in s) s.paymentId = '***';
  process.stderr.write(JSON.stringify({ ts: new Date().toISOString(), tool, args: s, agent: sdk.agentAddress ?? 'unknown', status, ...(detail ? { detail } : {}) }) + '\n');
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: rawArgs } = request.params;
  const args: Args = (rawArgs as Args) ?? {};

  try {
    let result: unknown;

    switch (name) {
      case 'krexa_register_agent': result = await handleRegisterAgent(args); break;
      case 'krexa_check_balance': result = await handleCheckBalance(args); break;
      case 'krexa_pay':           result = await handlePay(args);          break;
      case 'krexa_trade':         result = await handleTrade(args);        break;
      case 'krexa_swap':          result = await handleSwap(args);          break;
      case 'krexa_quote':         result = await handleQuote(args);         break;
      case 'krexa_portfolio':     result = await handlePortfolio();         break;
      case 'krexa_yield_scan':    result = await handleYieldScan(args);     break;
      case 'krexa_draw_credit':   result = await handleDrawCredit(args);   break;
      case 'krexa_repay':         result = await handleRepay(args);        break;
      case 'krexa_get_score':     result = await handleGetScore(args);     break;
      case 'krexa_price':         result = await handlePrice(args);        break;
      case 'krexa_positions':     result = await handlePositions();        break;
      case 'krexa_limit_order':   result = await handleLimitOrder(args);   break;
      case 'krexa_cancel_order':  result = await handleCancelOrder(args);  break;
      case 'krexa_lp_add':        result = await handleLpAdd(args);        break;
      case 'krexa_lp_remove':     result = await handleLpRemove(args);     break;
      case 'krexa_lp_positions':  result = await handleLpPositions();      break;
      case 'krexa_lp_pools':      result = await handleLpPools(args);      break;
      case 'krexa_history':       result = await handleHistory(args);      break;
      case 'krexa_vault_deposit': result = await handleVaultDeposit(args); break;
      case 'krexa_vault_stats':   result = await handleVaultStats();       break;
      default:
        auditLog(name, args, 'error', 'unknown tool');
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }

    auditLog(name, args, 'ok');
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    const message =
      err instanceof KrexaError
        ? `Krexa API error ${err.status}: ${err.message}`
        : err instanceof Error
        ? err.message
        : String(err);
    auditLog(name, args, 'error', message);

    return {
      content: [{ type: 'text', text: message }],
      isError: true,
    };
  }
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // MCP servers communicate only via stdio; no console.log to stdout
  process.stderr.write('Krexa Unified MCP server running — 22 tools (stdio)\n');
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err}\n`);
  process.exit(1);
});
