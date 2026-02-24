import React, { useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import css from './FloatingDock.module.css'

export interface DockItem {
  title: string
  icon: React.ReactNode
  href: string
  onClick?: () => void
}

interface FloatingDockProps {
  items: DockItem[]
}

function DockIcon({ item }: { item: DockItem }) {
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
      className={css.dockItem}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <AnimatePresence>
        {hovered && (
          <motion.div
            className={css.tooltip}
            initial={{ opacity: 0, y: 6, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.9 }}
            transition={{ duration: 0.15 }}
          >
            {item.title}
          </motion.div>
        )}
      </AnimatePresence>
      <motion.div
        ref={ref}
        className={css.iconWrapper}
        animate={{ scale: hovered ? 1.4 : 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      >
        {item.icon}
      </motion.div>
    </a>
  )
}

export default function FloatingDock({ items }: FloatingDockProps) {
  return (
    <div className={css.dock}>
      {items.map((item) => (
        <DockIcon key={item.title} item={item} />
      ))}
    </div>
  )
}
