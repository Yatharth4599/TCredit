import { useRef, useCallback, type ReactNode, type CSSProperties } from 'react'
import styles from './BentoGrid.module.css'

interface BentoCardProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
  /** Grid column span (e.g. "span 2") */
  colSpan?: string
  /** Grid row span (e.g. "span 2") */
  rowSpan?: string
  /** Custom glow color as r,g,b string */
  glowColor?: string
}

export function BentoCard({
  children,
  className = '',
  style,
  colSpan,
  rowSpan,
  glowColor = '255, 107, 53',
}: BentoCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const el = cardRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const y = ((e.clientY - rect.top) / rect.height) * 100
      el.style.setProperty('--glow-x', `${x}%`)
      el.style.setProperty('--glow-y', `${y}%`)
      el.style.setProperty('--glow-opacity', '1')
    },
    []
  )

  const handleMouseLeave = useCallback(() => {
    const el = cardRef.current
    if (!el) return
    el.style.setProperty('--glow-opacity', '0')
  }, [])

  return (
    <div
      ref={cardRef}
      className={`${styles.card} ${className}`}
      style={{
        gridColumn: colSpan,
        gridRow: rowSpan,
        '--glow-color': glowColor,
        ...style,
      } as CSSProperties}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div className={styles.cardGlow} />
      <div className={styles.cardContent}>{children}</div>
    </div>
  )
}

interface BentoGridProps {
  children: ReactNode
  className?: string
  /** Number of columns (default: 4) */
  columns?: number
  /** Gap in pixels (default: 12) */
  gap?: number
}

export function BentoGrid({ children, className = '', columns = 4, gap = 12 }: BentoGridProps) {
  return (
    <div
      className={`${styles.grid} ${className}`}
      style={{
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: `${gap}px`,
      }}
    >
      {children}
    </div>
  )
}
