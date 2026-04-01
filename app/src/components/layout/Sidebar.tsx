import { NavLink, Link } from 'react-router-dom'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { useIsAdmin } from '../../hooks'
import { cn, shortenAddress } from '../../lib/utils'
import {
  LayoutDashboard,
  Wallet,
  TrendingUp,
  Shield,
  Layers,
  Settings,
  Home,
} from 'lucide-react'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/dashboard/wallet', label: 'Wallet', icon: Wallet },
  { to: '/dashboard/credit', label: 'Credit Line', icon: TrendingUp },
  { to: '/dashboard/health', label: 'Health', icon: Shield },
]

const LP_ITEMS = [
  { to: '/dashboard/lp', label: 'LP Positions', icon: Layers },
]

const ADMIN_ITEMS = [
  { to: '/dashboard/admin', label: 'Admin', icon: Settings },
]

function NavItem({ to, label, icon: Icon }: { to: string; label: string; icon: React.ElementType }) {
  return (
    <NavLink
      to={to}
      end={to === '/dashboard'}
      className={({ isActive }) => cn(
        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
        isActive
          ? 'bg-white/[0.08] text-white'
          : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
      )}
    >
      <Icon size={16} />
      {label}
    </NavLink>
  )
}

export function Sidebar() {
  const { publicKey, connected } = useWallet()
  const isAdmin = useIsAdmin()

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-60 border-r border-white/[0.06] bg-[#0a0a0f] flex flex-col">
      {/* Logo */}
      <div className="p-5 border-b border-white/[0.06]">
        <h1 className="text-lg font-bold tracking-tight">
          <span className="text-white">Krexa</span>
          <span className="text-blue-400 ml-1">Protocol</span>
        </h1>
        <p className="text-[10px] text-white/20 mt-0.5">Solana Credit Protocol</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <Link
          to="/"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-colors mb-2"
        >
          <Home size={16} />
          Home
        </Link>
        <div className="mb-2 border-t border-white/[0.04]" />
        <p className="px-3 py-1.5 text-[10px] font-medium text-white/20 uppercase tracking-widest">Agent</p>
        {NAV_ITEMS.map(item => <NavItem key={item.to} {...item} />)}

        <div className="my-3 border-t border-white/[0.04]" />
        <p className="px-3 py-1.5 text-[10px] font-medium text-white/20 uppercase tracking-widest">Liquidity</p>
        {LP_ITEMS.map(item => <NavItem key={item.to} {...item} />)}

        {isAdmin && (
          <>
            <div className="my-3 border-t border-white/[0.04]" />
            <p className="px-3 py-1.5 text-[10px] font-medium text-white/20 uppercase tracking-widest">Admin</p>
            {ADMIN_ITEMS.map(item => <NavItem key={item.to} {...item} />)}
          </>
        )}
      </nav>

      {/* Wallet */}
      <div className="p-3 border-t border-white/[0.06]">
        {connected && publicKey ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03]">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-xs text-white/50 font-mono">{shortenAddress(publicKey.toBase58())}</span>
          </div>
        ) : null}
        <div className="mt-2 [&_button]:!w-full [&_button]:!rounded-lg [&_button]:!bg-white/[0.06] [&_button]:!border-0 [&_button]:!text-xs [&_button]:!h-9">
          <WalletMultiButton />
        </div>
      </div>
    </aside>
  )
}
