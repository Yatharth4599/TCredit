import { create } from 'zustand'
import { useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { agentApi, kyaApi } from '../api/solanaClient'
import type { OnChainAgent } from '../api/solanaTypes'

interface AgentState {
  agentData: OnChainAgent | null
  isRegistered: boolean
  kyaTier: number | undefined
  loading: boolean
  error: string | null
  fetch: (ownerPubkey: string) => Promise<void>
  clear: () => void
}

export const useAgentStore = create<AgentState>((set) => ({
  agentData: null,
  isRegistered: false,
  kyaTier: undefined,
  loading: false,
  error: null,

  fetch: async (ownerPubkey: string) => {
    set({ loading: true, error: null })
    try {
      const res = await agentApi.getWallet(ownerPubkey)
      const onChain: OnChainAgent = res.data.onChain ?? res.data
      const agentPubkey = onChain.agent ?? ownerPubkey

      // Fetch KYA tier from the KYA status endpoint
      let kyaTier: number | undefined
      try {
        const kyaRes = await kyaApi.getStatus(agentPubkey)
        kyaTier = kyaRes.data.onChainTier
      } catch {
        // KYA endpoint may fail — leave as undefined so downstream doesn't assume tier 0
        kyaTier = undefined
      }

      set({ agentData: onChain, isRegistered: true, kyaTier, loading: false })
    } catch (err) {
      // 404 = not registered, not an error
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 404) {
        set({ agentData: null, isRegistered: false, kyaTier: undefined, loading: false, error: null })
      } else {
        const msg = err instanceof Error ? err.message : 'Failed to fetch agent'
        set({ agentData: null, isRegistered: false, kyaTier: undefined, loading: false, error: msg })
      }
    }
  },

  clear: () => set({ agentData: null, isRegistered: false, kyaTier: undefined, loading: false, error: null }),
}))

export function useAgent() {
  const { publicKey, connected } = useWallet()
  const { agentData, isRegistered, kyaTier, loading, error, fetch, clear } = useAgentStore()

  useEffect(() => {
    if (connected && publicKey) {
      fetch(publicKey.toBase58())
    } else {
      clear()
    }
  }, [connected, publicKey, fetch, clear])

  return {
    isConnected: connected,
    isRegistered,
    agentPubkey: agentData?.agent ?? null,
    agentData,
    kyaTier, // Fetched from KYA status endpoint; undefined if unavailable
    loading,
    error,
    refetch: () => publicKey ? fetch(publicKey.toBase58()) : Promise.resolve(),
  }
}
