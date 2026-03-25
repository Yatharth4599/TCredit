import { useState } from 'react'
import { motion } from 'framer-motion'
import { useWallet } from '@solana/wallet-adapter-react'
import { Layers, Plus, ArrowDownToLine, Info, ArrowDown } from 'lucide-react'
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

        {/* === Tranche Education === */}
        <motion.div variants={fadeIn} className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Info size={16} className="text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-100">Understanding Tranches</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border border-blue-500/30 bg-blue-500/5 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-blue-400">Senior</span>
                <span className="text-xs font-medium text-blue-300 bg-blue-500/20 px-2 py-0.5 rounded">10% APR</span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Lowest risk. Senior LPs are repaid first from protocol yields. Losses are absorbed by Junior and Mezzanine tranches before reaching Senior.
              </p>
              <div className="mt-3 pt-3 border-t border-blue-500/20">
                <p className="text-[10px] text-gray-500">Risk: Low | Priority: First</p>
              </div>
            </div>
            <div className="border border-purple-500/30 bg-purple-500/5 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-purple-400">Mezzanine</span>
                <span className="text-xs font-medium text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded">12% APR</span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Medium risk. Mezzanine absorbs losses after Junior is depleted. Higher yield compensates for additional risk exposure.
              </p>
              <div className="mt-3 pt-3 border-t border-purple-500/20">
                <p className="text-[10px] text-gray-500">Risk: Medium | Priority: Second</p>
              </div>
            </div>
            <div className="border border-orange-500/30 bg-orange-500/5 rounded-xl p-4 opacity-60">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-orange-400">Junior</span>
                <span className="text-xs font-medium text-orange-300 bg-orange-500/20 px-2 py-0.5 rounded">20% APR</span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Highest risk/reward. Junior absorbs losses first. Protocol-only tranche — not available for external deposits. Acts as the protocol's insurance layer.
              </p>
              <div className="mt-3 pt-3 border-t border-orange-500/20">
                <p className="text-[10px] text-gray-500">Risk: High | Priority: Last | Protocol-only</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* === Repayment Waterfall === */}
        <motion.div variants={fadeIn} className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-gray-100 mb-4">Repayment Waterfall</h2>
          <p className="text-xs text-gray-500 mb-4">How agent repayments flow through the protocol</p>
          <div className="flex flex-col items-center gap-1">
            {[
              { label: 'Agent Repayment', desc: 'Principal + interest collected', color: 'bg-green-500/20 border-green-500/30 text-green-400' },
              { label: 'Senior Tranche', desc: 'Paid first — lowest risk', color: 'bg-blue-500/20 border-blue-500/30 text-blue-400' },
              { label: 'Protocol Pool', desc: 'Operating costs + insurance reserve', color: 'bg-gray-700/50 border-gray-600/30 text-gray-300' },
              { label: 'Mezzanine Tranche', desc: 'Paid second — medium risk', color: 'bg-purple-500/20 border-purple-500/30 text-purple-400' },
              { label: 'Junior Tranche', desc: 'Residual — highest risk/reward', color: 'bg-orange-500/20 border-orange-500/30 text-orange-400' },
            ].map((step, i, arr) => (
              <div key={step.label} className="w-full max-w-sm">
                <div className={`border rounded-xl p-3 ${step.color}`}>
                  <p className="text-sm font-medium">{step.label}</p>
                  <p className="text-[10px] opacity-70">{step.desc}</p>
                </div>
                {i < arr.length - 1 && (
                  <div className="flex justify-center py-1">
                    <ArrowDown size={14} className="text-gray-600" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </motion.div>

        {/* === Lock-up & Withdrawal Rules === */}
        <motion.div variants={fadeIn} className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-gray-100 mb-4">Withdrawal Rules</h2>
          <div className="space-y-3">
            {[
              { rule: 'No lock-up period', desc: 'Withdraw at any time — no minimum hold duration required.' },
              { rule: 'Available liquidity', desc: 'Withdrawals are limited to idle liquidity not currently lent out. If utilization is high, partial withdrawal may apply.' },
              { rule: 'Share-based redemption', desc: 'You redeem shares, not a fixed USD amount. Share value accrues yield over time.' },
              { rule: 'Tranche-specific', desc: 'Each tranche withdrawal is independent. Senior withdrawals are processed before Mezzanine.' },
            ].map((item) => (
              <div key={item.rule} className="flex gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                <div>
                  <p className="text-sm text-gray-200">{item.rule}</p>
                  <p className="text-xs text-gray-500">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
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
