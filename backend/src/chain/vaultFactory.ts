import type { Address } from 'viem';
import { publicClient } from './client.js';
import { VaultFactoryABI, addresses } from '../config/contracts.js';

const contract = {
  address: addresses.vaultFactory,
  abi: VaultFactoryABI,
} as const;

export async function predictVaultAddress(agent: Address) {
  return publicClient.readContract({
    ...contract,
    functionName: 'predictVaultAddress',
    args: [agent],
  });
}

export async function getAllVaults(): Promise<readonly Address[]> {
  return publicClient.readContract({
    ...contract,
    functionName: 'getAllVaults',
  }) as Promise<readonly Address[]>;
}

export async function getVaultCount() {
  return publicClient.readContract({
    ...contract,
    functionName: 'getVaultCount',
  });
}
