import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useParams, useNavigate } from 'react-router-dom'
import { useWallet } from '@solana/wallet-adapter-react'
import toast from 'react-hot-toast'
import { useScoreLookup } from '../hooks/useScoreLookup'
import { ScoreGauge } from '../components/score/ScoreGauge'
import type { KrexitScore, ScoreHistoryEntry } from '../sdk/types'

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
// Helpers
// ---------------------------------------------------------------------------

function formatUsdc(raw: { toString(): string } | number | string): string {
  const val = Number(raw.toString()) / 1e6
  return val.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function formatBps(bps: number): string {
  return (bps / 100).toFixed(2) + '%'
}

function formatSharpe(bps: number): string {
  return (bps / 100).toFixed(2)
}

function formatTimestamp(bn: { toNumber(): number } | number): string {
  const n = typeof bn === 'number' ? bn : bn.toNumber()
  if (!n) return '--'
  return new Date(n * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTimestampShort(bn: { toNumber(): number } | number): string {
  const n = typeof bn === 'number' ? bn : bn.toNumber()
  if (!n) return '--'
  return new Date(n * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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
// Main page
// ---------------------------------------------------------------------------

export default function ScoreLookupPage() {
  const { address: paramAddress } = useParams<{ address: string }>()
  const navigate = useNavigate()
  const { publicKey } = useWallet()

  // Determine the lookup address: URL param > connected wallet
  const defaultAddress = paramAddress || publicKey?.toBase58() || ''
  const [inputAddress, setInputAddress] = useState(defaultAddress)
  const [lookupAddress, setLookupAddress] = useState<string | null>(defaultAddress || null)

  // Sync URL param changes
  useEffect(() => {
    if (paramAddress) {
      setInputAddress(paramAddress)
      setLookupAddress(paramAddress)
    } else if (publicKey && !lookupAddress) {
      const addr = publicKey.toBase58()
      setInputAddress(addr)
      setLookupAddress(addr)
    }
  }, [paramAddress, publicKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const { data, isLoading, error } = useScoreLookup(lookupAddress)

  const score: KrexitScore | null = data?.score ?? null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = inputAddress.trim()
    if (!trimmed) return
    setLookupAddress(trimmed)
    navigate(`/score/${trimmed}`, { replace: true })
  }

  const handleShare = () => {
    if (!lookupAddress) return
    const url = `${window.location.origin}/score/${lookupAddress}`
    navigator.clipboard.writeText(url).then(() => {
      toast.success('Link copied to clipboard')
    })
  }

  // Ordered history (last 30 from ring buffer)
  const orderedHistory: ScoreHistoryEntry[] = score?.history
    ? (() => {
        const h = score.history
        const idx = score.historyIndex ?? 0
        const ordered: ScoreHistoryEntry[] = []
        for (let i = 0; i < h.length; i++) {
          const entry = h[(idx - 1 - i + h.length) % h.length]
          if (entry && entry.timestamp.toNumber() > 0) ordered.push(entry)
        }
        return ordered.slice(0, 30)
      })()
    : []

  // Level progress
  const currentLevel = score?.creditLevel ?? 1
  const nextLevel = Math.min(currentLevel + 1, 4)
  const nextThreshold = CREDIT_LEVELS[nextLevel]?.threshold ?? 850
  const currentThreshold = CREDIT_LEVELS[currentLevel]?.threshold ?? 200
  const levelProgress = score
    ? currentLevel >= 4
      ? 100
      : Math.max(0, Math.min(100, ((score.score - currentThreshold) / (nextThreshold - currentThreshold)) * 100))
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
            value={inputAddress}
            onChange={(e) => setInputAddress(e.target.value)}
            placeholder="Enter Solana agent pubkey..."
            className="flex-1 bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono text-sm"
          />
          <button
            type="submit"
            disabled={!inputAddress.trim() || isLoading}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium px-6 py-3 rounded-xl transition-colors"
          >
            {isLoading ? 'Loading...' : 'Lookup Score'}
          </button>
          {lookupAddress && score && (
            <button
              type="button"
              onClick={handleShare}
              className="bg-gray-700 hover:bg-gray-600 text-white font-medium px-4 py-3 rounded-xl transition-colors text-sm"
            >
              Share
            </button>
          )}
        </motion.form>

        {/* Empty state */}
        {!lookupAddress && (
          <motion.div {...fadeIn} className="text-center py-16">
            <p className="text-lg text-gray-500 mb-6">Paste a Solana agent public key above to view their Krexit Score.</p>
            <div className="max-w-lg mx-auto">
              <p className="text-sm text-gray-400 mb-3">Try these seeded test agents:</p>
              <div className="space-y-2">
                {[
                  { name: 'DataBot-Alpha', addr: '28SWEhYwWyvDic4wyK8AG9pXLYHwGaVPw2mTgEjRk1cj', score: 720, level: 'L3' },
                  { name: 'TradeBot-Beta', addr: '4Ditvk6A6f987heYinVM8ZJZywwPpknay3kEUdXgUnuw', score: 550, level: 'L2' },
                  { name: 'PayBot-Gamma', addr: 'E8j2hmRrLK4bNUU4rwiZ6P3qCVaQedmPBfmSAHNGfCY1', score: 410, level: 'L1' },
                ].map((agent) => (
                  <button
                    key={agent.addr}
                    onClick={() => {
                      setInputAddress(agent.addr)
                      setLookupAddress(agent.addr)
                      navigate(`/score/${agent.addr}`, { replace: true })
                    }}
                    className="w-full flex items-center justify-between bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3 hover:border-blue-500/30 transition-colors text-left"
                  >
                    <div>
                      <span className="text-sm font-medium text-gray-200">{agent.name}</span>
                      <p className="text-xs text-gray-500 font-mono">{agent.addr.slice(0, 16)}...</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-300">{agent.score}</span>
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-500/20 text-blue-400">{agent.level}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Loading */}
        {lookupAddress && isLoading && <LoadingSpinner />}

        {/* Error */}
        {lookupAddress && error && !isLoading && (
          <motion.div {...fadeIn}>
            <ErrorBanner message={error instanceof Error ? error.message : 'Agent not found or request failed'} />
          </motion.div>
        )}

        {/* Not found — show preview if available */}
        {lookupAddress && !isLoading && !error && data && !score && (
          <motion.div {...fadeIn} className="space-y-6">
            {data.preview ? (
              <>
                {/* Preview Score Card */}
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-amber-400 font-semibold">Preview Score — Not Yet Registered</h3>
                        {(data.preview as any).network && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            (data.preview as any).network === 'mainnet'
                              ? 'bg-purple-500/20 text-purple-400'
                              : (data.preview as any).network === 'unknown'
                                ? 'bg-gray-500/20 text-gray-400'
                                : 'bg-blue-500/20 text-blue-400'
                          }`}>
                            {(data.preview as any).network === 'mainnet'
                              ? `Mainnet · ${(data.preview as any).txCount ?? 0} txs · ${(data.preview as any).walletAgeDays ?? 0}d old`
                              : (data.preview as any).network === 'devnet'
                                ? `Devnet · ${(data.preview as any).txCount ?? 0} txs · ${(data.preview as any).walletAgeDays ?? 0}d old`
                                : 'RPC unavailable — base score only'}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-400 text-sm">{data.preview.note}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Preview Score Gauge */}
                  <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6 flex flex-col items-center gap-4">
                    <ScoreGauge score={data.preview.score} />
                    <p className="text-sm text-gray-400">Estimated Score (Preview)</p>
                    <p className="text-xs text-gray-500 text-center">
                      Based on on-chain activity only. Register as a Krexa agent to get an official Krexit Score.
                    </p>
                    <a
                      href="/dashboard"
                      className="mt-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors"
                    >
                      Register Agent & Get Full Score
                    </a>
                  </div>

                  {/* Score Breakdown */}
                  <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
                    <h3 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wider">Activity Breakdown</h3>
                    <div className="space-y-3">
                      {Object.entries(data.preview.breakdown).map(([key, val]) => (
                        <div key={key} className="flex items-center justify-between">
                          <span className="text-sm text-gray-400 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 rounded-full"
                                style={{ width: `${Math.min(100, ((val as number) / 200) * 100)}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium text-gray-200 w-8 text-right">+{val as number}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-700/50 flex justify-between">
                      <span className="text-sm text-gray-400">Total Preview Score</span>
                      <span className="text-lg font-bold text-amber-400">{data.preview.score}</span>
                    </div>
                  </div>
                </div>

                {/* Credit Eligibility Preview */}
                {(data as any).creditPreview && (() => {
                  const cp = (data as any).creditPreview
                  return (
                    <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
                      <h3 className="text-sm font-semibold text-gray-300 mb-1 uppercase tracking-wider">Credit Eligibility Preview</h3>
                      <p className="text-xs text-gray-500 mb-5">{cp.note}</p>

                      {/* Current best level */}
                      <div className={`rounded-xl p-4 mb-5 border ${cp.estimatedLevel > 0 ? 'bg-green-500/10 border-green-500/30' : 'bg-gray-700/30 border-gray-600/30'}`}>
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div>
                            <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Estimated Eligibility</p>
                            <p className={`text-lg font-bold ${cp.estimatedLevel > 0 ? 'text-green-400' : 'text-gray-400'}`}>
                              {cp.estimatedLevel > 0 ? `Level ${cp.estimatedLevel}` : 'Not Eligible Yet'}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">{cp.description}</p>
                          </div>
                          <div className="text-right">
                            {cp.maxCreditUsd > 0 && (
                              <>
                                <p className="text-2xl font-bold text-white">${cp.maxCreditUsd.toLocaleString()}</p>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                  cp.type === 'undercollateralized'
                                    ? 'bg-purple-500/20 text-purple-400'
                                    : 'bg-amber-500/20 text-amber-400'
                                }`}>
                                  {cp.type === 'undercollateralized' ? 'No collateral needed' : 'Collateral required'}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        {cp.kyaRequired && (
                          <p className="text-xs text-gray-500 mt-3">
                            Requires KYA Tier {cp.kyaRequired} verification after registration.
                          </p>
                        )}
                      </div>

                      {/* All levels table */}
                      <div className="space-y-2">
                        {cp.levels.map((l: any) => (
                          <div key={l.level} className={`flex items-center justify-between rounded-xl px-4 py-3 border text-sm ${
                            l.qualified
                              ? 'bg-green-500/5 border-green-500/20'
                              : 'bg-gray-900/30 border-gray-700/30'
                          }`}>
                            <div className="flex items-center gap-3">
                              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                                l.qualified
                                  ? 'bg-green-600/30 border-green-500 text-green-400'
                                  : 'bg-gray-800 border-gray-600 text-gray-500'
                              }`}>L{l.level}</span>
                              <div>
                                <p className={`font-medium ${l.qualified ? 'text-gray-200' : 'text-gray-500'}`}>
                                  ${l.maxUsd.toLocaleString()} max
                                </p>
                                <p className="text-xs text-gray-500">
                                  {l.type === 'undercollateralized' ? 'Uncollateralized' : `${l.ltv}× collateral`} · min score {l.minScore} · KYA {l.minKya}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              {l.qualified ? (
                                <span className="text-xs text-green-400 font-medium">✓ Qualifies</span>
                              ) : (
                                <span className="text-xs text-gray-500">+{l.pointsNeeded} pts needed</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}
              </>
            ) : (
              <div className="text-center py-16">
                <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-8 max-w-lg mx-auto">
                  <div className="w-16 h-16 rounded-full bg-gray-700/50 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-200 mb-2">No Score Found</h3>
                  <p className="text-gray-400 text-sm mb-4">
                    This address has no Krexit Score on-chain. Register as a Krexa agent to get scored.
                  </p>
                  <p className="text-gray-500 text-xs font-mono break-all mb-4">{lookupAddress}</p>
                  <a
                    href="/dashboard"
                    className="inline-block bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors"
                  >
                    Register Agent
                  </a>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Data */}
        {score && !isLoading && (
          <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-6">

            {/* === 1. Score Gauge Hero === */}
            <motion.div variants={fadeIn} className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
              <div className="flex flex-col lg:flex-row items-center gap-8">
                <ScoreGauge score={score.score ?? 200} />
                <div className="flex-1 space-y-4 text-center lg:text-left">
                  <div className="flex flex-wrap gap-2 justify-center lg:justify-start">
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400">
                      L{score.creditLevel} {CREDIT_LEVELS[score.creditLevel]?.name ?? 'Unknown'}
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400">
                      KYA: {KYA_TIERS[score.kyaTier] ?? score.kyaTier}
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-cyan-500/20 text-cyan-400">
                      {AGENT_TYPES[score.agentType] ?? 'Unknown'}
                    </span>
                    {score.isActive && (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400">Active</span>
                    )}
                    {score.isBlacklisted && (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400">Blacklisted</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider">Registered</p>
                      <p className="text-sm font-medium text-gray-200">{formatTimestamp(score.registeredAt)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider">Last Updated</p>
                      <p className="text-sm font-medium text-gray-200">{formatTimestamp(score.lastScoreUpdate)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider">Last Repayment</p>
                      <p className="text-sm font-medium text-gray-200">{formatTimestamp(score.lastRepayment)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider">Last Critical</p>
                      <p className="text-sm font-medium text-gray-200">{formatTimestamp(score.lastCriticalEvent)}</p>
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
                  const raw = (score as unknown as Record<string, unknown>)[c.key] as number ?? 0
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
                <StatCard label="On-Time" value={score.onTimeRepayments ?? 0} color="border-l-4 border-l-green-500" />
                <StatCard label="Late" value={score.lateRepayments ?? 0} color="border-l-4 border-l-yellow-500" />
                <StatCard label="Missed" value={score.missedRepayments ?? 0} color="border-l-4 border-l-orange-500" />
                <StatCard label="Liquidations" value={score.liquidations ?? 0} color="border-l-4 border-l-red-500" />
                <StatCard label="Defaults" value={score.defaults ?? 0} color="border-l-4 border-l-red-800" />
                <StatCard label="Cycles" value={score.creditCyclesCompleted ?? 0} color="border-l-4 border-l-blue-500" />
                <StatCard label="Total Txns" value={score.totalTransactions ?? 0} color="border-l-4 border-l-gray-500" />
              </div>
            </motion.div>

            {/* === 5. Financial Metrics === */}
            <motion.div variants={fadeIn}>
              <h2 className="text-lg font-semibold text-gray-100 mb-4">Financial Metrics</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Cumulative Borrowed</p>
                  <p className="text-2xl font-bold text-gray-100">{formatUsdc(score.cumulativeBorrowed)}</p>
                </div>
                <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Cumulative Repaid</p>
                  <p className="text-2xl font-bold text-gray-100">{formatUsdc(score.cumulativeRepaid)}</p>
                </div>
                <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Current Debt</p>
                  <p className="text-2xl font-bold text-gray-100">{formatUsdc(score.currentDebt)}</p>
                </div>
                <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">P&L Ratio</p>
                  <p className={`text-2xl font-bold ${(score.pnlRatioBps ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatBps(score.pnlRatioBps ?? 0)}
                  </p>
                </div>
                <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Max Drawdown</p>
                  <p className="text-2xl font-bold text-red-400">{formatBps(score.maxDrawdownBps ?? 0)}</p>
                </div>
                <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Sharpe Ratio</p>
                  <p className={`text-2xl font-bold ${(score.sharpeRatioBps ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatSharpe(score.sharpeRatioBps ?? 0)}
                  </p>
                </div>
              </div>
            </motion.div>

            {/* === 6. Zone Time Distribution === */}
            <motion.div variants={fadeIn} className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-gray-100 mb-4">Zone Time Distribution</h2>
              {(() => {
                const green = (score.greenTimeBps ?? 0) / 100
                const yellow = (score.yellowTimeBps ?? 0) / 100
                const orange = (score.orangeTimeBps ?? 0) / 100
                const red = (score.redTimeBps ?? 0) / 100
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
                  <p className="text-2xl font-bold text-gray-100">{formatBps(score.venueEntropyBps ?? 0)}</p>
                  <p className="text-xs text-gray-500 mt-0.5">of max diversity</p>
                </div>
                <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Unique Venues</p>
                  <p className="text-2xl font-bold text-gray-100">{score.uniqueVenues ?? 0}</p>
                </div>
                <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Avg Daily Volume</p>
                  <p className="text-2xl font-bold text-gray-100">{formatUsdc(score.avgDailyVolume)}</p>
                </div>
              </div>
            </motion.div>

            {/* === 8. Level Upgrade Path === */}
            <motion.div variants={fadeIn} className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-gray-100 mb-4">Level Upgrade Path</h2>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  {[1, 2, 3, 4].map((level) => {
                    const isCurrent = score.creditLevel === level
                    const isPast = score.creditLevel > level
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
                {score.creditLevel < 4 && (
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
                      <span>Current: {score.score}</span>
                      <span>Target: {nextThreshold}</span>
                    </div>
                  </div>
                )}
                {score.creditLevel >= 4 && (
                  <p className="text-center text-green-400 text-sm font-medium">Maximum level achieved</p>
                )}
              </div>
            </motion.div>

            {/* === 9. Service Metrics (Service / Hybrid agents only) === */}
            {(score.agentType === 1 || score.agentType === 2) && (
              <motion.div variants={fadeIn}>
                <h2 className="text-lg font-semibold text-gray-100 mb-4">Service Metrics</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
                    <p className="text-xs text-gray-400 uppercase tracking-wider">Revenue Health</p>
                    <p className="text-2xl font-bold text-gray-100">{formatBps(score.revenueHealthBps ?? 0)}</p>
                    <div className="h-2 bg-gray-900 rounded-full overflow-hidden mt-2">
                      <div
                        className="h-full bg-green-500 rounded-full transition-all duration-700"
                        style={{ width: `${Math.min((score.revenueHealthBps ?? 0) / 100, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
                    <p className="text-xs text-gray-400 uppercase tracking-wider">Milestone Completion</p>
                    <p className="text-2xl font-bold text-gray-100">{formatBps(score.milestoneCompletionRateBps ?? 0)}</p>
                    <div className="h-2 bg-gray-900 rounded-full overflow-hidden mt-2">
                      <div
                        className="h-full bg-purple-500 rounded-full transition-all duration-700"
                        style={{ width: `${Math.min((score.milestoneCompletionRateBps ?? 0) / 100, 100)}%` }}
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
