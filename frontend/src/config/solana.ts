import { clusterApiUrl } from '@solana/web3.js'

export const SOLANA_NETWORK = 'devnet' as const
export const DEVNET_ENDPOINT = import.meta.env.VITE_SOLANA_RPC || clusterApiUrl('devnet')

// Solscan helpers
const SOLSCAN_BASE = 'https://solscan.io'
const CLUSTER_PARAM = `?cluster=${SOLANA_NETWORK}`

export const txUrl = (sig: string) => `${SOLSCAN_BASE}/tx/${sig}${CLUSTER_PARAM}`
export const accountUrl = (address: string) => `${SOLSCAN_BASE}/account/${address}${CLUSTER_PARAM}`

// Krexa Program IDs (deployed on devnet)
export const PROGRAM_IDS = {
  agentRegistry:  'ChJjAXy7sE4d4jst9VViG7ScanVKqH9Q1cFxtdcH78cG',
  creditVault:    '26SQx3rAyujWCupxvPAMf9N3ok4cw1awyTWAVWDQfr9N',
  agentWallet:    '35t8yWLsUZNTLT71ej7DF59P81HrtZTx2uZeMhwuhhf6',
  venueWhitelist: 'HyWQrHG14Sw6KpKYSMiBDmVj5u7PXfLWvim6FHbBLmua',
  paymentRouter:  '2Zy3d7C28Z9dfazdysKVBQUXnvvWNshxtDEFKftG83u8',
  servicePlan:    'Eqc48c6TtKAPRosTMoC6Nasi85iqdLuzwbu6WBrsPFdt',
  score:          '2GwtAXnjY5LehfZfT77ZH3XSshwbni8LP9zXeA84WUqh',
} as const
