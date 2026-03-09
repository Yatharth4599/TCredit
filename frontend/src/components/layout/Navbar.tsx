import { useNavigate } from 'react-router-dom'
import { useAccount, useDisconnect } from 'wagmi'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import FloatingDock, { DockItem } from '../ui/FloatingDock'
import { truncateAddress } from '../../lib/format'

export default function Navbar() {
  const navigate = useNavigate()
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const { openConnectModal } = useConnectModal()

  const items: DockItem[] = [
    {
      title: 'Home',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
      href: '/',
      onClick: () => navigate('/'),
    },
    {
      title: 'Vaults',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="2" y="4" width="20" height="16" rx="2" /><circle cx="12" cy="12" r="3" /><line x1="12" y1="9" x2="12" y2="7" /><line x1="12" y1="17" x2="12" y2="15" /><line x1="9" y1="12" x2="7" y2="12" /><line x1="17" y1="12" x2="15" y2="12" /><rect x="18" y="8" width="2" height="3" rx="0.5" />
        </svg>
      ),
      href: '/vaults',
      onClick: () => navigate('/vaults'),
    },
    {
      title: 'Pools',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
        </svg>
      ),
      href: '/pools',
      onClick: () => navigate('/pools'),
    },
    {
      title: 'Portfolio',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M2 20h20M6 20V10M10 20V4M14 20V8M18 20V14" />
        </svg>
      ),
      href: '/portfolio',
      onClick: () => navigate('/portfolio'),
    },
    {
      title: 'Merchant',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 01-8 0" />
        </svg>
      ),
      href: '/merchant',
      onClick: () => navigate('/merchant'),
    },
    {
      title: 'Wallets',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M3 7V5a2 2 0 012-2h12a2 2 0 012 2v2" /><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M2 11h6a2 2 0 012 2v0a2 2 0 01-2 2H2" /><circle cx="7" cy="13" r="0.5" fill="currentColor" />
        </svg>
      ),
      href: '/app/wallets',
      onClick: () => navigate('/app/wallets'),
    },
    {
      title: 'Identity',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 10a3 3 0 100-6 3 3 0 000 6z" /><path d="M2 21a10 10 0 0120 0" /><path d="M12 14v4" /><path d="M8 18h8" />
        </svg>
      ),
      href: '/app/identity',
      onClick: () => navigate('/app/identity'),
    },
    {
      title: 'Gateway',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M2 20h20M6 20V10M10 20V4M14 20V8M18 20V14" />
        </svg>
      ),
      href: '/app/gateway',
      onClick: () => navigate('/app/gateway'),
    },
    {
      title: 'Kickstart',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4.5 16.5c-1.5 1.38-3 2.5-3 2.5s3.12 1 6.5 0c3.38-1 6-3.5 8-6.5 2-3 3-6 3-6s-2.5 1-4.5 2.5M12 15l-3-3M9.5 2L11 5.5M2 9.5L5.5 11M15 21.5L13 18" />
        </svg>
      ),
      href: '/app/kickstart',
      onClick: () => navigate('/app/kickstart'),
    },
    {
      title: 'x402 Demo',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      ),
      href: '/x402',
      onClick: () => navigate('/x402'),
    },
    {
      title: 'Twitter / X',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
      href: 'https://x.com/tigerbnkHQ',
    },
    {
      title: 'GitHub',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
        </svg>
      ),
      href: 'https://github.com/Yatharth4599/TCredit',
    },
    {
      title: 'Telegram',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
        </svg>
      ),
      href: 'https://t.me/tigerpayx',
    },
    {
      title: isConnected ? truncateAddress(address!, 4) : 'Connect Wallet',
      mono: isConnected,
      icon: isConnected ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="1.8">
          <path d="M3 7V5a2 2 0 012-2h12a2 2 0 012 2v2" /><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M2 11h6a2 2 0 012 2v0a2 2 0 01-2 2H2" /><circle cx="7" cy="13" r="1" fill="var(--color-success)" />
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M3 7V5a2 2 0 012-2h12a2 2 0 012 2v2" /><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M2 11h6a2 2 0 012 2v0a2 2 0 01-2 2H2" /><circle cx="7" cy="13" r="0.5" fill="currentColor" />
        </svg>
      ),
      href: '#',
      onClick: () => {
        if (isConnected) {
          disconnect()
        } else {
          openConnectModal?.()
        }
      },
    },
  ]

  return (
    <nav style={{ position: 'fixed', top: '16px', left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 100, pointerEvents: 'none' }}>
      <div style={{ pointerEvents: 'all' }}>
        <FloatingDock items={items} />
      </div>
    </nav>
  )
}
