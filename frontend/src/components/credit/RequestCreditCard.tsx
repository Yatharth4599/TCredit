import { useState, useCallback } from 'react'
import { creditApi, oracleApi } from '../../api/solanaClient'
import { useSolanaTx } from '../../hooks/useSolanaTx'
import { txUrl } from '../../config/solana'
import toast from 'react-hot-toast'
import s from './RequestCreditCard.module.css'

interface Props {
  agentPubkey: string
  maxAmount: number
  creditLevel: number
  interestRateBps: number
  onSuccess?: () => void
}

export default function RequestCreditCard({ agentPubkey, maxAmount, creditLevel, interestRateBps, onSuccess }: Props) {
  const [amount, setAmount] = useState('')
  const [status, setStatus] = useState<'idle' | 'requesting' | 'signing' | 'cosigning' | 'done' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [sig, setSig] = useState<string | null>(null)
  const { execute: executeTx } = useSolanaTx()

  const amountNum = Number(amount) || 0
  const dailyRate = (interestRateBps / 10000 / 365) * amountNum
  const isValid = amountNum > 0 && amountNum <= maxAmount

  const handleRequest = useCallback(async () => {
    if (!isValid) return
    setStatus('requesting')
    setError(null)

    try {
      // Step 1: Request unsigned tx from backend
      const res = await creditApi.requestCredit(agentPubkey, amountNum, creditLevel)
      const data = res.data

      if (data.transaction) {
        // Step 2: Sign with wallet
        setStatus('signing')
        const userSigned = await executeTx(data.transaction)

        // Step 3: Oracle co-sign (if needed)
        if (data.requiresOracleCosign) {
          setStatus('cosigning')
          await oracleApi.signCredit(userSigned)
        }

        setSig(userSigned)
      } else {
        setSig(data.txSignature ?? null)
      }

      setStatus('done')
      toast.success('Credit requested successfully!')
      onSuccess?.()
    } catch (err) {
      setStatus('error')
      const msg = err instanceof Error ? err.message : 'Request failed'
      setError(msg)
      toast.error(msg)
    }
  }, [agentPubkey, amountNum, creditLevel, isValid, executeTx, onSuccess])

  if (status === 'done') {
    return (
      <div className={s.wrapper}>
        <div className={s.success}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Credit request submitted!
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
      <div className={s.inputRow}>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className={s.amountInput}
          min={0}
          max={maxAmount}
          step={0.01}
          disabled={status !== 'idle'}
        />
        <button className={s.maxBtn} onClick={() => setAmount(String(maxAmount))} disabled={status !== 'idle'}>
          MAX
        </button>
      </div>

      <div className={s.infoGrid}>
        <div className={s.infoItem}>
          <span className={s.infoLabel}>Max Credit</span>
          <span className={s.infoValue}>${maxAmount.toLocaleString()}</span>
        </div>
        <div className={s.infoItem}>
          <span className={s.infoLabel}>Interest Rate</span>
          <span className={s.infoValue}>{(interestRateBps / 100).toFixed(2)}%</span>
        </div>
        <div className={s.infoItem}>
          <span className={s.infoLabel}>Daily Accrual</span>
          <span className={s.infoValue}>${dailyRate.toFixed(4)}</span>
        </div>
        <div className={s.infoItem}>
          <span className={s.infoLabel}>Credit Level</span>
          <span className={s.infoValue}>L{creditLevel}</span>
        </div>
      </div>

      <button
        className={s.submitBtn}
        disabled={!isValid || status !== 'idle'}
        onClick={handleRequest}
      >
        {status === 'requesting' && <><div className={s.spinner} /> Building transaction...</>}
        {status === 'signing' && <><div className={s.spinner} /> Sign in wallet...</>}
        {status === 'cosigning' && <><div className={s.spinner} /> Oracle co-signing...</>}
        {status === 'idle' && `Request $${amountNum.toLocaleString()} Credit`}
        {status === 'error' && 'Retry Request'}
      </button>

      {error && <p className={s.error}>{error}</p>}
    </div>
  )
}
