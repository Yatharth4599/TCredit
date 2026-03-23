import { useQuery } from '@tanstack/react-query'
import { useWallet } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { useKrexa } from './useKrexa'
import { config } from '../config'

export function useAgentWallet(agentPubkey?: string) {
  const { publicKey } = useWallet()
  const client = useKrexa()

  const key = agentPubkey || publicKey?.toBase58()

  return useQuery({
    queryKey: ['agent-wallet', key],
    queryFn: async () => {
      if (!key) return null
      return client.agent.getWallet(new PublicKey(key))
    },
    enabled: !!key,
    refetchInterval: config.refreshIntervals.positions,
  })
}
