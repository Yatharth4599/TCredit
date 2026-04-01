import { clusterApiUrl } from '@solana/web3.js'

if (import.meta.env.PROD && !import.meta.env.VITE_RPC_URL) {
  throw new Error('[config] VITE_RPC_URL is required in production. Set it in your deployment environment.')
}
if (import.meta.env.PROD && !import.meta.env.VITE_API_URL) {
  throw new Error('[config] VITE_API_URL is required in production. Set it in your deployment environment.')
}

const rpcEndpoint = import.meta.env.VITE_RPC_URL || clusterApiUrl('devnet')

/** Detect cluster from the RPC URL */
export function getCluster(): 'mainnet-beta' | 'devnet' | 'testnet' | 'custom' {
  if (rpcEndpoint.includes('mainnet')) return 'mainnet-beta'
  if (rpcEndpoint.includes('testnet')) return 'testnet'
  if (rpcEndpoint.includes('devnet')) return 'devnet'
  return 'custom'
}

export const config = {
  rpcEndpoint,
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  cluster: getCluster(),
  adminWallets: (import.meta.env.VITE_ADMIN_WALLETS || '').split(',').filter(Boolean),
  refreshIntervals: {
    health: 10_000,      // 10s
    positions: 30_000,   // 30s
    vault: 60_000,       // 1min
    score: 120_000,      // 2min
  },
} as const
