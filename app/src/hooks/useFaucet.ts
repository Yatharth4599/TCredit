import { useMutation } from '@tanstack/react-query'
import { useWallet } from '@solana/wallet-adapter-react'
import { config } from '../config'

export function useFaucet() {
  const { publicKey } = useWallet()

  return useMutation({
    mutationFn: async (amountUsdc = 10) => {
      if (!publicKey) throw new Error('Wallet not connected')
      const resp = await fetch(`${config.apiUrl}/api/v1/solana/faucet/usdc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: publicKey.toBase58(), amountUsdc }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.message || 'Faucet request failed')
      return data as { signature: string; ata: string; amountUsdc: number; explorerUrl: string }
    },
  })
}
