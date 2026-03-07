import { publicClient } from './client.js';
import { erc20Abi, parseAbiItem } from 'viem';
import type { Address } from 'viem';
import { env } from '../config/env.js';

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

export async function getWalletBalance(walletAddr: Address) {
  const usdcAddress = env.USDC_ADDRESS as Address;
  const balance = await publicClient.readContract({
    address: usdcAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [walletAddr],
  });
  return (balance as bigint).toString();
}

const PaymentExecutedEvent = parseAbiItem(
  'event PaymentExecuted(address indexed to, uint256 amount)'
);

export async function getTransferHistory(walletAddr: Address) {
  const latestBlock = await publicClient.getBlockNumber();
  const fromBlock = latestBlock > 50000n ? latestBlock - 50000n : 0n;

  const logs = await publicClient.getLogs({
    address: walletAddr,
    event: PaymentExecutedEvent,
    fromBlock,
    toBlock: 'latest',
  });

  return logs.map((log) => ({
    to: log.args.to as string,
    amount: (log.args.amount as bigint).toString(),
    blockNumber: log.blockNumber.toString(),
    txHash: log.transactionHash,
  }));
}
