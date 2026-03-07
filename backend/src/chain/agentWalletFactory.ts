import { publicClient } from './client.js';
import { encodeFunctionData } from 'viem';
import type { Address } from 'viem';

const AgentWalletFactoryABI = [
  {
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'ownerToWallet',
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getAllWallets',
    outputs: [{ type: 'address[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalWallets',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'operator', type: 'address' },
      { name: 'dailyLimit', type: 'uint256' },
      { name: 'perTxLimit', type: 'uint256' },
    ],
    name: 'createWallet',
    outputs: [{ type: 'address' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

// Minimal AgentWallet ABI for setLimits, setOperator, setWhitelist, freeze, unfreeze, transfer
const AgentWalletABI = [
  {
    inputs: [{ name: 'newDailyLimit', type: 'uint256' }, { name: 'newPerTxLimit', type: 'uint256' }],
    name: 'setLimits',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'newOperator', type: 'address' }],
    name: 'setOperator',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'recipient', type: 'address' }, { name: 'allowed', type: 'bool' }],
    name: 'setWhitelist',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'freeze',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'unfreeze',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'vault', type: 'address' }],
    name: 'linkCreditVault',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
    name: 'transfer',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'to', type: 'address' }],
    name: 'emergencyWithdraw',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'enabled', type: 'bool' }],
    name: 'toggleWhitelist',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

export async function getWalletByOwner(factoryAddr: Address, owner: Address) {
  const wallet = await publicClient.readContract({
    address: factoryAddr,
    abi: AgentWalletFactoryABI,
    functionName: 'ownerToWallet',
    args: [owner],
  });
  return wallet as Address;
}

export async function getAllWallets(factoryAddr: Address) {
  const wallets = await publicClient.readContract({
    address: factoryAddr,
    abi: AgentWalletFactoryABI,
    functionName: 'getAllWallets',
  });
  return wallets as Address[];
}

export function encodeCreateWallet(
  factoryAddr: Address,
  operator: Address,
  dailyLimit: bigint,
  perTxLimit: bigint,
) {
  const data = encodeFunctionData({
    abi: AgentWalletFactoryABI,
    functionName: 'createWallet',
    args: [operator, dailyLimit, perTxLimit],
  });
  return { to: factoryAddr, data };
}

export function encodeSetLimits(walletAddr: Address, dailyLimit: bigint, perTxLimit: bigint) {
  return {
    to: walletAddr,
    data: encodeFunctionData({ abi: AgentWalletABI, functionName: 'setLimits', args: [dailyLimit, perTxLimit] }),
  };
}

export function encodeSetOperator(walletAddr: Address, operator: Address) {
  return {
    to: walletAddr,
    data: encodeFunctionData({ abi: AgentWalletABI, functionName: 'setOperator', args: [operator] }),
  };
}

export function encodeSetWhitelist(walletAddr: Address, recipient: Address, allowed: boolean) {
  return {
    to: walletAddr,
    data: encodeFunctionData({ abi: AgentWalletABI, functionName: 'setWhitelist', args: [recipient, allowed] }),
  };
}

export function encodeFreeze(walletAddr: Address) {
  return {
    to: walletAddr,
    data: encodeFunctionData({ abi: AgentWalletABI, functionName: 'freeze' }),
  };
}

export function encodeUnfreeze(walletAddr: Address) {
  return {
    to: walletAddr,
    data: encodeFunctionData({ abi: AgentWalletABI, functionName: 'unfreeze' }),
  };
}

export function encodeLinkCreditVault(walletAddr: Address, vault: Address) {
  return {
    to: walletAddr,
    data: encodeFunctionData({ abi: AgentWalletABI, functionName: 'linkCreditVault', args: [vault] }),
  };
}

export function encodeTransfer(walletAddr: Address, to: Address, amount: bigint) {
  return {
    to: walletAddr,
    data: encodeFunctionData({ abi: AgentWalletABI, functionName: 'transfer', args: [to, amount] }),
  };
}

export function encodeEmergencyWithdraw(walletAddr: Address, to: Address) {
  return {
    to: walletAddr,
    data: encodeFunctionData({ abi: AgentWalletABI, functionName: 'emergencyWithdraw', args: [to] }),
  };
}

export function encodeToggleWhitelist(walletAddr: Address, enabled: boolean) {
  return {
    to: walletAddr,
    data: encodeFunctionData({ abi: AgentWalletABI, functionName: 'toggleWhitelist', args: [enabled] }),
  };
}
