import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { motion } from 'motion/react'
import { gatewayApi } from '../api/client'
import type { ApiGatewaySummary, ApiGatewayBreakdown } from '../api/types'
import { Wallet, ArrowUpRight, CreditCard, Globe } from 'lucide-react'
import { Skeleton } from '../components/ui/Skeleton'
import { truncateAddress } from '../lib/format'
import styles from './Gateway.module.css'

export default function Gateway() {
  const { address: walletAddress } = useAccount()
  const [summary, setSummary] = useState<ApiGatewaySummary | null>(null)
  const [breakdown, setBreakdown] = useState<ApiGatewayBreakdown | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!walletAddress) return
    setLoading(true)
    Promise.all([
      gatewayApi.summary(walletAddress).then(r => setSummary(r.data)).catch(() => null),
      gatewayApi.breakdown(walletAddress).then(r => setBreakdown(r.data)).catch(() => null),
    ]).finally(() => setLoading(false))
  }, [walletAddress])

  if (!walletAddress) {
    return (
      <div className={styles.page}>
        <div className={styles.empty}>
          <Wallet size={32} />
          <p>Connect your wallet to view gateway dashboard</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <motion.div className={styles.container} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className={styles.title}>Payment Gateway</h1>
        <p className={styles.subtitle}>Unified revenue across crypto, x402, and fiat sources</p>

        {/* Overview Stats */}
        {loading ? (
          <div className={styles.statsRow}>
            {[1, 2, 3].map(i => <Skeleton key={i} style={{ height: 100, borderRadius: 16, flex: 1 }} />)}
          </div>
        ) : summary ? (
          <div className={styles.statsRow}>
            <div className={styles.statCard}>
              <div className={styles.statIcon}><ArrowUpRight size={18} /></div>
              <span className={styles.statLabel}>Total Revenue</span>
              <span className={styles.statValue}>${summary.totalRevenue}</span>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon}><CreditCard size={18} /></div>
              <span className={styles.statLabel}>Total Payments</span>
              <span className={styles.statValue}>{summary.totalPayments}</span>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon}><Globe size={18} /></div>
              <span className={styles.statLabel}>Active Sources</span>
              <span className={styles.statValue}>
                {[summary.sources.crypto.count > 0, summary.sources.x402.count > 0, summary.sources.fiat.count > 0].filter(Boolean).length}/3
              </span>
            </div>
          </div>
        ) : null}

        {/* Revenue Breakdown */}
        {breakdown && (
          <div className={styles.breakdownSection}>
            <h2 className={styles.sectionTitle}>Revenue by Source</h2>
            <div className={styles.breakdownGrid}>
              {breakdown.breakdown.map(b => (
                <div key={b.source} className={styles.sourceCard}>
                  <div className={styles.sourceIndicator} style={{ background: b.color }} />
                  <div className={styles.sourceInfo}>
                    <span className={styles.sourceName}>{b.source}</span>
                    <span className={styles.sourceVolume}>${b.volume}</span>
                  </div>
                  <span className={styles.sourceCount}>{b.count} tx</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Payments */}
        {summary && summary.recentPayments.length > 0 && (
          <div className={styles.paymentsSection}>
            <h2 className={styles.sectionTitle}>Recent Payments</h2>
            <div className={styles.paymentsList}>
              {summary.recentPayments.slice(0, 20).map(p => (
                <div key={p.id} className={styles.paymentRow}>
                  <div className={styles.paymentInfo}>
                    <span className={styles.paymentSource}>{p.source}</span>
                    <span className={styles.paymentFrom}>{truncateAddress(p.from)} → {truncateAddress(p.to)}</span>
                  </div>
                  <div className={styles.paymentRight}>
                    <span className={styles.paymentAmount}>${p.amount}</span>
                    <span className={`${styles.paymentStatus} ${styles[`status_${p.status}`] || ''}`}>{p.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && summary && summary.totalPayments === 0 && (
          <div className={styles.emptyState}>
            <p>No payments yet. Payments from all sources will appear here.</p>
          </div>
        )}
      </motion.div>
    </div>
  )
}
