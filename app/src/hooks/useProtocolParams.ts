import { useQuery } from '@tanstack/react-query'
import { config } from '../config'

export interface ProtocolLevel {
  name: string
  maxUsdc: number
  maxDisplay: string
  rateBps: number
  rateDisplay: string
  minScore: number
  minKyaTier: number
}

export interface ProtocolTranche {
  aprBps: number
  aprDisplay: string
  risk: string
  description: string
  protocolOnly: boolean
}

export interface ProtocolParams {
  levels: Record<string, ProtocolLevel>
  tranches: Record<string, ProtocolTranche>
}

// Fallback ensures UI renders immediately without a loading flash
const FALLBACK_PARAMS: ProtocolParams = {
  levels: {
    '1': { name: 'Starter',     maxUsdc: 500,     maxDisplay: '$500',     rateBps: 3650, rateDisplay: '36.5%', minScore: 400, minKyaTier: 1 },
    '2': { name: 'Established', maxUsdc: 20_000,  maxDisplay: '$20,000',  rateBps: 2920, rateDisplay: '29.2%', minScore: 500, minKyaTier: 2 },
    '3': { name: 'Trusted',     maxUsdc: 50_000,  maxDisplay: '$50,000',  rateBps: 2190, rateDisplay: '21.9%', minScore: 650, minKyaTier: 2 },
    '4': { name: 'Elite',       maxUsdc: 500_000, maxDisplay: '$500,000', rateBps: 1825, rateDisplay: '18.25%', minScore: 750, minKyaTier: 3 },
  },
  tranches: {
    senior:    { aprBps: 1000, aprDisplay: '10%', risk: 'low',    description: 'Lowest risk — first priority on yields and repayments', protocolOnly: false },
    mezzanine: { aprBps: 1200, aprDisplay: '12%', risk: 'medium', description: 'Medium risk — absorbs losses after junior buffer is depleted', protocolOnly: false },
    junior:    { aprBps: 2000, aprDisplay: '20%', risk: 'high',   description: 'Highest yield — protocol-managed reserve, not available for external deposits', protocolOnly: true },
  },
}

export function useProtocolParams() {
  return useQuery({
    queryKey: ['protocol-params'],
    queryFn: async (): Promise<ProtocolParams> => {
      const res = await fetch(`${config.apiUrl}/api/v1/solana/credit/protocol-params`)
      if (!res.ok) return FALLBACK_PARAMS
      return res.json()
    },
    staleTime: 5 * 60_000, // 5 min — protocol constants change only on upgrade
    retry: 1,
    placeholderData: FALLBACK_PARAMS,
  })
}
