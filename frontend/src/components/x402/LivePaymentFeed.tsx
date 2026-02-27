import { useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { type Payment, PAYMENT_STREAM, TOTAL_OBLIGATION, fmtUSD } from '../../lib/x402MockData'
import { AgentAvatar } from './Icons'
import s from './LivePaymentFeed.module.css'

interface LivePaymentFeedProps {
  onPaymentAdded?: (totalRepaid: number) => void
  speed?: number // ms between payments
  maxVisible?: number
}

export default function LivePaymentFeed({
  onPaymentAdded,
  speed = 2500,
  maxVisible = 8,
}: LivePaymentFeedProps) {
  const [visiblePayments, setVisiblePayments] = useState<Payment[]>([])
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [totalRepaid, setTotalRepaid] = useState(0)
  const [totalKept, setTotalKept] = useState(0)
  const [fullyRepaid, setFullyRepaid] = useState(false)
  const indexRef = useRef(0)
  const intervalRef = useRef<ReturnType<typeof setInterval>>()
  const repaidRef = useRef(0)

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      // Stop when loan is fully repaid
      if (repaidRef.current >= TOTAL_OBLIGATION) {
        clearInterval(intervalRef.current)
        setFullyRepaid(true)
        return
      }

      if (indexRef.current >= PAYMENT_STREAM.length) {
        indexRef.current = 0
      }

      const payment = PAYMENT_STREAM[indexRef.current]
      indexRef.current++

      // Cap vault repayment at remaining obligation
      const remaining = TOTAL_OBLIGATION - repaidRef.current
      const actualVaultRepay = Math.min(payment.vaultRepayment, remaining)
      const actualAgentNet = payment.amount - actualVaultRepay

      repaidRef.current += actualVaultRepay

      setVisiblePayments((prev) => {
        const next = [payment, ...prev].slice(0, maxVisible)
        return next
      })

      setTotalRevenue((p) => p + payment.amount)
      setTotalRepaid(repaidRef.current)
      setTotalKept((p) => p + actualAgentNet)

      onPaymentAdded?.(repaidRef.current)
    }, speed)

    return () => clearInterval(intervalRef.current)
  }, [speed, maxVisible, onPaymentAdded])

  return (
    <div className={s.container}>
      {/* Running Totals */}
      <div className={s.totals}>
        <div className={s.totalItem}>
          <span className={s.totalLabel}>Total Revenue</span>
          <span className={s.totalValue}>{fmtUSD(totalRevenue)}</span>
        </div>
        <div className={s.totalItem}>
          <span className={s.totalLabel}>Vault Repaid</span>
          <span className={`${s.totalValue} ${s.repaid}`}>{fmtUSD(totalRepaid)}</span>
        </div>
        <div className={s.totalItem}>
          <span className={s.totalLabel}>Agent Kept</span>
          <span className={`${s.totalValue} ${s.kept}`}>{fmtUSD(totalKept)}</span>
        </div>
      </div>

      {/* Live Feed */}
      <div className={s.feed}>
        <div className={s.feedHeader}>
          <span className={s.liveIndicator}>
            <span className={s.liveDot} />
            {fullyRepaid ? 'REPAID ✓' : 'LIVE'}
          </span>
          <span className={s.feedTitle}>x402 Payment Stream</span>
        </div>

        <AnimatePresence initial={false}>
          {visiblePayments.map((p, i) => (
            <motion.div
              key={`${p.id}-${i}-${totalRevenue}`}
              className={s.paymentRow}
              initial={{ opacity: 0, y: -30, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            >
              <div className={s.paymentMain}>
                <span className={s.agentAvatar}>
                  <AgentAvatar avatarKey={p.from.avatar} size={18} color="#FF6B35" />
                </span>
                <div className={s.paymentRoute}>
                  <span className={s.agentName}>{p.from.name}</span>
                  <span className={s.arrow}>→</span>
                  <span className={s.agentName}>{p.to.name}</span>
                </div>
                <span className={s.paymentAmount}>{fmtUSD(p.amount)}</span>
                <span className={s.oracleBadge}>Oracle ✓</span>
              </div>
              <div className={s.paymentSplit}>
                <span className={s.splitVault}>
                  ├─ Vault: {fmtUSD(p.vaultRepayment)} ({15}%)
                </span>
                <span className={s.splitAgent}>
                  └─ {p.to.name}: {fmtUSD(p.agentNet)} ({85}%)
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
