import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { Keypair, PublicKey } from '@solana/web3.js'
import BN from 'bn.js'
import toast from 'react-hot-toast'
import { buildCreateWallet } from '../sdk/transactions'

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

      // Load agent keypair from sessionStorage (written by useRegisterAgent)
      const stored = sessionStorage.getItem(`krexa_agent_${publicKey.toBase58()}`)
      if (!stored) throw new Error('No agent keypair found. Register an agent first.')

      const agentKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(stored)))
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
    onSuccess: () => {
      toast.success('Wallet created!')
      queryClient.invalidateQueries({ queryKey: ['agent-wallet'] })
      queryClient.invalidateQueries({ queryKey: ['agent-profile'] })
    },
    onError: (err: Error) => {
      toast.error(`Wallet creation failed: ${err.message}`)
    },
  })
}
