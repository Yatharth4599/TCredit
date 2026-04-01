import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { agentApi, creditApi } from '../api/solanaClient'

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

const AGENT_TYPES: Record<number, string> = {
  0: 'Trader',
  1: 'Service',
  2: 'Hybrid',
}

function getHealthZone(factor: number): { label: string; color: string; bg: string } {
  if (factor >= 15000) return { label: 'Healthy', color: 'text-green-400', bg: 'bg-green-500' }
  if (factor >= 13000) return { label: 'Warning', color: 'text-yellow-400', bg: 'bg-yellow-500' }
  if (factor >= 12000) return { label: 'Danger', color: 'text-orange-400', bg: 'bg-orange-500' }
  return { label: 'Liquidation', color: 'text-red-400', bg: 'bg-red-500' }
}

function formatUsdc(raw: number | string): string {
  const val = Number(raw) / 1e6
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

interface SectionState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

function useSectionState<T>(): [SectionState<T>, React.Dispatch<React.SetStateAction<SectionState<T>>>] {
  return useState<SectionState<T>>({ data: null, loading: false, error: null })
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

export default function SolanaCreditDashboard() {
  const [address, setAddress] = useState('')
  const [searched, setSearched] = useState(false)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [profile, setProfile] = useSectionState<any>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [wallet, setWallet] = useSectionState<any>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [health, setHealth] = useSectionState<any>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [creditLine, setCreditLine] = useSectionState<any>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [terms, setTerms] = useSectionState<any>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [upgrade, setUpgrade] = useSectionState<any>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [repayment, setRepayment] = useSectionState<any>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [servicePlan, setServicePlan] = useSectionState<any>()

  const loadAgent = useCallback(async (addr: string) => {
    if (!addr.trim()) return
    setSearched(true)

    const load = async <T,>(
      fetcher: () => Promise<{ data: T }>,
      setter: React.Dispatch<React.SetStateAction<SectionState<T>>>,
    ) => {
      setter({ data: null, loading: true, error: null })
      try {
        const res = await fetcher()
        setter({ data: res.data, loading: false, error: null })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Request failed'
        setter({ data: null, loading: false, error: message })
      }
    }

    await Promise.allSettled([
      load(() => agentApi.getProfile(addr), setProfile),
      load(() => agentApi.getWallet(addr), setWallet),
      load(() => agentApi.getHealth(addr), setHealth),
      load(() => creditApi.getCreditLine(addr), setCreditLine),
      load(() => agentApi.getTerms(addr), setTerms),
      load(() => creditApi.getUpgradeCheck(addr), setUpgrade),
      load(() => creditApi.getRepaymentEstimate(addr), setRepayment),
      load(() => agentApi.getServicePlan(addr), setServicePlan),
    ])
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    loadAgent(address)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <motion.div {...fadeIn} className="mb-10">
          <h1 className="text-3xl font-bold text-gray-100 mb-2">Agent Credit Dashboard</h1>
          <p className="text-gray-400">Inspect any agent's credit profile, health, and terms on the Krexa Solana protocol.</p>
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
            disabled={!address.trim()}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium px-6 py-3 rounded-xl transition-colors"
          >
            Lookup Agent
          </button>
        </motion.form>

        {!searched && (
          <motion.div {...fadeIn} className="text-center py-20 text-gray-500">
            <p className="text-lg">Paste a Solana agent public key above to get started.</p>
          </motion.div>
        )}

        {searched && (
          <motion.div variants={stagger} initial="initial" animate="animate" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Profile Card */}
            <motion.div variants={fadeIn} className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-gray-100 mb-4">Agent Profile</h2>
              {profile.loading && <LoadingSpinner />}
              {profile.error && <ErrorBanner message={profile.error} />}
              {profile.data && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-blue-600/30 flex items-center justify-center text-blue-400 font-bold text-lg">
                      {(profile.data.name || 'A')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-100">{profile.data.name || 'Unnamed Agent'}</p>
                      <p className="text-xs text-gray-500 font-mono">{address.slice(0, 8)}...{address.slice(-6)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider">Credit Score</p>
                      <p className="text-2xl font-bold text-gray-100">{profile.data.creditScore ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider">KYA Tier</p>
                      <p className="text-2xl font-bold text-gray-100">{KYA_TIERS[profile.data.kyaTier] ?? profile.data.kyaTier}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider">Credit Level</p>
                      <div className="flex items-center gap-2">
                        <p className="text-2xl font-bold text-gray-100">L{profile.data.creditLevel}</p>
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400">
                          {CREDIT_LEVELS[profile.data.creditLevel]?.name ?? 'Unknown'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider">Agent Type</p>
                      <p className="text-2xl font-bold text-gray-100">{AGENT_TYPES[profile.data.agentType] ?? profile.data.agentType}</p>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>

            {/* Health Gauge */}
            <motion.div variants={fadeIn} className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-gray-100 mb-4">Health Factor</h2>
              {health.loading && <LoadingSpinner />}
              {health.error && <ErrorBanner message={health.error} />}
              {health.data && (() => {
                const factor = health.data.healthFactor ?? 0
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
                      <StatItem label="Collateral" value={formatUsdc(health.data.collateral ?? 0)} />
                      <StatItem label="Debt" value={formatUsdc(health.data.debt ?? 0)} />
                    </div>
                  </div>
                )
              })()}
            </motion.div>

            {/* Credit Line */}
            <motion.div variants={fadeIn} className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-gray-100 mb-4">Credit Line</h2>
              {creditLine.loading && <LoadingSpinner />}
              {creditLine.error && <ErrorBanner message={creditLine.error} />}
              {creditLine.data && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <StatItem label="Credit Limit" value={formatUsdc(creditLine.data.creditLimit ?? 0)} />
                    <StatItem label="Amount Drawn" value={formatUsdc(creditLine.data.drawn ?? 0)} />
                    <StatItem label="Accrued Interest" value={formatUsdc(creditLine.data.accruedInterest ?? 0)} />
                    <StatItem label="Interest Rate" value={formatBps(creditLine.data.rateBps ?? 0)} sub="Annual" />
                  </div>
                  {creditLine.data.creditLimit > 0 && (
                    <div>
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Utilization</span>
                        <span>{((creditLine.data.drawn / creditLine.data.creditLimit) * 100).toFixed(1)}%</span>
                      </div>
                      <div className="h-2 bg-gray-900 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min((creditLine.data.drawn / creditLine.data.creditLimit) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${creditLine.data.active ? 'bg-green-500/20 text-green-400' : 'bg-gray-600/20 text-gray-400'}`}>
                      {creditLine.data.active ? 'Active' : 'Inactive'}
                    </span>
                    {creditLine.data.frozen && (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400">Frozen</span>
                    )}
                  </div>
                </div>
              )}
            </motion.div>

            {/* Credit Terms */}
            <motion.div variants={fadeIn} className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-gray-100 mb-4">Credit Terms</h2>
              {terms.loading && <LoadingSpinner />}
              {terms.error && <ErrorBanner message={terms.error} />}
              {terms.data && (
                <div className="grid grid-cols-2 gap-4">
                  <StatItem label="Max Credit" value={formatUsdc(terms.data.maxCredit ?? 0)} />
                  <StatItem label="Daily Rate" value={formatBps(terms.data.dailyRateBps ?? 0)} />
                  <StatItem label="Annual Rate" value={formatBps(terms.data.annualRateBps ?? 0)} />
                  <StatItem label="NAV Trigger" value={formatUsdc(terms.data.navTrigger ?? 0)} />
                  <StatItem label="Leverage" value={`${(terms.data.maxLeverage ?? 0) / 100}x`} />
                  <StatItem label="Grace Period" value={`${terms.data.gracePeriodDays ?? 0} days`} />
                </div>
              )}
            </motion.div>

            {/* Wallet Info */}
            <motion.div variants={fadeIn} className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-gray-100 mb-4">Wallet</h2>
              {wallet.loading && <LoadingSpinner />}
              {wallet.error && <ErrorBanner message={wallet.error} />}
              {wallet.data && (
                <div className="grid grid-cols-2 gap-4">
                  <StatItem label="USDC Balance" value={formatUsdc(wallet.data.usdcBalance ?? 0)} />
                  <StatItem label="SOL Balance" value={`${((wallet.data.solBalance ?? 0) / 1e9).toFixed(4)} SOL`} />
                  <StatItem label="Total Deposited" value={formatUsdc(wallet.data.totalDeposited ?? 0)} />
                  <StatItem label="Total Withdrawn" value={formatUsdc(wallet.data.totalWithdrawn ?? 0)} />
                </div>
              )}
            </motion.div>

            {/* Level Upgrade */}
            <motion.div variants={fadeIn} className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-gray-100 mb-4">Level Upgrade Check</h2>
              {upgrade.loading && <LoadingSpinner />}
              {upgrade.error && <ErrorBanner message={upgrade.error} />}
              {upgrade.data && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 uppercase tracking-wider">Current Level</span>
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400">
                      L{upgrade.data.currentLevel} {CREDIT_LEVELS[upgrade.data.currentLevel]?.name}
                    </span>
                    {upgrade.data.nextLevel != null && (
                      <>
                        <span className="text-gray-600">→</span>
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400">
                          L{upgrade.data.nextLevel} {CREDIT_LEVELS[upgrade.data.nextLevel]?.name}
                        </span>
                      </>
                    )}
                  </div>
                  {upgrade.data.eligible != null && (
                    <div className={`px-4 py-3 rounded-xl text-sm ${upgrade.data.eligible ? 'bg-green-500/10 border border-green-500/30 text-green-400' : 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-400'}`}>
                      {upgrade.data.eligible ? 'Eligible for upgrade!' : 'Not yet eligible for upgrade'}
                    </div>
                  )}
                  {upgrade.data.requirements && (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-400 uppercase tracking-wider">Requirements</p>
                      {Object.entries(upgrade.data.requirements).map(([key, val]: [string, unknown]) => {
                        const req = val as { required: unknown; current: unknown; met: boolean }
                        return (
                          <div key={key} className="flex items-center justify-between text-sm">
                            <span className="text-gray-300 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400">{String(req.current)} / {String(req.required)}</span>
                              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${req.met ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                {req.met ? '✓' : '✗'}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </motion.div>

            {/* Repayment Estimate */}
            <motion.div variants={fadeIn} className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-gray-100 mb-4">Repayment Estimate</h2>
              {repayment.loading && <LoadingSpinner />}
              {repayment.error && <ErrorBanner message={repayment.error} />}
              {repayment.data && (
                <div className="space-y-4">
                  {repayment.data.totalOwed == null || repayment.data.totalOwed === 0 ? (
                    <p className="text-gray-500 text-sm">No outstanding debt.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <StatItem label="Principal" value={formatUsdc(repayment.data.principal ?? 0)} />
                      <StatItem label="Accrued Interest" value={formatUsdc(repayment.data.accruedInterest ?? 0)} />
                      <StatItem label="Total Owed" value={formatUsdc(repayment.data.totalOwed ?? 0)} />
                      <StatItem label="Daily Accrual" value={formatUsdc(repayment.data.dailyAccrual ?? 0)} sub="per day" />
                    </div>
                  )}
                </div>
              )}
            </motion.div>

            {/* Service Plan (Type B agents) */}
            <motion.div variants={fadeIn} className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-gray-100 mb-4">Service Plan</h2>
              {servicePlan.loading && <LoadingSpinner />}
              {servicePlan.error && <ErrorBanner message={servicePlan.error} />}
              {servicePlan.data && (
                <div className="space-y-4">
                  {!servicePlan.data.active ? (
                    <p className="text-gray-500 text-sm">No active service plan (Trader agents do not have service plans).</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <StatItem label="Total Revenue" value={formatUsdc(servicePlan.data.totalRevenue ?? 0)} />
                        <StatItem label="Milestones Completed" value={String(servicePlan.data.milestonesCompleted ?? 0)} />
                        <StatItem label="Next Milestone" value={formatUsdc(servicePlan.data.nextMilestone ?? 0)} />
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-wider">Health Zone</p>
                          {(() => {
                            const zone = getHealthZone(servicePlan.data.healthFactor ?? 15000)
                            return (
                              <span className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-medium ${zone.bg}/20 ${zone.color}`}>
                                {zone.label}
                              </span>
                            )
                          })()}
                        </div>
                      </div>
                      {servicePlan.data.revenueHistory && servicePlan.data.revenueHistory.length > 0 && (
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Revenue History</p>
                          <div className="flex items-end gap-1 h-16">
                            {servicePlan.data.revenueHistory.map((val: number, i: number) => {
                              const max = Math.max(...servicePlan.data.revenueHistory)
                              const h = max > 0 ? (val / max) * 100 : 0
                              return (
                                <div
                                  key={i}
                                  className="flex-1 bg-blue-500/40 rounded-t"
                                  style={{ height: `${Math.max(h, 4)}%` }}
                                  title={formatUsdc(val)}
                                />
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
