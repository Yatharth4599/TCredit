import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import BN from 'bn.js'
import toast from 'react-hot-toast'
import { buildDepositCollateral, USDC_MINT, getAssociatedTokenAddress } from '../sdk/transactions'
import { explorerTxUrl } from '../components/shared/TransactionToast'

interface DepositCollateralParams {
  agentPubkey: string
  amount: number // USDC
}

export function useDepositCollateral() {
  const { connection } = useConnection()
  const { publicKey, sendTransaction } = useWallet()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ agentPubkey, amount }: DepositCollateralParams) => {
      if (!publicKey || !sendTransaction) throw new Error('Wallet not connected')

      const agent = new PublicKey(agentPubkey)
      const amountLamports = new BN(Math.round(amount * 1_000_000))
      const ownerUsdc = getAssociatedTokenAddress(USDC_MINT, publicKey)

      const tx = buildDepositCollateral(agent, publicKey, ownerUsdc, amountLamports)
      tx.feePayer = publicKey
      const { blockhash } = await connection.getLatestBlockhash()
      tx.recentBlockhash = blockhash

      const sig = await sendTransaction(tx, connection)
      await connection.confirmTransaction(sig, 'confirmed')
      return { signature: sig }
    },
    onSuccess: ({ signature }) => {
      toast.success(`Collateral deposited! View: ${explorerTxUrl(signature)}`, { duration: 6000 })
      queryClient.invalidateQueries({ queryKey: ['agent-health'] })
      queryClient.invalidateQueries({ queryKey: ['agent-wallet'] })
    },
    onError: (err: Error) => {
      toast.error(`Deposit failed: ${err.message}`)
    },
  })
}
