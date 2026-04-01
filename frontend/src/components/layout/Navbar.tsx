import { useNavigate, useLocation } from 'react-router-dom'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import styles from './Navbar.module.css'

const NAV_ITEMS = [
  { label: 'HOME', href: '/app' },
  { label: 'CREDIT', href: '/app/solana/credit' },
  { label: 'SCORE', href: '/app/solana/score' },
  { label: 'LP', href: '/app/solana/lp' },
  { label: 'MY AGENTS', href: '/app/my-agents' },
]

export default function Navbar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { publicKey } = useWallet()

  const isActive = (href: string) => {
    if (href === '/app') return pathname === '/app'
    return pathname.startsWith(href)
  }

  const truncate = (key: string) =>
    key.length > 8 ? `${key.slice(0, 4)}...${key.slice(-4)}` : key

  return (
    <nav className={styles.nav}>
      <div className={styles.navInner}>
        <button className={styles.brand} onClick={() => navigate('/app')}>
          <img src="/images/krexa-logo-mark.png" alt="Krexa" className={styles.logo} />
        </button>

        <div className={styles.links}>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.href}
              className={`${styles.link} ${isActive(item.href) ? styles.active : ''}`}
              onClick={() => navigate(item.href)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <WalletMultiButton className={styles.walletBtn}>
          {publicKey ? truncate(publicKey.toBase58()) : 'CONNECT'}
        </WalletMultiButton>
      </div>
    </nav>
  )
}
