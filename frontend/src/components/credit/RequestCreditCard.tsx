import { useState, useCallback } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { Transaction } from '@solana/web3.js'
import { oracleApi } from '../../api/solanaClient'
import { useSolanaTx } from '../../hooks/useSolanaTx'
import { txUrl, PROGRAM_IDS } from '../../config/solana'
import toast from 'react-hot-toast'
import s from './RequestCreditCard.module.css'

/** Convert a USDC decimal string to base units (6 decimals) without float math */
function usdcToBaseUnits(amount: string): number {
  const parts = amount.split('.')
  const whole = parts[0] || '0'
  const frac = (parts[1] || '').padEnd(6, '0').slice(0, 6)
  return parseInt(whole + frac, 10)
}

const KNOWN_PROGRAM_IDS = new Set<string>(Object.values(PROGRAM_IDS))

interface Props {
  agentPubkey: string
  maxAmount: number
  creditLevel: number
  interestRateBps: number
  onSuccess?: () => void
}

export default function RequestCreditCard({ agentPubkey, maxAmount, creditLevel, interestRateBps, onSuccess }: Props) {
  const { publicKey } = useWallet()
  const [amount, setAmount] = useState('')
  const [status, setStatus] = useState<'idle' | 'building' | 'signing' | 'done' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [sig, setSig] = useState<string | null>(null)
  const { execute: executeTx } = useSolanaTx()

  const amountNum = Number(amount) || 0
  const amountBaseUnits = usdcToBaseUnits(amount)
  const dailyRate = (interestRateBps / 10000 / 365) * amountNum
  const isValid = amountBaseUnits > 0 && amountNum <= maxAmount && !!publicKey

  const handleRequest = useCallback(async () => {
    if (!isValid || !publicKey) return
    setStatus('building')
    setError(null)

    try {
      // Step 1: Oracle builds + signs the transaction (includes auto collateral init)
      const res = await oracleApi.signCredit({
        agentPubkey,
        agentOrOwnerPubkey: publicKey.toBase58(),
        amount: String(amountBaseUnits),
        creditLevel,
        rateBps: interestRateBps,
      })

      // Step 2: Verify the oracle transaction targets a known Krexa program
      const txBytes = Buffer.from(res.data.transaction, 'base64')
      const oracleTx = Transaction.from(txBytes)
      const firstIx = oracleTx.instructions[0]
      if (!firstIx || !KNOWN_PROGRAM_IDS.has(firstIx.programId.toBase58())) {
        throw new Error('Oracle returned transaction with unknown program — refusing to sign')
      }

      // Step 3: User signs the oracle-signed transaction
      setStatus('signing')
      const txSig = await executeTx(res.data.transaction)
      setSig(txSig)

      setStatus('done')
      toast.success('Credit requested successfully!')
      onSuccess?.()
    } catch (err) {
      setStatus('error')
      const msg = err instanceof Error ? err.message :
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Request failed'
      setError(msg)
      toast.error(msg)
    }
  }, [agentPubkey, amountBaseUnits, creditLevel, interestRateBps, isValid, publicKey, executeTx, onSuccess])

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
        <button
          className={s.submitBtn}
          style={{ marginTop: 12 }}
          onClick={() => { setStatus('idle'); setSig(null); setAmount(''); }}
        >
          Request More Credit
        </button>
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
          disabled={status !== 'idle' && status !== 'error'}
        />
        <button className={s.maxBtn} onClick={() => setAmount(String(maxAmount))} disabled={status !== 'idle' && status !== 'error'}>
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

      <p style={{ fontSize: 11, color: 'rgba(245,245,247,0.35)', margin: '8px 0 0', lineHeight: 1.5 }}>
        Zero-collateral L1 credit. Oracle co-signs the transaction for you.
      </p>

      <button
        className={s.submitBtn}
        disabled={!isValid || (status !== 'idle' && status !== 'error')}
        onClick={handleRequest}
      >
        {status === 'building' && <><div className={s.spinner} /> Building transaction...</>}
        {status === 'signing' && <><div className={s.spinner} /> Sign in wallet...</>}
        {(status === 'idle' || status === 'error') && `Request $${amountNum > 0 ? amountNum.toLocaleString() : '0.00'} Credit`}
      </button>

      {error && <p className={s.error}>{error}</p>}
    </div>
  )
}
