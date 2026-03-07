import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getBalance, executePayment } from '../client.js';

export function registerPaymentTools(server: McpServer) {
  // krexa_check_balance — check USDC balance of an address
  server.tool(
    'krexa_check_balance',
    'Check the USDC balance of any address on Base Sepolia',
    { address: z.string().describe('Wallet address (0x...)') },
    async ({ address }) => {
      const data = await getBalance(address);
      return {
        content: [{
          type: 'text' as const,
          text: `Balance for ${data.address}: ${data.balanceUsdc} USDC`,
        }],
      };
    },
  );

  // krexa_pay — execute a payment through the Krexa PaymentRouter
  server.tool(
    'krexa_pay',
    'Execute a USDC payment through Krexa PaymentRouter (oracle-signed)',
    {
      from: z.string().describe('Sender address'),
      to: z.string().describe('Recipient address'),
      amount: z.string().describe('Amount in USDC (e.g. "10.50")'),
    },
    async ({ from, to, amount }) => {
      const result = await executePayment({ from, to, amount });
      return {
        content: [{
          type: 'text' as const,
          text: [
            `Payment ${result.status}`,
            result.txHash ? `TX: ${result.txHash}` : '',
            `Payment ID: ${result.paymentId}`,
          ].filter(Boolean).join('\n'),
        }],
      };
    },
  );
}
