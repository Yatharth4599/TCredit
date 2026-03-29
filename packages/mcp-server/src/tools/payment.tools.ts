import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getBalance, executePayment } from '../client.js';

export function registerPaymentTools(server: McpServer) {
  // BUG-105: Strict address/amount validators
  const evmAddress = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid EVM address (must be 0x + 40 hex chars)');
  const usdcAmount = z.string().regex(/^\d+(\.\d+)?$/, 'Invalid amount (must be a positive decimal string, e.g. "10.50")');

  // krexa_check_balance — check USDC balance of an address
  server.tool(
    'krexa_check_balance',
    'Check the USDC balance of any address on Base Sepolia',
    { address: evmAddress.describe('Wallet address (0x...)') },
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
      from: evmAddress.describe('Sender address (0x...)'),
      to: evmAddress.describe('Recipient address (0x...)'),
      amount: usdcAmount.describe('Amount in USDC (e.g. "10.50")'),
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
