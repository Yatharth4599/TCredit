import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import BN from 'bn.js'
import toast from 'react-hot-toast'
import { buildDepositLP, USDC_MINT, getAssociatedTokenAddress } from '../sdk/transactions'

interface DepositLPParams {
  amount: number // USDC
  tranche: number // 0=Senior, 1=Mezzanine, 2=Junior
}

export function useDepositLP() {
  const { connection } = useConnection()
  const { publicKey, sendTransaction } = useWallet()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ amount, tranche }: DepositLPParams) => {
      if (!publicKey || !sendTransaction) throw new Error('Wallet not connected')

      const amountLamports = new BN(Math.round(amount * 1_000_000))
      const depositorUsdc = getAssociatedTokenAddress(USDC_MINT, publicKey)

      const tx = buildDepositLP(publicKey, depositorUsdc, amountLamports, tranche)
      tx.feePayer = publicKey
      const { blockhash } = await connection.getLatestBlockhash()
      tx.recentBlockhash = blockhash

      const sig = await sendTransaction(tx, connection)
      await connection.confirmTransaction(sig, 'confirmed')
      return { signature: sig }
    },
    onSuccess: () => {
      toast.success('LP deposit successful!')
      queryClient.invalidateQueries({ queryKey: ['lp-positions'] })
      queryClient.invalidateQueries({ queryKey: ['vault-stats'] })
    },
    onError: (err: Error) => {
      toast.error(`LP deposit failed: ${err.message}`)
    },
  })
}
