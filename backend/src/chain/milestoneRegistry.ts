import type { Address } from 'viem';
import { publicClient } from './client.js';
import { MilestoneRegistryABI, addresses } from '../config/contracts.js';

const contract = {
  address: addresses.milestoneRegistry,
  abi: MilestoneRegistryABI,
} as const;

export async function getMilestone(vault: Address, trancheIndex: bigint) {
  return publicClient.readContract({
    ...contract,
    functionName: 'getMilestone',
    args: [vault, trancheIndex],
  });
}

export async function isMilestoneApproved(vault: Address, trancheIndex: bigint) {
  return publicClient.readContract({
    ...contract,
    functionName: 'isMilestoneApproved',
    args: [vault, trancheIndex],
  });
}
