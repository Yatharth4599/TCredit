import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useWallet } from '@solana/wallet-adapter-react'
import { agentApi, creditApi } from '../api/solanaClient'
import { BentoGrid, BentoCard } from '../components/ui/BentoGrid'
import { GlassCard } from '../components/ui/GlassCard'
import { StatWidget } from '../components/ui/StatWidget'
import { AnimatedNumber } from '../components/ui/AnimatedNumber'
import { Skeleton } from '../components/ui/Skeleton'
import DecryptedText from '../components/ui/DecryptedText'
import SolanaLayout from '../components/layout/SolanaLayout'
import RequestCreditCard from '../components/credit/RequestCreditCard'
import RepayCard from '../components/credit/RepayCard'
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
import type { OnChainAgent, CreditLineData, EligibilityData, HealthData, ProtocolParamsData } from '../api/solanaTypes'
import s from './SolanaCreditDashboard.module.css'

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
  const displayFactor = factor / 10000
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
        <path
          d={`M ${start.x} ${start.y} A ${r} ${r} 0 1 1 ${trackEnd.x} ${trackEnd.y}`}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" strokeLinecap="round"
        />
        {arcAngle > 0 && (
          <motion.path
            d={`M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`}
            fill="none" stroke={zone.color} strokeWidth="10" strokeLinecap="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          />
        )}
        {arcAngle > 0 && (
          <circle cx={end.x} cy={end.y} r="7" fill={zone.color} opacity="0.9">
            <animate attributeName="opacity" values="0.9;0.5;0.9" dur="2s" repeatCount="indefinite" />
          </circle>
        )}
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
  const { publicKey, connected } = useWallet()
  const [address, setAddress] = useState('')
  const [searched, setSearched] = useState(false)
  const [slowLoad, setSlowLoad] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [profile, setProfile] = useSectionState<OnChainAgent>()
  const [health, setHealth] = useSectionState<HealthData>()
  const [creditLine, setCreditLine] = useSectionState<CreditLineData>()
  const [eligibility, setEligibility] = useSectionState<EligibilityData>()
  const [protocolParams, setProtocolParams] = useSectionState<ProtocolParamsData>()

  const anyData = profile.data || health.data || creditLine.data
  const isConnectedMode = connected && publicKey && (!address || address === publicKey.toBase58())
  const activeAddr = address || (connected && publicKey ? publicKey.toBase58() : '')

  const loadAgent = useCallback(async (addr: string) => {
    if (!addr.trim()) return
    setSearched(true)
    setSlowLoad(false)
    timerRef.current = setTimeout(() => setSlowLoad(true), 4000)

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
      load(() => agentApi.getWallet(addr).then(r => ({ data: r.data.onChain ?? r.data })), setProfile),
      load(() => agentApi.getHealth(addr), setHealth),
      load(() => creditApi.getLine(addr), setCreditLine),
      load(() => creditApi.getEligibility(addr), setEligibility),
      load(() => creditApi.getProtocolParams(), setProtocolParams),
    ])

    clearTimeout(timerRef.current!)
    setSlowLoad(false)
  }, [])

  // Auto-load for connected wallet
  useEffect(() => {
    if (connected && publicKey && !searched) {
      const addr = publicKey.toBase58()
      setAddress(addr)
      loadAgent(addr)
    }
  }, [connected, publicKey, searched, loadAgent])

  // Cleanup timer
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    loadAgent(address)
  }

  const handleRefresh = () => loadAgent(activeAddr)

  // Parse credit line data for components
  const clData = creditLine.data
  const principal = clData ? formatUsdcRaw(clData.creditDrawn) : 0
  const interest = clData ? formatUsdcRaw(clData.accruedInterest) : 0
  const totalOwed = clData ? formatUsdcRaw(clData.totalOwed) : 0

  // Parse eligibility
  const elig = eligibility.data
  const maxCredit = elig ? elig.maxCreditUsdc : 0
  const eligLevel = elig ? elig.creditLevel : 0

  // Get interest rate for request card
  const rateBps = clData?.interestRateBps ?? (protocolParams.data?.levels?.[String(eligLevel)]?.rateBps ?? 3650)

  return (
    <SolanaLayout
      title="Agent Credit Dashboard"
      subtitle={isConnectedMode ? 'Your connected agent credit profile.' : 'Inspect any agent\'s credit profile, health, and on-chain terms.'}
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
              placeholder={connected ? 'Connected — or paste another pubkey...' : 'Enter Solana agent pubkey...'}
              className={s.searchInput}
              spellCheck={false}
            />
            <button
              type="submit"
              disabled={!address.trim()}
              className="btn-primary"
              style={{ borderRadius: 'var(--radius-lg)', padding: '14px 28px' }}
            >
              Lookup
            </button>
          </form>
        </GlassCard>
      </div>

      {/* Loading / empty */}
      <AnimatePresence>
        {!searched && (
          <motion.div className={s.emptyState} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="1.2">
              <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <p className={s.emptyTitle}>
              {connected ? 'Loading your agent profile...' : 'Paste a Solana agent public key to get started'}
            </p>
            <p className={s.emptyHint}>Credit profile, health factor, eligibility and more</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slow load message */}
      {slowLoad && searched && (
        <div style={{ textAlign: 'center', padding: 16 }}>
          <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>Waking up the server — this can take up to 60s on first load...</p>
        </div>
      )}

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
                    <span className={`${s.pill} ${
                      (profile.data as OnChainAgent).ownerType === 'multisig' ? s.pillPurple : s.pillBlue
                    }`}>
                      {AGENT_TYPES[(profile.data as unknown as { agentType?: number }).agentType ?? 0] ?? 'Agent'}
                    </span>
                  )}
                </div>
                {profile.loading && <CardSkeleton rows={5} />}
                {profile.error && <p style={{ color: 'var(--color-error)', fontSize: 13 }}>{profile.error}</p>}
                {profile.data && (() => {
                  const d = profile.data
                  return (
                    <>
                      <div className={s.agentRow}>
                        <div className={s.avatar}>A</div>
                        <div>
                          <div className={s.agentName}>
                            <DecryptedText text={d.agent ? `${d.agent.slice(0, 8)}...` : 'Agent'} animateOn="view" sequential speed={35} />
                          </div>
                          <div className={s.agentAddr}>{activeAddr.slice(0, 8)}...{activeAddr.slice(-6)}</div>
                        </div>
                      </div>
                      <div className={s.statsGrid}>
                        <StatWidget label="Credit Level" value={`L${d.creditLevel} — ${CREDIT_LEVELS[d.creditLevel]?.name ?? '—'}`} />
                        <StatWidget label="Credit Limit" value={formatUsdc(d.creditLimit)} />
                        <StatWidget label="Total Trades" value={String(d.totalTrades)} />
                        <StatWidget label="Total Volume" value={formatUsdc(d.totalVolume)} />
                      </div>
                    </>
                  )
                })()}
              </BentoCard>
            </motion.div>

            {/* Health Factor */}
            <motion.div variants={cardVariants} style={{ gridColumn: 'span 2' }}>
              <BentoCard
                colSpan="span 2"
                glowColor={health.data ? getHealthZone(health.data.healthFactorBps ?? 0).rgb : '59, 130, 246'}
              >
                <div className={s.cardHeader}>
                  <span className={s.cardTitle}>Health Factor</span>
                  {health.data && (
                    <span className={s.pill} style={{
                      background: `rgba(${getHealthZone(health.data.healthFactorBps).rgb}, 0.12)`,
                      color: getHealthZone(health.data.healthFactorBps).color,
                      borderColor: `rgba(${getHealthZone(health.data.healthFactorBps).rgb}, 0.25)`,
                    }}>
                      {getHealthZone(health.data.healthFactorBps).label}
                    </span>
                  )}
                </div>
                {health.loading && <CardSkeleton rows={4} />}
                {health.error && <p style={{ color: 'var(--color-error)', fontSize: 13 }}>{health.error}</p>}
                {health.data && (
                  <>
                    <HealthGauge factor={health.data.healthFactorBps} />
                    <div className={s.statsGrid} style={{ marginTop: 16 }}>
                      <StatWidget label="Credit Drawn" value={formatUsdc(health.data.creditDrawn)} />
                      <StatWidget label="Total Debt" value={formatUsdc(health.data.totalDebt)} />
                      <StatWidget label="Frozen" value={health.data.isFrozen ? 'Yes' : 'No'} />
                      <StatWidget label="Liquidating" value={health.data.isLiquidating ? 'Yes' : 'No'} />
                    </div>
                    {(health.data.isFrozen || health.data.isLiquidating) && (
                      <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, textAlign: 'center' }}>
                        <span style={{ fontSize: 12, color: '#F87171', fontWeight: 600 }}>
                          {health.data.isLiquidating ? 'Agent is being liquidated' : 'Agent is frozen — health factor critical'}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </BentoCard>
            </motion.div>

            {/* Credit Line */}
            <motion.div variants={cardVariants} style={{ gridColumn: 'span 2' }}>
              <BentoCard colSpan="span 2" glowColor="6, 182, 212">
                <div className={s.cardHeader}>
                  <span className={s.cardTitle}>Credit Line</span>
                  {clData && (
                    <span className={`${s.pill} ${clData.isActive ? s.pillGreen : s.pillGray}`}>
                      {clData.isActive ? 'Active' : clData.exists ? 'Inactive' : 'No Line'}
                    </span>
                  )}
                </div>
                {creditLine.loading && <CardSkeleton />}
                {creditLine.error && <p style={{ color: 'var(--color-error)', fontSize: 13 }}>{creditLine.error}</p>}
                {clData && (
                  <>
                    <div className={s.statsGrid}>
                      <StatWidget label="Credit Limit" value={formatUsdc(clData.creditLimit ?? '0')} />
                      <StatWidget label="Amount Drawn" value={formatUsdc(clData.creditDrawn ?? '0')} />
                      <StatWidget label="Accrued Interest" value={clData.exists ? formatUsdc(clData.accruedInterest ?? '0') : '$0.00'} />
                      <StatWidget label="Interest Rate" value={clData.exists && clData.interestRateBps ? formatBps(clData.interestRateBps) : 'N/A'} sub={clData.exists ? 'Annual' : ''} />
                    </div>
                    {Number(clData.creditLimit) > 0 && (
                      <div style={{ marginTop: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            Utilization
                          </span>
                          <span style={{ fontSize: 12, color: 'var(--color-cyan)', fontWeight: 700 }}>
                            <AnimatedNumber
                              value={Math.min((formatUsdcRaw(clData.creditDrawn) / formatUsdcRaw(clData.creditLimit)) * 100, 100)}
                              decimals={1} suffix="%"
                            />
                          </span>
                        </div>
                        <div className={s.utilBar}>
                          <div
                            className={`${s.utilFill} ${s.utilShimmer}`}
                            style={{
                              width: `${Math.min((formatUsdcRaw(clData.creditDrawn) / formatUsdcRaw(clData.creditLimit)) * 100, 100)}%`,
                              background: 'linear-gradient(90deg, #06B6D4, #3B82F6)',
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </BentoCard>
            </motion.div>

            {/* Eligibility */}
            <motion.div variants={cardVariants} style={{ gridColumn: 'span 2' }}>
              <BentoCard colSpan="span 2" glowColor="139, 92, 246">
                <div className={s.cardHeader}>
                  <span className={s.cardTitle}>Eligibility</span>
                  {elig && (
                    <span className={`${s.pill} ${elig.eligible ? s.pillGreen : s.pillYellow}`}>
                      {elig.eligible ? 'Eligible' : 'Not Eligible'}
                    </span>
                  )}
                </div>
                {eligibility.loading && <CardSkeleton rows={5} />}
                {eligibility.error && <p style={{ color: 'var(--color-error)', fontSize: 13 }}>{eligibility.error}</p>}
                {elig && (
                  <>
                    {elig.eligible ? (
                      <div className={s.eligibleBanner}>
                        Eligible for L{elig.creditLevel} — up to ${elig.maxCreditUsdc.toLocaleString()}
                      </div>
                    ) : (
                      <div className={s.notEligibleBanner}>
                        {elig.reason || 'Not yet eligible for credit'}
                      </div>
                    )}
                    <div className={s.statsGrid} style={{ marginTop: 16 }}>
                      <StatWidget label="Credit Score" value={<AnimatedNumber value={elig.creditScore} /> as unknown as string} />
                      <StatWidget label="KYA Tier" value={KYA_TIERS[elig.kyaTier] ?? String(elig.kyaTier)} />
                      <StatWidget label="Credit Level" value={`L${elig.creditLevel}`} />
                      <StatWidget label="Max Credit" value={`$${elig.maxCreditUsdc.toLocaleString()}`} />
                    </div>

                    {/* Level progress */}
                    <div className={s.upgradeSteps} style={{ marginTop: 20 }}>
                      {[1, 2, 3, 4].map((lvl) => (
                        <div key={lvl} className={`${s.upgradeStep} ${lvl < elig.creditLevel ? s.done : ''}`}>
                          <div className={`${s.stepDot} ${lvl === elig.creditLevel ? s.current : lvl < elig.creditLevel ? s.done : ''}`}>
                            {lvl < elig.creditLevel ? '✓' : `L${lvl}`}
                          </div>
                          <span className={`${s.stepLabel} ${lvl === elig.creditLevel ? s.current : lvl < elig.creditLevel ? s.done : ''}`}>
                            {CREDIT_LEVELS[lvl]?.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </BentoCard>
            </motion.div>

            {/* Protocol Parameters */}
            {protocolParams.data && (
              <motion.div variants={cardVariants} style={{ gridColumn: 'span 4' }}>
                <GlassCard>
                  <div className={s.cardHeader}>
                    <span className={s.cardTitle}>Protocol Credit Levels</span>
                  </div>
                  <div className={s.grid4} style={{ marginTop: 8 }}>
                    {Object.entries(protocolParams.data.levels).map(([key, level]) => {
                      const isCurrentLevel = elig && String(elig.creditLevel) === key
                      return (
                        <div
                          key={key}
                          style={{
                            padding: 16,
                            background: isCurrentLevel ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.02)',
                            border: `1px solid ${isCurrentLevel ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.04)'}`,
                            borderRadius: 12,
                          }}
                        >
                          <div style={{ fontSize: 11, fontWeight: 700, color: isCurrentLevel ? '#60A5FA' : 'rgba(245,245,247,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                            {level.name} {isCurrentLevel && '← You'}
                          </div>
                          <div style={{ fontSize: 20, fontWeight: 700, color: 'rgba(245,245,247,0.9)', marginBottom: 8 }}>
                            {level.maxDisplay}
                          </div>
                          <div style={{ fontSize: 12, color: 'rgba(245,245,247,0.5)' }}>
                            APR: {level.rateDisplay} · Score ≥{level.minScore} · KYA ≥{level.minKyaTier}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </GlassCard>
              </motion.div>
            )}

            {/* Request Credit (connected mode only) */}
            {isConnectedMode && elig?.eligible && (
              <motion.div variants={cardVariants} style={{ gridColumn: 'span 2' }}>
                <BentoCard colSpan="span 2" glowColor="59, 130, 246">
                  <div className={s.cardHeader}>
                    <span className={s.cardTitle}>Request Credit</span>
                  </div>
                  <RequestCreditCard
                    agentPubkey={activeAddr}
                    maxAmount={maxCredit}
                    creditLevel={eligLevel}
                    interestRateBps={rateBps}
                    onSuccess={handleRefresh}
                  />
                </BentoCard>
              </motion.div>
            )}

            {/* Repay (connected mode only) */}
            {isConnectedMode && clData?.isActive && (
              <motion.div variants={cardVariants} style={{ gridColumn: 'span 2' }}>
                <BentoCard colSpan="span 2" glowColor="16, 185, 129">
                  <div className={s.cardHeader}>
                    <span className={s.cardTitle}>Repay</span>
                  </div>
                  <RepayCard
                    agentPubkey={activeAddr}
                    principal={principal}
                    accruedInterest={interest}
                    totalOwed={totalOwed}
                    onSuccess={handleRefresh}
                  />
                </BentoCard>
              </motion.div>
            )}

          </BentoGrid>
        </motion.div>
      )}
    </SolanaLayout>
  )
}
