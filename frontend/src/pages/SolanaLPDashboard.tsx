import { useState } from 'react'
import { motion } from 'framer-motion'
import { lpApi } from '../api/solanaClient'

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

const TRANCHES = ['senior', 'mezzanine', 'junior'] as const
const TRANCHE_STYLES: Record<string, { border: string; badge: string }> = {
  senior: { border: 'border-blue-500/40', badge: 'bg-blue-500/20 text-blue-400' },
  mezzanine: { border: 'border-purple-500/40', badge: 'bg-purple-500/20 text-purple-400' },
  junior: { border: 'border-orange-500/40', badge: 'bg-orange-500/20 text-orange-400' },
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyData = any

export default function SolanaLPDashboard() {
  const [address, setAddress] = useState('')
  const [searched, setSearched] = useState(false)

  const [positions, setPositions] = useState<{ data: AnyData; loading: boolean; error: string | null }>({ data: null, loading: false, error: null })

  // Deposit preview
  const [depositTranche, setDepositTranche] = useState<string>('senior')
  const [depositAmount, setDepositAmount] = useState('')
  const [depositPreview, setDepositPreview] = useState<{ data: AnyData; loading: boolean; error: string | null }>({ data: null, loading: false, error: null })

  // Withdraw preview
  const [withdrawTranche, setWithdrawTranche] = useState<string>('senior')
  const [withdrawShares, setWithdrawShares] = useState('')
  const [withdrawPreview, setWithdrawPreview] = useState<{ data: AnyData; loading: boolean; error: string | null }>({ data: null, loading: false, error: null })

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!address.trim()) return
    setSearched(true)
    setPositions({ data: null, loading: true, error: null })
    try {
      const res = await lpApi.getPositions(address)
      setPositions({ data: res.data, loading: false, error: null })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Request failed'
      setPositions({ data: null, loading: false, error: message })
    }
  }

  const handleDepositPreview = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!depositAmount) return
    setDepositPreview({ data: null, loading: true, error: null })
    try {
      const res = await lpApi.previewDeposit(depositTranche, depositAmount)
      setDepositPreview({ data: res.data, loading: false, error: null })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Request failed'
      setDepositPreview({ data: null, loading: false, error: message })
    }
  }

  const handleWithdrawPreview = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!withdrawShares) return
    setWithdrawPreview({ data: null, loading: true, error: null })
    try {
      const res = await lpApi.previewWithdraw(withdrawTranche, withdrawShares)
      setWithdrawPreview({ data: res.data, loading: false, error: null })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Request failed'
      setWithdrawPreview({ data: null, loading: false, error: message })
    }
  }

  // Compute summary stats from positions
  const totalDeposited = positions.data?.positions
    ? positions.data.positions.reduce((sum: number, p: AnyData) => sum + (p.deposits ?? 0), 0)
    : 0
  const totalYield = positions.data?.positions
    ? positions.data.positions.reduce((sum: number, p: AnyData) => sum + (p.yieldEarned ?? 0), 0)
    : 0

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <motion.div {...fadeIn} className="mb-10">
          <h1 className="text-3xl font-bold text-gray-100 mb-2">LP Dashboard</h1>
          <p className="text-gray-400">View LP positions, preview deposits, and calculate withdrawals.</p>
        </motion.div>

        {/* Wallet Lookup */}
        <motion.form {...fadeIn} onSubmit={handleLookup} className="mb-10 flex gap-3">
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Enter LP wallet address..."
            className="flex-1 bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono text-sm"
          />
          <button
            type="submit"
            disabled={!address.trim()}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium px-6 py-3 rounded-xl transition-colors"
          >
            Lookup Positions
          </button>
        </motion.form>

        <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-6">
          {/* Positions */}
          {searched && (
            <motion.div variants={fadeIn}>
              <h2 className="text-lg font-semibold text-gray-100 mb-4">LP Positions</h2>
              {positions.loading && <LoadingSpinner />}
              {positions.error && <ErrorBanner message={positions.error} />}
              {positions.data && (
                <div className="space-y-6">
                  {/* Summary */}
                  <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
                    <h3 className="text-sm font-medium text-gray-400 mb-4">Portfolio Summary</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <StatItem label="Total Deposited" value={formatUsdc(totalDeposited)} />
                      <StatItem label="Total Yield Earned" value={formatUsdc(totalYield)} />
                      <StatItem label="Active Positions" value={String(positions.data.positions?.length ?? 0)} />
                    </div>
                  </div>

                  {/* Individual positions */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {positions.data.positions?.map((pos: AnyData) => {
                      const tranche = (pos.tranche ?? '').toLowerCase()
                      const style = TRANCHE_STYLES[tranche] ?? TRANCHE_STYLES.senior
                      return (
                        <motion.div
                          key={pos.tranche}
                          variants={fadeIn}
                          className={`bg-gray-800/50 border ${style.border} rounded-2xl p-6`}
                        >
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${style.badge} mb-4`}>
                            {pos.tranche}
                          </span>
                          <div className="grid grid-cols-2 gap-4">
                            <StatItem label="Deposits" value={formatUsdc(pos.deposits ?? 0)} />
                            <StatItem label="Shares" value={(Number(pos.shares ?? 0) / 1e6).toLocaleString()} />
                            <StatItem label="Est. Value" value={formatUsdc(pos.estimatedValue ?? 0)} />
                            <StatItem label="Yield Earned" value={formatUsdc(pos.yieldEarned ?? 0)} />
                          </div>
                        </motion.div>
                      )
                    })}
                    {(!positions.data.positions || positions.data.positions.length === 0) && (
                      <div className="col-span-3 text-center py-8 text-gray-500">
                        No LP positions found for this wallet.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Deposit Preview */}
          <motion.div variants={fadeIn} className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-gray-100 mb-4">Deposit Preview</h2>
            <form onSubmit={handleDepositPreview} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">Tranche</label>
                  <select
                    value={depositTranche}
                    onChange={(e) => setDepositTranche(e.target.value)}
                    className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-gray-100 focus:outline-none focus:border-blue-500"
                  >
                    {TRANCHES.map((t) => (
                      <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">Amount (USDC)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="1000.00"
                    className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={!depositAmount}
                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium px-6 py-3 rounded-xl transition-colors"
                  >
                    Preview
                  </button>
                </div>
              </div>
            </form>
            {depositPreview.loading && <LoadingSpinner />}
            {depositPreview.error && <div className="mt-4"><ErrorBanner message={depositPreview.error} /></div>}
            {depositPreview.data && (
              <motion.div {...fadeIn} className="mt-4 bg-gray-900/50 rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatItem label="Shares Received" value={(Number(depositPreview.data.sharesReceived ?? 0) / 1e6).toLocaleString()} />
                <StatItem label="Share Price" value={`$${(Number(depositPreview.data.sharePrice ?? 1e6) / 1e6).toFixed(4)}`} />
                <StatItem label="Est. APY" value={formatPct(depositPreview.data.estimatedApyBps ?? 0)} />
                <StatItem label="Daily Yield" value={formatUsdc(depositPreview.data.estimatedDailyYield ?? 0)} />
              </motion.div>
            )}
          </motion.div>

          {/* Withdrawal Preview */}
          <motion.div variants={fadeIn} className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-gray-100 mb-4">Withdrawal Preview</h2>
            <form onSubmit={handleWithdrawPreview} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">Tranche</label>
                  <select
                    value={withdrawTranche}
                    onChange={(e) => setWithdrawTranche(e.target.value)}
                    className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-gray-100 focus:outline-none focus:border-blue-500"
                  >
                    {TRANCHES.map((t) => (
                      <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">Shares to Withdraw</label>
                  <input
                    type="number"
                    step="0.01"
                    value={withdrawShares}
                    onChange={(e) => setWithdrawShares(e.target.value)}
                    placeholder="500.00"
                    className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={!withdrawShares}
                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium px-6 py-3 rounded-xl transition-colors"
                  >
                    Preview
                  </button>
                </div>
              </div>
            </form>
            {withdrawPreview.loading && <LoadingSpinner />}
            {withdrawPreview.error && <div className="mt-4"><ErrorBanner message={withdrawPreview.error} /></div>}
            {withdrawPreview.data && (
              <motion.div {...fadeIn} className="mt-4 bg-gray-900/50 rounded-xl p-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                <StatItem label="USDC Received" value={formatUsdc(withdrawPreview.data.usdcReceived ?? 0)} />
                <StatItem label="Share Price" value={`$${(Number(withdrawPreview.data.sharePrice ?? 1e6) / 1e6).toFixed(4)}`} />
                <StatItem label="Withdrawal Fee" value={formatUsdc(withdrawPreview.data.fee ?? 0)} />
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
