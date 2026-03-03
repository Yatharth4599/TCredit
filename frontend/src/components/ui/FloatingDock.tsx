import React, { useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import css from './FloatingDock.module.css'

export interface DockItem {
  title: string
  icon: React.ReactNode
  href: string
  onClick?: () => void
  mono?: boolean
}

interface FloatingDockProps {
  items: DockItem[]
}

function DockIcon({ item, isActive }: { item: DockItem; isActive: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = React.useState(false)

  const handleClick = (e: React.MouseEvent) => {
    if (item.onClick) {
      e.preventDefault()
      item.onClick()
    }
  }

  return (
    <a
      href={item.href}
      onClick={handleClick}
      className={`${css.dockItem} ${isActive ? css.active : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <AnimatePresence>
        {hovered && (
          <motion.div
            className={`${css.tooltip} ${item.mono ? css.tooltipMono : ''}`}
            initial={{ opacity: 0, y: 6, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.9 }}
            transition={{ duration: 0.12 }}
          >
            {item.title}
          </motion.div>
        )}
      </AnimatePresence>
      <motion.div
        ref={ref}
        className={css.iconWrapper}
        animate={{ scale: hovered ? 1.3 : 1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 22 }}
      >
        {item.icon}
      </motion.div>
      {isActive && <span className={css.activeDot} />}
    </a>
  )
}

export default function FloatingDock({ items }: FloatingDockProps) {
  const location = useLocation()

  const isActiveHref = (href: string) => {
    if (href === '/') return location.pathname === '/'
    if (href.startsWith('http')) return false
    return location.pathname.startsWith(href)
  }

  return (
    <div className={css.dock}>
      {items.map((item) => (
        <DockIcon key={item.title} item={item} isActive={isActiveHref(item.href)} />
      ))}
    </div>
  )
}
