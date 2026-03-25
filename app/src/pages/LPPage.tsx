import { useState } from 'react'
import { motion } from 'framer-motion'
import { useWallet } from '@solana/wallet-adapter-react'
import { Layers, Plus, ArrowDownToLine } from 'lucide-react'
import { useLPPositions } from '../hooks'
import { EmptyState } from '../components/shared'
import { DepositModal } from '../components/lp/DepositModal'
import { WithdrawModal } from '../components/lp/WithdrawModal'
import type { LPPosition } from '../sdk/types'

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

const TRANCHES = ['senior', 'mezzanine', 'junior'] as const
const TRANCHE_NAMES: Record<number, string> = {
  0: 'Senior',
  1: 'Mezzanine',
  2: 'Junior',
}
const TRANCHE_STYLES: Record<string, { border: string; badge: string }> = {
  Senior: { border: 'border-blue-500/40', badge: 'bg-blue-500/20 text-blue-400' },
  Mezzanine: { border: 'border-purple-500/40', badge: 'bg-purple-500/20 text-purple-400' },
  Junior: { border: 'border-orange-500/40', badge: 'bg-orange-500/20 text-orange-400' },
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function LPPage() {
  const { connected } = useWallet()
  const { data: positions, isLoading, error } = useLPPositions()

  const [showDeposit, setShowDeposit] = useState(false)
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [withdrawTranche, setWithdrawTranche] = useState(0)

  // Deposit preview state
  const [depositTranchePreview, setDepositTranchePreview] = useState<string>('senior')
  const [depositAmount, setDepositAmount] = useState('')

  // Withdraw preview state
  const [withdrawTranchePreview, setWithdrawTranchePreview] = useState<string>('senior')
  const [withdrawShares, setWithdrawShares] = useState('')

  if (!connected) {
    return (
      <EmptyState
        icon={<Layers size={48} />}
        title="Connect your wallet"
        description="Connect a Solana wallet to view your LP positions."
      />
    )
  }

  // Convert Map to array
  const positionEntries: LPPosition[] = positions ? Array.from(positions.values()) : []

  // Compute summary
  const totalDeposited = positionEntries.reduce(
    (sum, p) => sum + Number(p.depositAmount.toString()),
    0
  )
  const totalYield = positionEntries.reduce(
    (sum, p) => sum + Number(p.estimatedYield.toString()),
    0
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div {...fadeIn}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white tracking-tight">LP Dashboard</h2>
            <p className="text-sm text-white/30 mt-0.5">Your liquidity positions, deposit previews, and withdrawal estimates.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowDeposit(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Plus size={14} /> Deposit
            </button>
            {positionEntries.length > 0 && (
              <button
                onClick={() => setShowWithdraw(true)}
                className="bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <ArrowDownToLine size={14} /> Withdraw
              </button>
            )}
          </div>
        </div>
      </motion.div>

      <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-6">

        {/* === Positions === */}
        <motion.div variants={fadeIn}>
          <h2 className="text-lg font-semibold text-gray-100 mb-4">LP Positions</h2>
          {isLoading && <LoadingSpinner />}
          {error && !isLoading && (
            <ErrorBanner message={error instanceof Error ? error.message : 'Failed to load positions'} />
          )}
          {!isLoading && !error && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
                <h3 className="text-sm font-medium text-gray-400 mb-4">Portfolio Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <StatItem label="Total Deposited" value={formatUsdc(totalDeposited)} />
                  <StatItem label="Total Yield Earned" value={formatUsdc(totalYield)} />
                  <StatItem label="Active Positions" value={String(positionEntries.length)} />
                </div>
              </div>

              {/* Individual position cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {positionEntries.map((pos, i) => {
                  const trancheName = TRANCHE_NAMES[pos.tranche] ?? 'Unknown'
                  const style = TRANCHE_STYLES[trancheName] ?? TRANCHE_STYLES.Senior
                  return (
                    <motion.div
                      key={i}
                      variants={fadeIn}
                      className={`bg-gray-800/50 border ${style.border} rounded-2xl p-6`}
                    >
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${style.badge} mb-4`}>
                        {trancheName}
                      </span>
                      <div className="grid grid-cols-2 gap-4">
                        <StatItem label="Deposits" value={formatUsdc(pos.depositAmount)} />
                        <StatItem label="Shares" value={(Number(pos.shares.toString()) / 1e6).toLocaleString()} />
                        <StatItem label="Est. Value" value={formatUsdc(pos.estimatedValue)} />
                        <StatItem label="Yield Earned" value={formatUsdc(pos.estimatedYield)} />
                      </div>
                    </motion.div>
                  )
                })}
                {positionEntries.length === 0 && (
                  <div className="col-span-3 text-center py-8 text-gray-500">
                    No LP positions found for this wallet.
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>

        {/* === Deposit Preview === */}
        <motion.div variants={fadeIn} className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-gray-100 mb-4">Deposit Preview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">Tranche</label>
              <select
                value={depositTranchePreview}
                onChange={(e) => setDepositTranchePreview(e.target.value)}
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
          </div>
          {depositAmount && parseFloat(depositAmount) > 0 && (() => {
            const aprMap: Record<string, number> = { senior: 10, mezzanine: 12, junior: 20 }
            const apr = aprMap[depositTranchePreview] ?? 10
            const principal = parseFloat(depositAmount)
            const annualYield = principal * apr / 100
            return (
              <div className="mt-4 bg-gray-900/50 rounded-xl p-4 grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Annual Yield</p>
                  <p className="text-sm font-bold text-green-400">${annualYield.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Monthly Yield</p>
                  <p className="text-sm font-bold text-green-400">${(annualYield / 12).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">APR</p>
                  <p className="text-sm font-bold text-gray-100">{apr}%</p>
                </div>
              </div>
            )
          })()}
        </motion.div>

        {/* === Withdrawal Preview === */}
        <motion.div variants={fadeIn} className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-gray-100 mb-4">Withdrawal Preview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">Tranche</label>
              <select
                value={withdrawTranchePreview}
                onChange={(e) => setWithdrawTranchePreview(e.target.value)}
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
          </div>
          {withdrawShares && parseFloat(withdrawShares) > 0 && (() => {
            // Shares are 1:1 with USDC at deposit time (1 share = $1 USDC principal)
            const shares = parseFloat(withdrawShares)
            const aprMap: Record<string, number> = { senior: 10, mezzanine: 12, junior: 20 }
            const apr = aprMap[withdrawTranchePreview] ?? 10
            const estimatedValue = shares * (1 + apr / 100 / 12) // ~1 month accrual
            return (
              <div className="mt-4 bg-gray-900/50 rounded-xl p-4 grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Principal</p>
                  <p className="text-sm font-bold text-gray-100">${shares.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Est. Value</p>
                  <p className="text-sm font-bold text-green-400">${estimatedValue.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">APR</p>
                  <p className="text-sm font-bold text-gray-100">{apr}%</p>
                </div>
              </div>
            )
          })()}
        </motion.div>

      </motion.div>

      <DepositModal isOpen={showDeposit} onClose={() => setShowDeposit(false)} />
      <WithdrawModal
        isOpen={showWithdraw}
        onClose={() => setShowWithdraw(false)}
        tranche={withdrawTranche}
      />
    </div>
  )
}
