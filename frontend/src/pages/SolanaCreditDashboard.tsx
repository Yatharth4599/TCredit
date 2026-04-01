import { useState, useCallback } from 'react'
import styles from './SolanaCreditDashboard.module.css'
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

function getHealthZone(factor: number): { label: string; valueClass: string; bgClass: string } {
  if (factor >= 15000) return { label: 'Healthy',     valueClass: styles.healthGreen,  bgClass: styles.healthBgGreen }
  if (factor >= 13000) return { label: 'Warning',     valueClass: styles.healthYellow, bgClass: styles.healthBgYellow }
  if (factor >= 12000) return { label: 'Danger',      valueClass: styles.healthOrange, bgClass: styles.healthBgOrange }
  return                       { label: 'Liquidation', valueClass: styles.healthRed,    bgClass: styles.healthBgRed }
}

function formatUsdc(raw: number | string): string {
  const val = Number(raw) / 1e6
  return val.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function formatBps(bps: number): string {
  return (bps / 100).toFixed(2) + '%'
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

function StatItem({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{value}</span>
      {sub && <span className={styles.statSub}>{sub}</span>}
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
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <h1 className={styles.pageTitle}>Agent Credit Dashboard</h1>
          <p className={styles.subtitle}>Inspect any agent's credit profile, health, and terms on the Krexa Solana protocol.</p>
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
            disabled={!address.trim()}
            className={styles.submitBtn}
          >
            Lookup Agent
          </button>
        </form>

        {!searched && (
          <div className={styles.emptyState}>
            <p className={styles.emptyText}>Paste a Solana agent public key above to get started.</p>
          </div>
        )}

        {searched && (
          <div className={styles.cardsGrid}>
            {/* Profile Card */}
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Agent Profile</h2>
              {profile.loading && <LoadingSpinner />}
              {profile.error && <ErrorBanner message={profile.error} />}
              {profile.data && (
                <div className={styles.cardBody}>
                  <div className={styles.profileRow}>
                    <div className={styles.avatarCircle}>
                      {(profile.data.name || 'A')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className={styles.agentName}>{profile.data.name || 'Unnamed Agent'}</p>
                      <p className={styles.agentAddress}>{address.slice(0, 8)}...{address.slice(-6)}</p>
                    </div>
                  </div>
                  <div className={styles.statsGrid2}>
                    <StatItem label="Credit Score" value={String(profile.data.creditScore ?? '—')} />
                    <StatItem label="KYA Tier" value={KYA_TIERS[profile.data.kyaTier] ?? String(profile.data.kyaTier)} />
                    <div>
                      <span className={styles.statLabel}>Credit Level</span>
                      <div className={styles.badgesRow}>
                        <span className={styles.statValue}>L{profile.data.creditLevel}</span>
                        <span className={`${styles.badge} ${styles.badgeBlue}`}>
                          {CREDIT_LEVELS[profile.data.creditLevel]?.name ?? 'Unknown'}
                        </span>
                      </div>
                    </div>
                    <StatItem label="Agent Type" value={AGENT_TYPES[profile.data.agentType] ?? String(profile.data.agentType)} />
                  </div>
                </div>
              )}
            </div>

            {/* Health Gauge */}
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Health Factor</h2>
              {health.loading && <LoadingSpinner />}
              {health.error && <ErrorBanner message={health.error} />}
              {health.data && (() => {
                const factor = health.data.healthFactor ?? 0
                const zone = getHealthZone(factor)
                const pct = Math.min((factor / 20000) * 100, 100)
                return (
                  <div className={styles.cardBody}>
                    <div style={{ textAlign: 'center' }}>
                      <span className={`${styles.healthValue} ${zone.valueClass}`}>{(factor / 100).toFixed(2)}x</span>
                      <div>
                        <span className={`${styles.zoneBadge} ${zone.valueClass}`}>
                          {zone.label}
                        </span>
                      </div>
                    </div>
                    <div className={styles.healthBarTrack}>
                      <div
                        className={zone.bgClass}
                        style={{ height: '100%', width: `${pct}%`, opacity: 0.7, transition: 'width 0.7s ease' }}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className={styles.statSub}>Liquidation</span>
                      <span className={styles.statSub}>Danger</span>
                      <span className={styles.statSub}>Warning</span>
                      <span className={styles.statSub}>Healthy</span>
                    </div>
                    <div className={styles.statsGrid2}>
                      <StatItem label="Collateral" value={formatUsdc(health.data.collateral ?? 0)} />
                      <StatItem label="Debt" value={formatUsdc(health.data.debt ?? 0)} />
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* Credit Line */}
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Credit Line</h2>
              {creditLine.loading && <LoadingSpinner />}
              {creditLine.error && <ErrorBanner message={creditLine.error} />}
              {creditLine.data && (
                <div className={styles.cardBody}>
                  <div className={styles.statsGrid2}>
                    <StatItem label="Credit Limit" value={formatUsdc(creditLine.data.creditLimit ?? 0)} />
                    <StatItem label="Amount Drawn" value={formatUsdc(creditLine.data.drawn ?? 0)} />
                    <StatItem label="Accrued Interest" value={formatUsdc(creditLine.data.accruedInterest ?? 0)} />
                    <StatItem label="Interest Rate" value={formatBps(creditLine.data.rateBps ?? 0)} sub="Annual" />
                  </div>
                  {creditLine.data.creditLimit > 0 && (
                    <div>
                      <div className={styles.utilHeader}>
                        <span className={styles.statSub}>Utilization</span>
                        <span className={styles.statSub}>
                          {((creditLine.data.drawn / creditLine.data.creditLimit) * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className={styles.utilBarWrap}>
                        <div
                          className={styles.utilFill}
                          style={{ width: `${Math.min((creditLine.data.drawn / creditLine.data.creditLimit) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                  <div className={styles.badgesRow}>
                    <span className={`${styles.badge} ${creditLine.data.active ? styles.badgeGreen : styles.badgeGray}`}>
                      {creditLine.data.active ? 'Active' : 'Inactive'}
                    </span>
                    {creditLine.data.frozen && (
                      <span className={`${styles.badge} ${styles.badgeBlue}`}>Frozen</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Credit Terms */}
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Credit Terms</h2>
              {terms.loading && <LoadingSpinner />}
              {terms.error && <ErrorBanner message={terms.error} />}
              {terms.data && (
                <div className={styles.statsGrid2}>
                  <StatItem label="Max Credit" value={formatUsdc(terms.data.maxCredit ?? 0)} />
                  <StatItem label="Daily Rate" value={formatBps(terms.data.dailyRateBps ?? 0)} />
                  <StatItem label="Annual Rate" value={formatBps(terms.data.annualRateBps ?? 0)} />
                  <StatItem label="NAV Trigger" value={formatUsdc(terms.data.navTrigger ?? 0)} />
                  <StatItem label="Leverage" value={`${(terms.data.maxLeverage ?? 0) / 100}x`} />
                  <StatItem label="Grace Period" value={`${terms.data.gracePeriodDays ?? 0} days`} />
                </div>
              )}
            </div>

            {/* Wallet Info */}
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Wallet</h2>
              {wallet.loading && <LoadingSpinner />}
              {wallet.error && <ErrorBanner message={wallet.error} />}
              {wallet.data && (
                <div className={styles.statsGrid2}>
                  <StatItem label="USDC Balance" value={formatUsdc(wallet.data.usdcBalance ?? 0)} />
                  <StatItem label="SOL Balance" value={`${((wallet.data.solBalance ?? 0) / 1e9).toFixed(4)} SOL`} />
                  <StatItem label="Total Deposited" value={formatUsdc(wallet.data.totalDeposited ?? 0)} />
                  <StatItem label="Total Withdrawn" value={formatUsdc(wallet.data.totalWithdrawn ?? 0)} />
                </div>
              )}
            </div>

            {/* Level Upgrade */}
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Level Upgrade Check</h2>
              {upgrade.loading && <LoadingSpinner />}
              {upgrade.error && <ErrorBanner message={upgrade.error} />}
              {upgrade.data && (
                <div className={styles.cardBody}>
                  <div className={styles.badgesRow}>
                    <span className={styles.statLabel}>Current Level</span>
                    <span className={`${styles.badge} ${styles.badgeBlue}`}>
                      L{upgrade.data.currentLevel} {CREDIT_LEVELS[upgrade.data.currentLevel]?.name}
                    </span>
                    {upgrade.data.nextLevel != null && (
                      <>
                        <span className={styles.statSub}>→</span>
                        <span className={`${styles.badge} ${styles.badgePurple}`}>
                          L{upgrade.data.nextLevel} {CREDIT_LEVELS[upgrade.data.nextLevel]?.name}
                        </span>
                      </>
                    )}
                  </div>
                  {upgrade.data.eligible != null && (
                    <div className={upgrade.data.eligible ? styles.eligibleBanner : styles.notEligibleBanner}>
                      {upgrade.data.eligible ? 'Eligible for upgrade!' : 'Not yet eligible for upgrade'}
                    </div>
                  )}
                  {upgrade.data.requirements && (
                    <div className={styles.cardBody}>
                      <span className={styles.statLabel}>Requirements</span>
                      {Object.entries(upgrade.data.requirements).map(([key, val]: [string, unknown]) => {
                        const req = val as { required: unknown; current: unknown; met: boolean }
                        return (
                          <div key={key} className={styles.requirementRow}>
                            <span className={styles.requirementLabel}>{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                            <div className={styles.requirementValues}>
                              <span>{String(req.current)} / {String(req.required)}</span>
                              <span className={req.met ? styles.checkMark : styles.xMark}>
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
            </div>

            {/* Repayment Estimate */}
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Repayment Estimate</h2>
              {repayment.loading && <LoadingSpinner />}
              {repayment.error && <ErrorBanner message={repayment.error} />}
              {repayment.data && (
                <div className={styles.cardBody}>
                  {repayment.data.totalOwed == null || repayment.data.totalOwed === 0 ? (
                    <p className={styles.emptyText}>No outstanding debt.</p>
                  ) : (
                    <div className={styles.statsGrid2}>
                      <StatItem label="Principal" value={formatUsdc(repayment.data.principal ?? 0)} />
                      <StatItem label="Accrued Interest" value={formatUsdc(repayment.data.accruedInterest ?? 0)} />
                      <StatItem label="Total Owed" value={formatUsdc(repayment.data.totalOwed ?? 0)} />
                      <StatItem label="Daily Accrual" value={formatUsdc(repayment.data.dailyAccrual ?? 0)} sub="per day" />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Service Plan (Type B agents) */}
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Service Plan</h2>
              {servicePlan.loading && <LoadingSpinner />}
              {servicePlan.error && <ErrorBanner message={servicePlan.error} />}
              {servicePlan.data && (
                <div className={styles.cardBody}>
                  {!servicePlan.data.active ? (
                    <p className={styles.emptyText}>No active service plan (Trader agents do not have service plans).</p>
                  ) : (
                    <>
                      <div className={styles.statsGrid2}>
                        <StatItem label="Total Revenue" value={formatUsdc(servicePlan.data.totalRevenue ?? 0)} />
                        <StatItem label="Milestones Completed" value={String(servicePlan.data.milestonesCompleted ?? 0)} />
                        <StatItem label="Next Milestone" value={formatUsdc(servicePlan.data.nextMilestone ?? 0)} />
                        <div>
                          <span className={styles.statLabel}>Health Zone</span>
                          {(() => {
                            const zone = getHealthZone(servicePlan.data.healthFactor ?? 15000)
                            return (
                              <span className={`${styles.zoneBadge} ${zone.valueClass}`}>
                                {zone.label}
                              </span>
                            )
                          })()}
                        </div>
                      </div>
                      {servicePlan.data.revenueHistory && servicePlan.data.revenueHistory.length > 0 && (
                        <div>
                          <span className={styles.statLabel}>Revenue History</span>
                          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '64px' }}>
                            {servicePlan.data.revenueHistory.map((val: number, i: number) => {
                              const max = Math.max(...servicePlan.data.revenueHistory)
                              const h = max > 0 ? (val / max) * 100 : 0
                              return (
                                <div
                                  key={i}
                                  style={{
                                    flex: 1,
                                    background: 'rgba(37, 99, 235, 0.4)',
                                    height: `${Math.max(h, 4)}%`,
                                  }}
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
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
