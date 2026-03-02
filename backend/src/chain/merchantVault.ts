import type { Address } from 'viem';
import { publicClient } from './client.js';
import { MerchantVaultABI } from '../config/contracts.js';

export async function getState(vaultAddr: Address) {
  return publicClient.readContract({
    address: vaultAddr,
    abi: MerchantVaultABI,
    functionName: 'state',
  });
}

export async function totalRaised(vaultAddr: Address) {
  return publicClient.readContract({
    address: vaultAddr,
    abi: MerchantVaultABI,
    functionName: 'totalRaised',
  });
}

export async function totalRepaid(vaultAddr: Address) {
  return publicClient.readContract({
    address: vaultAddr,
    abi: MerchantVaultABI,
    functionName: 'totalRepaid',
  });
}

export async function totalToRepay(vaultAddr: Address) {
  return publicClient.readContract({
    address: vaultAddr,
    abi: MerchantVaultABI,
    functionName: 'totalToRepay',
  });
}

export async function calculateLateFee(vaultAddr: Address) {
  return publicClient.readContract({
    address: vaultAddr,
    abi: MerchantVaultABI,
    functionName: 'calculateLateFee',
  });
}

export async function shouldDefault(vaultAddr: Address) {
  return publicClient.readContract({
    address: vaultAddr,
    abi: MerchantVaultABI,
    functionName: 'shouldDefault',
  });
}

export async function nextPaymentDue(vaultAddr: Address) {
  return publicClient.readContract({
    address: vaultAddr,
    abi: MerchantVaultABI,
    functionName: 'nextPaymentDue',
  });
}
