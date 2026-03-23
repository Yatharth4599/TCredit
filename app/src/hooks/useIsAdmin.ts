import { useWallet } from '@solana/wallet-adapter-react'
import { config } from '../config'

export function useIsAdmin(): boolean {
  const { publicKey } = useWallet()
  if (!publicKey) return false
  return config.adminWallets.includes(publicKey.toBase58())
}
