import { useQuery } from '@tanstack/react-query'
import { useWallet } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { useKrexa } from './useKrexa'
import { config } from '../config'

export function useAgentHealth(agentPubkey?: string) {
  const { publicKey } = useWallet()
  const client = useKrexa()

  const key = agentPubkey || publicKey?.toBase58()

  return useQuery({
    queryKey: ['agent-health', key],
    queryFn: async () => {
      if (!key) return null
      return client.agent.getHealth(new PublicKey(key))
    },
    enabled: !!key,
    refetchInterval: config.refreshIntervals.health,
  })
}
