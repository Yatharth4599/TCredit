import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { txUrl } from '../../config/solana'
import type { TxStatus } from '../../hooks/useSolanaTx'
import s from './TxStatusPanel.module.css'

interface Props {
  status: TxStatus
  txSig: string | null
  error: string | null
  onDismiss: () => void
}

const STATUS_LABELS: Record<TxStatus, string> = {
  idle: '',
  signing: 'Waiting for wallet signature...',
  submitted: 'Transaction submitted',
  confirming: 'Confirming on Solana...',
  confirmed: 'Transaction confirmed!',
  failed: 'Transaction failed',
}

const STEPS: TxStatus[] = ['signing', 'submitted', 'confirming', 'confirmed']

function stepState(step: TxStatus, current: TxStatus): 'pending' | 'active' | 'done' | 'failed' {
  if (current === 'failed') {
    const ci = STEPS.indexOf(current)
    const si = STEPS.indexOf(step)
    if (si <= ci) return 'failed'
    return 'pending'
  }
  const ci = STEPS.indexOf(current)
  const si = STEPS.indexOf(step)
  if (si < ci) return 'done'
  if (si === ci) return 'active'
  return 'pending'
}

export default function TxStatusPanel({ status, txSig, error, onDismiss }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (status !== 'idle') setVisible(true)
  }, [status])

  // Auto-dismiss on success after 5s
  useEffect(() => {
    if (status === 'confirmed') {
      const t = setTimeout(() => { setVisible(false); onDismiss() }, 5000)
      return () => clearTimeout(t)
    }
  }, [status, onDismiss])

  return (
    <AnimatePresence>
      {visible && status !== 'idle' && (
        <motion.div
          className={s.panel}
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.25 }}
        >
          <div className={s.card}>
            <div className={s.header}>
              <span className={s.title}>Transaction</span>
              <button className={s.closeBtn} onClick={() => { setVisible(false); onDismiss() }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className={s.steps}>
              {STEPS.map((step) => {
                const state = stepState(step, status)
                return (
                  <div key={step} className={`${s.step} ${state === 'active' ? s.active : ''} ${state === 'done' ? s.done : ''} ${state === 'failed' ? s.failed : ''}`}>
                    {state === 'active' ? (
                      <div className={s.spinner} />
                    ) : (
                      <div className={s.stepDot} />
                    )}
                    <span>{STATUS_LABELS[step]}</span>
                  </div>
                )
              })}
            </div>

            {error && (
              <p style={{ fontSize: 11, color: '#F87171', marginTop: 8 }}>{error}</p>
            )}

            {txSig && (
              <a href={txUrl(txSig)} target="_blank" rel="noopener noreferrer" className={s.txLink}>
                View on Solscan
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
                </svg>
              </a>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
