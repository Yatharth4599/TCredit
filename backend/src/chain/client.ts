import { createPublicClient, createWalletClient, http } from 'viem';
import { baseSepolia, base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { env } from '../config/env.js';

export const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(env.BASE_RPC_URL),
});

// Base mainnet client — used for Kickstart (EasyA) interactions
export const publicClientMainnet = createPublicClient({
  chain: base,
  transport: http(env.BASE_MAINNET_RPC_URL),
});

// Oracle signing account — only available when ORACLE_PRIVATE_KEY is set
const oracleKey = env.ORACLE_PRIVATE_KEY?.replace(/^0x/, '');

export const oracleAccount = oracleKey
  ? privateKeyToAccount(`0x${oracleKey}` as `0x${string}`)
  : null;

export const walletClient = oracleAccount
  ? createWalletClient({
      account: oracleAccount,
      chain: baseSepolia,
      transport: http(env.BASE_RPC_URL),
    })
  : null;
