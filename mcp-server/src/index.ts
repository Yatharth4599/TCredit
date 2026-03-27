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

// ---------------------------------------------------------------------------
// MCP Server wiring
// ---------------------------------------------------------------------------

const server = new Server(
  { name: 'krexa-mcp', version: '0.1.0' },
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
      case 'krexa_draw_credit':   result = await handleDrawCredit(args);   break;
      case 'krexa_repay':         result = await handleRepay(args);        break;
      case 'krexa_get_score':     result = await handleGetScore(args);     break;
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
  process.stderr.write('Krexa MCP server running (stdio)\n');
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err}\n`);
  process.exit(1);
});
