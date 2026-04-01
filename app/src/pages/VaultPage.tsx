import { motion } from 'framer-motion'
import { useVaultStats, useVaultRevenue, useVaultLossBuffer } from '../hooks'
import type { VaultStats } from '../sdk/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatUsdc(raw: { toString(): string } | number | string): string {
  const val = Number(raw.toString()) / 1e6
  return val.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function formatPct(bps: number): string {
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

function NoDataCard({ title }: { title: string }) {
  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6 text-center">
      <p className="text-gray-500 text-sm">{title} - No data available</p>
    </div>
  )
}

const TRANCHE_NAMES = ['senior', 'mezzanine', 'junior'] as const
const TRANCHE_DISPLAY: Record<string, string> = {
  senior: 'Senior',
  mezzanine: 'Mezzanine',
  junior: 'Junior',
}
const TRANCHE_COLORS: Record<string, { border: string; badge: string; bar: string }> = {
  senior: { border: 'border-blue-500/40', badge: 'bg-blue-500/20 text-blue-400', bar: 'bg-blue-500' },
  mezzanine: { border: 'border-purple-500/40', badge: 'bg-purple-500/20 text-purple-400', bar: 'bg-purple-500' },
  junior: { border: 'border-orange-500/40', badge: 'bg-orange-500/20 text-orange-400', bar: 'bg-orange-500' },
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function VaultPage() {
  const { data: stats, isLoading: statsLoading, error: statsError } = useVaultStats()
  const { data: revenue, isLoading: revenueLoading, error: revenueError } = useVaultRevenue()
  const { data: lossBuffer, isLoading: lossLoading, error: lossError } = useVaultLossBuffer()

  const vaultStats = stats as VaultStats | null | undefined

  // Compute utilization
  const utilPct = vaultStats
    ? Math.min(vaultStats.utilizationBps / 100, 100)
    : 0

  // Compute available liquidity
  const availableLiquidity = vaultStats
    ? Number(vaultStats.totalDeposits.toString()) - Number(vaultStats.totalBorrowed.toString())
    : 0

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <motion.div {...fadeIn} className="mb-10">
          <h1 className="text-3xl font-bold text-gray-100 mb-2">Vault Overview</h1>
          <p className="text-gray-400">Real-time stats for the Krexa credit vault on Solana.</p>
        </motion.div>

        <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-6">

          {/* === Vault Stats === */}
          <motion.div variants={fadeIn} className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-gray-100 mb-4">Vault Stats</h2>
            {statsLoading && <LoadingSpinner />}
            {statsError && !statsLoading && (
              <div className="text-center py-6">
                <p className="text-gray-400 text-sm">Vault stats are not available yet. The vault configuration account has not been initialized.</p>
                <p className="text-gray-600 text-xs mt-2">This section will populate once the vault is initialized with deposits.</p>
              </div>
            )}
            {vaultStats && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatItem label="Total Deposits" value={formatUsdc(vaultStats.totalDeposits)} />
                  <StatItem label="Total Borrowed" value={formatUsdc(vaultStats.totalBorrowed)} />
                  <StatItem label="Available Liquidity" value={formatUsdc(availableLiquidity)} />
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider">Status</p>
                    <span className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-medium ${vaultStats.isPaused ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                      {vaultStats.isPaused ? 'Paused' : 'Active'}
                    </span>
                  </div>
                </div>

                {/* Utilization Bar */}
                <div>
                  <div className="flex justify-between text-xs text-gray-400 mb-2">
                    <span>Utilization</span>
                    <span>{utilPct.toFixed(1)}% / 80% cap</span>
                  </div>
                  <div className="relative h-4 bg-gray-900 rounded-full overflow-hidden">
                    <div className="absolute top-0 h-full w-px bg-yellow-500/60" style={{ left: '80%' }} />
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${utilPct > 80 ? 'bg-red-500' : utilPct > 60 ? 'bg-yellow-500' : 'bg-blue-500'}`}
                      style={{ width: `${utilPct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-600 mt-1">
                    <span>0%</span>
                    <span className="text-yellow-600">80% cap</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>
            )}
            {!statsLoading && !statsError && !vaultStats && <NoDataCard title="Vault Stats" />}
          </motion.div>

          {/* === Tranche Breakdown === */}
          <motion.div variants={fadeIn}>
            <h2 className="text-lg font-semibold text-gray-100 mb-4">Tranche Breakdown</h2>
            {statsLoading && <LoadingSpinner />}
            {vaultStats?.tranches ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {TRANCHE_NAMES.map((name) => {
                  const t = vaultStats.tranches[name]
                  const colors = TRANCHE_COLORS[name]
                  if (!t) return null
                  return (
                    <motion.div
                      key={name}
                      variants={fadeIn}
                      className={`bg-gray-800/50 border ${colors.border} rounded-2xl p-6`}
                    >
                      <div className="flex items-center gap-2 mb-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${colors.badge}`}>
                          {TRANCHE_DISPLAY[name]}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <StatItem label="Total Deposits" value={formatUsdc(t.deposits)} />
                        <StatItem label="Total Shares" value={(Number(t.shares.toString()) / 1e6).toLocaleString()} />
                        <StatItem label="APR" value={formatPct(t.aprBps ?? 0)} />
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            ) : (
              !statsLoading && <NoDataCard title="Tranche Breakdown" />
            )}
          </motion.div>

          {/* === Revenue Waterfall === */}
          <motion.div variants={fadeIn} className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-gray-100 mb-4">Revenue Breakdown</h2>
            {revenueLoading && <LoadingSpinner />}
            {revenueError && !revenueLoading && (
              <p className="text-gray-500 text-sm">Revenue data is not available yet. This section will populate when the vault has active revenue.</p>
            )}
            {revenue && !revenueError ? (
              <div className="space-y-6">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {(() => {
                  const rev = revenue as Record<string, number>
                  const items = [
                    { label: 'Agent Revenue', value: rev.agentRevenue ?? 0, color: 'bg-blue-500' },
                    { label: 'Protocol Fee', value: rev.protocolFee ?? 0, color: 'bg-gray-500' },
                    { label: 'Senior Yield', value: rev.seniorYield ?? 0, color: 'bg-blue-400' },
                    { label: 'Mezz Yield', value: rev.mezzanineYield ?? 0, color: 'bg-purple-400' },
                    { label: 'Junior Yield', value: rev.juniorYield ?? 0, color: 'bg-orange-400' },
                    { label: 'Insurance', value: rev.insuranceFund ?? 0, color: 'bg-yellow-500' },
                    { label: 'Treasury', value: rev.treasury ?? 0, color: 'bg-green-500' },
                  ]
                  const maxVal = Math.max(...items.map(i => i.value), 1)
                  return (
                    <div className="space-y-2">
                      {items.map((item) => {
                        const pct = (item.value / maxVal) * 100
                        return (
                          <div key={item.label} className="flex items-center gap-3">
                            <span className="text-xs text-gray-400 w-28 text-right shrink-0">{item.label}</span>
                            <div className="flex-1 h-5 bg-gray-900 rounded-full overflow-hidden">
                              <motion.div
                                className={`h-full ${item.color} rounded-full`}
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.max(pct, 2)}%` }}
                                transition={{ duration: 0.8, delay: 0.1 }}
                              />
                            </div>
                            <span className="text-xs text-gray-400 w-24 shrink-0">{formatUsdc(item.value)}</span>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </div>
            ) : (
              !revenueLoading && !revenueError && <NoDataCard title="Revenue" />
            )}
          </motion.div>

          {/* === Loss Buffer === */}
          <motion.div variants={fadeIn} className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-gray-100 mb-4">Loss Buffer Status</h2>
            {lossLoading && <LoadingSpinner />}
            {lossError && !lossLoading && (
              <p className="text-gray-500 text-sm">Loss buffer data is not available yet. This section will populate when the vault has insurance reserves.</p>
            )}
            {lossBuffer && !lossError ? (
              <div className="space-y-6">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {(() => {
                  const lb = lossBuffer as Record<string, number>
                  const insuranceBalance = lb.insuranceBalance ?? 0
                  const insuranceCapacity = lb.insuranceCapacity ?? 0
                  const juniorBuffer = lb.juniorBuffer ?? 0
                  const mezzanineBuffer = lb.mezzanineBuffer ?? 0
                  const totalDefaults = lb.totalDefaultsBeforeSeniorLoss ?? (insuranceBalance + juniorBuffer + mezzanineBuffer)

                  return (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatItem label="Insurance Balance" value={formatUsdc(insuranceBalance)} />
                        <StatItem label="Insurance Capacity" value={formatUsdc(insuranceCapacity)} />
                        <StatItem label="Junior Buffer" value={formatUsdc(juniorBuffer)} />
                        <StatItem label="Mezzanine Buffer" value={formatUsdc(mezzanineBuffer)} />
                      </div>

                      <div className="bg-gray-900/50 rounded-xl p-4">
                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Total Defaults Before Senior Loss</p>
                        <p className="text-3xl font-bold text-green-400">{formatUsdc(totalDefaults)}</p>
                        <p className="text-xs text-gray-500 mt-1">Insurance + Junior equity + Mezzanine equity</p>
                      </div>

                      {/* Buffer visualization */}
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Buffer Stack</p>
                        <div className="flex h-8 rounded-full overflow-hidden bg-gray-900">
                          {(() => {
                            const total = totalDefaults || 1
                            const ins = (insuranceBalance / total) * 100
                            const jr = (juniorBuffer / total) * 100
                            const mz = (mezzanineBuffer / total) * 100
                            return (
                              <>
                                <div className="bg-yellow-500 h-full" style={{ width: `${ins}%` }} title="Insurance" />
                                <div className="bg-orange-500 h-full" style={{ width: `${jr}%` }} title="Junior" />
                                <div className="bg-purple-500 h-full" style={{ width: `${mz}%` }} title="Mezzanine" />
                              </>
                            )
                          })()}
                        </div>
                        <div className="flex gap-4 mt-2 text-xs text-gray-400">
                          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-500 inline-block" /> Insurance</span>
                          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-500 inline-block" /> Junior</span>
                          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-purple-500 inline-block" /> Mezzanine</span>
                        </div>
                      </div>
                    </>
                  )
                })()}
              </div>
            ) : (
              !lossLoading && !lossError && <NoDataCard title="Loss Buffer" />
            )}
          </motion.div>

        </motion.div>
      </div>
    </div>
  )
}
