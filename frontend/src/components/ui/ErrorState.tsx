import { RefreshCw } from 'lucide-react'
import styles from './ErrorState.module.css'

interface ErrorStateProps {
  message?: string
  onRetry?: () => void
  className?: string
  compact?: boolean
}

export function ErrorState({
  message = 'Unable to load data. Please try again.',
  onRetry,
  className,
  compact,
}: ErrorStateProps) {
  return (
    <div className={`${styles.errorState} ${compact ? styles.compact : ''} ${className ?? ''}`}>
      <svg className={styles.icon} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <circle cx="12" cy="16" r="0.5" fill="currentColor" />
      </svg>
      <p className={styles.message}>{message}</p>
      {onRetry && (
        <button className={styles.retryBtn} onClick={onRetry}>
          <RefreshCw size={13} />
          Try again
        </button>
      )}
    </div>
  )
}
