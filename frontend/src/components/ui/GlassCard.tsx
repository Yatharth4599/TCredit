import type { ReactNode } from 'react'
import styles from './GlassCard.module.css'

interface GlassCardProps {
  children: ReactNode
  className?: string
  variant?: 'default' | 'interactive' | 'highlight'
  onClick?: () => void
}

export function GlassCard({ children, className = '', variant = 'default', onClick }: GlassCardProps) {
  return (
    <div
      className={`${styles.card} ${styles[variant]} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  )
}
