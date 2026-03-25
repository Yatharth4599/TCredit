import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { Keypair } from '@solana/web3.js'
import toast from 'react-hot-toast'
import { buildRegisterAgent } from '../sdk/transactions'
import { explorerTxUrl } from '../components/shared/TransactionToast'

interface RegisterAgentParams {
  name: string
  agentType: number // 0=Trader, 1=Service, 2=Hybrid
}

export function useRegisterAgent() {
  const { connection } = useConnection()
  const { publicKey, sendTransaction } = useWallet()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ name, agentType }: RegisterAgentParams) => {
      if (!publicKey || !sendTransaction) throw new Error('Wallet not connected')

      // Generate agent keypair client-side
      const agentKeypair = Keypair.generate()

      // Store in sessionStorage (cleared when the tab closes — not persisted to disk).
      // WARNING: this is acceptable for devnet. For mainnet, replace with a proper
      // encrypted keystore or hardware wallet derived key.
      sessionStorage.setItem(
        `krexa_agent_${publicKey.toBase58()}`,
        JSON.stringify(Array.from(agentKeypair.secretKey))
      )

      const tx = buildRegisterAgent(agentKeypair.publicKey, publicKey, name, agentType)

      // The agent keypair needs to sign too
      tx.feePayer = publicKey
      const { blockhash } = await connection.getLatestBlockhash()
      tx.recentBlockhash = blockhash
      tx.partialSign(agentKeypair)

      const sig = await sendTransaction(tx, connection)
      await connection.confirmTransaction(sig, 'confirmed')

      return {
        signature: sig,
        agentPubkey: agentKeypair.publicKey.toBase58(),
      }
    },
    onSuccess: (data) => {
      toast.success(
        `Agent registered! ${data.agentPubkey.slice(0, 8)}...`,
        { duration: 5000 }
      )
      queryClient.invalidateQueries({ queryKey: ['agent-profile'] })
    },
    onError: (err: Error) => {
      toast.error(`Registration failed: ${err.message}`)
    },
  })
}
