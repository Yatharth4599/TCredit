import { useNavigate, useLocation } from 'react-router-dom'
import { useAccount, useDisconnect } from 'wagmi'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { truncateAddress } from '../../lib/format'
import styles from './Navbar.module.css'

const NAV_ITEMS = [
  { label: 'HOME', href: '/app' },
  { label: 'VAULTS', href: '/app/vaults' },
  { label: 'POOLS', href: '/app/pools' },
  { label: 'PORTFOLIO', href: '/app/portfolio' },
  { label: 'IDENTITY', href: '/app/identity' },
  { label: 'MERCHANT', href: '/app/merchant' },
]

export default function Navbar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const { openConnectModal } = useConnectModal()

  const isActive = (href: string) => {
    if (href === '/app') return pathname === '/app'
    return pathname.startsWith(href)
  }

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

        <button
          className={isConnected ? styles.walletConnected : styles.walletBtn}
          onClick={() => isConnected ? disconnect() : openConnectModal?.()}
        >
          {isConnected ? truncateAddress(address!, 4) : 'CONNECT'}
        </button>
      </div>
    </nav>
  )
}
