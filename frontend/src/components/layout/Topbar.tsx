import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { Bell, Search } from 'lucide-react'
import styles from './Topbar.module.css'

interface TopbarProps {
  title?: string
}

export default function Topbar({ title }: TopbarProps) {
  useWallet() // used for wallet state side-effects via context

  return (
    <header className={styles.topbar}>
      {title && <h1 className={styles.pageTitle}>{title}</h1>}

      <div className={styles.searchBox}>
        <Search size={14} className={styles.searchIcon} />
        <input
          type="text"
          placeholder="Search vaults, merchants..."
          className={styles.searchInput}
        />
      </div>

      <div className={styles.right}>
        <div className={styles.networkBadge}>
          <span className={styles.networkDot} />
          Solana Devnet
        </div>

        <button className={styles.iconBtn} aria-label="Notifications">
          <Bell size={16} />
        </button>

        <WalletMultiButton className={styles.walletBtn} />
      </div>
    </header>
  )
}
