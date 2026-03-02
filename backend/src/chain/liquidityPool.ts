import type { Address } from 'viem';
import { publicClient } from './client.js';
import { LiquidityPoolABI } from '../config/contracts.js';

export async function getTotalDeposits(poolAddr: Address) {
  return publicClient.readContract({
    address: poolAddr,
    abi: LiquidityPoolABI,
    functionName: 'totalDeposits',
  });
}

export async function getAvailableBalance(poolAddr: Address) {
  return publicClient.readContract({
    address: poolAddr,
    abi: LiquidityPoolABI,
    functionName: 'availableBalance',
  });
}

export async function getAllocation(poolAddr: Address, vaultAddr: Address) {
  return publicClient.readContract({
    address: poolAddr,
    abi: LiquidityPoolABI,
    functionName: 'allocations',
    args: [vaultAddr],
  });
}
