import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { env } from '../config/env.js';

export const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(env.BASE_RPC_URL),
});
