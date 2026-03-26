import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { agentApi, creditApi } from '../api/solanaClient'
import { BentoGrid, BentoCard } from '../components/ui/BentoGrid'
import { GlassCard } from '../components/ui/GlassCard'
import { StatWidget } from '../components/ui/StatWidget'
import { AnimatedNumber } from '../components/ui/AnimatedNumber'
import { Skeleton } from '../components/ui/Skeleton'
import DecryptedText from '../components/ui/DecryptedText'
import SolanaLayout from '../components/layout/SolanaLayout'
import {
  formatUsdc,
  formatUsdcRaw,
  formatBps,
  getHealthZone,
  CREDIT_LEVELS,
  KYA_TIERS,
  AGENT_TYPES,
} from '../utils/dashboardHelpers'
import { containerVariants, cardVariants } from '../utils/motionVariants'
import s from './SolanaCreditDashboard.module.css'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyData = any

interface SectionState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

function useSectionState<T>(): [SectionState<T>, React.Dispatch<React.SetStateAction<SectionState<T>>>] {
  return useState<SectionState<T>>({ data: null, loading: false, error: null })
}

// SVG health gauge (270° arc)
function HealthGauge({ factor }: { factor: number }) {
  const zone = getHealthZone(factor)
  const displayFactor = factor / 100
  const pct = Math.min(factor / 20000, 1)

  const r = 72
  const cx = 90
  const cy = 90
  const startAngle = 135
  const totalAngle = 270
  const arcAngle = totalAngle * pct

  function polarToCartesian(angle: number) {
    const rad = ((angle - 90) * Math.PI) / 180
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
  }

  const start = polarToCartesian(startAngle)
  const end = polarToCartesian(startAngle + arcAngle)
  const largeArc = arcAngle > 180 ? 1 : 0
  const trackEnd = polarToCartesian(startAngle + totalAngle)

  return (
    <div className={s.gaugeWrap}>
      <svg width="180" height="170" className={s.gaugeSvg} style={{ '--gaugeGlowColor': `rgba(${zone.rgb}, 0.35)` } as React.CSSProperties}>
        {/* Track */}
        <path
          d={`M ${start.x} ${start.y} A ${r} ${r} 0 1 1 ${trackEnd.x} ${trackEnd.y}`}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        {/* Fill arc */}
        {arcAngle > 0 && (
          <motion.path
            d={`M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`}
            fill="none"
            stroke={zone.color}
            strokeWidth="10"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          />
        )}
        {/* Endpoint glow dot */}
        {arcAngle > 0 && (
          <circle cx={end.x} cy={end.y} r="7" fill={zone.color} opacity="0.9">
            <animate attributeName="opacity" values="0.9;0.5;0.9" dur="2s" repeatCount="indefinite" />
          </circle>
        )}
        {/* Center value */}
        <text x={cx} y={cy - 8} textAnchor="middle" fill={zone.color} fontSize="26" fontWeight="800" fontFamily="var(--font-display)">
          {displayFactor.toFixed(2)}x
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" fill="var(--text-dim)" fontSize="11" fontWeight="500">
          {zone.label}
        </text>
      </svg>
    </div>
  )
}

function CardSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height={32} width={i % 2 === 0 ? '70%' : '50%'} />
      ))}
    </div>
  )
}

export default function SolanaCreditDashboard() {
  const [address, setAddress] = useState('')
  const [searched, setSearched] = useState(false)

  const [profile, setProfile] = useSectionState<AnyData>()
  const [wallet, setWallet] = useSectionState<AnyData>()
  const [health, setHealth] = useSectionState<AnyData>()
  const [creditLine, setCreditLine] = useSectionState<AnyData>()
  const [terms, setTerms] = useSectionState<AnyData>()
  const [upgrade, setUpgrade] = useSectionState<AnyData>()
  const [repayment, setRepayment] = useSectionState<AnyData>()
  const [servicePlan, setServicePlan] = useSectionState<AnyData>()

  const anyData = profile.data || health.data || creditLine.data || wallet.data

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
    <SolanaLayout
      title="Agent Credit Dashboard"
      subtitle="Inspect any agent's credit profile, health, and on-chain terms."
      dataLoaded={!!anyData}
    >
      {/* Search */}
      <div className={s.searchWrap}>
        <GlassCard variant="highlight">
          <form onSubmit={handleSubmit} className={s.searchInner}>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter Solana agent pubkey..."
              className={s.searchInput}
              spellCheck={false}
            />
            <button
              type="submit"
              disabled={!address.trim()}
              className="btn-primary"
              style={{ borderRadius: 'var(--radius-lg)', padding: '14px 28px' }}
            >
              Lookup Agent
            </button>
          </form>
        </GlassCard>
      </div>

      {/* Empty state */}
      <AnimatePresence>
        {!searched && (
          <motion.div
            className={s.emptyState}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="1.2">
              <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <p className={s.emptyTitle}>Paste a Solana agent public key to get started</p>
            <p className={s.emptyHint}>Credit profile, health factor, terms and more</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results grid */}
      {searched && (
        <motion.div variants={containerVariants} initial="hidden" animate="visible">
          <BentoGrid columns={4} gap={16}>

            {/* Profile Card */}
            <motion.div variants={cardVariants} style={{ gridColumn: 'span 2' }}>
              <BentoCard colSpan="span 2" glowColor="59, 130, 246">
                <div className={s.cardHeader}>
                  <span className={s.cardTitle}>Agent Profile</span>
                  {profile.data && (
                    <span className={`${s.pill} ${profile.data.agentType === 0 ? s.pillBlue : profile.data.agentType === 1 ? s.pillGreen : s.pillPurple}`}>
                      {AGENT_TYPES[profile.data.agentType] ?? '—'}
                    </span>
                  )}
                </div>
                {profile.loading && <CardSkeleton rows={5} />}
                {profile.error && (
                  <p style={{ color: 'var(--color-error)', fontSize: 13 }}>{profile.error}</p>
                )}
                {profile.data && (
                  <>
                    <div className={s.agentRow}>
                      <div className={s.avatar}>{(profile.data.name || 'A')[0].toUpperCase()}</div>
                      <div>
                        <div className={s.agentName}>
                          <DecryptedText text={profile.data.name || 'Unnamed Agent'} animateOn="view" sequential speed={35} />
                        </div>
                        <div className={s.agentAddr}>{address.slice(0, 8)}…{address.slice(-6)}</div>
                      </div>
                    </div>
                    <div className={s.statsGrid}>
                      <StatWidget
                        label="Credit Score"
                        value={<AnimatedNumber value={profile.data.creditScore ?? 0} /> as unknown as string}
                      />
                      <StatWidget
                        label="KYA Tier"
                        value={KYA_TIERS[profile.data.kyaTier] ?? profile.data.kyaTier}
                      />
                      <StatWidget
                        label="Credit Level"
                        value={`L${profile.data.creditLevel} — ${CREDIT_LEVELS[profile.data.creditLevel]?.name ?? '—'}`}
                      />
                      <StatWidget
                        label="Credit Limit"
                        value={CREDIT_LEVELS[profile.data.creditLevel]?.limit ?? '—'}
                      />
                    </div>
                  </>
                )}
              </BentoCard>
            </motion.div>

            {/* Health Factor */}
            <motion.div variants={cardVariants} style={{ gridColumn: 'span 2' }}>
              <BentoCard
                colSpan="span 2"
                glowColor={health.data ? getHealthZone(health.data.healthFactor ?? 0).rgb : '59, 130, 246'}
              >
                <div className={s.cardHeader}>
                  <span className={s.cardTitle}>Health Factor</span>
                  {health.data && (
                    <span
                      className={s.pill}
                      style={{
                        background: `rgba(${getHealthZone(health.data.healthFactor ?? 0).rgb}, 0.12)`,
                        color: getHealthZone(health.data.healthFactor ?? 0).color,
                        borderColor: `rgba(${getHealthZone(health.data.healthFactor ?? 0).rgb}, 0.25)`,
                      }}
                    >
                      {getHealthZone(health.data.healthFactor ?? 0).label}
                    </span>
                  )}
                </div>
                {health.loading && <CardSkeleton rows={4} />}
                {health.error && <p style={{ color: 'var(--color-error)', fontSize: 13 }}>{health.error}</p>}
                {health.data && (
                  <>
                    <HealthGauge factor={health.data.healthFactor ?? 0} />
                    <div className={s.statsGrid} style={{ marginTop: 16 }}>
                      <StatWidget label="Collateral" value={formatUsdc(health.data.collateral ?? 0)} trend="up" trendValue="secured" />
                      <StatWidget label="Debt" value={formatUsdc(health.data.debt ?? 0)} trend={health.data.debt > 0 ? 'down' : 'neutral'} />
                    </div>
                  </>
                )}
              </BentoCard>
            </motion.div>

            {/* Credit Line */}
            <motion.div variants={cardVariants} style={{ gridColumn: 'span 2' }}>
              <BentoCard colSpan="span 2" glowColor="6, 182, 212">
                <div className={s.cardHeader}>
                  <span className={s.cardTitle}>Credit Line</span>
                  {creditLine.data && (
                    <span className={`${s.pill} ${creditLine.data.active ? s.pillGreen : s.pillGray}`}>
                      {creditLine.data.active ? 'Active' : 'Inactive'}
                    </span>
                  )}
                </div>
                {creditLine.loading && <CardSkeleton />}
                {creditLine.error && <p style={{ color: 'var(--color-error)', fontSize: 13 }}>{creditLine.error}</p>}
                {creditLine.data && (
                  <>
                    <div className={s.statsGrid}>
                      <StatWidget label="Credit Limit" value={formatUsdc(creditLine.data.creditLimit ?? 0)} />
                      <StatWidget label="Amount Drawn" value={formatUsdc(creditLine.data.drawn ?? 0)} />
                      <StatWidget label="Accrued Interest" value={formatUsdc(creditLine.data.accruedInterest ?? 0)} />
                      <StatWidget label="Interest Rate" value={formatBps(creditLine.data.rateBps ?? 0)} sub="Annual" />
                    </div>
                    {(creditLine.data.creditLimit ?? 0) > 0 && (
                      <div style={{ marginTop: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            Utilization
                          </span>
                          <span style={{ fontSize: 12, color: 'var(--color-cyan)', fontWeight: 700 }}>
                            <AnimatedNumber
                              value={Math.min((creditLine.data.drawn / creditLine.data.creditLimit) * 100, 100)}
                              decimals={1}
                              suffix="%"
                            />
                          </span>
                        </div>
                        <div className={s.utilBar} style={{ position: 'relative', marginBottom: 4 }}>
                          <div
                            className={`${s.utilFill} ${s.utilShimmer}`}
                            style={{
                              width: `${Math.min((creditLine.data.drawn / creditLine.data.creditLimit) * 100, 100)}%`,
                              background: 'linear-gradient(90deg, #06B6D4, #3B82F6)',
                            }}
                          />
                          <div className={s.utilCapMarker} style={{ left: '80%' }}>
                            <span className={s.utilCapLabel}>80% cap</span>
                          </div>
                        </div>
                        <div className={s.utilLabels}><span>0%</span><span>50%</span><span>100%</span></div>
                      </div>
                    )}
                  </>
                )}
              </BentoCard>
            </motion.div>

            {/* Credit Terms */}
            <motion.div variants={cardVariants} style={{ gridColumn: 'span 2' }}>
              <BentoCard colSpan="span 2" glowColor="139, 92, 246">
                <div className={s.cardHeader}>
                  <span className={s.cardTitle}>Credit Terms</span>
                </div>
                {terms.loading && <CardSkeleton rows={6} />}
                {terms.error && <p style={{ color: 'var(--color-error)', fontSize: 13 }}>{terms.error}</p>}
                {terms.data && (
                  <div className={s.statsGrid}>
                    <StatWidget label="Max Credit" value={formatUsdc(terms.data.maxCredit ?? 0)} />
                    <StatWidget label="Daily Rate" value={formatBps(terms.data.dailyRateBps ?? 0)} />
                    <StatWidget label="Annual Rate" value={formatBps(terms.data.annualRateBps ?? 0)} />
                    <StatWidget label="NAV Trigger" value={formatUsdc(terms.data.navTrigger ?? 0)} />
                    <StatWidget label="Leverage" value={`${((terms.data.maxLeverage ?? 0) / 100).toFixed(1)}x`} />
                    <StatWidget label="Grace Period" value={`${terms.data.gracePeriodDays ?? 0} days`} />
                  </div>
                )}
              </BentoCard>
            </motion.div>

            {/* Wallet */}
            <motion.div variants={cardVariants} style={{ gridColumn: 'span 2' }}>
              <BentoCard colSpan="span 2" glowColor="16, 185, 129">
                <div className={s.cardHeader}>
                  <span className={s.cardTitle}>Wallet</span>
                </div>
                {wallet.loading && <CardSkeleton />}
                {wallet.error && <p style={{ color: 'var(--color-error)', fontSize: 13 }}>{wallet.error}</p>}
                {wallet.data && (
                  <div className={s.statsGrid}>
                    <StatWidget label="USDC Balance" value={formatUsdc(wallet.data.usdcBalance ?? 0)} />
                    <StatWidget label="SOL Balance" value={`${((wallet.data.solBalance ?? 0) / 1e9).toFixed(4)} SOL`} />
                    <StatWidget label="Total Deposited" value={formatUsdc(wallet.data.totalDeposited ?? 0)} trend="up" />
                    <StatWidget label="Total Withdrawn" value={formatUsdc(wallet.data.totalWithdrawn ?? 0)} trend="down" />
                  </div>
                )}
              </BentoCard>
            </motion.div>

            {/* Level Upgrade */}
            <motion.div variants={cardVariants} style={{ gridColumn: 'span 2' }}>
              <BentoCard colSpan="span 2" glowColor="139, 92, 246">
                <div className={s.cardHeader}>
                  <span className={s.cardTitle}>Level Upgrade</span>
                </div>
                {upgrade.loading && <CardSkeleton rows={5} />}
                {upgrade.error && <p style={{ color: 'var(--color-error)', fontSize: 13 }}>{upgrade.error}</p>}
                {upgrade.data && (() => {
                  const cur = upgrade.data.currentLevel ?? 0
                  const next = upgrade.data.nextLevel
                  return (
                    <>
                      {/* Step indicator */}
                      <div className={s.upgradeSteps}>
                        {[1, 2, 3, 4].map((lvl) => (
                          <div
                            key={lvl}
                            className={`${s.upgradeStep} ${lvl < cur ? s.done : ''}`}
                          >
                            <div className={`${s.stepDot} ${lvl === cur ? s.current : lvl < cur ? s.done : ''}`}>
                              {lvl < cur ? '✓' : `L${lvl}`}
                            </div>
                            <span className={`${s.stepLabel} ${lvl === cur ? s.current : lvl < cur ? s.done : ''}`}>
                              {CREDIT_LEVELS[lvl]?.name}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Eligibility banner */}
                      {upgrade.data.eligible != null && next != null && (
                        <div className={upgrade.data.eligible ? s.eligibleBanner : s.notEligibleBanner}>
                          {upgrade.data.eligible
                            ? `🎉 Eligible for L${next} — ${CREDIT_LEVELS[next]?.name}!`
                            : `Not yet eligible for L${next}`}
                        </div>
                      )}

                      {/* Requirements */}
                      {upgrade.data.requirements && (
                        <div style={{ marginTop: 16 }}>
                          {Object.entries(upgrade.data.requirements).map(([key, val]: [string, unknown]) => {
                            const req = val as { required: unknown; current: unknown; met: boolean }
                            return (
                              <div key={key} className={s.requirementRow}>
                                <span className={s.reqLabel}>{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                <span className={s.reqValues}>{String(req.current)} / {String(req.required)}</span>
                                <div className={`${s.reqCheck} ${req.met ? s.reqMet : s.reqNotMet}`}>
                                  {req.met ? '✓' : '✗'}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </>
                  )
                })()}
              </BentoCard>
            </motion.div>

            {/* Repayment Estimate */}
            <motion.div variants={cardVariants} style={{ gridColumn: 'span 2' }}>
              <BentoCard colSpan="span 2" glowColor="59, 130, 246">
                <div className={s.cardHeader}>
                  <span className={s.cardTitle}>Repayment Estimate</span>
                </div>
                {repayment.loading && <CardSkeleton />}
                {repayment.error && <p style={{ color: 'var(--color-error)', fontSize: 13 }}>{repayment.error}</p>}
                {repayment.data && (
                  repayment.data.totalOwed == null || Number(repayment.data.totalOwed) === 0 ? (
                    <div className={s.noDebt}>
                      <div className={s.noDebtIcon}>✓</div>
                      <p className={s.noDebtText}>No outstanding debt</p>
                    </div>
                  ) : (
                    <div className={s.statsGrid}>
                      <StatWidget label="Principal" value={formatUsdc(repayment.data.principal ?? 0)} />
                      <StatWidget label="Accrued Interest" value={formatUsdc(repayment.data.accruedInterest ?? 0)} />
                      <StatWidget
                        label="Total Owed"
                        value={<AnimatedNumber value={formatUsdcRaw(repayment.data.totalOwed ?? 0)} decimals={2} prefix="$" /> as unknown as string}
                      />
                      <StatWidget label="Daily Accrual" value={formatUsdc(repayment.data.dailyAccrual ?? 0)} sub="per day" />
                    </div>
                  )
                )}
              </BentoCard>
            </motion.div>

            {/* Service Plan */}
            <motion.div variants={cardVariants} style={{ gridColumn: 'span 2' }}>
              <BentoCard colSpan="span 2" glowColor="6, 182, 212">
                <div className={s.cardHeader}>
                  <span className={s.cardTitle}>Service Plan</span>
                  {servicePlan.data?.active && (
                    <span className={`${s.pill} ${s.pillGreen}`}>Active</span>
                  )}
                </div>
                {servicePlan.loading && <CardSkeleton rows={4} />}
                {servicePlan.error && <p style={{ color: 'var(--color-error)', fontSize: 13 }}>{servicePlan.error}</p>}
                {servicePlan.data && (
                  !servicePlan.data.active ? (
                    <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>
                      No active service plan — Trader agents do not have service plans.
                    </p>
                  ) : (
                    <>
                      <div className={s.statsGrid}>
                        <StatWidget label="Total Revenue" value={formatUsdc(servicePlan.data.totalRevenue ?? 0)} trend="up" />
                        <StatWidget label="Milestones" value={String(servicePlan.data.milestonesCompleted ?? 0)} />
                        <StatWidget label="Next Milestone" value={formatUsdc(servicePlan.data.nextMilestone ?? 0)} />
                        <StatWidget label="Health Zone" value={getHealthZone(servicePlan.data.healthFactor ?? 15000).label} />
                      </div>
                      {servicePlan.data.revenueHistory?.length > 0 && (
                        <div style={{ marginTop: 16 }}>
                          <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            Revenue History
                          </span>
                          <div className={s.revBars}>
                            {servicePlan.data.revenueHistory.map((val: number, i: number) => {
                              const max = Math.max(...servicePlan.data.revenueHistory, 1)
                              return (
                                <motion.div
                                  key={i}
                                  className={s.revBar}
                                  initial={{ height: '4px' }}
                                  animate={{ height: `${Math.max((val / max) * 100, 4)}%` }}
                                  transition={{ duration: 0.6, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
                                  title={formatUsdc(val)}
                                />
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  )
                )}
              </BentoCard>
            </motion.div>

          </BentoGrid>
        </motion.div>
      )}
    </SolanaLayout>
  )
}
