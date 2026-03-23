import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import BN from 'bn.js'
import toast from 'react-hot-toast'
import { buildRepay, USDC_MINT, getAssociatedTokenAddress } from '../sdk/transactions'

interface RepayParams {
  agentPubkey: string
  amount: number // USDC
}

export function useRepay() {
  const { connection } = useConnection()
  const { publicKey, sendTransaction } = useWallet()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ agentPubkey, amount }: RepayParams) => {
      if (!publicKey || !sendTransaction) throw new Error('Wallet not connected')

      const agent = new PublicKey(agentPubkey)
      const amountLamports = new BN(Math.round(amount * 1_000_000))
      const callerUsdc = getAssociatedTokenAddress(USDC_MINT, publicKey)

      const tx = buildRepay(agent, publicKey, callerUsdc, amountLamports)
      tx.feePayer = publicKey
      const { blockhash } = await connection.getLatestBlockhash()
      tx.recentBlockhash = blockhash

      const sig = await sendTransaction(tx, connection)
      await connection.confirmTransaction(sig, 'confirmed')
      return { signature: sig }
    },
    onSuccess: () => {
      toast.success('Repayment successful!')
      queryClient.invalidateQueries({ queryKey: ['credit-line'] })
      queryClient.invalidateQueries({ queryKey: ['agent-wallet'] })
      queryClient.invalidateQueries({ queryKey: ['agent-health'] })
    },
    onError: (err: Error) => {
      toast.error(`Repayment failed: ${err.message}`)
    },
  })
}
