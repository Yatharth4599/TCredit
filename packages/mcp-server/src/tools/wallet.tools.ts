import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getWalletStatus, buildWalletTransfer, buildWalletDeposit } from '../client.js';

export function registerWalletTools(server: McpServer) {
  // krexa_wallet_status — check wallet state (balance, limits, remaining, frozen)
  server.tool(
    'krexa_wallet_status',
    'Check the status of a Krexa agent wallet (balance, limits, remaining daily, frozen state)',
    { address: z.string().describe('Agent wallet contract address') },
    async ({ address }) => {
      const data = await getWalletStatus(address);
      return {
        content: [{
          type: 'text' as const,
          text: [
            `Agent Wallet: ${data.address}`,
            `Balance: ${data.balanceUsdc} USDC`,
            `Owner: ${data.owner}`,
            `Operator: ${data.operator}`,
            `Daily Limit: ${data.dailyLimit} USDC`,
            `Per-Tx Limit: ${data.perTxLimit} USDC`,
            `Spent Today: ${data.spentToday} USDC`,
            `Remaining Daily: ${data.remainingDaily} USDC`,
            `Frozen: ${data.frozen ? 'Yes' : 'No'}`,
            `Whitelist: ${data.whitelistEnabled ? 'Enabled' : 'Disabled'}`,
            `Credit Vault: ${data.creditVault === '0x0000000000000000000000000000000000000000' ? 'None' : data.creditVault}`,
          ].join('\n'),
        }],
      };
    },
  );

  // krexa_wallet_transfer — build unsigned transfer tx
  server.tool(
    'krexa_wallet_transfer',
    'Build an unsigned transfer tx for a Krexa agent wallet (operator signs)',
    {
      walletAddress: z.string().describe('Agent wallet contract address'),
      to: z.string().describe('Recipient address'),
      amountUsdc: z.string().describe('Amount in USDC (e.g. "50.00")'),
    },
    async ({ walletAddress, to, amountUsdc }) => {
      const tx = await buildWalletTransfer(walletAddress, to, amountUsdc);
      return {
        content: [{
          type: 'text' as const,
          text: [
            `Unsigned transfer transaction:`,
            `  To contract: ${tx.to}`,
            `  Data: ${tx.data}`,
            `  Description: ${tx.description}`,
            `Sign and submit from the operator wallet.`,
          ].join('\n'),
        }],
      };
    },
  );

  // krexa_wallet_deposit — build unsigned deposit tx
  server.tool(
    'krexa_wallet_deposit',
    'Build an unsigned USDC deposit tx into a Krexa agent wallet',
    {
      walletAddress: z.string().describe('Agent wallet contract address'),
      amountUsdc: z.string().describe('Amount in USDC (e.g. "100.00")'),
    },
    async ({ walletAddress, amountUsdc }) => {
      const tx = await buildWalletDeposit(walletAddress, amountUsdc);
      return {
        content: [{
          type: 'text' as const,
          text: [
            `Unsigned deposit transaction:`,
            `  To contract: ${tx.to}`,
            `  Data: ${tx.data}`,
            `  Description: ${tx.description}`,
            `Sign and submit to deposit USDC into the wallet.`,
            `Note: You may need to approve USDC spending first.`,
          ].join('\n'),
        }],
      };
    },
  );
}
