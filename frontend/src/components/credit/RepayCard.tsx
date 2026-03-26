import { useState, useCallback } from 'react'
import { creditApi } from '../../api/solanaClient'
import { useSolanaTx } from '../../hooks/useSolanaTx'
import { txUrl } from '../../config/solana'
import toast from 'react-hot-toast'
import s from './RepayCard.module.css'

interface Props {
  agentPubkey: string
  principal: number
  accruedInterest: number
  totalOwed: number
  onSuccess?: () => void
}

export default function RepayCard({ agentPubkey, principal, accruedInterest, totalOwed, onSuccess }: Props) {
  const [amount, setAmount] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'signing' | 'done' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [sig, setSig] = useState<string | null>(null)
  const { execute: executeTx } = useSolanaTx()

  const amountNum = Number(amount) || 0
  const isValid = amountNum > 0 && amountNum <= totalOwed

  const handleRepay = useCallback(async () => {
    if (!isValid) return
    setStatus('loading')
    setError(null)

    try {
      const res = await creditApi.repay(agentPubkey, amountNum)
      const data = res.data

      if (data.transaction) {
        setStatus('signing')
        const txSig = await executeTx(data.transaction)
        setSig(txSig)
      } else {
        setSig(data.txSignature ?? null)
      }

      setStatus('done')
      toast.success('Repayment successful!')
      onSuccess?.()
    } catch (err) {
      setStatus('error')
      const msg = err instanceof Error ? err.message : 'Repayment failed'
      setError(msg)
      toast.error(msg)
    }
  }, [agentPubkey, amountNum, isValid, executeTx, onSuccess])

  if (totalOwed <= 0) {
    return (
      <div className={s.wrapper}>
        <div className={s.debtSummary}>
          <div className={s.debtItem}>
            <div className={s.debtLabel}>Total Owed</div>
            <div className={s.debtValue} style={{ color: '#34D399' }}>$0.00</div>
          </div>
        </div>
        <p style={{ fontSize: 13, color: 'rgba(245,245,247,0.4)', textAlign: 'center' }}>
          No outstanding debt
        </p>
      </div>
    )
  }

  if (status === 'done') {
    return (
      <div className={s.wrapper}>
        <div className={s.success}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Repayment of ${amountNum.toFixed(2)} confirmed!
          {sig && (
            <a href={txUrl(sig)} target="_blank" rel="noopener noreferrer" className={s.txLink}>
              View on Solscan
            </a>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={s.wrapper}>
      <div className={s.debtSummary}>
        <div className={s.debtItem}>
          <div className={s.debtLabel}>Principal</div>
          <div className={s.debtValue}>${principal.toFixed(2)}</div>
        </div>
        <div className={s.debtItem}>
          <div className={s.debtLabel}>Interest</div>
          <div className={s.debtValue}>${accruedInterest.toFixed(2)}</div>
        </div>
        <div className={s.debtItem}>
          <div className={s.debtLabel}>Total Owed</div>
          <div className={s.debtValue} style={{ color: '#F87171' }}>${totalOwed.toFixed(2)}</div>
        </div>
      </div>

      <div className={s.inputRow}>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className={s.amountInput}
          min={0}
          max={totalOwed}
          step={0.01}
          disabled={status !== 'idle'}
        />
        <button className={s.maxBtn} onClick={() => setAmount(String(totalOwed))} disabled={status !== 'idle'}>
          MAX
        </button>
      </div>

      <button
        className={s.submitBtn}
        disabled={!isValid || status !== 'idle'}
        onClick={handleRepay}
      >
        {status === 'loading' && <><div className={s.spinner} /> Building transaction...</>}
        {status === 'signing' && <><div className={s.spinner} /> Sign in wallet...</>}
        {status === 'idle' && `Repay $${amountNum > 0 ? amountNum.toFixed(2) : '0.00'}`}
        {status === 'error' && 'Retry Repayment'}
      </button>

      {error && <p className={s.error}>{error}</p>}
    </div>
  )
}
