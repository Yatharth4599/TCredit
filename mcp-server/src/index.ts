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
import type { Chain } from '@krexa/sdk';

// ---------------------------------------------------------------------------
// SDK initialisation
// ---------------------------------------------------------------------------

const sdk = new KrexaSDK({
  apiKey:       process.env.KREXA_API_KEY,
  baseUrl:      process.env.KREXA_BASE_URL,
  chain:        (process.env.KREXA_CHAIN ?? 'solana') as Chain,
  agentAddress: process.env.KREXA_AGENT_ADDRESS,
});

// ---------------------------------------------------------------------------
// REST API helpers (for tools that call backend directly)
// ---------------------------------------------------------------------------

const API_URL = process.env.KREXA_BASE_URL ?? 'https://tcredit-backend.onrender.com/api/v1';
const agentAddress = process.env.KREXA_AGENT_ADDRESS ?? '';

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
        },
      },
      required: ['venue', 'from', 'to', 'amount'],
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
        amount: {
          type: 'number',
          description: 'Amount of USDC to draw from the credit line.',
        },
        rateBps: {
          type: 'number',
          description: 'Interest rate in basis points, e.g. 150 for 1.5%.',
        },
      },
      required: ['amount'],
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
  const ownerAddress = args.ownerAddress as string;
  const agentType = (args.agentType as number | undefined) ?? 0;
  const dailySpendLimitUsdc = args.dailySpendLimitUsdc as number | undefined;
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

async function handlePay(args: Args) {
  const recipient = args.recipient as string;
  const amount    = args.amount as number;
  const paymentId = args.paymentId as string | undefined;
  return sdk.agent.payX402({ recipient, amount, paymentId });
}

async function handleTrade(args: Args) {
  return sdk.agent.trade({
    venue:  args.venue  as string,
    from:   args.from   as string,
    to:     args.to     as string,
    amount: args.amount as number,
  });
}

async function handleSwap(args: Args) {
  return sdk.agent.swap({
    from:         args.from         as string,
    to:           args.to           as string,
    amount:       args.amount       as number,
    slippageBps:  args.slippageBps  as number | undefined,
    ownerAddress: args.ownerAddress as string,
  });
}

async function handleQuote(args: Args) {
  return sdk.agent.quote({
    from:        args.from        as string,
    to:          args.to          as string,
    amount:      args.amount      as number,
    slippageBps: args.slippageBps as number | undefined,
  });
}

async function handlePortfolio() {
  return sdk.agent.portfolio();
}

async function handleYieldScan(args: Args) {
  return sdk.agent.yieldScan({
    limit:  args.limit  as number | undefined,
    minTvl: args.minTvl as number | undefined,
    token:  args.token  as string | undefined,
  });
}

async function handleDrawCredit(args: Args) {
  return sdk.agent.requestCredit({
    amount:   args.amount   as number,
    rateBps:  args.rateBps  as number | undefined,
  });
}

async function handleRepay(args: Args) {
  return sdk.agent.repay({
    amount:        args.amount        as number,
    callerAddress: args.callerAddress as string | undefined,
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
  const token = args.token as string;
  return apiGet(`/solana/trading/price/${encodeURIComponent(token)}`);
}

async function handlePositions() {
  return sdk.agent.portfolio();
}

async function handleLimitOrder(args: Args) {
  return apiPost(`/solana/trading/${agentAddress}/limit-order`, {
    fromToken: args.fromToken as string,
    toToken: args.toToken as string,
    amount: args.amount as number,
    targetPrice: args.targetPrice as number,
    expiry: (args.expiry as string) ?? '24h',
  });
}

async function handleCancelOrder(args: Args) {
  return apiPost(`/solana/trading/${agentAddress}/cancel-order`, {
    orderId: args.orderId as string,
  });
}

async function handleLpAdd(args: Args) {
  return apiPost(`/solana/trading/${agentAddress}/lp/add`, {
    pool: args.pool as string,
    amount: args.amount as number,
    protocol: (args.protocol as string) ?? 'auto',
    rangePercent: (args.rangePercent as number) ?? 10,
  });
}

async function handleLpRemove(args: Args) {
  return apiPost(`/solana/trading/${agentAddress}/lp/remove`, {
    positionId: args.positionId as string,
    percentage: (args.percentage as number) ?? 100,
  });
}

async function handleLpPositions() {
  return apiGet(`/solana/trading/${agentAddress}/lp/positions`);
}

async function handleLpPools(args: Args) {
  const params = new URLSearchParams();
  if (args.token) params.set('token', args.token as string);
  if (args.protocol) params.set('protocol', args.protocol as string);
  if (args.minApy) params.set('minApy', String(args.minApy));
  if (args.limit) params.set('limit', String(args.limit));
  const qs = params.toString();
  return apiGet(`/solana/trading/pools${qs ? `?${qs}` : ''}`);
}

async function handleHistory(args: Args) {
  const params = new URLSearchParams();
  if (args.limit) params.set('limit', String(args.limit));
  if (args.type && args.type !== 'all') params.set('type', args.type as string);
  const qs = params.toString();
  return apiGet(`/solana/wallets/${agentAddress}/history${qs ? `?${qs}` : ''}`);
}

async function handleVaultDeposit(args: Args) {
  return sdk.agent.deposit({
    amount: args.amount as number,
    ownerAddress: agentAddress,
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
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }

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
