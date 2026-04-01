import { useState, useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import { useWallet } from '@solana/wallet-adapter-react'
import { vaultApi, healthApi, creditApi } from '../api/solanaClient'
import { BentoCard } from '../components/ui/BentoGrid'
import { GlassCard } from '../components/ui/GlassCard'
import { StatWidget } from '../components/ui/StatWidget'
import { AnimatedNumber } from '../components/ui/AnimatedNumber'
import { Skeleton } from '../components/ui/Skeleton'
import SolanaLayout from '../components/layout/SolanaLayout'
import { containerVariants, cardVariants } from '../utils/motionVariants'
import s from './SolanaVaultDashboard.module.css'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyData = any

const TRANCHE_COLORS: Record<string, { accent: string; bg: string; label: string }> = {
  senior:    { accent: '#3B82F6', bg: 'rgba(59,130,246,0.08)',  label: 'Senior' },
  mezzanine: { accent: '#A855F7', bg: 'rgba(168,85,247,0.08)', label: 'Mezzanine' },
  junior:    { accent: '#F97316', bg: 'rgba(249,115,22,0.08)',  label: 'Junior' },
}

function statusDot(ok: boolean) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: ok ? '#34D399' : '#EF4444',
        marginRight: 6,
        boxShadow: ok ? '0 0 6px rgba(52,211,153,0.6)' : '0 0 6px rgba(239,68,68,0.6)',
      }}
    />
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

export default function SolanaVaultDashboard() {
  const { publicKey } = useWallet()
  const [stats, setStats] = useState<{ data: AnyData; loading: boolean; error: string | null }>({ data: null, loading: true, error: null })
  const [slowLoad, setSlowLoad] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [vaultHealth, setVaultHealth] = useState<{ data: AnyData; loading: boolean; error: string | null }>({ data: null, loading: true, error: null })
  const [protocolParams, setProtocolParams] = useState<{ data: AnyData; loading: boolean; error: string | null }>({ data: null, loading: true, error: null })
  const [lpPosition, setLpPosition] = useState<{ data: AnyData; loading: boolean }>({ data: null, loading: false })

  useEffect(() => {
    timerRef.current = setTimeout(() => setSlowLoad(true), 4000)
    vaultApi.getStats()
      .then((res) => {
        clearTimeout(timerRef.current!)
        setSlowLoad(false)
        setStats({ data: res.data, loading: false, error: null })
      })
      .catch((err) => {
        clearTimeout(timerRef.current!)
        setSlowLoad(false)
        setStats({ data: null, loading: false, error: err.response?.data?.message ?? err.message })
      })
    return () => clearTimeout(timerRef.current!)
  }, [])

  useEffect(() => {
    healthApi.vaultHealth()
      .then((res) => setVaultHealth({ data: res.data, loading: false, error: null }))
      .catch((err) => setVaultHealth({ data: null, loading: false, error: err.response?.data?.message ?? err.message }))
  }, [])

  useEffect(() => {
    creditApi.getProtocolParams()
      .then((res) => setProtocolParams({ data: res.data, loading: false, error: null }))
      .catch((err) => setProtocolParams({ data: null, loading: false, error: err.response?.data?.message ?? err.message }))
  }, [])

  useEffect(() => {
    if (!publicKey) return
    setLpPosition({ data: null, loading: true })
    vaultApi.getLpPosition(publicKey.toBase58())
      .then((res) => setLpPosition({ data: res.data, loading: false }))
      .catch(() => setLpPosition({ data: null, loading: false }))
  }, [publicKey])

  const d = stats.data
  const utilPct = d ? Math.min(Number(d.utilizationPct ?? 0), 100) : 0
  const capPct  = d ? (d.utilizationCapBps ?? 8000) / 100 : 80

  return (
    <SolanaLayout
      title="Vault Overview"
      subtitle="Real-time stats for the Krexa credit vault on Solana devnet."
      dataLoaded={!!d}
    >
      <motion.div variants={containerVariants} initial="hidden" animate="visible">

        {/* ── Loading / Error ── */}
        {stats.loading && (
          <motion.div variants={cardVariants} style={{ marginBottom: 16 }}>
            <GlassCard>
              <CardSkeleton rows={6} />
              {slowLoad && (
                <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 16, textAlign: 'center' }}>
                  Waking up the server — this can take up to 60s on first load...
                </p>
              )}
            </GlassCard>
          </motion.div>
        )}
        {stats.error && (
          <motion.div variants={cardVariants} style={{ marginBottom: 16 }}>
            <GlassCard>
              <p style={{ color: 'var(--color-error)', fontSize: 13 }}>{stats.error}</p>
            </GlassCard>
          </motion.div>
        )}

        {d && (
          <>
            {/* ── TVL Hero ── */}
            <motion.div variants={cardVariants} style={{ marginBottom: 16 }}>
              <BentoCard glowColor="59, 130, 246" style={{ display: 'block' }}>
                <p className={s.cardTitle}>Vault Health</p>

                <div className={s.stats4}>
                  <StatWidget
                    label="Total Value Locked"
                    value={<AnimatedNumber value={Number(d.totalDepositsUsdc ?? 0)} decimals={2} prefix="$" /> as unknown as string}
                  />
                  <StatWidget
                    label="Deployed Capital"
                    value={<AnimatedNumber value={Number(d.totalDeployedUsdc ?? 0)} decimals={2} prefix="$" /> as unknown as string}
                  />
                  <StatWidget
                    label="Available Liquidity"
                    value={<AnimatedNumber value={Number(d.availableLiquidityUsdc ?? 0)} decimals={2} prefix="$" /> as unknown as string}
                  />
                  <StatWidget
                    label="Status"
                    value={d.isPaused ? 'Paused' : 'Active'}
                  />
                </div>

                {/* Utilization bar */}
                <div style={{ marginTop: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      Utilization
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: utilPct > capPct ? '#EF4444' : utilPct > 60 ? '#F59E0B' : '#3B82F6' }}>
                      <AnimatedNumber value={utilPct} decimals={1} suffix="%" /> / {capPct}% cap
                    </span>
                  </div>
                  <div className={s.utilBar}>
                    <div
                      className={s.utilFill}
                      style={{
                        width: `${utilPct}%`,
                        background: utilPct > capPct
                          ? 'linear-gradient(90deg, #DC2626, #EF4444)'
                          : utilPct > 60
                            ? 'linear-gradient(90deg, #D97706, #F59E0B)'
                            : 'linear-gradient(90deg, #2563EB, #3B82F6)',
                      }}
                    />
                    <div className={s.utilCapMarker} style={{ left: `${capPct}%` }}>
                      <span className={s.utilCapLabel}>{capPct}%</span>
                    </div>
                  </div>
                  <div className={s.utilLabels}><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div>
                </div>
              </BentoCard>
            </motion.div>

            {/* ── Protocol Parameters ── */}
            <motion.div variants={cardVariants} style={{ marginBottom: 16 }}>
              <GlassCard>
                <p className={s.cardTitle}>Protocol Parameters</p>
                <div className={s.stats4}>
                  <StatWidget
                    label="Base Interest Rate"
                    value={<AnimatedNumber value={(d.baseInterestRateBps ?? 0) / 100} decimals={2} suffix="%" /> as unknown as string}
                  />
                  <StatWidget
                    label="Utilization Cap"
                    value={<AnimatedNumber value={capPct} decimals={0} suffix="%" /> as unknown as string}
                  />
                  <StatWidget
                    label="Lockup Period"
                    value={`${Math.round((d.lockupSeconds ?? 0) / 86400)}d`}
                  />
                  <StatWidget
                    label="Total Shares"
                    value={<AnimatedNumber value={Number(d.totalShares ?? 0) / 1e6} decimals={2} /> as unknown as string}
                  />
                </div>
              </GlassCard>
            </motion.div>

            {/* ── Performance Metrics ── */}
            <motion.div variants={cardVariants}>
              <BentoCard glowColor="16, 185, 129" style={{ display: 'block' }}>
                <p className={s.cardTitle}>Performance</p>
                <div className={s.stats4}>
                  <StatWidget
                    label="Total Interest Earned"
                    value={<AnimatedNumber value={Number(d.totalInterestEarned ?? 0) / 1e6} decimals={2} prefix="$" /> as unknown as string}
                  />
                  <StatWidget
                    label="Insurance Balance"
                    value={<AnimatedNumber value={Number(d.insuranceBalanceUsdc ?? 0)} decimals={2} prefix="$" /> as unknown as string}
                  />
                  <StatWidget
                    label="Total Defaults"
                    value={<AnimatedNumber value={Number(d.totalDefaults ?? 0)} decimals={0} /> as unknown as string}
                  />
                  <StatWidget
                    label="Vault State"
                    value={d.initialized ? 'Initialized' : 'Not Initialized'}
                  />
                </div>
              </BentoCard>
            </motion.div>

            {/* ── Idle Capital Yield (Meteora) ── */}
            <motion.div variants={cardVariants} style={{ marginTop: 16 }}>
              <BentoCard glowColor="249, 115, 22" style={{ display: 'block' }}>
                <p className={s.cardTitle}>Idle Capital Yield</p>
                <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16 }}>
                  Idle vault capital (the {capPct > 0 ? `${100 - capPct}%` : '20%'} utilization buffer) is automatically routed to Meteora Dynamic Vaults for yield.
                </p>
                <div className={s.stats4}>
                  <StatWidget
                    label="Idle Buffer"
                    value={<AnimatedNumber value={Math.max(0, Number(d.availableLiquidityUsdc ?? 0))} decimals={2} prefix="$" /> as unknown as string}
                  />
                  <StatWidget
                    label="In Meteora"
                    value="Coming soon"
                  />
                  <StatWidget
                    label="Meteora APY"
                    value="~5-10%"
                  />
                  <StatWidget
                    label="Strategy"
                    value="Dynamic Vault"
                  />
                </div>
                <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.12)', fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                  Meteora rebalances every minute across Kamino, MarginFi, and Solend to find the highest yield. Funds remain withdrawable for new credit lines.
                </div>
              </BentoCard>
            </motion.div>

            {/* ── Vault System Health ── */}
            <motion.div variants={cardVariants} style={{ marginTop: 16 }}>
              <BentoCard glowColor="52, 211, 153" style={{ display: 'block' }}>
                <p className={s.cardTitle}>Vault System Health</p>
                {vaultHealth.loading && <CardSkeleton rows={4} />}
                {vaultHealth.error && (
                  <p style={{ color: 'var(--color-error)', fontSize: 13 }}>{vaultHealth.error}</p>
                )}
                {vaultHealth.data && (() => {
                  const h = vaultHealth.data
                  const keeper = h.keeper ?? h.keeperStatus ?? {}
                  const indexer = h.indexer ?? h.indexerStatus ?? {}
                  const oracle = h.oracle ?? h.oracleStatus ?? {}
                  const portfolio = h.portfolio ?? h.portfolioStats ?? {}
                  return (
                    <>
                      <div className={s.healthGrid}>
                        <div className={s.healthItem}>
                          <p className={s.healthLabel}>Keeper</p>
                          <p className={s.healthValue}>
                            {statusDot(keeper.healthy ?? keeper.ok ?? keeper.status === 'ok')}
                            {keeper.healthy || keeper.ok || keeper.status === 'ok' ? 'Healthy' : 'Degraded'}
                          </p>
                          {keeper.lastRun && (
                            <p className={s.healthSub}>Last run: {new Date(keeper.lastRun).toLocaleTimeString()}</p>
                          )}
                          {keeper.uptime != null && (
                            <p className={s.healthSub}>Uptime: {(Number(keeper.uptime) * 100).toFixed(1)}%</p>
                          )}
                        </div>
                        <div className={s.healthItem}>
                          <p className={s.healthLabel}>Indexer</p>
                          <p className={s.healthValue}>
                            {statusDot(indexer.healthy ?? indexer.ok ?? indexer.status === 'ok')}
                            {indexer.healthy || indexer.ok || indexer.status === 'ok' ? 'Synced' : 'Behind'}
                          </p>
                          {indexer.latestSlot != null && (
                            <p className={s.healthSub}>Slot: {Number(indexer.latestSlot).toLocaleString()}</p>
                          )}
                          {indexer.lag != null && (
                            <p className={s.healthSub}>Lag: {indexer.lag} slots</p>
                          )}
                        </div>
                        <div className={s.healthItem}>
                          <p className={s.healthLabel}>Oracle</p>
                          <p className={s.healthValue}>
                            {statusDot(oracle.healthy ?? oracle.ok ?? oracle.status === 'ok')}
                            {oracle.healthy || oracle.ok || oracle.status === 'ok' ? 'Online' : 'Offline'}
                          </p>
                          {oracle.lastUpdate && (
                            <p className={s.healthSub}>Updated: {new Date(oracle.lastUpdate).toLocaleTimeString()}</p>
                          )}
                          {oracle.price != null && (
                            <p className={s.healthSub}>Price: ${Number(oracle.price).toFixed(2)}</p>
                          )}
                        </div>
                        <div className={s.healthItem}>
                          <p className={s.healthLabel}>Portfolio</p>
                          <div className={s.healthValue}>
                            {statusDot(true)}
                            {portfolio.activeLoans ?? portfolio.totalLoans ?? 0} active loans
                          </div>
                          {portfolio.totalBorrowed != null && (
                            <p className={s.healthSub}>Borrowed: ${Number(portfolio.totalBorrowed).toLocaleString()}</p>
                          )}
                          {portfolio.defaultRate != null && (
                            <p className={s.healthSub}>Default rate: {(Number(portfolio.defaultRate) * 100).toFixed(2)}%</p>
                          )}
                        </div>
                      </div>

                      {/* LP Position (auto-loaded when wallet connected) */}
                      {publicKey && (
                        <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 8, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.12)' }}>
                          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                            Your LP Position
                          </p>
                          {lpPosition.loading && <Skeleton height={24} width="60%" />}
                          {!lpPosition.loading && !lpPosition.data && (
                            <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>No active LP position found.</p>
                          )}
                          {lpPosition.data && (
                            <div className={s.stats4}>
                              <StatWidget
                                label="Shares"
                                value={<AnimatedNumber value={Number(lpPosition.data.shares ?? 0) / 1e6} decimals={2} /> as unknown as string}
                              />
                              <StatWidget
                                label="Deposited"
                                value={<AnimatedNumber value={Number(lpPosition.data.depositedUsdc ?? lpPosition.data.deposited ?? 0)} decimals={2} prefix="$" /> as unknown as string}
                              />
                              <StatWidget
                                label="Current Value"
                                value={<AnimatedNumber value={Number(lpPosition.data.currentValueUsdc ?? lpPosition.data.value ?? 0)} decimals={2} prefix="$" /> as unknown as string}
                              />
                              <StatWidget
                                label="Status"
                                value={lpPosition.data.locked ? 'Locked' : 'Unlocked'}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )
                })()}
              </BentoCard>
            </motion.div>

            {/* ── Tranche Structure ── */}
            <motion.div variants={cardVariants} style={{ marginTop: 16 }}>
              <GlassCard>
                <p className={s.cardTitle}>Tranche Structure</p>
                {protocolParams.loading && <CardSkeleton rows={3} />}
                {protocolParams.error && (
                  <p style={{ color: 'var(--color-error)', fontSize: 13 }}>{protocolParams.error}</p>
                )}
                {protocolParams.data?.tranches && (() => {
                  const tranches: AnyData[] = protocolParams.data.tranches
                  return (
                    <div className={s.trancheGrid}>
                      {tranches.map((t: AnyData, i: number) => {
                        const key = (t.name ?? t.label ?? '').toLowerCase()
                        const color = TRANCHE_COLORS[key] ?? TRANCHE_COLORS[
                          key.includes('senior') ? 'senior'
                            : key.includes('mezz') ? 'mezzanine'
                            : key.includes('junior') ? 'junior'
                            : 'senior'
                        ] ?? { accent: '#6B7280', bg: 'rgba(107,114,128,0.08)', label: t.name ?? `Tranche ${i}` }

                        const rateBps = t.rateBps ?? t.interestRateBps ?? t.rate ?? 0
                        const allocationPct = t.allocationPct ?? t.allocation ?? t.weight ?? 0
                        const riskLevel = t.riskLevel ?? t.risk ?? ''

                        return (
                          <motion.div
                            key={t.name ?? i}
                            className={s.trancheCard}
                            style={{ '--trancheAccent': color.accent, background: color.bg, border: `1px solid ${color.accent}22` } as React.CSSProperties}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.35, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
                          >
                            <div className={s.trancheHeader}>
                              <span className={s.trancheBadge} style={{ background: color.accent }}>
                                {color.label || t.name || `Tranche ${i + 1}`}
                              </span>
                              {riskLevel && (
                                <span className={s.trancheRisk}>{riskLevel}</span>
                              )}
                            </div>
                            <div className={s.trancheStats}>
                              <div className={s.trancheStat}>
                                <span className={s.trancheStatLabel}>Interest Rate</span>
                                <span className={s.trancheStatValue} style={{ color: color.accent }}>
                                  {(rateBps / 100).toFixed(2)}%
                                </span>
                              </div>
                              <div className={s.trancheStat}>
                                <span className={s.trancheStatLabel}>Allocation</span>
                                <span className={s.trancheStatValue} style={{ color: color.accent }}>
                                  {Number(allocationPct).toFixed(0)}%
                                </span>
                              </div>
                            </div>
                            {/* Allocation bar */}
                            <div className={s.trancheBarTrack}>
                              <motion.div
                                className={s.trancheBarFill}
                                style={{ background: color.accent }}
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(Number(allocationPct), 100)}%` }}
                                transition={{ duration: 0.8, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
                              />
                            </div>
                          </motion.div>
                        )
                      })}
                    </div>
                  )
                })()}
              </GlassCard>
            </motion.div>
          </>
        )}

      </motion.div>
    </SolanaLayout>
  )
}
