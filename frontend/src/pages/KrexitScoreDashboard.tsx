import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { scoreApi } from '../api/solanaClient'
import { BentoGrid, BentoCard } from '../components/ui/BentoGrid'
import { GlassCard } from '../components/ui/GlassCard'
import { StatWidget } from '../components/ui/StatWidget'
import { AnimatedNumber } from '../components/ui/AnimatedNumber'
import { Skeleton } from '../components/ui/Skeleton'
import DecryptedText from '../components/ui/DecryptedText'
import SolanaLayout from '../components/layout/SolanaLayout'
import { formatUsdc, formatBps } from '../utils/dashboardHelpers'
import { containerVariants, cardVariants } from '../utils/motionVariants'
import s from './KrexitScoreDashboard.module.css'

// ── Constants ──────────────────────────────────────────────────────────────

const CREDIT_LEVELS: Record<number, { name: string; threshold: number }> = {
  1: { name: 'Starter',     threshold: 200 },
  2: { name: 'Established', threshold: 500 },
  3: { name: 'Trusted',     threshold: 650 },
  4: { name: 'Elite',       threshold: 750 },
}

const KYA_TIERS: Record<number, string>   = { 0: 'None', 1: 'Basic', 2: 'Enhanced', 3: 'Institutional' }
const AGENT_TYPES: Record<number, string> = { 0: 'Trader', 1: 'Service', 2: 'Hybrid' }

const EVENT_TYPE_LABELS: string[] = [
  'Daily Update', 'On-Time Repayment', 'Early Repayment', 'Late Repayment',
  'Missed Payment', 'Liquidation', 'Default', 'Cycle Complete',
  'Level Change', 'KYA Upgrade', 'Milestone', 'Revenue Health', 'Wind-Down', 'Manual',
]

const COMPONENTS = [
  { key: 'c1Repayment',    name: 'Repayment',  weight: 30, rgb: '59, 130, 246',  color: '#3B82F6' },
  { key: 'c2Profitability', name: 'Profit',    weight: 25, rgb: '34, 197, 94',   color: '#22C55E' },
  { key: 'c3Behavioral',   name: 'Behavioral', weight: 20, rgb: '139, 92, 246',  color: '#8B5CF6' },
  { key: 'c4Usage',        name: 'Usage',      weight: 15, rgb: '245, 158, 11',  color: '#F59E0B' },
  { key: 'c5Maturity',     name: 'Maturity',   weight: 10, rgb: '6, 182, 212',   color: '#06B6D4' },
] as const

const EVENT_COUNTERS = [
  { key: 'onTimeRepayments',      label: 'On-Time',    color: '#22C55E' },
  { key: 'lateRepayments',        label: 'Late',       color: '#F59E0B' },
  { key: 'missedRepayments',      label: 'Missed',     color: '#F97316' },
  { key: 'liquidations',          label: 'Liquidations', color: '#EF4444' },
  { key: 'defaults',              label: 'Defaults',   color: '#DC2626' },
  { key: 'creditCyclesCompleted', label: 'Cycles',     color: '#3B82F6' },
  { key: 'totalTransactions',     label: 'Total Txns', color: '#64748B' },
] as const

// ── Types ──────────────────────────────────────────────────────────────────

interface HistoryEntry {
  timestamp: string
  oldScore: number
  newScore: number
  eventType: number
  deltaBps: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type KrexitData = any

// ── Helpers ────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 750) return '#3B82F6'
  if (score >= 650) return '#22C55E'
  if (score >= 500) return '#F59E0B'
  if (score >= 400) return '#F97316'
  return '#EF4444'
}

function scoreRgb(score: number): string {
  if (score >= 750) return '59, 130, 246'
  if (score >= 650) return '34, 197, 94'
  if (score >= 500) return '245, 158, 11'
  if (score >= 400) return '249, 115, 22'
  return '239, 68, 68'
}

function formatTimestamp(unix: string): string {
  const n = Number(unix)
  if (!n) return '—'
  return new Date(n * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTimestampShort(unix: string): string {
  const n = Number(unix)
  if (!n) return '—'
  return new Date(n * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Score Gauge SVG ────────────────────────────────────────────────────────

function ScoreGauge({ score }: { score: number }) {
  const min = 200
  const max = 850
  const pct = Math.max(0, Math.min(1, (score - min) / (max - min)))
  const color = scoreColor(score)

  const r = 78
  const cx = 100
  const cy = 105
  const startAngle = 135
  const totalAngle = 270
  const arcAngle = totalAngle * pct

  function polarToXY(angle: number) {
    const rad = ((angle - 90) * Math.PI) / 180
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
  }

  const s0 = polarToXY(startAngle)
  const se = polarToXY(startAngle + totalAngle)
  const ae = polarToXY(startAngle + arcAngle)
  const largeArc = arcAngle > 180 ? 1 : 0

  return (
    <svg width="200" height="175" style={{ filter: `drop-shadow(0 0 20px rgba(${scoreRgb(score)}, 0.35))` }}>
      {/* Track */}
      <path
        d={`M ${s0.x} ${s0.y} A ${r} ${r} 0 1 1 ${se.x} ${se.y}`}
        fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="12" strokeLinecap="round"
      />
      {/* Fill */}
      {arcAngle > 0 && (
        <motion.path
          d={`M ${s0.x} ${s0.y} A ${r} ${r} 0 ${largeArc} 1 ${ae.x} ${ae.y}`}
          fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
        />
      )}
      {/* Endpoint glow */}
      {arcAngle > 0 && (
        <circle cx={ae.x} cy={ae.y} r="8" fill={color} opacity="0.85">
          <animate attributeName="opacity" values="0.85;0.45;0.85" dur="2s" repeatCount="indefinite" />
        </circle>
      )}
      {/* Score value */}
      <text x={cx} y={cy - 12} textAnchor="middle" fill={color}
        fontSize="38" fontWeight="800" fontFamily="var(--font-display)" letterSpacing="-1">
        {score}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill="var(--text-dim)" fontSize="12">
        out of 850
      </text>
    </svg>
  )
}

// ── Circular progress ring for components ────────────────────────────────

function ComponentRing({ value, color, size = 64 }: { value: number; color: string; size?: number }) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(1, value / 10000)) // bps 0-10000

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="5" />
      <motion.circle
        cx={size/2} cy={size/2} r={r}
        fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ * (1 - pct) }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      />
    </svg>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

function CardSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height={32} width={i % 2 === 0 ? '70%' : '50%'} />
      ))}
    </div>
  )
}

export default function KrexitScoreDashboard() {
  const [address, setAddress] = useState('')
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<KrexitData | null>(null)

  const loadScore = useCallback(async (addr: string) => {
    if (!addr.trim()) return
    setSearched(true)
    setLoading(true)
    setError(null)
    setData(null)
    try {
      const [scoreRes, profileRes] = await Promise.all([
        scoreApi.getScore(addr),
        scoreApi.getProfile(addr),
      ])
      setData({ ...profileRes.data, ...scoreRes.data })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Agent not found or request failed')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    loadScore(address)
  }

  // History
  const orderedHistory: HistoryEntry[] = data?.history
    ? (() => {
        const h = data.history
        const idx = data.historyIndex ?? 0
        const out: HistoryEntry[] = []
        for (let i = 0; i < h.length; i++) {
          const entry = h[(idx - 1 - i + h.length) % h.length]
          if (entry && Number(entry.timestamp) > 0) out.push(entry)
        }
        return out.slice(0, 30)
      })()
    : []

  // Level progress
  const curLevel  = data?.creditLevel ?? 1
  const nextLevel = Math.min(curLevel + 1, 4)
  const curThresh  = CREDIT_LEVELS[curLevel]?.threshold ?? 200
  const nextThresh = CREDIT_LEVELS[nextLevel]?.threshold ?? 850
  const levelProgress = data
    ? (curLevel >= 4 ? 100 : Math.max(0, Math.min(100, ((data.score - curThresh) / (nextThresh - curThresh)) * 100)))
    : 0

  const score = data?.score ?? 0

  return (
    <SolanaLayout
      title="Krexit Score"
      subtitle="Comprehensive on-chain credit score for any Krexa agent."
      dataLoaded={!!data}
    >
      <motion.div variants={containerVariants} initial="hidden" animate="visible">

        {/* Search */}
        <motion.div variants={cardVariants} style={{ marginBottom: 16 }}>
          <GlassCard variant="highlight">
            <form onSubmit={handleSubmit} className={s.searchInner}>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Enter agent Solana pubkey..."
                className={s.searchInput}
                spellCheck={false}
              />
              <button
                type="submit"
                disabled={!address.trim()}
                className="btn-primary"
                style={{ borderRadius: 'var(--radius-lg)', padding: '14px 28px' }}
              >
                Lookup Score
              </button>
            </form>
          </GlassCard>
        </motion.div>

        <AnimatePresence>
          {!searched && (
            <motion.div className={s.emptyState} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="1.2">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              <p className={s.emptyText}>Look up any agent's Krexit Score</p>
              <p className={s.emptyHint}>5-component behavioral credit score ranging 200–850</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading state */}
        {loading && (
          <motion.div variants={cardVariants} style={{ marginBottom: 16 }}>
            <GlassCard><CardSkeleton rows={6} /></GlassCard>
          </motion.div>
        )}

        {/* Error */}
        {error && (
          <motion.div variants={cardVariants} style={{ marginBottom: 16 }}>
            <GlassCard>
              <p style={{ color: 'var(--color-error)', fontSize: 13 }}>{error}</p>
            </GlassCard>
          </motion.div>
        )}

        {/* ── Score Hero ── */}
        {data && (
          <>
            <motion.div variants={cardVariants} style={{ marginBottom: 16 }}>
              <BentoCard glowColor={scoreRgb(score)}>
                <p className={s.cardTitle}>Score Overview</p>
                <div className={s.scoreHeroInner}>
                  <div className={s.scoreGaugeSide}>
                    <ScoreGauge score={score} />
                    <p className={s.scoreLabel}>{score >= 750 ? 'Elite' : score >= 650 ? 'Trusted' : score >= 500 ? 'Established' : score >= 400 ? 'Building' : 'New'}</p>
                  </div>
                  <div className={s.scoreInfoSide}>
                    <div className={s.badgeRow}>
                      <span className={s.badge} style={{ background: `rgba(${scoreRgb(score)}, 0.12)`, color: scoreColor(score), borderColor: `rgba(${scoreRgb(score)}, 0.25)` }}>
                        <DecryptedText text={`L${curLevel} ${CREDIT_LEVELS[curLevel]?.name ?? ''}`} animateOn="view" sequential speed={40} />
                      </span>
                      <span className={s.badge} style={{ background: 'rgba(59,130,246,0.1)', color: '#60A5FA', borderColor: 'rgba(59,130,246,0.2)' }}>
                        KYA {KYA_TIERS[data.kyaTier] ?? data.kyaTier}
                      </span>
                      <span className={s.badge} style={{ background: 'rgba(139,92,246,0.1)', color: '#A78BFA', borderColor: 'rgba(139,92,246,0.2)' }}>
                        {AGENT_TYPES[data.agentType] ?? 'Unknown'}
                      </span>
                      <span className={s.badge} style={
                        data.isBlacklisted
                          ? { background: 'rgba(239,68,68,0.12)', color: '#F87171', borderColor: 'rgba(239,68,68,0.2)' }
                          : data.isActive
                            ? { background: 'rgba(16,185,129,0.12)', color: '#34D399', borderColor: 'rgba(16,185,129,0.2)' }
                            : { background: 'rgba(100,116,139,0.12)', color: '#94A3B8', borderColor: 'rgba(100,116,139,0.2)' }
                      }>
                        {data.isBlacklisted ? 'Blacklisted' : data.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className={s.stats2}>
                      <StatWidget label="Registered" value={formatTimestamp(data.registeredAt)} />
                      <StatWidget label="Last Updated" value={formatTimestamp(data.lastScoreUpdate)} />
                      <StatWidget label="Last Repayment" value={formatTimestamp(data.lastRepayment)} />
                      <StatWidget label="Last Critical Event" value={formatTimestamp(data.lastCriticalEvent)} />
                    </div>
                  </div>
                </div>
              </BentoCard>
            </motion.div>

            {/* ── Component Breakdown ── */}
            <motion.div variants={cardVariants} style={{ marginBottom: 16 }}>
              <p className={s.cardTitle} style={{ paddingLeft: 2 }}>Score Components</p>
              <BentoGrid columns={5} gap={12}>
                {COMPONENTS.map((comp) => {
                  const bpsVal = data[comp.key] ?? 0
                  const pct = (bpsVal / 10000) * 100
                  return (
                    <motion.div key={comp.key} variants={cardVariants}>
                      <BentoCard glowColor={comp.rgb}>
                        <div className={s.componentRingWrap}>
                          <ComponentRing value={bpsVal} color={comp.color} size={68} />
                          <p className={s.componentName} style={{ color: comp.color }}>{comp.name}</p>
                          <p className={s.componentWeight}>{comp.weight}% weight</p>
                          <p className={s.componentScore} style={{ color: comp.color }}>
                            <AnimatedNumber value={pct} decimals={1} suffix="%" />
                          </p>
                          <p style={{ fontSize: 10, color: 'var(--text-dim)' }}>{bpsVal} bps</p>
                        </div>
                      </BentoCard>
                    </motion.div>
                  )
                })}
              </BentoGrid>
            </motion.div>

            {/* ── Score History ── */}
            <motion.div variants={cardVariants} style={{ marginBottom: 16 }}>
              <GlassCard>
                <p className={s.cardTitle}>Score History</p>
                {orderedHistory.length === 0 ? (
                  <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>No history available.</p>
                ) : (
                  <div className={s.historyList}>
                    {orderedHistory.map((entry, i) => {
                      const delta = entry.newScore - entry.oldScore
                      const deltaClass = delta > 0 ? s.deltaPos : delta < 0 ? s.deltaNeg : s.deltaZero
                      return (
                        <div key={i} className={s.historyRow}>
                          <span className={s.historyEvent}>
                            {EVENT_TYPE_LABELS[entry.eventType] ?? `Event ${entry.eventType}`}
                          </span>
                          <span className={s.historyDate}>{formatTimestampShort(entry.timestamp)}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                            {entry.oldScore} → {entry.newScore}
                          </span>
                          <span className={`${s.historyDelta} ${deltaClass}`}>
                            {delta > 0 ? '+' : ''}{delta}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </GlassCard>
            </motion.div>

            {/* ── Event Counters ── */}
            <motion.div variants={cardVariants} style={{ marginBottom: 16 }}>
              <p className={s.cardTitle} style={{ paddingLeft: 2 }}>Event Counters</p>
              <BentoGrid columns={7} gap={10}>
                {EVENT_COUNTERS.map((ec) => (
                  <motion.div key={ec.key} variants={cardVariants}>
                    <BentoCard glowColor={ec.color.replace('#', '').match(/.{2}/g)?.map(h => parseInt(h, 16)).join(', ') ?? '100, 116, 139'}>
                      <div style={{ position: 'relative', paddingLeft: 10 }}>
                        <div className={s.counterLeft} style={{ background: ec.color }} />
                        <p style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
                          {ec.label}
                        </p>
                        <p style={{ fontSize: '1.5rem', fontWeight: 800, color: ec.color, fontFamily: 'var(--font-display)' }}>
                          <AnimatedNumber value={data[ec.key] ?? 0} />
                        </p>
                      </div>
                    </BentoCard>
                  </motion.div>
                ))}
              </BentoGrid>
            </motion.div>

            {/* ── Financial Metrics ── */}
            <motion.div variants={cardVariants} style={{ marginBottom: 16 }}>
              <GlassCard>
                <p className={s.cardTitle}>Financial Metrics</p>
                <div className={s.stats3}>
                  <StatWidget label="Cumulative Borrowed" value={formatUsdc(data.cumulativeBorrowed ?? 0)} />
                  <StatWidget label="Cumulative Repaid" value={formatUsdc(data.cumulativeRepaid ?? 0)} />
                  <StatWidget label="Current Debt" value={formatUsdc(data.currentDebt ?? 0)} trend={Number(data.currentDebt) > 0 ? 'down' : 'neutral'} />
                  <StatWidget label="P&L Ratio" value={formatBps(data.pnlRatioBps ?? 0)} trend={data.pnlRatioBps > 0 ? 'up' : 'down'} />
                  <StatWidget label="Max Drawdown" value={formatBps(data.maxDrawdownBps ?? 0)} />
                  <StatWidget label="Sharpe Ratio" value={(((data.sharpeRatioBps ?? 0) / 100)).toFixed(2)} trend={data.sharpeRatioBps > 0 ? 'up' : 'neutral'} />
                </div>
              </GlassCard>
            </motion.div>

            {/* ── Zone Time Distribution ── */}
            <motion.div variants={cardVariants} style={{ marginBottom: 16 }}>
              <GlassCard>
                <p className={s.cardTitle}>Time in Health Zones</p>
                <div className={s.zoneBar}>
                  {[
                    { key: 'greenTimeBps',  color: '#22C55E' },
                    { key: 'yellowTimeBps', color: '#F59E0B' },
                    { key: 'orangeTimeBps', color: '#F97316' },
                    { key: 'redTimeBps',    color: '#EF4444' },
                  ].map((zone) => (
                    <motion.div
                      key={zone.key}
                      className={s.zoneSegment}
                      style={{ background: zone.color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${(data[zone.key] ?? 0) / 100}%` }}
                      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    />
                  ))}
                </div>
                <div className={s.zoneLegend}>
                  {[
                    { key: 'greenTimeBps',  label: 'Healthy',     color: '#22C55E' },
                    { key: 'yellowTimeBps', label: 'Warning',     color: '#F59E0B' },
                    { key: 'orangeTimeBps', label: 'Danger',      color: '#F97316' },
                    { key: 'redTimeBps',    label: 'Liquidation', color: '#EF4444' },
                  ].map((zone) => (
                    <div key={zone.key} className={s.zoneLegendItem}>
                      <div className={s.zoneDot} style={{ background: zone.color }} />
                      <span>{zone.label}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: zone.color }}>
                        <AnimatedNumber value={(data[zone.key] ?? 0) / 100} decimals={1} suffix="%" />
                      </span>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </motion.div>

            {/* ── Usage Metrics ── */}
            <motion.div variants={cardVariants} style={{ marginBottom: 16 }}>
              <GlassCard>
                <p className={s.cardTitle}>Usage Metrics</p>
                <div className={s.stats3}>
                  <StatWidget label="Venue Entropy" value={formatBps(data.venueEntropyBps ?? 0)} />
                  <StatWidget label="Unique Venues" value={<AnimatedNumber value={data.uniqueVenues ?? 0} /> as unknown as string} />
                  <StatWidget label="Avg Daily Volume" value={formatUsdc(data.avgDailyVolume ?? 0)} />
                </div>
              </GlassCard>
            </motion.div>

            {/* ── Level Upgrade Path ── */}
            <motion.div variants={cardVariants} style={{ marginBottom: 16 }}>
              <GlassCard>
                <p className={s.cardTitle}>Level Upgrade Path</p>
                <div className={s.upgradeSteps}>
                  {[1, 2, 3, 4].map((lvl) => (
                    <div key={lvl} className={`${s.upgradeStep} ${lvl < curLevel ? s.done : ''}`}>
                      <div className={`${s.stepDot} ${lvl === curLevel ? s.current : lvl < curLevel ? s.done : ''}`}>
                        {lvl < curLevel ? '✓' : `L${lvl}`}
                      </div>
                      <span className={`${s.stepLabel} ${lvl === curLevel ? s.current : lvl < curLevel ? s.done : ''}`}>
                        {CREDIT_LEVELS[lvl]?.name}
                      </span>
                    </div>
                  ))}
                </div>
                {curLevel < 4 && (
                  <>
                    <div className={s.progressTrack}>
                      <motion.div
                        className={s.progressFill}
                        initial={{ width: 0 }}
                        animate={{ width: `${levelProgress}%` }}
                        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                      />
                    </div>
                    <div className={s.progressLabels}>
                      <span>L{curLevel} ({curThresh} pts)</span>
                      <span style={{ color: 'var(--accent)' }}>
                        <AnimatedNumber value={levelProgress} decimals={0} suffix="%" /> to L{nextLevel}
                      </span>
                      <span>L{nextLevel} ({nextThresh} pts)</span>
                    </div>
                  </>
                )}
                {curLevel >= 4 && (
                  <div style={{ textAlign: 'center', padding: '12px 0', color: '#3B82F6', fontSize: 14, fontWeight: 700 }}>
                    🏆 Maximum Level Achieved
                  </div>
                )}
              </GlassCard>
            </motion.div>

            {/* ── Service Metrics (Type B only) ── */}
            {data.agentType === 1 && (
              <motion.div variants={cardVariants} style={{ marginBottom: 16 }}>
                <GlassCard>
                  <p className={s.cardTitle}>Service Metrics</p>
                  <div className={s.stats2}>
                    <StatWidget
                      label="Revenue Health"
                      value={<AnimatedNumber value={(data.revenueHealthBps ?? 0) / 100} decimals={1} suffix="%" /> as unknown as string}
                    />
                    <StatWidget
                      label="Milestone Rate"
                      value={<AnimatedNumber value={(data.milestoneCompletionRateBps ?? 0) / 100} decimals={1} suffix="%" /> as unknown as string}
                    />
                  </div>
                </GlassCard>
              </motion.div>
            )}
          </>
        )}
      </motion.div>
    </SolanaLayout>
  )
}
