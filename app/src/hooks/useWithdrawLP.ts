import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import BN from 'bn.js'
import toast from 'react-hot-toast'
import { buildWithdrawLP, USDC_MINT, getAssociatedTokenAddress } from '../sdk/transactions'

interface WithdrawLPParams {
  shares: number // share units (USDC 6 decimal)
  tranche: number
}

export function useWithdrawLP() {
  const { connection } = useConnection()
  const { publicKey, sendTransaction } = useWallet()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ shares, tranche }: WithdrawLPParams) => {
      if (!publicKey || !sendTransaction) throw new Error('Wallet not connected')

      const sharesLamports = new BN(Math.round(shares * 1_000_000))
      const depositorUsdc = getAssociatedTokenAddress(USDC_MINT, publicKey)

      const tx = buildWithdrawLP(publicKey, depositorUsdc, sharesLamports, tranche)
      tx.feePayer = publicKey
      const { blockhash } = await connection.getLatestBlockhash()
      tx.recentBlockhash = blockhash

      const sig = await sendTransaction(tx, connection)
      await connection.confirmTransaction(sig, 'confirmed')
      return { signature: sig }
    },
    onSuccess: () => {
      toast.success('LP withdrawal successful!')
      queryClient.invalidateQueries({ queryKey: ['lp-positions'] })
      queryClient.invalidateQueries({ queryKey: ['vault-stats'] })
    },
    onError: (err: Error) => {
      toast.error(`LP withdrawal failed: ${err.message}`)
    },
  })
}
