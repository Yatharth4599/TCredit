import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { vaultApi } from '../api/solanaClient'
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
  const [stats, setStats] = useState<{ data: AnyData; loading: boolean; error: string | null }>({ data: null, loading: true, error: null })

  useEffect(() => {
    vaultApi.getStats()
      .then((res) => setStats({ data: res.data, loading: false, error: null }))
      .catch((err) => setStats({ data: null, loading: false, error: err.response?.data?.message ?? err.message }))
  }, [])

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
            <GlassCard><CardSkeleton rows={6} /></GlassCard>
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
          </>
        )}

      </motion.div>
    </SolanaLayout>
  )
}
