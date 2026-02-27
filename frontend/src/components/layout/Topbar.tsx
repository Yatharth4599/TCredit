import { Bell, Search, Wallet } from 'lucide-react'
import styles from './Topbar.module.css'

interface TopbarProps {
  title?: string
}

export default function Topbar({ title }: TopbarProps) {
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
          Base Sepolia
        </div>

        <button className={styles.iconBtn} aria-label="Notifications">
          <Bell size={16} />
        </button>

        <button className={styles.walletBtn}>
          <Wallet size={14} />
          Connect Wallet
        </button>
      </div>
    </header>
  )
}
