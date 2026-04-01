import { useState } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { cn } from '../../lib/utils'

const NAV_LINKS = [
  { to: '/score', label: 'Score' },
  { to: '/vault', label: 'Vault' },
  { to: '/docs', label: 'Docs' },
]

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 bg-[#08080d]/80 backdrop-blur border-b border-white/[0.06]">
      <div className="max-w-7xl mx-auto flex items-center justify-between h-16 px-6">
        {/* Logo */}
        <Link to="/" className="text-lg font-bold tracking-tight">
          <span className="text-white">Krexa</span>
          <span className="text-blue-400 ml-1">Protocol</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => cn(
                'text-sm transition-colors',
                isActive ? 'text-white' : 'text-white/40 hover:text-white/70'
              )}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden md:block">
          <Link
            to="/dashboard"
            className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors"
          >
            Launch App
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-white/60 hover:text-white"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-white/[0.06] bg-[#08080d]/95 backdrop-blur px-6 py-4 space-y-3">
          {NAV_LINKS.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) => cn(
                'block text-sm py-2 transition-colors',
                isActive ? 'text-white' : 'text-white/40 hover:text-white/70'
              )}
            >
              {link.label}
            </NavLink>
          ))}
          <Link
            to="/dashboard"
            onClick={() => setMobileOpen(false)}
            className="block text-center mt-2 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors"
          >
            Launch App
          </Link>
        </div>
      )}
    </header>
  )
}
