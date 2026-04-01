import { useQuery } from '@tanstack/react-query'
import { useWallet } from '@solana/wallet-adapter-react'
import { config } from '../config'

export interface ScoreHistoryEntry {
  score: number
  level: number
  timestamp: string
}

export interface HealthHistoryEntry {
  healthFactorBps: number
  creditDrawn: string
  totalDebt: string
  timestamp: string
}

export interface TradeEntry {
  venue: string
  amount: string
  direction: string
  txSignature: string
  timestamp: string
}

export interface CreditActivity {
  agentPubkey: string
  scoreHistory: ScoreHistoryEntry[]
  healthHistory: HealthHistoryEntry[]
  recentTrades: TradeEntry[]
}

export function useCreditActivity(agentPubkey?: string) {
  const { publicKey } = useWallet()
  const key = agentPubkey || publicKey?.toBase58()

  return useQuery({
    queryKey: ['credit-activity', key],
    queryFn: async (): Promise<CreditActivity | null> => {
      if (!key) return null
      const res = await fetch(`${config.apiUrl}/api/v1/solana/credit/${key}/activity?limit=20`)
      if (!res.ok) return null
      return res.json()
    },
    enabled: !!key,
    staleTime: 60_000,
    retry: 1,
  })
}
