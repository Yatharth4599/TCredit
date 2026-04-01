import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { Keypair } from '@solana/web3.js'
import BN from 'bn.js'
import toast from 'react-hot-toast'
import { buildCreateWallet } from '../sdk/transactions'
import { explorerTxUrl } from '../components/shared/TransactionToast'
import { loadAgentKeypair } from '../utils/agentKeystore'

interface CreateWalletParams {
  dailySpendLimit: number // in USDC (e.g. 1000 = $1,000)
}

export function useCreateWallet() {
  const { connection } = useConnection()
  const { publicKey, sendTransaction } = useWallet()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ dailySpendLimit }: CreateWalletParams) => {
      if (!publicKey || !sendTransaction) throw new Error('Wallet not connected')

      // Load agent keypair from encrypted localStorage (falls back to legacy sessionStorage)
      const secretKey = await loadAgentKeypair(publicKey.toBase58())
      if (!secretKey) throw new Error('No agent keypair found. Register an agent first.')

      const agentKeypair = Keypair.fromSecretKey(secretKey)
      const limitLamports = new BN(dailySpendLimit).mul(new BN(1_000_000)) // USDC 6 decimals

      const tx = buildCreateWallet(agentKeypair.publicKey, publicKey, limitLamports)

      tx.feePayer = publicKey
      const { blockhash } = await connection.getLatestBlockhash()
      tx.recentBlockhash = blockhash
      tx.partialSign(agentKeypair)

      const sig = await sendTransaction(tx, connection)
      await connection.confirmTransaction(sig, 'confirmed')

      return { signature: sig }
    },
    onSuccess: ({ signature }) => {
      toast.success(`Wallet created! View: ${explorerTxUrl(signature)}`, { duration: 6000 })
      queryClient.invalidateQueries({ queryKey: ['agent-wallet'] })
      queryClient.invalidateQueries({ queryKey: ['agent-profile'] })
    },
    onError: (err: Error) => {
      toast.error(`Wallet creation failed: ${err.message}`)
    },
  })
}
