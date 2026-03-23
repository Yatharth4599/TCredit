import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { scoreApi } from '../api/solanaClient'

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
  { key: 'c1Repayment', name: 'Repayment History', weight: 30, color: 'bg-blue-500', text: 'text-blue-400', ring: 'border-blue-500/30' },
  { key: 'c2Profitability', name: 'Profitability', weight: 25, color: 'bg-green-500', text: 'text-green-400', ring: 'border-green-500/30' },
  { key: 'c3Behavioral', name: 'Behavioral Health', weight: 20, color: 'bg-purple-500', text: 'text-purple-400', ring: 'border-purple-500/30' },
  { key: 'c4Usage', name: 'Usage Patterns', weight: 15, color: 'bg-amber-500', text: 'text-amber-400', ring: 'border-amber-500/30' },
  { key: 'c5Maturity', name: 'Account Maturity', weight: 10, color: 'bg-cyan-500', text: 'text-cyan-400', ring: 'border-cyan-500/30' },
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
  if (score >= 750) return '#3b82f6'  // blue
  if (score >= 650) return '#22c55e'  // green
  if (score >= 500) return '#eab308'  // yellow
  if (score >= 400) return '#f97316'  // orange
  return '#ef4444'                    // red
}

function scoreColorClass(score: number): string {
  if (score >= 750) return 'text-blue-400'
  if (score >= 650) return 'text-green-400'
  if (score >= 500) return 'text-yellow-400'
  if (score >= 400) return 'text-orange-400'
  return 'text-red-400'
}

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
}

const stagger = {
  animate: { transition: { staggerChildren: 0.08 } },
}

// ---------------------------------------------------------------------------
// Small components
// ---------------------------------------------------------------------------

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
      {message}
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className={`bg-gray-800/50 border border-gray-700/50 rounded-2xl p-4 ${color}`}>
      <p className="text-xs text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-gray-100 mt-1">{value}</p>
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
    <div className="relative w-56 h-56 mx-auto">
      <svg viewBox="0 0 200 200" className="w-full h-full -rotate-[135deg]">
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
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-5xl font-bold ${scoreColorClass(score)}`}>{score}</span>
        <span className="text-xs text-gray-400 mt-1">out of 850</span>
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
    <div className="min-h-screen bg-gray-950 text-gray-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div {...fadeIn} className="mb-10">
          <h1 className="text-3xl font-bold text-gray-100 mb-2">Krexit Score Dashboard</h1>
          <p className="text-gray-400">Inspect any agent's on-chain credit score, component breakdown, and history.</p>
        </motion.div>

        {/* Search */}
        <motion.form {...fadeIn} onSubmit={handleSubmit} className="mb-10 flex gap-3">
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Enter Solana agent pubkey..."
            className="flex-1 bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono text-sm"
          />
          <button
            type="submit"
            disabled={!address.trim() || loading}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium px-6 py-3 rounded-xl transition-colors"
          >
            {loading ? 'Loading...' : 'Lookup Score'}
          </button>
        </motion.form>

        {/* Empty state */}
        {!searched && (
          <motion.div {...fadeIn} className="text-center py-20 text-gray-500">
            <p className="text-lg">Paste a Solana agent public key above to view their Krexit Score.</p>
          </motion.div>
        )}

        {/* Loading */}
        {searched && loading && <LoadingSpinner />}

        {/* Error */}
        {searched && error && (
          <motion.div {...fadeIn}>
            <ErrorBanner message={error} />
          </motion.div>
        )}

        {/* Data */}
        {searched && data && !loading && (
          <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-6">

            {/* === 1. Score Gauge Hero === */}
            <motion.div variants={fadeIn} className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
              <div className="flex flex-col lg:flex-row items-center gap-8">
                <ScoreGauge score={data.score ?? 200} />
                <div className="flex-1 space-y-4 text-center lg:text-left">
                  <div className="flex flex-wrap gap-2 justify-center lg:justify-start">
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400">
                      L{data.creditLevel} {CREDIT_LEVELS[data.creditLevel]?.name ?? 'Unknown'}
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400">
                      KYA: {KYA_TIERS[data.kyaTier] ?? data.kyaTier}
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-cyan-500/20 text-cyan-400">
                      {AGENT_TYPES[data.agentType] ?? 'Unknown'}
                    </span>
                    {data.isActive && (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400">Active</span>
                    )}
                    {data.isBlacklisted && (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400">Blacklisted</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider">Registered</p>
                      <p className="text-sm font-medium text-gray-200">{formatTimestamp(data.registeredAt)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider">Last Updated</p>
                      <p className="text-sm font-medium text-gray-200">{formatTimestamp(data.lastScoreUpdate)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider">Last Repayment</p>
                      <p className="text-sm font-medium text-gray-200">{formatTimestamp(data.lastRepayment)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider">Last Critical</p>
                      <p className="text-sm font-medium text-gray-200">{formatTimestamp(data.lastCriticalEvent)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* === 2. Component Breakdown === */}
            <motion.div variants={fadeIn}>
              <h2 className="text-lg font-semibold text-gray-100 mb-4">Component Breakdown</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {COMPONENTS.map((c) => {
                  const raw = (data as unknown as Record<string, unknown>)[c.key] as number ?? 0
                  const pct = Math.min(raw / 100, 100)
                  return (
                    <div key={c.key} className={`bg-gray-800/50 border ${c.ring} rounded-2xl p-4`}>
                      <p className={`text-xs font-medium ${c.text} uppercase tracking-wider`}>{c.name}</p>
                      <p className="text-xs text-gray-500 mb-2">Weight: {c.weight}%</p>
                      <p className="text-2xl font-bold text-gray-100 mb-2">{pct.toFixed(1)}%</p>
                      <div className="h-2 bg-gray-900 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${c.color} rounded-full transition-all duration-700`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{raw.toLocaleString()} / 10,000 BPS</p>
                    </div>
                  )
                })}
              </div>
            </motion.div>

            {/* === 3. Score History Timeline === */}
            <motion.div variants={fadeIn} className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-gray-100 mb-4">Score History</h2>
              {orderedHistory.length === 0 ? (
                <p className="text-gray-500 text-sm">No history entries yet.</p>
              ) : (
                <div className="max-h-80 overflow-y-auto space-y-0 rounded-xl">
                  {orderedHistory.map((entry, i) => {
                    const delta = entry.newScore - entry.oldScore
                    const deltaPct = entry.deltaBps / 100
                    return (
                      <div
                        key={i}
                        className={`flex items-center justify-between px-4 py-2.5 text-sm ${i % 2 === 0 ? 'bg-gray-900/30' : 'bg-gray-900/10'}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-gray-500 text-xs shrink-0">{formatTimestampShort(entry.timestamp)}</span>
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-700/50 text-gray-300 shrink-0">
                            {EVENT_TYPE_LABELS[entry.eventType] ?? `Event ${entry.eventType}`}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-gray-400">{entry.oldScore}</span>
                          <span className="text-gray-600">-&gt;</span>
                          <span className="text-gray-100 font-medium">{entry.newScore}</span>
                          <span className={`text-xs font-medium w-16 text-right ${delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                            {delta > 0 ? '+' : ''}{deltaPct.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </motion.div>

            {/* === 4. Event Counters === */}
            <motion.div variants={fadeIn}>
              <h2 className="text-lg font-semibold text-gray-100 mb-4">Event Counters</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
                <StatCard label="On-Time" value={data.onTimeRepayments ?? 0} color="border-l-4 border-l-green-500" />
                <StatCard label="Late" value={data.lateRepayments ?? 0} color="border-l-4 border-l-yellow-500" />
                <StatCard label="Missed" value={data.missedRepayments ?? 0} color="border-l-4 border-l-orange-500" />
                <StatCard label="Liquidations" value={data.liquidations ?? 0} color="border-l-4 border-l-red-500" />
                <StatCard label="Defaults" value={data.defaults ?? 0} color="border-l-4 border-l-red-800" />
                <StatCard label="Cycles" value={data.creditCyclesCompleted ?? 0} color="border-l-4 border-l-blue-500" />
                <StatCard label="Total Txns" value={data.totalTransactions ?? 0} color="border-l-4 border-l-gray-500" />
              </div>
            </motion.div>

            {/* === 5. Financial Metrics === */}
            <motion.div variants={fadeIn}>
              <h2 className="text-lg font-semibold text-gray-100 mb-4">Financial Metrics</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Cumulative Borrowed</p>
                  <p className="text-2xl font-bold text-gray-100">{formatUsdc(data.cumulativeBorrowed ?? '0')}</p>
                </div>
                <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Cumulative Repaid</p>
                  <p className="text-2xl font-bold text-gray-100">{formatUsdc(data.cumulativeRepaid ?? '0')}</p>
                </div>
                <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Current Debt</p>
                  <p className="text-2xl font-bold text-gray-100">{formatUsdc(data.currentDebt ?? '0')}</p>
                </div>
                <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">P&L Ratio</p>
                  <p className={`text-2xl font-bold ${(data.pnlRatioBps ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatBps(data.pnlRatioBps ?? 0)}
                  </p>
                </div>
                <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Max Drawdown</p>
                  <p className="text-2xl font-bold text-red-400">{formatBps(data.maxDrawdownBps ?? 0)}</p>
                </div>
                <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Sharpe Ratio</p>
                  <p className={`text-2xl font-bold ${(data.sharpeRatioBps ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatSharpe(data.sharpeRatioBps ?? 0)}
                  </p>
                </div>
              </div>
            </motion.div>

            {/* === 6. Behavioral Metrics - Zone Time Distribution === */}
            <motion.div variants={fadeIn} className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-gray-100 mb-4">Zone Time Distribution</h2>
              {(() => {
                const green = (data.greenTimeBps ?? 0) / 100
                const yellow = (data.yellowTimeBps ?? 0) / 100
                const orange = (data.orangeTimeBps ?? 0) / 100
                const red = (data.redTimeBps ?? 0) / 100
                const total = green + yellow + orange + red
                const g = total > 0 ? (green / total) * 100 : 25
                const y = total > 0 ? (yellow / total) * 100 : 25
                const o = total > 0 ? (orange / total) * 100 : 25
                const r = total > 0 ? (red / total) * 100 : 25
                return (
                  <div className="space-y-3">
                    <div className="h-8 flex rounded-full overflow-hidden">
                      {g > 0 && <div className="bg-green-500 transition-all duration-700" style={{ width: `${g}%` }} />}
                      {y > 0 && <div className="bg-yellow-500 transition-all duration-700" style={{ width: `${y}%` }} />}
                      {o > 0 && <div className="bg-orange-500 transition-all duration-700" style={{ width: `${o}%` }} />}
                      {r > 0 && <div className="bg-red-500 transition-all duration-700" style={{ width: `${r}%` }} />}
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500" />
                        <span className="text-gray-300">Green {green.toFixed(1)}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-yellow-500" />
                        <span className="text-gray-300">Yellow {yellow.toFixed(1)}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-orange-500" />
                        <span className="text-gray-300">Orange {orange.toFixed(1)}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500" />
                        <span className="text-gray-300">Red {red.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                )
              })()}
            </motion.div>

            {/* === 7. Usage Metrics === */}
            <motion.div variants={fadeIn}>
              <h2 className="text-lg font-semibold text-gray-100 mb-4">Usage Metrics</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Venue Entropy</p>
                  <p className="text-2xl font-bold text-gray-100">{formatBps(data.venueEntropyBps ?? 0)}</p>
                  <p className="text-xs text-gray-500 mt-0.5">of max diversity</p>
                </div>
                <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Unique Venues</p>
                  <p className="text-2xl font-bold text-gray-100">{data.uniqueVenues ?? 0}</p>
                </div>
                <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Avg Daily Volume</p>
                  <p className="text-2xl font-bold text-gray-100">{formatUsdc(data.avgDailyVolume ?? '0')}</p>
                </div>
              </div>
            </motion.div>

            {/* === 8. Level Upgrade Path === */}
            <motion.div variants={fadeIn} className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-gray-100 mb-4">Level Upgrade Path</h2>
              <div className="space-y-6">
                {/* Stepper */}
                <div className="flex items-center justify-between">
                  {[1, 2, 3, 4].map((level) => {
                    const isCurrent = data.creditLevel === level
                    const isPast = data.creditLevel > level
                    return (
                      <div key={level} className="flex flex-col items-center flex-1">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
                            isCurrent
                              ? 'bg-blue-600 border-blue-400 text-white'
                              : isPast
                                ? 'bg-green-600/30 border-green-500 text-green-400'
                                : 'bg-gray-800 border-gray-600 text-gray-500'
                          }`}
                        >
                          L{level}
                        </div>
                        <span className={`text-xs mt-1 ${isCurrent ? 'text-blue-400 font-medium' : 'text-gray-500'}`}>
                          {CREDIT_LEVELS[level]?.name}
                        </span>
                        <span className="text-xs text-gray-600">
                          {level > 1 ? `${CREDIT_LEVELS[level]?.threshold}+` : '200+'}
                        </span>
                      </div>
                    )
                  })}
                </div>
                {/* Progress to next */}
                {data.creditLevel < 4 && (
                  <div>
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>Progress to L{nextLevel}</span>
                      <span>{levelProgress.toFixed(1)}%</span>
                    </div>
                    <div className="h-3 bg-gray-900 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-700"
                        style={{ width: `${levelProgress}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>Current: {data.score}</span>
                      <span>Target: {nextThreshold}</span>
                    </div>
                  </div>
                )}
                {data.creditLevel >= 4 && (
                  <p className="text-center text-green-400 text-sm font-medium">Maximum level achieved</p>
                )}
              </div>
            </motion.div>

            {/* === 9. Type B Section (Service / Hybrid agents only) === */}
            {(data.agentType === 1 || data.agentType === 2) && (
              <motion.div variants={fadeIn}>
                <h2 className="text-lg font-semibold text-gray-100 mb-4">Service Metrics</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
                    <p className="text-xs text-gray-400 uppercase tracking-wider">Revenue Health</p>
                    <p className="text-2xl font-bold text-gray-100">{formatBps(data.revenueHealthBps ?? 0)}</p>
                    <div className="h-2 bg-gray-900 rounded-full overflow-hidden mt-2">
                      <div
                        className="h-full bg-green-500 rounded-full transition-all duration-700"
                        style={{ width: `${Math.min((data.revenueHealthBps ?? 0) / 100, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
                    <p className="text-xs text-gray-400 uppercase tracking-wider">Milestone Completion</p>
                    <p className="text-2xl font-bold text-gray-100">{formatBps(data.milestoneCompletionRateBps ?? 0)}</p>
                    <div className="h-2 bg-gray-900 rounded-full overflow-hidden mt-2">
                      <div
                        className="h-full bg-purple-500 rounded-full transition-all duration-700"
                        style={{ width: `${Math.min((data.milestoneCompletionRateBps ?? 0) / 100, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

          </motion.div>
        )}
      </div>
    </div>
  )
}
