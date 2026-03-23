import { useQuery } from '@tanstack/react-query'
import { useConnection } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { KrexaClient } from '../sdk'
import { config } from '../config'

export interface ScorePreview {
  score: number
  breakdown: Record<string, number>
  note: string
}

export interface ScoreLookupResult {
  profile: Awaited<ReturnType<KrexaClient['agent']['getProfile']>>
  score: Awaited<ReturnType<KrexaClient['score']['getScore']>>
  health: Awaited<ReturnType<KrexaClient['agent']['getHealth']>> | null
  wallet: Awaited<ReturnType<KrexaClient['agent']['getWallet']>> | null
  // Preview data from backend API when no on-chain score exists
  preview?: ScorePreview | null
  isRegistered?: boolean
  source?: 'on-chain' | 'preview'
}

export function useScoreLookup(address: string | null) {
  const { connection } = useConnection()

  return useQuery({
    queryKey: ['score-lookup', address],
    queryFn: async (): Promise<ScoreLookupResult | null> => {
      if (!address) return null
      const pubkey = new PublicKey(address)
      const client = new KrexaClient({ connection })

      const [profile, score, health, wallet] = await Promise.all([
        client.agent.getProfile(pubkey),
        client.score.getScore(pubkey),
        client.agent.getHealth(pubkey).catch(() => null),
        client.agent.getWallet(pubkey).catch(() => null),
      ])

      // If on-chain score exists, return it directly
      if (score) {
        return { profile, score, health, wallet, source: 'on-chain' }
      }

      // No on-chain score — fetch preview from backend API
      try {
        const resp = await fetch(`${config.apiUrl}/api/v1/solana/score/${address}`)
        if (resp.ok) {
          const data = await resp.json()
          if (data.source === 'preview') {
            return {
              profile,
              score: null,
              health,
              wallet,
              source: 'preview',
              preview: data.preview,
              isRegistered: data.isRegistered,
            }
          }
        }
      } catch {
        // Backend unavailable — just show not found
      }

      return { profile, score: null, health, wallet, source: 'preview', preview: null }
    },
    enabled: !!address && address.length >= 32,
    staleTime: 30_000,
    retry: 1,
  })
}
