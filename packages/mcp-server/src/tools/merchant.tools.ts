import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getMerchantStats, getSettlement } from '../client.js';

export function registerMerchantTools(server: McpServer) {
  // krexa_revenue_summary — combined stats + settlement overview
  server.tool(
    'krexa_revenue_summary',
    'Get a revenue summary for an agent including credit stats and settlement data',
    { address: z.string().describe('Agent/merchant wallet address') },
    async ({ address }) => {
      const [stats, settlement] = await Promise.allSettled([
        getMerchantStats(address),
        getSettlement(address),
      ]);

      const lines: string[] = [];

      if (stats.status === 'fulfilled') {
        const s = stats.value;
        lines.push(
          '=== Credit Stats ===',
          `Credit Score: ${s.creditScore}/1000 (Tier ${s.creditTier})`,
          `Total Borrowed: ${s.totalBorrowed} USDC`,
          `Total Repaid: ${s.totalRepaid} USDC`,
          `Vaults: ${s.vaultCount}`,
        );
      } else {
        lines.push(`Credit stats unavailable: ${stats.reason}`);
      }

      lines.push('');

      if (settlement.status === 'fulfilled') {
        const st = settlement.value;
        lines.push(
          '=== Settlement ===',
          `Active: ${st.active ? 'Yes' : 'No'}`,
          `Vault: ${st.vault}`,
          `Repayment Rate: ${(st.repaymentRateBps / 100).toFixed(1)}%`,
          `Total Routed: ${st.totalRouted} USDC`,
          `Payments: ${st.totalPayments}`,
          st.lastPaymentAt ? `Last Payment: ${st.lastPaymentAt}` : 'No payments yet',
        );
      } else {
        lines.push('Settlement data unavailable (no active settlement).');
      }

      return {
        content: [{ type: 'text' as const, text: lines.join('\n') }],
      };
    },
  );

  // krexa_create_invoice — stub for future invoice generation
  server.tool(
    'krexa_create_invoice',
    'Create a payment invoice for a customer (stub — returns payment link format)',
    {
      merchantAddress: z.string().describe('Merchant wallet address'),
      amount: z.string().describe('Invoice amount in USDC'),
      description: z.string().optional().describe('Invoice description'),
    },
    async ({ merchantAddress, amount, description }) => {
      return {
        content: [{
          type: 'text' as const,
          text: [
            'Invoice created (stub):',
            `  Merchant: ${merchantAddress}`,
            `  Amount: ${amount} USDC`,
            description ? `  Description: ${description}` : '',
            '',
            'Note: Full invoice system coming in a future release.',
            'For now, use krexa_pay to process direct payments.',
          ].filter(Boolean).join('\n'),
        }],
      };
    },
  );
}
