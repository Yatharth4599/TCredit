import type { Address } from 'viem';
import { publicClient } from './client.js';
import { PaymentRouterABI, addresses } from '../config/contracts.js';

const contract = {
  address: addresses.paymentRouter,
  abi: PaymentRouterABI,
} as const;

export async function getSettlement(agent: Address) {
  return publicClient.readContract({
    ...contract,
    functionName: 'getSettlement',
    args: [agent],
  });
}

export async function isNonceUsed(sender: Address, nonce: bigint) {
  return publicClient.readContract({
    ...contract,
    functionName: 'isNonceUsed',
    args: [sender, nonce],
  });
}
