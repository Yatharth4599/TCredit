import { useState, useCallback } from 'react'
import { scoreApi } from '../api/solanaClient'
import styles from './KrexitScoreDashboard.module.css'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CREDIT_LEVELS: Record<number, { name: string; threshold: number }> = {
  1: { name: 'Starter', threshold: 200 },
  2: { name: 'Established', threshold: 500 },
  3: { name: 'Trusted', threshold: 650 },
  4: { name: 'Elite', threshold: 750 },
}

const KYA_TIERS: Record<number, string> = {
  0: 'None',
  1: 'Basic',
  2: 'Enhanced',
  3: 'Institutional',
}

const AGENT_TYPES: Record<number, string> = {
  0: 'Trader',
  1: 'Service',
  2: 'Hybrid',
}

const EVENT_TYPE_LABELS: string[] = [
  'Daily Update',
  'On-Time Repayment',
  'Early Repayment',
  'Late Repayment',
  'Missed Payment',
  'Liquidation',
  'Default',
  'Cycle Complete',
  'Level Change',
  'KYA Upgrade',
  'Milestone Complete',
  'Revenue Health',
  'Wind-Down',
  'Manual Adjustment',
]

const COMPONENTS = [
  { key: 'c1Repayment',    name: 'Repayment History', weight: 30, nameClass: styles.compNameC1, fillClass: styles.compBarFillC1 },
  { key: 'c2Profitability', name: 'Profitability',     weight: 25, nameClass: styles.compNameC2, fillClass: styles.compBarFillC2 },
  { key: 'c3Behavioral',   name: 'Behavioral Health', weight: 20, nameClass: styles.compNameC3, fillClass: styles.compBarFillC3 },
  { key: 'c4Usage',        name: 'Usage Patterns',    weight: 15, nameClass: styles.compNameC4, fillClass: styles.compBarFillC4 },
  { key: 'c5Maturity',     name: 'Account Maturity',  weight: 10, nameClass: styles.compNameC5, fillClass: styles.compBarFillC5 },
] as const

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HistoryEntry {
  timestamp: string
  oldScore: number
  newScore: number
  eventType: number
  deltaBps: number
}

interface KrexitScoreData {
  agent: string
  owner: string
  score: number
  creditLevel: number
  kyaTier: number
  c1Repayment: number
  c2Profitability: number
  c3Behavioral: number
  c4Usage: number
  c5Maturity: number
  onTimeRepayments: number
  lateRepayments: number
  missedRepayments: number
  liquidations: number
  defaults: number
  creditCyclesCompleted: number
  cumulativeBorrowed: string
  cumulativeRepaid: string
  currentDebt: string
  pnlRatioBps: number
  maxDrawdownBps: number
  sharpeRatioBps: number
  greenTimeBps: number
  yellowTimeBps: number
  orangeTimeBps: number
  redTimeBps: number
  venueEntropyBps: number
  uniqueVenues: number
  totalTransactions: number
  avgDailyVolume: string
  registeredAt: string
  lastScoreUpdate: string
  lastCriticalEvent: string
  lastRepayment: string
  history: HistoryEntry[]
  historyIndex: number
  agentType: number
  revenueHealthBps: number
  milestoneCompletionRateBps: number
  isActive: boolean
  isBlacklisted: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatUsdc(raw: number | string): string {
  const val = Number(raw) / 1e6
  return val.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function formatBps(bps: number): string {
  return (bps / 100).toFixed(2) + '%'
}

function formatSharpe(bps: number): string {
  return (bps / 100).toFixed(2)
}

function formatTimestamp(unix: string): string {
  const n = Number(unix)
  if (!n) return '--'
  return new Date(n * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTimestampShort(unix: string): string {
  const n = Number(unix)
  if (!n) return '--'
  return new Date(n * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function scoreColor(score: number): string {
  if (score >= 750) return '#3b82f6'
  if (score >= 650) return '#22c55e'
  if (score >= 500) return '#eab308'
  if (score >= 400) return '#f97316'
  return '#ef4444'
}

// ---------------------------------------------------------------------------
// Small components
// ---------------------------------------------------------------------------

function LoadingSpinner() {
  return (
    <div className={styles.spinnerWrap}>
      <div className={styles.spinner} />
    </div>
  )
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className={styles.errorBanner}>
      {message}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Score Gauge (SVG circle)
// ---------------------------------------------------------------------------

function ScoreGauge({ score }: { score: number }) {
  const min = 200
  const max = 850
  const pct = Math.max(0, Math.min(1, (score - min) / (max - min)))
  const radius = 90
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - pct * 0.75) // 270-degree arc
  const color = scoreColor(score)

  return (
    <div className={styles.gaugeWrap}>
      <svg viewBox="0 0 200 200" className={styles.gaugeSvg}>
        {/* Background arc */}
        <circle
          cx="100" cy="100" r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="14"
          strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
          strokeLinecap="round"
        />
        {/* Score arc */}
        <circle
          cx="100" cy="100" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease-out, stroke 0.5s ease' }}
        />
      </svg>
      <div className={styles.gaugeOverlay}>
        <span className={styles.gaugeScore}>{score}</span>
        <span className={styles.gaugeMax}>out of 850</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function KrexitScoreDashboard() {
  const [address, setAddress] = useState('')
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<KrexitScoreData | null>(null)

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
      // Merge both responses into one data object
      setData({ ...profileRes.data, ...scoreRes.data } as KrexitScoreData)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Agent not found or request failed'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    loadScore(address)
  }

  // Ordered history (last 30 from ring buffer)
  const orderedHistory = data?.history
    ? (() => {
        const h = data.history
        const idx = data.historyIndex ?? 0
        const ordered: HistoryEntry[] = []
        for (let i = 0; i < h.length; i++) {
          const entry = h[(idx - 1 - i + h.length) % h.length]
          if (entry && Number(entry.timestamp) > 0) ordered.push(entry)
        }
        return ordered.slice(0, 30)
      })()
    : []

  // Level progress
  const nextLevel = data ? Math.min((data.creditLevel ?? 1) + 1, 4) : 2
  const nextThreshold = CREDIT_LEVELS[nextLevel]?.threshold ?? 850
  const currentThreshold = data ? (CREDIT_LEVELS[data.creditLevel]?.threshold ?? 200) : 200
  const levelProgress = data
    ? data.creditLevel >= 4
      ? 100
      : Math.max(0, Math.min(100, ((data.score - currentThreshold) / (nextThreshold - currentThreshold)) * 100))
    : 0

  return (
    <div className={styles.page}>
      <div className={styles.inner}>

        {/* Header */}
        <div className={styles.header}>
          <h1 className={styles.pageTitle}>Krexit Score Dashboard</h1>
          <p className={styles.subtitle}>Inspect any agent's on-chain credit score, component breakdown, and history.</p>
        </div>

        {/* Search */}
        <form onSubmit={handleSubmit} className={styles.searchForm}>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Enter Solana agent pubkey..."
            className={styles.searchInput}
          />
          <button
            type="submit"
            disabled={!address.trim() || loading}
            className={styles.submitBtn}
          >
            {loading ? 'Loading...' : 'Lookup Score'}
          </button>
        </form>

        {/* Empty state */}
        {!searched && (
          <div className={styles.emptyState}>
            Paste a Solana agent public key above to view their Krexit Score.
          </div>
        )}

        {/* Loading */}
        {searched && loading && <LoadingSpinner />}

        {/* Error */}
        {searched && error && <ErrorBanner message={error} />}

        {/* Data */}
        {searched && data && !loading && (
          <div>

            {/* === 1. Score Gauge Hero === */}
            <div className={styles.section}>
              <div className={styles.scoreHeroCard}>
                <ScoreGauge score={data.score ?? 200} />
                <div className={styles.scoreMeta}>
                  <div className={styles.badgesRow}>
                    <span className={`${styles.badge} ${styles.badgeLevel}`}>
                      L{data.creditLevel} {CREDIT_LEVELS[data.creditLevel]?.name ?? 'Unknown'}
                    </span>
                    <span className={`${styles.badge} ${styles.badgeKya}`}>
                      KYA: {KYA_TIERS[data.kyaTier] ?? data.kyaTier}
                    </span>
                    <span className={`${styles.badge} ${styles.badgeType}`}>
                      {AGENT_TYPES[data.agentType] ?? 'Unknown'}
                    </span>
                    {data.isActive && (
                      <span className={`${styles.badge} ${styles.badgeActive}`}>Active</span>
                    )}
                    {data.isBlacklisted && (
                      <span className={`${styles.badge} ${styles.badgeBlacklisted}`}>Blacklisted</span>
                    )}
                  </div>
                  <div className={styles.metaDatesGrid}>
                    <div>
                      <p className={styles.metaItemLabel}>Registered</p>
                      <p className={styles.metaItemValue}>{formatTimestamp(data.registeredAt)}</p>
                    </div>
                    <div>
                      <p className={styles.metaItemLabel}>Last Updated</p>
                      <p className={styles.metaItemValue}>{formatTimestamp(data.lastScoreUpdate)}</p>
                    </div>
                    <div>
                      <p className={styles.metaItemLabel}>Last Repayment</p>
                      <p className={styles.metaItemValue}>{formatTimestamp(data.lastRepayment)}</p>
                    </div>
                    <div>
                      <p className={styles.metaItemLabel}>Last Critical</p>
                      <p className={styles.metaItemValue}>{formatTimestamp(data.lastCriticalEvent)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* === 2. Component Breakdown === */}
            <div className={styles.section}>
              <span className={styles.sectionLabel}>Component Breakdown</span>
              <div className={styles.componentsGrid}>
                {COMPONENTS.map((c) => {
                  const raw = (data as unknown as Record<string, unknown>)[c.key] as number ?? 0
                  const pct = Math.min(raw / 100, 100)
                  return (
                    <div key={c.key} className={styles.componentCard}>
                      <p className={`${styles.compName} ${c.nameClass}`}>{c.name}</p>
                      <p className={styles.compWeight}>Weight: {c.weight}%</p>
                      <p className={styles.compScore}>{pct.toFixed(1)}%</p>
                      <div className={styles.compBarTrack}>
                        <div
                          className={`${styles.compBarFill} ${c.fillClass}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className={styles.compBps}>{raw.toLocaleString()} / 10,000 BPS</p>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* === 3. Score History Timeline === */}
            <div className={styles.section}>
              <div className={styles.historyWrap}>
                <span className={styles.sectionLabel}>Score History</span>
                {orderedHistory.length === 0 ? (
                  <p className={styles.historyEmpty}>No history entries yet.</p>
                ) : (
                  <div className={styles.historyScroll}>
                    {orderedHistory.map((entry, i) => {
                      const delta = entry.newScore - entry.oldScore
                      const deltaPct = entry.deltaBps / 100
                      const deltaClass = delta > 0 ? styles.historyDeltaPos : delta < 0 ? styles.historyDeltaNeg : styles.historyDeltaZero
                      return (
                        <div
                          key={i}
                          className={`${styles.historyRow} ${i % 2 === 0 ? styles.historyRowEven : styles.historyRowOdd}`}
                        >
                          <div className={styles.historyLeft}>
                            <span className={styles.historyDate}>{formatTimestampShort(entry.timestamp)}</span>
                            <span className={styles.historyEventBadge}>
                              {EVENT_TYPE_LABELS[entry.eventType] ?? `Event ${entry.eventType}`}
                            </span>
                          </div>
                          <div className={styles.historyRight}>
                            <span className={styles.historyOldScore}>{entry.oldScore}</span>
                            <span className={styles.historyArrow}>-&gt;</span>
                            <span className={styles.historyNewScore}>{entry.newScore}</span>
                            <span className={deltaClass}>
                              {delta > 0 ? '+' : ''}{deltaPct.toFixed(2)}%
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* === 4. Event Counters === */}
            <div className={styles.section}>
              <span className={styles.sectionLabel}>Event Counters</span>
              <div className={styles.eventsGrid}>
                <div className={styles.eventCardOnTime}>
                  <p className={styles.statLabel}>On-Time</p>
                  <p className={styles.statValue}>{data.onTimeRepayments ?? 0}</p>
                </div>
                <div className={styles.eventCardLate}>
                  <p className={styles.statLabel}>Late</p>
                  <p className={styles.statValue}>{data.lateRepayments ?? 0}</p>
                </div>
                <div className={styles.eventCardMissed}>
                  <p className={styles.statLabel}>Missed</p>
                  <p className={styles.statValue}>{data.missedRepayments ?? 0}</p>
                </div>
                <div className={styles.eventCardLiquid}>
                  <p className={styles.statLabel}>Liquidations</p>
                  <p className={styles.statValue}>{data.liquidations ?? 0}</p>
                </div>
                <div className={styles.eventCardDefault}>
                  <p className={styles.statLabel}>Defaults</p>
                  <p className={styles.statValue}>{data.defaults ?? 0}</p>
                </div>
                <div className={styles.eventCardCycles}>
                  <p className={styles.statLabel}>Cycles</p>
                  <p className={styles.statValue}>{data.creditCyclesCompleted ?? 0}</p>
                </div>
                <div className={styles.eventCardTxns}>
                  <p className={styles.statLabel}>Total Txns</p>
                  <p className={styles.statValue}>{data.totalTransactions ?? 0}</p>
                </div>
              </div>
            </div>

            {/* === 5. Financial Metrics === */}
            <div className={styles.section}>
              <span className={styles.sectionLabel}>Financial Metrics</span>
              <div className={styles.financialsGrid}>
                <div className={styles.financialCard}>
                  <p className={styles.statLabel}>Cumulative Borrowed</p>
                  <p className={styles.statValue}>{formatUsdc(data.cumulativeBorrowed ?? '0')}</p>
                </div>
                <div className={styles.financialCard}>
                  <p className={styles.statLabel}>Cumulative Repaid</p>
                  <p className={styles.statValue}>{formatUsdc(data.cumulativeRepaid ?? '0')}</p>
                </div>
                <div className={styles.financialCard}>
                  <p className={styles.statLabel}>Current Debt</p>
                  <p className={styles.statValue}>{formatUsdc(data.currentDebt ?? '0')}</p>
                </div>
                <div className={styles.financialCard}>
                  <p className={styles.statLabel}>P&L Ratio</p>
                  <p className={(data.pnlRatioBps ?? 0) >= 0 ? styles.statValuePositive : styles.statValueNegative}>
                    {formatBps(data.pnlRatioBps ?? 0)}
                  </p>
                </div>
                <div className={styles.financialCard}>
                  <p className={styles.statLabel}>Max Drawdown</p>
                  <p className={styles.statValueNegative}>{formatBps(data.maxDrawdownBps ?? 0)}</p>
                </div>
                <div className={styles.financialCard}>
                  <p className={styles.statLabel}>Sharpe Ratio</p>
                  <p className={(data.sharpeRatioBps ?? 0) >= 0 ? styles.statValuePositive : styles.statValueNegative}>
                    {formatSharpe(data.sharpeRatioBps ?? 0)}
                  </p>
                </div>
              </div>
            </div>

            {/* === 6. Zone Time Distribution === */}
            <div className={styles.section}>
              <div className={styles.zoneWrap}>
                <span className={styles.sectionLabel}>Zone Time Distribution</span>
                {(() => {
                  const green  = (data.greenTimeBps  ?? 0) / 100
                  const yellow = (data.yellowTimeBps ?? 0) / 100
                  const orange = (data.orangeTimeBps ?? 0) / 100
                  const red    = (data.redTimeBps    ?? 0) / 100
                  const total  = green + yellow + orange + red
                  const g = total > 0 ? (green  / total) * 100 : 25
                  const y = total > 0 ? (yellow / total) * 100 : 25
                  const o = total > 0 ? (orange / total) * 100 : 25
                  const r = total > 0 ? (red    / total) * 100 : 25
                  return (
                    <>
                      <div className={styles.zoneBar}>
                        {g > 0 && <div className={styles.zoneSegment} style={{ width: `${g}%`, background: '#22c55e' }} />}
                        {y > 0 && <div className={styles.zoneSegment} style={{ width: `${y}%`, background: '#eab308' }} />}
                        {o > 0 && <div className={styles.zoneSegment} style={{ width: `${o}%`, background: '#f97316' }} />}
                        {r > 0 && <div className={styles.zoneSegment} style={{ width: `${r}%`, background: '#ef4444' }} />}
                      </div>
                      <div className={styles.zoneLegend}>
                        <div className={styles.zoneLegendItem}>
                          <div className={styles.zoneSwatch} style={{ background: '#22c55e' }} />
                          Green {green.toFixed(1)}%
                        </div>
                        <div className={styles.zoneLegendItem}>
                          <div className={styles.zoneSwatch} style={{ background: '#eab308' }} />
                          Yellow {yellow.toFixed(1)}%
                        </div>
                        <div className={styles.zoneLegendItem}>
                          <div className={styles.zoneSwatch} style={{ background: '#f97316' }} />
                          Orange {orange.toFixed(1)}%
                        </div>
                        <div className={styles.zoneLegendItem}>
                          <div className={styles.zoneSwatch} style={{ background: '#ef4444' }} />
                          Red {red.toFixed(1)}%
                        </div>
                      </div>
                    </>
                  )
                })()}
              </div>
            </div>

            {/* === 7. Usage Metrics === */}
            <div className={styles.section}>
              <span className={styles.sectionLabel}>Usage Metrics</span>
              <div className={styles.usageGrid}>
                <div className={styles.statCard}>
                  <p className={styles.statLabel}>Venue Entropy</p>
                  <p className={styles.statValue}>{formatBps(data.venueEntropyBps ?? 0)}</p>
                  <p className={styles.statSub}>of max diversity</p>
                </div>
                <div className={styles.statCard}>
                  <p className={styles.statLabel}>Unique Venues</p>
                  <p className={styles.statValue}>{data.uniqueVenues ?? 0}</p>
                </div>
                <div className={styles.statCard}>
                  <p className={styles.statLabel}>Avg Daily Volume</p>
                  <p className={styles.statValue}>{formatUsdc(data.avgDailyVolume ?? '0')}</p>
                </div>
              </div>
            </div>

            {/* === 8. Level Upgrade Path === */}
            <div className={styles.section}>
              <div className={styles.levelWrap}>
                <span className={styles.sectionLabel}>Level Upgrade Path</span>
                <div className={styles.levelStepper}>
                  {[1, 2, 3, 4].map((level) => {
                    const isCurrent = data.creditLevel === level
                    const isPast    = data.creditLevel > level
                    const nodeClass = isCurrent
                      ? styles.levelNodeCurrent
                      : isPast
                        ? styles.levelNodePast
                        : styles.levelNodeFuture
                    return (
                      <div key={level} className={styles.levelStep}>
                        <div className={`${styles.levelNode} ${nodeClass}`}>
                          L{level}
                        </div>
                        <span className={isCurrent ? styles.levelNameCurrent : styles.levelName}>
                          {CREDIT_LEVELS[level]?.name}
                        </span>
                        <span className={styles.levelThreshold}>
                          {level > 1 ? `${CREDIT_LEVELS[level]?.threshold}+` : '200+'}
                        </span>
                      </div>
                    )
                  })}
                </div>
                {data.creditLevel < 4 && (
                  <div className={styles.levelProgressWrap}>
                    <div className={styles.levelProgressHeader}>
                      <span>Progress to L{nextLevel}</span>
                      <span>{levelProgress.toFixed(1)}%</span>
                    </div>
                    <div className={styles.levelProgressTrack}>
                      <div
                        className={styles.levelProgressFill}
                        style={{ width: `${levelProgress}%` }}
                      />
                    </div>
                    <div className={styles.levelProgressFooter}>
                      <span>Current: {data.score}</span>
                      <span>Target: {nextThreshold}</span>
                    </div>
                  </div>
                )}
                {data.creditLevel >= 4 && (
                  <p className={styles.levelMaxText}>Maximum level achieved</p>
                )}
              </div>
            </div>

            {/* === 9. Service Metrics (Service / Hybrid agents only) === */}
            {(data.agentType === 1 || data.agentType === 2) && (
              <div className={styles.section}>
                <span className={styles.sectionLabel}>Service Metrics</span>
                <div className={styles.serviceGrid}>
                  <div className={styles.serviceCard}>
                    <p className={styles.statLabel}>Revenue Health</p>
                    <p className={styles.statValue}>{formatBps(data.revenueHealthBps ?? 0)}</p>
                    <div className={styles.serviceBarTrack}>
                      <div
                        className={styles.serviceBarFillTeal}
                        style={{ width: `${Math.min((data.revenueHealthBps ?? 0) / 100, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className={styles.serviceCard}>
                    <p className={styles.statLabel}>Milestone Completion</p>
                    <p className={styles.statValue}>{formatBps(data.milestoneCompletionRateBps ?? 0)}</p>
                    <div className={styles.serviceBarTrack}>
                      <div
                        className={styles.serviceBarFillTeal}
                        style={{ width: `${Math.min((data.milestoneCompletionRateBps ?? 0) / 100, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  )
}
