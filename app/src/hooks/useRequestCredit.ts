import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { Transaction } from '@solana/web3.js'
import toast from 'react-hot-toast'
import { config } from '../config'

interface RequestCreditParams {
  agentPubkey: string
  amount: number // USDC (e.g. 500 = $500)
  creditLevel?: number
}

export function useRequestCredit() {
  const { connection } = useConnection()
  const { publicKey, sendTransaction } = useWallet()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ agentPubkey, amount, creditLevel }: RequestCreditParams) => {
      if (!publicKey || !sendTransaction) throw new Error('Wallet not connected')

      const amountBaseUnits = Math.round(amount * 1_000_000) // USDC 6 decimals

      // Step 1: Ask the oracle backend to build and partially sign the tx
      const resp = await fetch(`${config.apiUrl}/api/v1/solana/oracle/sign-credit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentPubkey,
          agentOrOwnerPubkey: publicKey.toBase58(),
          amount: String(amountBaseUnits),
          creditLevel,
        }),
      })

      const data = await resp.json()
      if (!resp.ok) {
        throw new Error(data.message || data.error || 'Oracle sign-credit failed')
      }

      // Step 2: Deserialize the oracle-signed transaction and add the wallet signature
      const txBuf = Buffer.from(data.transaction as string, 'base64')
      const tx = Transaction.from(txBuf)

      const sig = await sendTransaction(tx, connection)
      await connection.confirmTransaction(sig, 'confirmed')

      return { signature: sig }
    },
    onSuccess: ({ signature }) => {
      toast.success(`Credit request submitted! Tx: ${signature.slice(0, 8)}…`, { duration: 5000 })
      queryClient.invalidateQueries({ queryKey: ['credit-line'] })
      queryClient.invalidateQueries({ queryKey: ['agent-wallet'] })
      queryClient.invalidateQueries({ queryKey: ['agent-health'] })
    },
    onError: (err: Error) => {
      toast.error(`Credit request failed: ${err.message}`)
    },
  })
}
