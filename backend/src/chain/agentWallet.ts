import { publicClient } from './client.js';
import type { Address } from 'viem';

const AgentWalletABI = [
  { inputs: [], name: 'owner', outputs: [{ type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'operator', outputs: [{ type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'dailyLimit', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'perTxLimit', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'spentToday', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'frozen', outputs: [{ type: 'bool' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'whitelistEnabled', outputs: [{ type: 'bool' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'creditVault', outputs: [{ type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'getRemainingDaily', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
] as const;

export async function getWalletState(walletAddr: Address) {
  const [owner, operator, dailyLimit, perTxLimit, spentToday, frozen, whitelistEnabled, creditVault, remainingDaily] =
    await Promise.all([
      publicClient.readContract({ address: walletAddr, abi: AgentWalletABI, functionName: 'owner' }),
      publicClient.readContract({ address: walletAddr, abi: AgentWalletABI, functionName: 'operator' }),
      publicClient.readContract({ address: walletAddr, abi: AgentWalletABI, functionName: 'dailyLimit' }),
      publicClient.readContract({ address: walletAddr, abi: AgentWalletABI, functionName: 'perTxLimit' }),
      publicClient.readContract({ address: walletAddr, abi: AgentWalletABI, functionName: 'spentToday' }),
      publicClient.readContract({ address: walletAddr, abi: AgentWalletABI, functionName: 'frozen' }),
      publicClient.readContract({ address: walletAddr, abi: AgentWalletABI, functionName: 'whitelistEnabled' }),
      publicClient.readContract({ address: walletAddr, abi: AgentWalletABI, functionName: 'creditVault' }),
      publicClient.readContract({ address: walletAddr, abi: AgentWalletABI, functionName: 'getRemainingDaily' }),
    ]);

  return {
    owner: owner as string,
    operator: operator as string,
    dailyLimit: (dailyLimit as bigint).toString(),
    perTxLimit: (perTxLimit as bigint).toString(),
    spentToday: (spentToday as bigint).toString(),
    frozen: frozen as boolean,
    whitelistEnabled: whitelistEnabled as boolean,
    creditVault: creditVault as string,
    remainingDaily: (remainingDaily as bigint).toString(),
  };
}
