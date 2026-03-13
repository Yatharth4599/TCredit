import type { UnsignedTx, TxConfig } from './types.js';

/**
 * Convert an API unsigned transaction response to a viem-compatible tx config.
 */
export function toTxConfig(unsignedTx: UnsignedTx): TxConfig {
  return {
    to: unsignedTx.to as `0x${string}`,
    data: unsignedTx.data as `0x${string}`,
  };
}

/**
 * Send an unsigned transaction via a viem WalletClient.
 * Returns the transaction hash.
 *
 * @example
 * ```ts
 * import { createKrexaClient, sendTx } from '@krexa/sdk';
 * import { createWalletClient, http } from 'viem';
 * import { baseSepolia } from 'viem/chains';
 *
 * const client = createKrexaClient({ baseUrl: 'http://localhost:3001' });
 * const wallet = createWalletClient({ chain: baseSepolia, transport: http() });
 *
 * const unsignedTx = await client.investments.invest(vaultAddress, amount);
 * const txHash = await sendTx(wallet, account, unsignedTx);
 * ```
 */
export async function sendTx(
  walletClient: {
    sendTransaction: (args: {
      account: `0x${string}`;
      to: `0x${string}`;
      data: `0x${string}`;
      chain?: unknown;
    }) => Promise<`0x${string}`>;
    chain?: unknown;
  },
  account: `0x${string}`,
  unsignedTx: UnsignedTx,
): Promise<`0x${string}`> {
  const config = toTxConfig(unsignedTx);
  return walletClient.sendTransaction({
    account,
    to: config.to,
    data: config.data,
    chain: walletClient.chain,
  });
}

/**
 * Wait for a transaction to be confirmed using a viem PublicClient.
 *
 * @example
 * ```ts
 * const receipt = await waitForTx(publicClient, txHash);
 * console.log('Confirmed in block', receipt.blockNumber);
 * ```
 */
export async function waitForTx(
  publicClient: {
    waitForTransactionReceipt: (args: { hash: `0x${string}` }) => Promise<{
      blockNumber: bigint;
      status: 'success' | 'reverted';
      transactionHash: `0x${string}`;
    }>;
  },
  txHash: `0x${string}`,
) {
  return publicClient.waitForTransactionReceipt({ hash: txHash });
}
