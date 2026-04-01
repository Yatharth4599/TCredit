import { useQuery } from '@tanstack/react-query'
import { useWallet } from '@solana/wallet-adapter-react'
import { config } from '../config'

export interface CreditRequestEntry {
  id: string
  amount: string
  creditLevel: number
  status: 'pending' | 'approved' | 'rejected' | 'expired'
  reason: string | null
  txSignature: string | null
  requestedAt: string
  resolvedAt: string | null
}

export interface CreditRequestsResult {
  agentPubkey: string
  requests: CreditRequestEntry[]
  total: number
  page: number
  limit: number
}

export function useCreditRequests(agentPubkey?: string) {
  const { publicKey } = useWallet()
  const key = agentPubkey || publicKey?.toBase58()

  return useQuery({
    queryKey: ['credit-requests', key],
    queryFn: async (): Promise<CreditRequestsResult | null> => {
      if (!key) return null
      const res = await fetch(`${config.apiUrl}/api/v1/solana/credit/${key}/requests?limit=20`)
      if (!res.ok) return null
      return res.json()
    },
    enabled: !!key,
    staleTime: 30_000,
    retry: 1,
  })
}
