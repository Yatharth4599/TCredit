import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import styles from './WalletButton.module.css'

export default function WalletButton() {
  const { connected } = useWallet()

  return (
    <div className={styles.wrapper}>
      <WalletMultiButton />
      {connected && <div className={styles.connectedDot} />}
    </div>
  )
}
