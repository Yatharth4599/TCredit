import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getMerchantStats, getMerchantVaults, releaseTranche } from '../client.js';

export function registerCreditTools(server: McpServer) {
  // BUG-105 follow-up: enforce strict EVM address validation in credit tools too
  const evmAddress = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid EVM address (must be 0x + 40 hex chars)');

  // krexa_check_credit — get credit score and tier for an agent
  server.tool(
    'krexa_check_credit',
    'Check the Krexa credit score and tier for an agent address',
    { address: evmAddress.describe('Agent wallet address (0x...)') },
    async ({ address }) => {
      const stats = await getMerchantStats(address);
      return {
        content: [{
          type: 'text' as const,
          text: [
            `Agent: ${stats.agent}`,
            `Credit Score: ${stats.creditScore}/1000`,
            `Tier: ${stats.creditTier}`,
            `Registered: ${stats.isRegistered ? 'Yes' : 'No'}`,
            `Vaults: ${stats.vaultCount}`,
            `Total Borrowed: ${stats.totalBorrowed} USDC`,
            `Total Repaid: ${stats.totalRepaid} USDC`,
          ].join('\n'),
        }],
      };
    },
  );

  // krexa_loan_status — get all vaults/loans for an agent
  server.tool(
    'krexa_loan_status',
    'Get the status of all credit vaults (loans) for an agent',
    { address: evmAddress.describe('Agent wallet address (0x...)') },
    async ({ address }) => {
      const data = await getMerchantVaults(address);
      if (data.vaults.length === 0) {
        return {
          content: [{ type: 'text' as const, text: 'No vaults found for this agent.' }],
        };
      }
      const lines = data.vaults.map((v, i) => [
        `--- Vault ${i + 1}: ${v.address} ---`,
        `  State: ${v.state}`,
        `  Target: ${v.targetAmount} USDC`,
        `  Funded: ${v.totalFunded} USDC`,
        `  Repaid: ${v.totalRepaid} / ${v.totalToRepay} USDC`,
        `  Tranches: ${v.tranchesReleased}/${v.numTranches} released`,
      ].join('\n'));
      return {
        content: [{
          type: 'text' as const,
          text: `Found ${data.total} vault(s):\n\n${lines.join('\n\n')}`,
        }],
      };
    },
  );

  // krexa_draw_credit — release next tranche from a vault
  server.tool(
    'krexa_draw_credit',
    'Release the next tranche from a Krexa credit vault (returns unsigned tx)',
    { vaultAddress: evmAddress.describe('Vault contract address (0x...)') },
    async ({ vaultAddress }) => {
      const tx = await releaseTranche(vaultAddress);
      return {
        content: [{
          type: 'text' as const,
          text: [
            'Unsigned transaction to release next tranche:',
            `  To: ${tx.to}`,
            `  Data: ${tx.data}`,
            'Sign and submit this transaction from the agent wallet.',
          ].join('\n'),
        }],
      };
    },
  );
}
