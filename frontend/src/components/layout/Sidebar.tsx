import { NavLink } from 'react-router-dom'
import { useState } from 'react'
import {
  Home, Layers, PieChart, Store, Settings,
  ChevronLeft, ChevronRight, Zap
} from 'lucide-react'
import styles from './Sidebar.module.css'

const navItems = [
  { path: '/app', icon: Home, label: 'Home' },
  { path: '/app/vaults', icon: Layers, label: 'Vaults' },
  { path: '/app/portfolio', icon: PieChart, label: 'Portfolio' },
  { path: '/app/merchant', icon: Store, label: 'Merchant' },
  { path: '/settings', icon: Settings, label: 'Settings' },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
      <div className={styles.logo}>
        <Zap size={22} className={styles.logoIcon} />
        {!collapsed && <span>Krexa</span>}
      </div>

      <nav className={styles.nav}>
        {navItems.map(({ path, icon: Icon, label }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/app'}
            className={({ isActive }) =>
              `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
            }
          >
            <Icon size={18} className={styles.navIcon} />
            {!collapsed && <span className={styles.navLabel}>{label}</span>}
          </NavLink>
        ))}
      </nav>

      <button
        className={styles.collapseBtn}
        onClick={() => setCollapsed((c) => !c)}
        aria-label="Toggle sidebar"
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </aside>
  )
}
