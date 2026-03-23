import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { vaultApi } from '../api/solanaClient'

function formatUsdc(raw: number | string): string {
  const val = Number(raw) / 1e6
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

const TRANCHE_NAMES = ['Senior', 'Mezzanine', 'Junior'] as const
const TRANCHE_COLORS = {
  Senior: { border: 'border-blue-500/40', badge: 'bg-blue-500/20 text-blue-400', bar: 'bg-blue-500' },
  Mezzanine: { border: 'border-purple-500/40', badge: 'bg-purple-500/20 text-purple-400', bar: 'bg-purple-500' },
  Junior: { border: 'border-orange-500/40', badge: 'bg-orange-500/20 text-orange-400', bar: 'bg-orange-500' },
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyData = any

export default function SolanaVaultDashboard() {
  const [stats, setStats] = useState<{ data: AnyData; loading: boolean; error: string | null }>({ data: null, loading: true, error: null })
  const [tranches, setTranches] = useState<{ data: Record<string, AnyData>; loading: boolean; error: string | null }>({ data: {}, loading: true, error: null })
  const [revenue, setRevenue] = useState<{ data: AnyData; loading: boolean; error: string | null }>({ data: null, loading: true, error: null })
  const [lossBuffer, setLossBuffer] = useState<{ data: AnyData; loading: boolean; error: string | null }>({ data: null, loading: true, error: null })

  useEffect(() => {
    const loadAll = async () => {
      // Stats
      vaultApi.getStats()
        .then((res) => setStats({ data: res.data, loading: false, error: null }))
        .catch((err) => setStats({ data: null, loading: false, error: err.message }))

      // Tranches
      Promise.all(
        TRANCHE_NAMES.map(async (t) => {
          try {
            const res = await vaultApi.getTrancheStats(t.toLowerCase())
            return [t, res.data] as const
          } catch {
            return [t, null] as const
          }
        })
      ).then((results) => {
        const data: Record<string, AnyData> = {}
        results.forEach(([name, val]) => { if (val) data[name] = val })
        setTranches({ data, loading: false, error: Object.keys(data).length === 0 ? 'Failed to load tranches' : null })
      })

      // Revenue
      vaultApi.getRevenue()
        .then((res) => setRevenue({ data: res.data, loading: false, error: null }))
        .catch((err) => setRevenue({ data: null, loading: false, error: err.message }))

      // Loss buffer
      vaultApi.getLossBuffer()
        .then((res) => setLossBuffer({ data: res.data, loading: false, error: null }))
        .catch((err) => setLossBuffer({ data: null, loading: false, error: err.message }))
    }

    loadAll()
  }, [])

  const utilPct = stats.data
    ? Math.min(((stats.data.totalBorrowed ?? 0) / Math.max(stats.data.tvl ?? 1, 1)) * 100, 100)
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
          {/* Vault Stats */}
          <motion.div variants={fadeIn} className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-gray-100 mb-4">Vault Stats</h2>
            {stats.loading && <LoadingSpinner />}
            {stats.error && <ErrorBanner message={stats.error} />}
            {stats.data && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatItem label="Total Value Locked" value={formatUsdc(stats.data.tvl ?? 0)} />
                  <StatItem label="Total Borrowed" value={formatUsdc(stats.data.totalBorrowed ?? 0)} />
                  <StatItem label="Available Liquidity" value={formatUsdc(stats.data.availableLiquidity ?? 0)} />
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider">Status</p>
                    <span className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-medium ${stats.data.paused ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                      {stats.data.paused ? 'Paused' : 'Active'}
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
                    {/* 80% cap marker */}
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
          </motion.div>

          {/* Tranche Breakdown */}
          <motion.div variants={fadeIn}>
            <h2 className="text-lg font-semibold text-gray-100 mb-4">Tranche Breakdown</h2>
            {tranches.loading && <LoadingSpinner />}
            {tranches.error && <ErrorBanner message={tranches.error} />}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {TRANCHE_NAMES.map((name) => {
                const t = tranches.data[name]
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
                        {name}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <StatItem label="Total Deposits" value={formatUsdc(t.totalDeposits ?? 0)} />
                      <StatItem label="Total Shares" value={(Number(t.totalShares ?? 0) / 1e6).toLocaleString()} />
                      <StatItem label="APR" value={formatPct(t.aprBps ?? 0)} />
                      <StatItem label="Share Price" value={`$${(Number(t.sharePrice ?? 1e6) / 1e6).toFixed(4)}`} />
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </motion.div>

          {/* Revenue Breakdown */}
          <motion.div variants={fadeIn} className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-gray-100 mb-4">Daily Revenue Breakdown</h2>
            {revenue.loading && <LoadingSpinner />}
            {revenue.error && <ErrorBanner message={revenue.error} />}
            {revenue.data && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <StatItem label="Agent Revenue" value={formatUsdc(revenue.data.agentRevenue ?? 0)} />
                  <StatItem label="Protocol Fee" value={formatUsdc(revenue.data.protocolFee ?? 0)} />
                  <StatItem label="Senior Yield" value={formatUsdc(revenue.data.seniorYield ?? 0)} />
                  <StatItem label="Mezzanine Yield" value={formatUsdc(revenue.data.mezzanineYield ?? 0)} />
                  <StatItem label="Junior Yield" value={formatUsdc(revenue.data.juniorYield ?? 0)} />
                  <StatItem label="Surplus" value={formatUsdc(revenue.data.surplus ?? 0)} />
                  <StatItem label="Insurance Fund" value={formatUsdc(revenue.data.insuranceFund ?? 0)} />
                  <StatItem label="Treasury" value={formatUsdc(revenue.data.treasury ?? 0)} />
                </div>

                {/* Revenue Waterfall */}
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Revenue Waterfall</p>
                  <div className="space-y-2">
                    {[
                      { label: 'Agent Revenue', value: revenue.data.agentRevenue ?? 0, color: 'bg-blue-500' },
                      { label: 'Protocol Fee', value: revenue.data.protocolFee ?? 0, color: 'bg-gray-500' },
                      { label: 'Senior Yield', value: revenue.data.seniorYield ?? 0, color: 'bg-blue-400' },
                      { label: 'Mezz Yield', value: revenue.data.mezzanineYield ?? 0, color: 'bg-purple-400' },
                      { label: 'Junior Yield', value: revenue.data.juniorYield ?? 0, color: 'bg-orange-400' },
                      { label: 'Insurance', value: revenue.data.insuranceFund ?? 0, color: 'bg-yellow-500' },
                      { label: 'Treasury', value: revenue.data.treasury ?? 0, color: 'bg-green-500' },
                    ].map((item) => {
                      const maxVal = Math.max(
                        revenue.data.agentRevenue ?? 0,
                        revenue.data.protocolFee ?? 0,
                        revenue.data.seniorYield ?? 0,
                        revenue.data.mezzanineYield ?? 0,
                        revenue.data.juniorYield ?? 0,
                        revenue.data.insuranceFund ?? 0,
                        revenue.data.treasury ?? 0,
                        1
                      )
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
                </div>
              </div>
            )}
          </motion.div>

          {/* Loss Buffer */}
          <motion.div variants={fadeIn} className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-gray-100 mb-4">Loss Buffer Status</h2>
            {lossBuffer.loading && <LoadingSpinner />}
            {lossBuffer.error && <ErrorBanner message={lossBuffer.error} />}
            {lossBuffer.data && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatItem label="Insurance Balance" value={formatUsdc(lossBuffer.data.insuranceBalance ?? 0)} />
                  <StatItem label="Insurance Capacity" value={formatUsdc(lossBuffer.data.insuranceCapacity ?? 0)} />
                  <StatItem label="Junior Buffer" value={formatUsdc(lossBuffer.data.juniorBuffer ?? 0)} />
                  <StatItem label="Mezzanine Buffer" value={formatUsdc(lossBuffer.data.mezzanineBuffer ?? 0)} />
                </div>

                <div className="bg-gray-900/50 rounded-xl p-4">
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Total Defaults Before Senior Loss</p>
                  <p className="text-3xl font-bold text-green-400">{formatUsdc(lossBuffer.data.totalDefaultsBeforeSeniorLoss ?? 0)}</p>
                  <p className="text-xs text-gray-500 mt-1">Insurance + Junior equity + Mezzanine equity</p>
                </div>

                {/* Buffer visualization */}
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Buffer Stack</p>
                  <div className="flex h-8 rounded-full overflow-hidden bg-gray-900">
                    {(() => {
                      const total = (lossBuffer.data.totalDefaultsBeforeSeniorLoss ?? 1) || 1
                      const ins = ((lossBuffer.data.insuranceBalance ?? 0) / total) * 100
                      const jr = ((lossBuffer.data.juniorBuffer ?? 0) / total) * 100
                      const mz = ((lossBuffer.data.mezzanineBuffer ?? 0) / total) * 100
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
              </div>
            )}
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
