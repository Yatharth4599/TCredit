import { useState, useRef, useCallback, useEffect, memo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { ExternalLink, Loader2, Zap, CheckCircle2, AlertCircle, Activity } from 'lucide-react'
import s from './X402Demo.module.css'

// ── Demo constants ─────────────────────────────────────────────────────────
const DEMO_MERCHANT = {
  name: 'GlobalTextiles',
  address: '0xA109...7d2',
  vault: '0x4aF9...3b1D',
}

const DEMO_LOAN        = 100_000
const DEMO_INIT_REPAID = 42_000
const SENIOR_TARGET    = 70_000
const POOL_TARGET      = 20_000
const COMMUNITY_TARGET = 10_000

const TEST_SOURCES = [
  { id: 'shopbot',   label: 'ShopBot',        addr: '0x3cF1...F1d' },
  { id: 'databot',   label: 'DataBot',         addr: '0x9eA2...F9A' },
  { id: 'codebot',   label: 'CodeBot',         addr: '0x5dB8...E6' },
  { id: 'customer1', label: 'Customer-0x2aE4', addr: '0x2aE4...F1' },
]

const PRESET_AMOUNTS = [500, 1_000, 2_500, 5_000, 10_000]

// ── Payment split math (mirrors WaterfallLib.sol) ──────────────────────────
interface PaymentSplit {
  total: number
  platformFee: number
  net: number
  seniorTranche: number
  liquidityPool: number
  communityInvestors: number
  merchantReceives: number
}

function computeSplitLocal(amount: number): PaymentSplit {
  const total = amount
  const platformFee = Math.floor(total * 250) / 10000
  const net = total - platformFee
  const seniorTranche = Math.floor(net * 2000) / 10000
  const liquidityPool = Math.floor(net * 1000) / 10000
  const communityInvestors = Math.floor(net * 500) / 10000
  const merchantReceives = parseFloat((net - seniorTranche - liquidityPool - communityInvestors).toFixed(2))
  return { total, platformFee, net, seniorTranche, liquidityPool, communityInvestors, merchantReceives }
}

// ── AnimatedNumber ─────────────────────────────────────────────────────────
function AnimatedNumber({
  value,
  decimals = 2,
  prefix = '',
}: {
  value: number
  decimals?: number
  prefix?: string
}) {
  const [displayed, setDisplayed] = useState(value)
  const prevRef  = useRef(value)
  const rafRef   = useRef<number>()

  useEffect(() => {
    const from = prevRef.current
    const to   = value
    prevRef.current = to

    let start: number | undefined

    const tick = (now: number) => {
      if (!start) start = now
      const t      = Math.min((now - start) / 700, 1)
      const eased  = 1 - Math.pow(1 - t, 3) // ease-out cubic
      setDisplayed(from + (to - from) * eased)
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }

    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [value])

  const fmt = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(displayed)

  return <>{prefix}{fmt}</>
}

// ── Waterfall tier box ─────────────────────────────────────────────────────
interface TierDef {
  key: string
  name: string
  pct: string | null
  color: string
  amount: number
  progress: number | null  // 0–100
  isLast?: boolean
  isMerchant?: boolean
}

const WaterfallBox = memo(function WaterfallBox({
  tier,
  lit,
  connectorLit,
}: {
  tier: TierDef
  lit: boolean
  connectorLit: boolean
}) {
  return (
    <div className={s.wfItem}>
      <motion.div
        className={`${s.wfBox} ${tier.isMerchant ? s.wfBoxMerchant : ''}`}
        animate={{
          borderColor: lit ? tier.color : 'rgba(255,255,255,0.06)',
          boxShadow: lit ? `0 0 24px -4px ${tier.color}40` : '0 0 0 0 transparent',
        }}
        transition={{ duration: 0.35 }}
      >
        <div className={s.wfBoxRow}>
          <div className={s.wfBoxLeft}>
            <span className={s.wfBoxName}>{tier.name}</span>
            {tier.pct && <span className={s.wfBoxPct}>{tier.pct}</span>}
          </div>
          <motion.span
            className={s.wfBoxAmount}
            animate={{ color: lit ? tier.color : 'rgba(255,255,255,0.9)' }}
            transition={{ duration: 0.35 }}
          >
            {tier.amount > 0
              ? <AnimatedNumber value={tier.amount} prefix="$" />
              : <span className={s.wfBoxZero}>—</span>
            }
          </motion.span>
        </div>

        {tier.progress !== null && (
          <div className={s.wfBarWrap}>
            <div className={s.wfBar}>
              <motion.div
                className={s.wfBarFill}
                style={{ background: tier.color }}
                animate={{ width: `${Math.min(tier.progress, 100)}%` }}
                transition={{ duration: 1.1, ease: 'easeOut', delay: lit ? 0.25 : 0 }}
              />
            </div>
            <span className={s.wfBarLabel}>{tier.progress.toFixed(0)}% filled</span>
          </div>
        )}
      </motion.div>

      {!tier.isLast && (
        <div className={s.wfConnector}>
          <motion.div
            className={s.wfConnectorLine}
            animate={{ scaleY: connectorLit ? 1 : 0.3, opacity: connectorLit ? 1 : 0.25 }}
            style={{ transformOrigin: 'top', background: connectorLit ? tier.color : 'rgba(255,255,255,0.15)' }}
            transition={{ duration: 0.3 }}
          />
          <motion.div
            className={s.wfArrow}
            animate={{ color: connectorLit ? tier.color : 'rgba(255,255,255,0.15)' }}
            transition={{ duration: 0.3 }}
          >
            ▼
          </motion.div>
        </div>
      )}
    </div>
  )
})

// ── Session state ───────────────────────────────────────────────────────────
interface SessionState {
  totalRepaid: number
  paymentsCount: number
  revenueRouted: number
  merchantEarned: number
}

interface PaymentLog {
  id: string
  amount: number
  source: string
  txHash: string | null
  ts: string
}

// ── Main component ─────────────────────────────────────────────────────────
export default function X402Demo() {
  const [mounted,     setMounted]     = useState(false)
  const [amount,      setAmount]      = useState(2_500)
  const [rawInput,    setRawInput]    = useState('2500')
  const [source,      setSource]      = useState('shopbot')
  const [submitting,  setSubmitting]  = useState(false)
  const [activeTier,  setActiveTier]  = useState(-1)  // -1 = idle, 0-5 = animating
  const [lastSplit,   setLastSplit]   = useState<PaymentSplit | null>(null)
  const [txHash,      setTxHash]      = useState<string | null>(null)
  const [txUrl,       setTxUrl]       = useState<string | null>(null)
  const [demoMode,    setDemoMode]    = useState<'live' | 'demo' | null>(null)
  const [error,       setError]       = useState<string | null>(null)
  const [session,     setSession]     = useState<SessionState>({
    totalRepaid: DEMO_INIT_REPAID,
    paymentsCount: 0,
    revenueRouted: 0,
    merchantEarned: 0,
  })
  const [payments, setPayments] = useState<PaymentLog[]>([])

  useEffect(() => { setMounted(true) }, [])

  const handleAmountInput = useCallback((raw: string) => {
    setRawInput(raw)
    const v = parseFloat(raw.replace(/,/g, ''))
    if (!isNaN(v) && v > 0) {
      setAmount(Math.min(Math.max(Math.round(v * 100) / 100, 100), 10_000))
    }
  }, [])

  const handleSimulate = useCallback(async () => {
    if (submitting) return
    setSubmitting(true)
    setError(null)
    setActiveTier(-1)
    setTxHash(null)
    setTxUrl(null)
    setDemoMode(null)

    let split: PaymentSplit
    let txHashResult: string | null = null
    let txUrlResult: string | null = null
    let modeResult: 'live' | 'demo' = 'demo'

    try {
      const res = await fetch('/api/v1/demo/simulate-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, source }),
      })
      if (res.ok) {
        const data = await res.json()
        split = data.split
        txHashResult = data.txHash
        txUrlResult  = data.txUrl
        modeResult   = data.mode
      } else {
        split = computeSplitLocal(amount)
      }
    } catch {
      split = computeSplitLocal(amount)
    }

    setSubmitting(false)
    setLastSplit(split)
    setTxHash(txHashResult)
    setTxUrl(txUrlResult)
    setDemoMode(modeResult)

    // Animate tiers sequentially (200ms between each)
    const TIER_DELAY = 200
    for (let i = 0; i <= 5; i++) {
      setTimeout(() => setActiveTier(i), i * TIER_DELAY)
    }
    // Keep last state visible; reset on next payment

    // Update session totals
    const vaultCut = split.seniorTranche + split.liquidityPool + split.communityInvestors
    setSession(prev => ({
      totalRepaid:    prev.totalRepaid + vaultCut,
      paymentsCount:  prev.paymentsCount + 1,
      revenueRouted:  prev.revenueRouted + split.total,
      merchantEarned: prev.merchantEarned + split.merchantReceives,
    }))

    // Add to log
    const srcObj = TEST_SOURCES.find(t => t.id === source) ?? TEST_SOURCES[0]
    setPayments(prev => [{
      id:     Date.now().toString(),
      amount: split.total,
      source: srcObj.label,
      txHash: txHashResult,
      ts:     new Date().toLocaleTimeString(),
    }, ...prev.slice(0, 9)])
  }, [amount, source, submitting])

  // Compute cumulative tranche fill percentages (sequential waterfall)
  const seniorProgress    = Math.min((session.totalRepaid / SENIOR_TARGET) * 100, 100)
  const poolProgress      = Math.min(Math.max(((session.totalRepaid - SENIOR_TARGET) / POOL_TARGET) * 100, 0), 100)
  const communityProgress = Math.min(Math.max(((session.totalRepaid - SENIOR_TARGET - POOL_TARGET) / COMMUNITY_TARGET) * 100, 0), 100)

  const outstanding  = Math.max(DEMO_LOAN - session.totalRepaid, 0)
  const progressPct  = Math.min((session.totalRepaid / DEMO_LOAN) * 100, 100)

  // Preview split for current amount
  const preview = computeSplitLocal(amount)

  // Waterfall tier definitions
  const wfTiers: TierDef[] = lastSplit ? [
    {
      key: 'incoming', name: 'Incoming Payment', pct: null,
      color: 'rgba(255,255,255,0.9)', amount: lastSplit.total,
      progress: null,
    },
    {
      key: 'fee', name: 'Platform Fee', pct: '2.5%',
      color: '#6b7280', amount: lastSplit.platformFee,
      progress: null,
    },
    {
      key: 'senior', name: 'Senior Tranche', pct: '20% of net',
      color: '#3b82f6', amount: lastSplit.seniorTranche,
      progress: seniorProgress,
    },
    {
      key: 'pool', name: 'Liquidity Pool', pct: '10% of net',
      color: '#a855f7', amount: lastSplit.liquidityPool,
      progress: poolProgress,
    },
    {
      key: 'community', name: 'Community Investors', pct: '5% of net',
      color: '#f59e0b', amount: lastSplit.communityInvestors,
      progress: communityProgress,
    },
    {
      key: 'merchant', name: 'Merchant Receives', pct: '65% of net',
      color: '#22c55e', amount: lastSplit.merchantReceives,
      progress: null,
      isLast: true,
      isMerchant: true,
    },
  ] : []

  return (
    <div className={s.page}>
      <div className={s.ambientGlow} />

      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className={`${s.header} ${mounted ? s.visible : ''}`}>
        <span className={s.overline}>Krexa x402 Demo · Live on Base Sepolia</span>
        <h1 className={s.title}>Revenue Router — Live Demo</h1>
        <p className={s.subtitle}>
          Submit a payment and watch the PaymentRouter split it through the
          waterfall in real-time. Every cent accounted for. No trust required.
        </p>
      </header>

      {/* ── Main grid ───────────────────────────────────────────────── */}
      <div className={s.demoGrid}>

        {/* ── LEFT: Simulator + Waterfall ─────────────────────────── */}
        <div className={s.demoLeft}>

          {/* Payment Simulator ─────────────────────────────────────── */}
          <div className={s.simCard}>
            <div className={s.simCardHead}>
              <span className={s.simCardTitle}>x402 Payment Simulator</span>
              <AnimatePresence>
                {demoMode && (
                  <motion.span
                    className={demoMode === 'live' ? s.modeLive : s.modeDemo}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                  >
                    {demoMode === 'live'
                      ? <><span className={s.liveDot} /> On-chain</>
                      : 'Demo mode'}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>

            {/* Merchant info */}
            <div className={s.simMerchant}>
              <div className={s.simMerchantRow}>
                <span className={s.simMeta}>Merchant</span>
                <span className={s.simMerchantName}>
                  {DEMO_MERCHANT.name}
                  <code className={s.simAddr}>{DEMO_MERCHANT.address}</code>
                </span>
              </div>
              <div className={s.simMerchantRow}>
                <span className={s.simMeta}>Active Vault</span>
                <span className={s.simMerchantName}>
                  $100,000 loan —{' '}
                  <span className={s.simRepaid}>
                    $<AnimatedNumber value={session.totalRepaid} decimals={0} /> repaid
                  </span>
                </span>
              </div>
            </div>

            {/* Amount input */}
            <div className={s.simFields}>
              <div className={s.simField}>
                <label className={s.simLabel}>Payment Amount (USDC)</label>
                <div className={s.simInputRow}>
                  <div className={s.simInputWrap}>
                    <span className={s.simCurrSign}>$</span>
                    <input
                      type="number"
                      className={s.simInput}
                      value={rawInput}
                      min={100}
                      max={10000}
                      step={100}
                      onChange={e => handleAmountInput(e.target.value)}
                      onBlur={() => setRawInput(String(amount))}
                    />
                  </div>
                  <div className={s.simPresets}>
                    {PRESET_AMOUNTS.map(p => (
                      <button
                        key={p}
                        className={`${s.simPreset} ${amount === p ? s.simPresetActive : ''}`}
                        onClick={() => { setAmount(p); setRawInput(String(p)) }}
                      >
                        ${p >= 1000 ? `${p / 1000}K` : p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className={s.simField}>
                <label className={s.simLabel}>Payment Source</label>
                <select
                  className={s.simSelect}
                  value={source}
                  onChange={e => setSource(e.target.value)}
                >
                  {TEST_SOURCES.map(t => (
                    <option key={t.id} value={t.id}>{t.label} · {t.addr}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Split preview */}
            <div className={s.simPreview}>
              <div className={s.simPreviewRow}>
                <span>Platform fee</span>
                <span>${preview.platformFee.toFixed(2)}</span>
              </div>
              <div className={s.simPreviewRow}>
                <span>To vault (senior + pool + community)</span>
                <span>${(preview.seniorTranche + preview.liquidityPool + preview.communityInvestors).toFixed(2)}</span>
              </div>
              <div className={`${s.simPreviewRow} ${s.simPreviewHighlight}`}>
                <span>Merchant receives</span>
                <span>${preview.merchantReceives.toFixed(2)}</span>
              </div>
            </div>

            {/* CTA */}
            <button
              className={s.simCta}
              onClick={handleSimulate}
              disabled={submitting}
            >
              {submitting
                ? <><Loader2 size={16} className={s.spinning} /> Processing…</>
                : <><Zap size={16} /> Simulate x402 Payment</>
              }
            </button>

            {/* Status */}
            <AnimatePresence>
              {(txHash || demoMode) && !submitting && (
                <motion.div
                  className={s.simStatus}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <CheckCircle2 size={14} className={s.statusOk} />
                  {demoMode === 'live' && txHash ? (
                    <>
                      <span>Payment confirmed</span>
                      <a
                        className={s.txLink}
                        href={txUrl!}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {txHash.slice(0, 10)}…{txHash.slice(-6)}
                        <ExternalLink size={11} />
                      </a>
                    </>
                  ) : (
                    <span>Split calculated · oracle offline, demo mode active</span>
                  )}
                </motion.div>
              )}
              {error && (
                <motion.div className={s.simError} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <AlertCircle size={14} /> {error}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Waterfall Visualization ────────────────────────────────── */}
          <div className={s.wfCard}>
            <div className={s.wfCardHead}>
              <span className={s.wfCardTitle}>Payment Waterfall</span>
              {lastSplit && (
                <span className={s.wfCardAmount}>
                  $<AnimatedNumber value={lastSplit.total} decimals={2} /> USDC
                </span>
              )}
            </div>

            {!lastSplit ? (
              <div className={s.wfEmpty}>
                <Activity size={36} className={s.wfEmptyIcon} />
                <p>Simulate a payment to see the real-time waterfall</p>
                <span>Each tier lights up sequentially as funds flow through the protocol</span>
              </div>
            ) : (
              <div className={s.wfFlow}>
                {wfTiers.map((tier, i) => (
                  <WaterfallBox
                    key={tier.key}
                    tier={tier}
                    lit={activeTier >= i}
                    connectorLit={activeTier > i}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: Vault Health + Payment Log ───────────────────── */}
        <div className={s.demoRight}>

          {/* Vault Health ───────────────────────────────────────────── */}
          <div className={s.healthCard}>
            <div className={s.healthHead}>
              <span className={s.healthTitle}>Vault Health</span>
              <span className={s.healthVault}>{DEMO_MERCHANT.vault}</span>
            </div>

            <div className={s.healthStats}>
              <div className={s.healthStat}>
                <span className={s.healthStatLabel}>Total Loan</span>
                <span className={s.healthStatVal}>
                  $<AnimatedNumber value={DEMO_LOAN} decimals={2} />
                </span>
              </div>
              <div className={s.healthStat}>
                <span className={s.healthStatLabel}>Total Repaid</span>
                <span className={`${s.healthStatVal} ${s.healthGreen}`}>
                  $<AnimatedNumber value={session.totalRepaid} decimals={2} />
                </span>
              </div>
              <div className={s.healthStat}>
                <span className={s.healthStatLabel}>Outstanding</span>
                <span className={s.healthStatVal}>
                  $<AnimatedNumber value={outstanding} decimals={2} />
                </span>
              </div>
            </div>

            <div className={s.healthProgressWrap}>
              <div className={s.healthBar}>
                <motion.div
                  className={s.healthBarFill}
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 0.9, ease: 'easeOut' }}
                />
              </div>
              <div className={s.healthBarMeta}>
                <span>Progress</span>
                <span className={s.healthBarPct}>{progressPct.toFixed(1)}%</span>
              </div>
            </div>

            <div className={s.healthDivider} />

            {/* Tranche breakdown */}
            <div className={s.trancheList}>
              {[
                { label: 'Senior Pool',          color: '#3b82f6', pct: seniorProgress,    target: SENIOR_TARGET },
                { label: 'Liquidity Pool',        color: '#a855f7', pct: poolProgress,      target: POOL_TARGET },
                { label: 'Community Investors',   color: '#f59e0b', pct: communityProgress, target: COMMUNITY_TARGET },
              ].map(t => (
                <div key={t.label} className={s.trancheItem}>
                  <div className={s.trancheItemHead}>
                    <span className={s.trancheLabel}>{t.label}</span>
                    <span className={s.tranchePct} style={{ color: t.color }}>{t.pct.toFixed(0)}%</span>
                  </div>
                  <div className={s.trancheBar}>
                    <motion.div
                      className={s.trancheBarFill}
                      style={{ background: t.color }}
                      animate={{ width: `${t.pct}%` }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className={s.healthDivider} />

            <div className={s.healthStats}>
              <div className={s.healthStat}>
                <span className={s.healthStatLabel}>Payments Today</span>
                <span className={s.healthStatVal}>{session.paymentsCount}</span>
              </div>
              <div className={s.healthStat}>
                <span className={s.healthStatLabel}>Revenue Routed</span>
                <span className={s.healthStatVal}>
                  {session.revenueRouted > 0
                    ? <>${session.revenueRouted.toLocaleString()}</>
                    : '—'}
                </span>
              </div>
              <div className={s.healthStat}>
                <span className={s.healthStatLabel}>Merchant Earned</span>
                <span className={`${s.healthStatVal} ${s.healthGreen}`}>
                  {session.merchantEarned > 0
                    ? <>${session.merchantEarned.toFixed(2)}</>
                    : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Log ────────────────────────────────────────────── */}
          <div className={s.logCard}>
            <div className={s.logHead}>
              <span className={s.logTitle}>Recent Payments</span>
              {payments.length > 0 && (
                <span className={s.logCount}>{payments.length}</span>
              )}
            </div>

            {payments.length === 0 ? (
              <div className={s.logEmpty}>No payments yet · click Simulate</div>
            ) : (
              <div className={s.logList}>
                <AnimatePresence initial={false}>
                  {payments.map(p => (
                    <motion.div
                      key={p.id}
                      className={s.logRow}
                      initial={{ opacity: 0, x: 12, height: 0 }}
                      animate={{ opacity: 1, x: 0,  height: 'auto' }}
                      exit={{ opacity: 0, x: -12 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className={s.logLeft}>
                        <span className={s.logSource}>{p.source}</span>
                        <span className={s.logTime}>{p.ts}</span>
                      </div>
                      <div className={s.logRight}>
                        <span className={s.logAmount}>${p.amount.toLocaleString()}</span>
                        {p.txHash && (
                          <a
                            className={s.logTxBtn}
                            href={`https://sepolia.basescan.org/tx/${p.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink size={10} />
                          </a>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
