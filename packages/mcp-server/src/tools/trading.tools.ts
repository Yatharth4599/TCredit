import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { executeSwap, getSwapQuote, getPortfolio, scanYields } from '../client.js';

export function registerTradingTools(server: McpServer) {
  // krexa_swap — execute a token swap via Jupiter
  server.tool(
    'krexa_swap',
    'Execute a token swap via Jupiter aggregator (best route across all Solana DEXs). Returns unsigned transaction.',
    {
      agentAddress: z.string().describe('Agent wallet public key'),
      from: z.string().describe('Source token symbol or mint (e.g. "USDC")'),
      to: z.string().describe('Destination token symbol or mint (e.g. "SOL")'),
      amount: z.number().describe('Amount in human units (e.g. 50 for 50 USDC)'),
      slippageBps: z.number().optional().describe('Slippage tolerance in bps (default 50)'),
      ownerAddress: z.string().describe('Public key that will sign the transaction'),
    },
    async ({ agentAddress, from, to, amount, slippageBps, ownerAddress }) => {
      const data = await executeSwap(agentAddress, { from, to, amount, slippageBps, ownerAddress });
      return {
        content: [{
          type: 'text' as const,
          text: [
            `Swap Transaction Built:`,
            `  ${data.description}`,
            `  Transaction (base64): ${(data.transaction as string).slice(0, 60)}...`,
            `  Encoding: ${data.encoding}`,
            ``,
            `Sign and submit this transaction to execute the swap.`,
          ].join('\n'),
        }],
      };
    },
  );

  // krexa_quote — get swap quote without executing
  server.tool(
    'krexa_quote',
    'Get a swap quote without executing. Preview best route, output amount, and price impact.',
    {
      agentAddress: z.string().describe('Agent wallet public key'),
      from: z.string().describe('Source token symbol or mint'),
      to: z.string().describe('Destination token symbol or mint'),
      amount: z.number().describe('Amount in human units'),
      slippageBps: z.number().optional().describe('Slippage tolerance in bps (default 50)'),
    },
    async ({ agentAddress, from, to, amount, slippageBps }) => {
      const data = await getSwapQuote(agentAddress, { from, to, amount, slippageBps });
      return {
        content: [{
          type: 'text' as const,
          text: [
            `Swap Quote:`,
            `  From: ${data.from.amount} ${data.from.symbol}`,
            `  To: ${data.to.amount} ${data.to.symbol}`,
            `  Price Impact: ${data.priceImpactPct}%`,
            `  Slippage: ${data.slippageBps} bps`,
          ].join('\n'),
        }],
      };
    },
  );

  // krexa_portfolio — get token portfolio with USD values
  server.tool(
    'krexa_portfolio',
    'Get the agent\'s full token portfolio with USD values — all balances, prices, and total value.',
    {
      agentAddress: z.string().describe('Agent wallet public key'),
    },
    async ({ agentAddress }) => {
      const data = await getPortfolio(agentAddress);
      const lines = [`Portfolio for ${data.agentPubkey}:`, ``];
      for (const t of data.tokens) {
        lines.push(`  ${t.symbol}: ${t.balance} ($${t.balanceUsd})`);
      }
      lines.push(``, `Total Value: $${data.totalValueUsd}`);
      return {
        content: [{ type: 'text' as const, text: lines.join('\n') }],
      };
    },
  );

  // krexa_yield_scan — find best yield opportunities
  server.tool(
    'krexa_yield_scan',
    'Scan for top yield opportunities on Solana — DeFi protocols sorted by APY.',
    {
      limit: z.number().optional().describe('Number of results (default 20)'),
      minTvl: z.number().optional().describe('Minimum TVL in USD'),
      token: z.string().optional().describe('Filter by token symbol'),
    },
    async ({ limit, minTvl, token }) => {
      const data = await scanYields({ limit, minTvl, token });
      const lines = [`Top Yield Opportunities (${data.count} results):`, ``];
      for (const y of data.opportunities) {
        lines.push(`  ${y.protocol} — ${y.pool}: ${y.apy}% APY ($${(y.tvlUsd / 1e6).toFixed(1)}M TVL)`);
      }
      return {
        content: [{ type: 'text' as const, text: lines.join('\n') }],
      };
    },
  );
}
