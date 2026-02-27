import { useNavigate } from 'react-router-dom'
import FloatingDock, { DockItem } from '../ui/FloatingDock'

export default function Navbar() {
  const navigate = useNavigate()

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
      href: 'https://x.com/',
    },
    {
      title: 'GitHub',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
        </svg>
      ),
      href: 'https://github.com/',
    },
    {
      title: 'Connect Wallet',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M3 7V5a2 2 0 012-2h12a2 2 0 012 2v2" /><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M2 11h6a2 2 0 012 2v0a2 2 0 01-2 2H2" /><circle cx="7" cy="13" r="0.5" fill="currentColor" />
        </svg>
      ),
      href: '#',
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

