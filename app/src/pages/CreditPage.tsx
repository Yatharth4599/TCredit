import { useState } from 'react'
import { motion } from 'framer-motion'
import { useWallet } from '@solana/wallet-adapter-react'
import { TrendingUp, AlertTriangle, ArrowUpCircle, History, ExternalLink, FileText, Clock, CheckCircle, XCircle } from 'lucide-react'
import { useAgentProfile, useAgentHealth, useCreditLine, useAgentWallet, useCreditActivity, useCreditRequests } from '../hooks'
import { EmptyState } from '../components/shared'
import { RequestCreditModal } from '../components/credit/RequestCreditModal'
import { RepayModal } from '../components/credit/RepayModal'
import { config } from '../config'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CREDIT_LEVELS: Record<number, { name: string; limit: string }> = {
  0: { name: 'KYA Only', limit: '$0' },
  1: { name: 'Starter', limit: '$500' },
  2: { name: 'Established', limit: '$20,000' },
  3: { name: 'Trusted', limit: '$50,000' },
  4: { name: 'Elite', limit: '$500,000' },
}

const KYA_TIERS: Record<number, string> = {
  0: 'None',
  1: 'Basic',
  2: 'Enhanced',
  3: 'Institutional',
}

const LEVEL_THRESHOLDS: Record<number, { score: number; name: string; maxCredit: string; kya: number }> = {
  1: { score: 400, name: 'Starter', maxCredit: '$500', kya: 1 },
  2: { score: 500, name: 'Established', maxCredit: '$20,000', kya: 2 },
  3: { score: 650, name: 'Trusted', maxCredit: '$50,000', kya: 2 },
  4: { score: 750, name: 'Elite', maxCredit: '$500,000', kya: 3 },
}

const AGENT_TYPES: Record<number, string> = {
  0: 'Trader',
  1: 'Service',
  2: 'Hybrid',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getHealthZone(factor: number): { label: string; color: string; bg: string } {
  if (factor >= 15000) return { label: 'Healthy', color: 'text-green-400', bg: 'bg-green-500' }
  if (factor >= 13000) return { label: 'Warning', color: 'text-yellow-400', bg: 'bg-yellow-500' }
  if (factor >= 12000) return { label: 'Danger', color: 'text-orange-400', bg: 'bg-orange-500' }
  return { label: 'Liquidation', color: 'text-red-400', bg: 'bg-red-500' }
}

function formatUsdc(raw: { toString(): string } | number | string): string {
  const val = Number(raw.toString()) / 1e6
  return val.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function formatBps(bps: number): string {
  return (bps / 100).toFixed(2) + '%'
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

function StatItem({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-gray-100">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function CreditPage() {
  const { publicKey, connected } = useWallet()
  const address = publicKey?.toBase58()
  const [showRequestCredit, setShowRequestCredit] = useState(false)
  const [showRepay, setShowRepay] = useState(false)

  const { data: profile, isLoading: profileLoading, error: profileError } = useAgentProfile()
  const { data: health, isLoading: healthLoading, error: healthError } = useAgentHealth()
  const { data: creditLine, isLoading: creditLoading, error: creditError } = useCreditLine()
  const { data: wallet, isLoading: walletLoading, error: walletError } = useAgentWallet()
  const { data: activity } = useCreditActivity()
  const { data: creditRequests } = useCreditRequests()

  if (!connected) {
    return (
      <EmptyState
        icon={<TrendingUp size={48} />}
        title="Connect your wallet"
        description="Connect a Solana wallet to view your agent credit dashboard."
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div {...fadeIn}>
        <h2 className="text-xl font-semibold text-white tracking-tight">Agent Credit Dashboard</h2>
        <p className="text-sm text-white/30 mt-0.5">Your credit profile, health, and wallet on the Krexa protocol.</p>
      </motion.div>

      {/* Liquidation Warning */}
      {health && health.healthFactorBps > 0 && health.healthFactorBps < 13000 && (
        <motion.div {...fadeIn} className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle size={20} className="text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-400">
              {health.healthFactorBps < 12000
                ? 'Liquidation risk — repay debt immediately to avoid liquidation'
                : 'Warning — health factor approaching danger zone'}
            </p>
            <p className="text-xs text-red-400/70 mt-1">
              Current health: {(health.healthFactorBps / 10000).toFixed(2)}x — target 1.50x or higher
            </p>
          </div>
        </motion.div>
      )}

      {/* Level Upgrade Path */}
      {profile && (() => {
        const currentLevel = profile.creditLevel
        const nextLevel = currentLevel + 1
        const next = LEVEL_THRESHOLDS[nextLevel]
        if (!next || currentLevel >= 4) return null
        const score = profile.creditScore
        const prevScore = LEVEL_THRESHOLDS[currentLevel]?.score ?? 0
        const progress = next.score > prevScore ? Math.min(((score - prevScore) / (next.score - prevScore)) * 100, 100) : 0
        const pointsNeeded = Math.max(0, next.score - score)
        const kyaMet = (profile.kyaTier ?? 0) >= next.kya
        return (
          <motion.div {...fadeIn} className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <ArrowUpCircle size={16} className="text-blue-400" />
              <h3 className="text-sm font-medium text-gray-400">Upgrade to L{nextLevel} {next.name}</h3>
              <span className="text-xs text-gray-600 ml-auto">Up to {next.maxCredit} credit</span>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
              <span>Score: {score}</span>
              <span>Target: {next.score}</span>
            </div>
            <div className="h-2 bg-gray-900 rounded-full overflow-hidden mb-3">
              <div className="h-full bg-blue-500 rounded-full transition-all duration-700" style={{ width: `${Math.max(progress, 2)}%` }} />
            </div>
            <div className="flex gap-3 text-xs">
              <span className={pointsNeeded <= 0 ? 'text-green-400' : 'text-gray-500'}>
                {pointsNeeded > 0 ? `${pointsNeeded} more score points needed` : '✓ Score requirement met'}
              </span>
              <span className={kyaMet ? 'text-green-400' : 'text-gray-500'}>
                {kyaMet ? `✓ KYA ${KYA_TIERS[next.kya]}` : `Requires KYA ${KYA_TIERS[next.kya]}`}
              </span>
            </div>
          </motion.div>
        )
      })()}

      <motion.div variants={stagger} initial="initial" animate="animate" className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* === Agent Profile === */}
        <motion.div variants={fadeIn} className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-gray-100 mb-4">Agent Profile</h2>
          {profileLoading && <LoadingSpinner />}
          {profileError && !profileLoading && (
            <ErrorBanner message={profileError instanceof Error ? profileError.message : 'Failed to load profile'} />
          )}
          {profile && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-blue-600/30 flex items-center justify-center text-blue-400 font-bold text-lg">
                  A
                </div>
                <div>
                  <p className="font-semibold text-gray-100">Agent</p>
                  <p className="text-xs text-gray-500 font-mono">{address ? `${address.slice(0, 8)}...${address.slice(-6)}` : '--'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Credit Score</p>
                  <p className="text-2xl font-bold text-gray-100">{profile.creditScore ?? '--'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">KYA Tier</p>
                  <p className="text-2xl font-bold text-gray-100">{KYA_TIERS[profile.kyaTier] ?? profile.kyaTier}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Credit Level</p>
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-bold text-gray-100">L{profile.creditLevel}</p>
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400">
                      {CREDIT_LEVELS[profile.creditLevel]?.name ?? 'Unknown'}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Agent Type</p>
                  <p className="text-2xl font-bold text-gray-100">{AGENT_TYPES[profile.agentType] ?? profile.agentType}</p>
                </div>
              </div>
            </div>
          )}
          {!profileLoading && !profileError && !profile && (
            <p className="text-gray-500 text-sm">No agent profile found. Register your agent to get started.</p>
          )}
        </motion.div>

        {/* === Health Factor Gauge === */}
        <motion.div variants={fadeIn} className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-gray-100 mb-4">Health Factor</h2>
          {healthLoading && <LoadingSpinner />}
          {healthError && !healthLoading && (
            <ErrorBanner message={healthError instanceof Error ? healthError.message : 'Failed to load health'} />
          )}
          {health && (() => {
            const factor = health.healthFactorBps ?? 0
            const zone = getHealthZone(factor)
            const pct = Math.min((factor / 20000) * 100, 100)
            return (
              <div className="space-y-6">
                <div className="text-center">
                  <p className={`text-5xl font-bold ${zone.color}`}>{(factor / 100).toFixed(2)}x</p>
                  <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium ${zone.bg}/20 ${zone.color}`}>
                    {zone.label}
                  </span>
                </div>
                <div className="relative h-4 bg-gray-900 rounded-full overflow-hidden">
                  <div className="absolute inset-0 flex">
                    <div className="h-full bg-red-500/30" style={{ width: '25%' }} />
                    <div className="h-full bg-orange-500/30" style={{ width: '10%' }} />
                    <div className="h-full bg-yellow-500/30" style={{ width: '15%' }} />
                    <div className="h-full bg-green-500/30" style={{ width: '50%' }} />
                  </div>
                  <div
                    className={`absolute top-0 left-0 h-full ${zone.bg} rounded-full transition-all duration-700`}
                    style={{ width: `${pct}%`, opacity: 0.7 }}
                  />
                  <div
                    className={`absolute top-0 h-full w-1 ${zone.bg}`}
                    style={{ left: `${pct}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Liquidation</span>
                  <span>Danger</span>
                  <span>Warning</span>
                  <span>Healthy</span>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <StatItem label="Collateral" value={formatUsdc(health.collateralValue)} />
                  <StatItem label="Debt" value={formatUsdc(health.totalDebt)} />
                </div>
              </div>
            )
          })()}
          {!healthLoading && !healthError && !health && (
            <p className="text-gray-500 text-sm">No health data available.</p>
          )}
        </motion.div>

        {/* === Credit Line === */}
        <motion.div variants={fadeIn} className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-gray-100 mb-4">Credit Line</h2>
          {creditLoading && <LoadingSpinner />}
          {creditError && !creditLoading && (
            <ErrorBanner message={creditError instanceof Error ? creditError.message : 'Failed to load credit line'} />
          )}
          {creditLine && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <StatItem label="Credit Limit" value={formatUsdc(creditLine.creditLimit)} />
                <StatItem label="Amount Drawn" value={formatUsdc(creditLine.creditDrawn)} />
                <StatItem label="Accrued Interest" value={formatUsdc(creditLine.accruedInterest)} />
                <StatItem label="Interest Rate" value={formatBps(creditLine.interestRateBps ?? 0)} sub="Annual" />
              </div>
              {Number(creditLine.creditLimit.toString()) > 0 && (
                <div>
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Utilization</span>
                    <span>
                      {((Number(creditLine.creditDrawn.toString()) / Number(creditLine.creditLimit.toString())) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 bg-gray-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          (Number(creditLine.creditDrawn.toString()) / Number(creditLine.creditLimit.toString())) * 100,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              )}
              <div className="flex gap-2 flex-wrap">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${creditLine.isActive ? 'bg-green-500/20 text-green-400' : 'bg-gray-600/20 text-gray-400'}`}>
                  {creditLine.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          )}
          {!creditLoading && !creditError && !creditLine && (
            <p className="text-gray-500 text-sm">No credit line found. Request credit to get started.</p>
          )}
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => setShowRequestCredit(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              Request Credit
            </button>
            {creditLine && (
              <button
                onClick={() => setShowRepay(true)}
                className="bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                Repay
              </button>
            )}
          </div>
        </motion.div>

        {/* === Repayment Schedule === */}
        {creditLine && Number(creditLine.creditDrawn.toString()) > 0 && (() => {
          const drawn = Number(creditLine.creditDrawn.toString()) / 1e6
          const interest = Number(creditLine.accruedInterest.toString()) / 1e6
          const totalOwed = drawn + interest
          const rateBps = creditLine.interestRateBps ?? 0
          const dailyRate = rateBps / 10000 / 365
          const dailyInterest = drawn * dailyRate
          const weeklyInterest = dailyInterest * 7
          const monthlyInterest = dailyInterest * 30
          return (
            <motion.div variants={fadeIn} className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6 lg:col-span-2">
              <h2 className="text-lg font-semibold text-gray-100 mb-4">Repayment Schedule</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Principal</p>
                  <p className="text-xl font-bold text-gray-100">${drawn.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Accrued Interest</p>
                  <p className="text-xl font-bold text-orange-400">${interest.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Total Owed</p>
                  <p className="text-xl font-bold text-red-400">${totalOwed.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Daily Accrual</p>
                  <p className="text-xl font-bold text-gray-100">${dailyInterest.toFixed(4)}</p>
                </div>
              </div>
              <div className="bg-gray-900/50 rounded-xl p-4">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Interest Projection</p>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-sm font-bold text-gray-100">${weeklyInterest.toFixed(2)}</p>
                    <p className="text-[10px] text-gray-500">7 days</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-100">${monthlyInterest.toFixed(2)}</p>
                    <p className="text-[10px] text-gray-500">30 days</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-100">${(dailyInterest * 365).toFixed(2)}</p>
                    <p className="text-[10px] text-gray-500">1 year</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )
        })()}

        {/* === Wallet Info === */}
        <motion.div variants={fadeIn} className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-gray-100 mb-4">Wallet</h2>
          {walletLoading && <LoadingSpinner />}
          {walletError && !walletLoading && (
            <ErrorBanner message={walletError instanceof Error ? walletError.message : 'Failed to load wallet'} />
          )}
          {wallet && (
            <div className="grid grid-cols-2 gap-4">
              <StatItem label="Credit Limit" value={formatUsdc(wallet.creditLimit)} />
              <StatItem label="Credit Drawn" value={formatUsdc(wallet.creditDrawn)} />
              <StatItem label="Total Debt" value={formatUsdc(wallet.totalDebt)} />
              <StatItem label="Total Volume" value={formatUsdc(wallet.totalVolume)} />
              <StatItem label="Total Repaid" value={formatUsdc(wallet.totalRepaid)} />
              <StatItem label="Health Factor" value={`${(wallet.healthFactorBps / 100).toFixed(2)}x`} />
            </div>
          )}
          {!walletLoading && !walletError && !wallet && (
            <p className="text-gray-500 text-sm">No wallet data available.</p>
          )}
        </motion.div>

      </motion.div>

      {/* Credit Request History */}
      {creditRequests && creditRequests.requests.length > 0 && (
        <motion.div {...fadeIn} className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText size={16} className="text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-100">Credit Requests</h2>
            <span className="text-xs text-gray-500 ml-auto">{creditRequests.total} total</span>
          </div>
          <div className="space-y-2">
            {creditRequests.requests.map((req) => {
              const statusConfig: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
                pending:  { icon: <Clock size={14} />, color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
                approved: { icon: <CheckCircle size={14} />, color: 'text-green-400', bg: 'bg-green-500/20' },
                rejected: { icon: <XCircle size={14} />, color: 'text-red-400', bg: 'bg-red-500/20' },
                expired:  { icon: <Clock size={14} />, color: 'text-gray-400', bg: 'bg-gray-500/20' },
              }
              const sc = statusConfig[req.status] ?? statusConfig.pending
              return (
                <div key={req.id} className="flex items-center justify-between py-2.5 border-b border-gray-800 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className={`${sc.bg} ${sc.color} p-1.5 rounded-lg`}>{sc.icon}</span>
                    <div>
                      <p className="text-sm text-gray-100 font-medium">
                        {formatUsdc(req.amount)} at L{req.creditLevel}
                      </p>
                      {req.reason && (
                        <p className="text-xs text-gray-500">{req.reason}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-medium ${sc.bg} ${sc.color}`}>
                      {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(req.requestedAt).toLocaleDateString()}
                    </span>
                    {req.txSignature && (
                      <a
                        href={`https://explorer.solana.com/tx/${req.txSignature}${config.cluster !== 'mainnet-beta' ? `?cluster=${config.cluster}` : ''}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-gray-600 hover:text-gray-400"
                      >
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* Credit Activity History */}
      {activity && (activity.scoreHistory.length > 0 || activity.recentTrades.length > 0) && (
        <motion.div {...fadeIn} className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <History size={16} className="text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-100">Credit Activity</h2>
          </div>

          {/* Score History */}
          {activity.scoreHistory.length > 0 && (
            <div className="mb-5">
              <h3 className="text-xs text-gray-400 uppercase tracking-wider mb-3">Score History</h3>
              <div className="space-y-2">
                {activity.scoreHistory.slice(0, 8).map((entry, i) => {
                  const prev = activity.scoreHistory[i + 1]
                  const delta = prev ? entry.score - prev.score : 0
                  return (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-gray-100">{entry.score}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-500/20 text-blue-400">
                          L{entry.level}
                        </span>
                        {delta !== 0 && (
                          <span className={`text-xs font-medium ${delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {delta > 0 ? '+' : ''}{delta}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(entry.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Recent Trades */}
          {activity.recentTrades.length > 0 && (
            <div>
              <h3 className="text-xs text-gray-400 uppercase tracking-wider mb-3">Recent Trades</h3>
              <div className="space-y-2">
                {activity.recentTrades.slice(0, 8).map((trade, i) => {
                  const explorerUrl = `https://explorer.solana.com/tx/${trade.txSignature}${config.cluster !== 'mainnet-beta' ? `?cluster=${config.cluster}` : ''}`
                  return (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                          trade.direction === 'buy' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {trade.direction.toUpperCase()}
                        </span>
                        <span className="text-sm text-gray-100">{formatUsdc(trade.amount)}</span>
                        <span className="text-xs text-gray-500">{trade.venue}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">
                          {new Date(trade.timestamp).toLocaleDateString()}
                        </span>
                        <a href={explorerUrl} target="_blank" rel="noreferrer" className="text-gray-600 hover:text-gray-400">
                          <ExternalLink size={12} />
                        </a>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </motion.div>
      )}

      <RequestCreditModal
        isOpen={showRequestCredit}
        onClose={() => setShowRequestCredit(false)}
        creditLevel={profile?.creditLevel ?? 1}
      />
      <RepayModal
        isOpen={showRepay}
        onClose={() => setShowRepay(false)}
        agentPubkey={address ?? ''}
        currentDebt={creditLine ? formatUsdc(creditLine.creditDrawn) : undefined}
        accruedInterest={creditLine ? formatUsdc(creditLine.accruedInterest) : undefined}
        rawDebtUsdc={creditLine ? Number(creditLine.creditDrawn.toString()) : undefined}
        rawInterestUsdc={creditLine ? Number(creditLine.accruedInterest.toString()) : undefined}
      />
    </div>
  )
}
