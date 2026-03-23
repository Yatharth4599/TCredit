import { clusterApiUrl } from '@solana/web3.js'

export const config = {
  rpcEndpoint: import.meta.env.VITE_RPC_URL || clusterApiUrl('devnet'),
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  adminWallets: (import.meta.env.VITE_ADMIN_WALLETS || '').split(',').filter(Boolean),
  refreshIntervals: {
    health: 10_000,      // 10s
    positions: 30_000,   // 30s
    vault: 60_000,       // 1min
    score: 120_000,      // 2min
  },
} as const
