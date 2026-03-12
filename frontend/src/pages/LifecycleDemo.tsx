import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { AnimatedNumber } from '../components/ui/AnimatedNumber'
import { truncateAddress } from '../lib/format'
import {
  Play, CheckCircle2, Loader2, ExternalLink, ArrowRight,
  AlertCircle, RotateCcw, Zap,
} from 'lucide-react'
import styles from './LifecycleDemo.module.css'

// ─── Types ────────────────────────────────────────────────────────────────────

type StepStatus = 'pending' | 'running' | 'done' | 'error'

interface WaterfallSplit {
  platformFee: number
  senior:      number
  pool:        number
  community:   number
  merchant:    number
}

interface Payment {
  paymentNumber: number
  amount:        number
  totalRepaid:   number
  outstanding:   number
  progressPct:   number
  waterfall:     WaterfallSplit
  txHash:        string | null
  txUrl:         string | null
  mode:          'live' | 'demo'
}

interface FinalResult {
  loanAmount:   number
  totalRepaid:  number
  totalInterest:number
  numPayments:  number
  vaultAddress: string
  returns: {
    senior:      number
    general:     number
    community:   number
    merchant:    number
    platformFee: number
  }
}

interface DemoState {
  running:      boolean
  done:         boolean
  error:        string | null
  stepStatus:   Record<number, StepStatus>
  vaultAddress: string | null
  txHashes:     Record<string, string>
  payments:     Payment[]
  outstanding:  number
  totalRepaid:  number
  totalToRepay: number
  progressPct:  number
  finalResult:  FinalResult | null
}

const INITIAL_STATE: DemoState = {
  running:      false,
  done:         false,
  error:        null,
  stepStatus:   { 1: 'pending', 2: 'pending', 3: 'pending', 4: 'pending', 5: 'pending' },
  vaultAddress: null,
  txHashes:     {},
  payments:     [],
  outstanding:  0,
  totalRepaid:  0,
  totalToRepay: 0,
  progressPct:  0,
  finalResult:  null,
}

const DEMO_MERCHANT = '0xA1090527ac5c019Abc3989F405a5a63bB008008D'
const BASESCAN_TX   = (hash: string) => `https://sepolia.basescan.org/tx/${hash}`
const BASESCAN_ADDR = (addr: string) => `https://sepolia.basescan.org/address/${addr}`

const STEP_LABELS: Record<number, string> = {
  1: 'Create Vault',
  2: 'Fund Vault',
  3: 'Disburse to Merchant',
  4: 'Revenue Payments',
  5: 'Loan Status',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LifecycleDemo() {
  const navigate   = useNavigate()
  const abortRef   = useRef<AbortController | null>(null)
  const startedAt  = useRef<number>(0)

  const [loanAmount,   setLoanAmount]   = useState(5000)
  const [numPayments,  setNumPayments]  = useState(10)
  const [state,        setState]        = useState<DemoState>(INITIAL_STATE)
  const [elapsed,      setElapsed]      = useState(0)

  // Timer interval while running
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const resetDemo = useCallback(() => {
    abortRef.current?.abort()
    if (timerRef.current) clearInterval(timerRef.current)
    setState(INITIAL_STATE)
    setElapsed(0)
  }, [])

  const startDemo = useCallback(async () => {
    resetDemo()
    await new Promise(r => setTimeout(r, 50)) // let reset settle

    const totalToRepay = +(loanAmount * 1.03).toFixed(2) // 12% APY × 3 months = ~3%

    setState(s => ({
      ...s,
      running:     true,
      done:        false,
      error:       null,
      totalToRepay,
      outstanding: totalToRepay,
      stepStatus:  { 1: 'running', 2: 'pending', 3: 'pending', 4: 'pending', 5: 'pending' },
    }))

    startedAt.current = Date.now()
    timerRef.current  = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt.current) / 1000))
    }, 1000)

    const ctrl = new AbortController()
    abortRef.current = ctrl

    const BASE_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3001/api'

    try {
      const response = await fetch(`${BASE_URL}/v1/demo/full-lifecycle`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ merchantAddress: DEMO_MERCHANT, loanAmount, numPayments }),
        signal:  ctrl.signal,
      })

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const reader  = response.body.getReader()
      const decoder = new TextDecoder()
      let   buffer  = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const chunks = buffer.split('\n\n')
        buffer = chunks.pop() ?? ''

        for (const chunk of chunks) {
          const line = chunk.trim()
          if (!line.startsWith('data: ')) continue

          let msg: { step: number; event: string; data: Record<string, unknown> }
          try {
            msg = JSON.parse(line.slice(6))
          } catch {
            continue
          }

          handleSSEEvent(msg.step, msg.event, msg.data)
        }
      }

      // Stream ended naturally → mark done
      if (timerRef.current) clearInterval(timerRef.current)
      setState(s => ({ ...s, running: false, done: true }))
    } catch (err: unknown) {
      if (timerRef.current) clearInterval(timerRef.current)
      if (err instanceof Error && err.name === 'AbortError') return
      const msg = err instanceof Error ? err.message : String(err)
      setState(s => ({
        ...s,
        running: false,
        error:   msg,
      }))
    }
  }, [loanAmount, numPayments, resetDemo])

  const handleSSEEvent = (
    step:  number,
    event: string,
    data:  Record<string, unknown>,
  ) => {
    setState(prev => {
      const next = { ...prev }

      if (event === 'error') {
        next.error   = (data.message as string) ?? 'Unknown error'
        next.running = false
        next.stepStatus = { ...prev.stepStatus, [step]: 'error' }
        if (timerRef.current) clearInterval(timerRef.current)
        return next
      }

      if (event === 'step_start') {
        next.stepStatus = { ...prev.stepStatus, [step]: 'running' }
        // Mark previous step done
        if (step > 1) next.stepStatus[step - 1] = 'done'
        return next
      }

      if (event === 'vault_created') {
        next.vaultAddress        = data.vaultAddress as string
        next.txHashes            = { ...prev.txHashes, vault: data.txHash as string }
        next.stepStatus          = { ...prev.stepStatus, 1: 'done', 2: 'running' }
        return next
      }

      if (event === 'vault_funded') {
        next.txHashes   = { ...prev.txHashes, funding: (data.txHash as string) ?? '' }
        next.stepStatus = { ...prev.stepStatus, 2: 'done', 3: 'running' }
        return next
      }

      if (event === 'tranche_released') {
        next.txHashes   = { ...prev.txHashes, tranche: (data.txHash as string) ?? '' }
        next.stepStatus = { ...prev.stepStatus, 3: 'done', 4: 'running' }
        return next
      }

      if (event.startsWith('payment_') && event.endsWith('_start')) {
        return next // just waiting
      }

      if (/^payment_\d+$/.test(event)) {
        const pmt: Payment = {
          paymentNumber: data.paymentNumber as number,
          amount:        data.amount        as number,
          totalRepaid:   data.totalRepaid   as number,
          outstanding:   data.outstanding   as number,
          progressPct:   data.progressPct   as number,
          waterfall:     data.waterfall     as WaterfallSplit,
          txHash:        data.txHash        as string | null,
          txUrl:         data.txUrl         as string | null,
          mode:          (data.mode as 'live' | 'demo') ?? 'demo',
        }
        next.payments    = [...prev.payments, pmt]
        next.outstanding = pmt.outstanding
        next.totalRepaid = pmt.totalRepaid
        next.progressPct = pmt.progressPct
        return next
      }

      if (event === 'loan_repaid') {
        next.stepStatus  = { 1: 'done', 2: 'done', 3: 'done', 4: 'done', 5: 'done' }
        next.progressPct = 100
        next.outstanding = 0
        next.finalResult = {
          loanAmount:    data.loanAmount    as number,
          totalRepaid:   data.totalRepaid   as number,
          totalInterest: data.totalInterest as number,
          numPayments:   data.numPayments   as number,
          vaultAddress:  data.vaultAddress  as string,
          returns:       data.returns       as FinalResult['returns'],
        }
        return next
      }

      return next
    })
  }

  const s = state
  const isRunning   = s.running
  const isCompleted = !!s.finalResult
  const hasStarted  = isRunning || s.payments.length > 0 || s.finalResult !== null

  return (
    <div className={styles.page}>
      {/* ── Hero Header ───────────────────────────────────────────────────────── */}
      <div className={styles.hero}>
        <motion.div
          className={styles.heroInner}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className={styles.heroLabel}>Live Demonstration</div>
          <h1 className={styles.heroTitle}>Full Loan Lifecycle Demo</h1>
          <p className={styles.heroSubtitle}>
            Watch a loan go from creation to full repayment.{' '}
            <strong>Every step is a real on-chain transaction on Base Sepolia.</strong>
          </p>
        </motion.div>
      </div>

      {/* ── Main Content ──────────────────────────────────────────────────────── */}
      <div className={styles.body}>

        {/* Config panel */}
        {!hasStarted && (
          <motion.div
            className={styles.configCard}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          >
            <div className={styles.configRow}>
              <div className={styles.configItem}>
                <label className={styles.configLabel}>Merchant</label>
                <div className={styles.configValue}>
                  <span className={styles.merchantName}>GlobalTextiles</span>
                  <span className={styles.merchantBadge}>Score: 780 · Tier A</span>
                </div>
                <div className={styles.configAddr}>{truncateAddress(DEMO_MERCHANT, 6)}</div>
              </div>
              <div className={styles.configDivider} />
              <div className={styles.configItem}>
                <label className={styles.configLabel}>Loan Amount (USDC)</label>
                <div className={styles.configInputRow}>
                  {[1000, 2500, 5000, 10000].map(amt => (
                    <button
                      key={amt}
                      className={`${styles.presetBtn} ${loanAmount === amt ? styles.presetActive : ''}`}
                      onClick={() => setLoanAmount(amt)}
                    >
                      ${amt.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.configDivider} />
              <div className={styles.configItem}>
                <label className={styles.configLabel}>Number of Payments</label>
                <div className={styles.configInputRow}>
                  {[5, 10, 15].map(n => (
                    <button
                      key={n}
                      className={`${styles.presetBtn} ${numPayments === n ? styles.presetActive : ''}`}
                      onClick={() => setNumPayments(n)}
                    >
                      {n}×
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className={styles.configSummary}>
              <span>12% APY · 3-month term · ~{Math.round(numPayments * 2.5 / 60)} min demo</span>
            </div>

            <button className={styles.startBtn} onClick={startDemo}>
              <Play size={16} />
              Start Full Lifecycle Demo
            </button>
          </motion.div>
        )}

        {/* Error display */}
        {s.error && (
          <motion.div
            className={styles.errorCard}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <AlertCircle size={20} />
            <span>{s.error}</span>
            <button className={styles.retryBtn} onClick={resetDemo}>
              <RotateCcw size={13} /> Reset
            </button>
          </motion.div>
        )}

        {/* Running header with elapsed time and restart button */}
        {hasStarted && (
          <motion.div
            className={styles.runningHeader}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className={styles.runningMeta}>
              {isRunning && <span className={styles.liveDot} />}
              <span className={styles.runningLabel}>
                {isCompleted ? 'Demo Complete' : isRunning ? 'Running live on Base Sepolia…' : 'Stopped'}
              </span>
              {elapsed > 0 && (
                <span className={styles.elapsed}>
                  {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}
                </span>
              )}
            </div>
            <button className={styles.resetBtn} onClick={resetDemo}>
              <RotateCcw size={13} /> New Demo
            </button>
          </motion.div>
        )}

        {/* ── Steps ─────────────────────────────────────────────────────────── */}
        {hasStarted && (
          <div className={styles.steps}>

            {/* Step 1: Create Vault */}
            <StepCard
              stepNum={1}
              label={STEP_LABELS[1]}
              status={s.stepStatus[1]}
            >
              {s.vaultAddress && (
                <div className={styles.stepDetail}>
                  <div className={styles.stepDetailRow}>
                    <span className={styles.detailKey}>Vault Address</span>
                    <a
                      href={BASESCAN_ADDR(s.vaultAddress)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.addrLink}
                    >
                      {truncateAddress(s.vaultAddress, 8)}
                      <ExternalLink size={11} />
                    </a>
                  </div>
                  {s.txHashes.vault && (
                    <TxRow label="Transaction" hash={s.txHashes.vault} />
                  )}
                  <div className={styles.stepDetailRow}>
                    <span className={styles.detailKey}>Config</span>
                    <span className={styles.detailVal}>12% APY · 3mo · 1 tranche</span>
                  </div>
                </div>
              )}
            </StepCard>

            {/* Step 2: Fund Vault */}
            <StepCard
              stepNum={2}
              label={STEP_LABELS[2]}
              status={s.stepStatus[2]}
            >
              {s.stepStatus[2] === 'done' && (
                <div className={styles.stepDetail}>
                  <div className={styles.fundingBars}>
                    <FundingBar
                      label="Senior Pool"
                      pct={60}
                      amount={+(loanAmount * 0.60).toFixed(0)}
                      color="var(--accent)"
                    />
                    <FundingBar
                      label="General Pool"
                      pct={40}
                      amount={+(loanAmount * 0.40).toFixed(0)}
                      color="#60a5fa"
                    />
                  </div>
                  {s.txHashes.funding && (
                    <TxRow label="Complete Fundraising Tx" hash={s.txHashes.funding} />
                  )}
                </div>
              )}
            </StepCard>

            {/* Step 3: Disburse */}
            <StepCard
              stepNum={3}
              label={STEP_LABELS[3]}
              status={s.stepStatus[3]}
            >
              {s.stepStatus[3] === 'done' && (
                <div className={styles.stepDetail}>
                  <div className={styles.stepDetailRow}>
                    <span className={styles.detailKey}>Amount disbursed</span>
                    <span className={styles.detailVal} style={{ color: 'var(--color-success)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                      ${loanAmount.toLocaleString()} USDC
                    </span>
                  </div>
                  <div className={styles.stepDetailRow}>
                    <span className={styles.detailKey}>Recipient</span>
                    <span className={styles.detailVal}>{truncateAddress(DEMO_MERCHANT, 6)}</span>
                  </div>
                  {s.txHashes.tranche && (
                    <TxRow label="Release Tranche Tx" hash={s.txHashes.tranche} />
                  )}
                </div>
              )}
            </StepCard>

            {/* Step 4: Payments */}
            <StepCard
              stepNum={4}
              label={STEP_LABELS[4]}
              status={s.stepStatus[4]}
            >
              {(s.payments.length > 0 || s.stepStatus[4] === 'running') && (
                <div className={styles.paymentsSection}>
                  {/* Live counter row */}
                  <div className={styles.liveCounters}>
                    <div className={styles.liveCounter}>
                      <span className={styles.liveCounterLabel}>Outstanding</span>
                      <span className={styles.liveCounterValue} style={{ color: s.outstanding === 0 ? 'var(--color-success)' : 'var(--accent)' }}>
                        $<AnimatedNumber value={s.outstanding} decimals={2} />
                      </span>
                    </div>
                    <div className={styles.liveCounterDivider} />
                    <div className={styles.liveCounter}>
                      <span className={styles.liveCounterLabel}>Repaid</span>
                      <span className={styles.liveCounterValue} style={{ color: 'var(--color-success)' }}>
                        $<AnimatedNumber value={s.totalRepaid} decimals={2} />
                      </span>
                    </div>
                    <div className={styles.liveCounterDivider} />
                    <div className={styles.liveCounter}>
                      <span className={styles.liveCounterLabel}>Progress</span>
                      <span className={styles.liveCounterValue}>
                        <AnimatedNumber value={s.progressPct} decimals={1} />%
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className={styles.progressTrack}>
                    <motion.div
                      className={styles.progressFill}
                      animate={{ width: `${s.progressPct}%` }}
                      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>

                  {/* Payment list */}
                  <div className={styles.paymentList}>
                    <AnimatePresence>
                      {s.payments.map((pmt) => (
                        <motion.div
                          key={pmt.paymentNumber}
                          className={styles.paymentRow}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                        >
                          <div className={styles.pmtLeft}>
                            <CheckCircle2 size={15} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
                            <span className={styles.pmtNum}>#{pmt.paymentNumber}</span>
                            <span className={styles.pmtAmt}>${pmt.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            {pmt.mode === 'live' && pmt.txHash && (
                              <a
                                href={pmt.txUrl!}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles.pmtTx}
                                title="View on BaseScan"
                              >
                                {truncateAddress(pmt.txHash, 4)}
                                <ExternalLink size={10} />
                              </a>
                            )}
                            {pmt.mode === 'demo' && (
                              <span className={styles.pmtDemo}>demo</span>
                            )}
                          </div>
                          <div className={styles.pmtWaterfall}>
                            <WaterfallPill label="Fee"       val={pmt.waterfall.platformFee} color="rgba(255,255,255,0.3)" />
                            <WaterfallPill label="Senior"    val={pmt.waterfall.senior}      color="var(--accent)" />
                            <WaterfallPill label="Pool"      val={pmt.waterfall.pool}        color="#60a5fa" />
                            <WaterfallPill label="Community" val={pmt.waterfall.community}   color="#a78bfa" />
                            <WaterfallPill label="Merchant"  val={pmt.waterfall.merchant}    color="var(--color-success)" />
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>

                    {/* Pending slots */}
                    {isRunning && s.stepStatus[4] === 'running' && (
                      Array.from({ length: Math.max(0, numPayments - s.payments.length) }).map((_, i) => (
                        <div key={`pending-${i}`} className={styles.paymentRowPending}>
                          <div className={styles.pendingPill}>
                            {i === 0 ? (
                              <><Loader2 size={13} className={styles.spin} /> Processing…</>
                            ) : (
                              <><span className={styles.pendingDot} /> Payment #{s.payments.length + i + 1} waiting</>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </StepCard>

            {/* Step 5: Final Status */}
            <StepCard
              stepNum={5}
              label={STEP_LABELS[5]}
              status={s.stepStatus[5]}
            >
              {!isCompleted && s.stepStatus[5] !== 'done' && (
                <p className={styles.stepWaiting}>Waiting for all payments to complete…</p>
              )}
            </StepCard>
          </div>
        )}

        {/* ── Final Celebration Card ─────────────────────────────────────────── */}
        <AnimatePresence>
          {isCompleted && s.finalResult && (
            <motion.div
              className={styles.celebrationCard}
              initial={{ opacity: 0, scale: 0.94, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Glow rings */}
              <div className={styles.glowRing1} />
              <div className={styles.glowRing2} />

              <div className={styles.celebrationInner}>
                <motion.div
                  className={styles.checkCircle}
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.2, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                >
                  <CheckCircle2 size={44} />
                </motion.div>

                <h2 className={styles.celebrationTitle}>Loan Fully Repaid</h2>
                <p className={styles.celebrationSub}>
                  {s.finalResult.numPayments} automatic payments · {elapsed}s · 100% on-chain
                </p>

                {/* Stats grid */}
                <div className={styles.finalStats}>
                  <FinalStat label="Loan Amount"   value={`$${s.finalResult.loanAmount.toLocaleString()}`} />
                  <FinalStat label="Total Repaid"  value={`$${s.finalResult.totalRepaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} />
                  <FinalStat label="Interest Paid" value={`$${s.finalResult.totalInterest.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} highlight />
                  <FinalStat label="Time to Repay" value={elapsed >= 60 ? `${Math.floor(elapsed/60)}m ${elapsed%60}s` : `${elapsed}s`} />
                </div>

                {/* Returns breakdown */}
                <div className={styles.returnsCard}>
                  <div className={styles.returnsTitle}>Waterfall Distribution</div>
                  <div className={styles.returnsGrid}>
                    <ReturnRow label="Senior Pool earned"  val={s.finalResult.returns.senior}      color="var(--accent)" />
                    <ReturnRow label="General Pool earned" val={s.finalResult.returns.general}     color="#60a5fa" />
                    <ReturnRow label="Community earned"    val={s.finalResult.returns.community}   color="#a78bfa" />
                    <ReturnRow label="Merchant retained"   val={s.finalResult.returns.merchant}    color="var(--color-success)" />
                    <ReturnRow label="Platform fee"        val={s.finalResult.returns.platformFee} color="rgba(255,255,255,0.4)" />
                  </div>
                </div>

                <p className={styles.celebrationNote}>
                  <Zap size={13} />
                  Every transaction is on-chain. Every split was automatic.
                  The merchant never made a manual repayment.
                </p>

                {/* CTA buttons */}
                <div className={styles.celebrationActions}>
                  {s.finalResult.vaultAddress && (
                    <a
                      href={BASESCAN_ADDR(s.finalResult.vaultAddress)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.ctaLink}
                    >
                      View Vault on BaseScan <ExternalLink size={13} />
                    </a>
                  )}
                  <button
                    className={styles.ctaLink}
                    onClick={() => navigate('/app/vaults')}
                  >
                    Explore All Vaults <ArrowRight size={13} />
                  </button>
                  <button className={styles.ctaPrimary} onClick={resetDemo}>
                    <RotateCcw size={14} /> Run Another Demo
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepCard({
  stepNum, label, status, children,
}: {
  stepNum: number
  label:   string
  status:  StepStatus
  children?: React.ReactNode
}) {
  const isDone    = status === 'done'
  const isRunning = status === 'running'
  const isPending = status === 'pending'

  return (
    <motion.div
      className={`${styles.stepCard} ${isDone ? styles.stepDone : ''} ${isRunning ? styles.stepRunning : ''} ${isPending ? styles.stepPending : ''}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: isPending ? 0.5 : 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className={styles.stepHeader}>
        <div className={styles.stepIcon}>
          {isDone    && <CheckCircle2 size={16} style={{ color: 'var(--color-success)' }} />}
          {isRunning && <Loader2 size={16} className={styles.spin} style={{ color: 'var(--accent)' }} />}
          {isPending && <span className={styles.stepNum}>{stepNum}</span>}
          {status === 'error' && <AlertCircle size={16} style={{ color: '#f87171' }} />}
        </div>
        <span className={styles.stepLabel}>Step {stepNum}: {label}</span>
        {isRunning && <span className={styles.runningBadge}>Processing…</span>}
        {isDone    && <span className={styles.doneBadge}>Complete</span>}
      </div>
      <AnimatePresence>
        {children && isDone && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            {children}
          </motion.div>
        )}
        {children && isRunning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function TxRow({ label, hash }: { label: string; hash: string }) {
  return (
    <div className={styles.stepDetailRow}>
      <span className={styles.detailKey}>{label}</span>
      <a
        href={BASESCAN_TX(hash)}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.txLink}
      >
        {truncateAddress(hash, 6)} <ExternalLink size={10} />
      </a>
    </div>
  )
}

function FundingBar({ label, pct, amount, color }: { label: string; pct: number; amount: number; color: string }) {
  return (
    <div className={styles.fundingBar}>
      <div className={styles.fundingBarHeader}>
        <span className={styles.fundingBarLabel}>{label}</span>
        <span className={styles.fundingBarValue} style={{ color }}>${amount.toLocaleString()} USDC ({pct}%)</span>
      </div>
      <div className={styles.fundingBarTrack}>
        <motion.div
          className={styles.fundingBarFill}
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  )
}

function WaterfallPill({ label, val, color }: { label: string; val: number; color: string }) {
  return (
    <span className={styles.waterfallPill} style={{ borderColor: color, color }}>
      {label}: ${val.toFixed(2)}
    </span>
  )
}

function FinalStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={styles.finalStat}>
      <span className={styles.finalStatLabel}>{label}</span>
      <span className={styles.finalStatValue} style={highlight ? { color: 'var(--color-success)' } : undefined}>
        {value}
      </span>
    </div>
  )
}

function ReturnRow({ label, val, color }: { label: string; val: number; color: string }) {
  return (
    <div className={styles.returnRow}>
      <span className={styles.returnDot} style={{ background: color }} />
      <span className={styles.returnLabel}>{label}</span>
      <span className={styles.returnVal} style={{ color }}>${val.toFixed(2)}</span>
    </div>
  )
}
