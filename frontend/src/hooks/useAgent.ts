import { create } from 'zustand'
import { useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { agentApi } from '../api/solanaClient'
import type { OnChainAgent } from '../api/solanaTypes'

interface AgentState {
  agentData: OnChainAgent | null
  isRegistered: boolean
  loading: boolean
  error: string | null
  fetch: (ownerPubkey: string) => Promise<void>
  clear: () => void
}

export const useAgentStore = create<AgentState>((set) => ({
  agentData: null,
  isRegistered: false,
  loading: false,
  error: null,

  fetch: async (ownerPubkey: string) => {
    set({ loading: true, error: null })
    try {
      const res = await agentApi.getWallet(ownerPubkey)
      const onChain: OnChainAgent = res.data.onChain ?? res.data
      set({ agentData: onChain, isRegistered: true, loading: false })
    } catch (err) {
      // 404 = not registered, not an error
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 404) {
        set({ agentData: null, isRegistered: false, loading: false, error: null })
      } else {
        const msg = err instanceof Error ? err.message : 'Failed to fetch agent'
        set({ agentData: null, isRegistered: false, loading: false, error: msg })
      }
    }
  },

  clear: () => set({ agentData: null, isRegistered: false, loading: false, error: null }),
}))

export function useAgent() {
  const { publicKey, connected } = useWallet()
  const { agentData, isRegistered, loading, error, fetch, clear } = useAgentStore()

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
    kyaTier: 0, // Will be fetched from KYA endpoint when needed
    loading,
    error,
    refetch: () => publicKey ? fetch(publicKey.toBase58()) : Promise.resolve(),
  }
}
