import type { ReactNode } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import styles from './StatWidget.module.css'

interface StatWidgetProps {
  label: string
  value: string | number
  sub?: string
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  icon?: ReactNode
  className?: string
}

export function StatWidget({ label, value, sub, trend, trendValue, icon, className = '' }: StatWidgetProps) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus

  return (
    <div className={`${styles.widget} ${className}`}>
      <div className={styles.top}>
        <span className={styles.label}>{label}</span>
        {icon && <div className={styles.icon}>{icon}</div>}
      </div>
      <div className={styles.value}>{value}</div>
      {(sub || trend) && (
        <div className={styles.bottom}>
          {sub && <span className={styles.sub}>{sub}</span>}
          {trend && trendValue && (
            <span className={`${styles.trend} ${styles[trend]}`}>
              <TrendIcon size={12} />
              {trendValue}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
