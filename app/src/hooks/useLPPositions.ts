import { useQuery } from '@tanstack/react-query'
import { useWallet } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { useKrexa } from './useKrexa'
import { config } from '../config'
import { Tranche } from '@krexa/solana-sdk'

export function useLPPositions(ownerPubkey?: string) {
  const { publicKey } = useWallet()
  const client = useKrexa()

  const key = ownerPubkey || publicKey?.toBase58()

  return useQuery({
    queryKey: ['lp-positions', key],
    queryFn: async () => {
      if (!key) return null
      return client.lp.getAllPositions(new PublicKey(key))
    },
    enabled: !!key,
    refetchInterval: config.refreshIntervals.positions,
  })
}

export function useLPPosition(ownerPubkey: string | undefined, tranche: Tranche) {
  const client = useKrexa()

  return useQuery({
    queryKey: ['lp-position', ownerPubkey, tranche],
    queryFn: async () => {
      if (!ownerPubkey) return null
      return client.lp.getPosition(new PublicKey(ownerPubkey), tranche)
    },
    enabled: !!ownerPubkey,
    refetchInterval: config.refreshIntervals.positions,
  })
}
