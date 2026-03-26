import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { vaultApi } from '../api/solanaClient'
import { BentoGrid, BentoCard } from '../components/ui/BentoGrid'
import { GlassCard } from '../components/ui/GlassCard'
import { StatWidget } from '../components/ui/StatWidget'
import { AnimatedNumber } from '../components/ui/AnimatedNumber'
import { Skeleton } from '../components/ui/Skeleton'
import SolanaLayout from '../components/layout/SolanaLayout'
import { formatUsdc, formatUsdcRaw, formatPct } from '../utils/dashboardHelpers'
import { containerVariants, cardVariants } from '../utils/motionVariants'
import s from './SolanaVaultDashboard.module.css'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyData = any

const TRANCHE_NAMES = ['senior', 'mezzanine', 'junior'] as const

const TRANCHE_CFG = {
  senior:    { label: 'Senior',    rgb: '59, 130, 246',  color: '#3B82F6', accent: 'linear-gradient(90deg, #2563EB, #3B82F6)' },
  mezzanine: { label: 'Mezzanine', rgb: '139, 92, 246',  color: '#8B5CF6', accent: 'linear-gradient(90deg, #7C3AED, #8B5CF6)' },
  junior:    { label: 'Junior',    rgb: '249, 115, 22',  color: '#F97316', accent: 'linear-gradient(90deg, #EA580C, #F97316)' },
}

const REVENUE_ROWS = [
  { key: 'agentRevenue',    label: 'Agent Revenue',  color: '#3B82F6' },
  { key: 'protocolFee',     label: 'Protocol Fee',   color: '#64748B' },
  { key: 'seniorYield',     label: 'Senior Yield',   color: '#60A5FA' },
  { key: 'mezzanineYield',  label: 'Mezzanine Yield',color: '#A78BFA' },
  { key: 'juniorYield',     label: 'Junior Yield',   color: '#FB923C' },
  { key: 'insuranceFund',   label: 'Insurance',      color: '#FCD34D' },
  { key: 'treasury',        label: 'Treasury',       color: '#34D399' },
]


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
  const [stats, setStats]         = useState<{ data: AnyData; loading: boolean; error: string | null }>({ data: null, loading: true, error: null })
  const [tranches, setTranches]   = useState<{ data: Record<string, AnyData>; loading: boolean; error: string | null }>({ data: {}, loading: true, error: null })
  const [revenue, setRevenue]     = useState<{ data: AnyData; loading: boolean; error: string | null }>({ data: null, loading: true, error: null })
  const [lossBuffer, setLoss]     = useState<{ data: AnyData; loading: boolean; error: string | null }>({ data: null, loading: true, error: null })

  useEffect(() => {
    vaultApi.getStats()
      .then((res) => setStats({ data: res.data, loading: false, error: null }))
      .catch((err) => setStats({ data: null, loading: false, error: err.message }))

    Promise.all(
      TRANCHE_NAMES.map(async (t) => {
        try { const res = await vaultApi.getTrancheStats(t); return [t, res.data] as const }
        catch { return [t, null] as const }
      })
    ).then((results) => {
      const data: Record<string, AnyData> = {}
      results.forEach(([name, val]) => { if (val) data[name] = val })
      setTranches({ data, loading: false, error: Object.keys(data).length === 0 ? 'Failed to load tranches' : null })
    })

    vaultApi.getRevenue()
      .then((res) => setRevenue({ data: res.data, loading: false, error: null }))
      .catch((err) => setRevenue({ data: null, loading: false, error: err.message }))

    vaultApi.getLossBuffer()
      .then((res) => setLoss({ data: res.data, loading: false, error: null }))
      .catch((err) => setLoss({ data: null, loading: false, error: err.message }))
  }, [])

  const utilPct = stats.data
    ? Math.min(((stats.data.totalBorrowed ?? 0) / Math.max(stats.data.tvl ?? 1, 1)) * 100, 100)
    : 0

  const anyLoaded = stats.data || revenue.data

  return (
    <SolanaLayout
      title="Vault Overview"
      subtitle="Real-time stats for the Krexa credit vault on Solana devnet."
      dataLoaded={!!anyLoaded}
    >
      <motion.div variants={containerVariants} initial="hidden" animate="visible">

        {/* ── Vault Stats Hero ── */}
        <motion.div variants={cardVariants} style={{ marginBottom: 16 }}>
          <BentoCard glowColor="59, 130, 246" style={{ display: 'block' }}>
            <p className={s.cardTitle}>Vault Stats</p>
            {stats.loading && <CardSkeleton rows={2} />}
            {stats.error && <p style={{ color: 'var(--color-error)', fontSize: 13 }}>{stats.error}</p>}
            {stats.data && (
              <>
                <div className={s.stats4}>
                  <StatWidget
                    label="Total Value Locked"
                    value={<AnimatedNumber value={formatUsdcRaw(stats.data.tvl ?? 0)} decimals={2} prefix="$" /> as unknown as string}
                  />
                  <StatWidget
                    label="Total Borrowed"
                    value={<AnimatedNumber value={formatUsdcRaw(stats.data.totalBorrowed ?? 0)} decimals={2} prefix="$" /> as unknown as string}
                  />
                  <StatWidget
                    label="Available Liquidity"
                    value={<AnimatedNumber value={formatUsdcRaw(stats.data.availableLiquidity ?? 0)} decimals={2} prefix="$" /> as unknown as string}
                  />
                  <StatWidget
                    label="Status"
                    value={stats.data.paused ? 'Paused' : 'Active'}
                  />
                </div>

                {/* Utilization bar */}
                <div style={{ marginTop: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      Utilization
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: utilPct > 80 ? '#EF4444' : utilPct > 60 ? '#F59E0B' : '#3B82F6' }}>
                      <AnimatedNumber value={utilPct} decimals={1} suffix="%" /> / 80% cap
                    </span>
                  </div>
                  <div className={s.utilBar}>
                    <div
                      className={s.utilFill}
                      style={{
                        width: `${utilPct}%`,
                        background: utilPct > 80
                          ? 'linear-gradient(90deg, #DC2626, #EF4444)'
                          : utilPct > 60
                            ? 'linear-gradient(90deg, #D97706, #F59E0B)'
                            : 'linear-gradient(90deg, #2563EB, #3B82F6)',
                      }}
                    />
                    <div className={s.utilCapMarker} style={{ left: '80%' }}>
                      <span className={s.utilCapLabel}>80%</span>
                    </div>
                  </div>
                  <div className={s.utilLabels}><span>0%</span><span>40%</span><span>80%</span><span>100%</span></div>
                </div>
              </>
            )}
          </BentoCard>
        </motion.div>

        {/* ── Tranche Breakdown ── */}
        <motion.div variants={cardVariants} style={{ marginBottom: 16 }}>
          <p className={s.cardTitle} style={{ paddingLeft: 2 }}>Tranche Breakdown</p>
          {tranches.loading && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {[0,1,2].map(i => <GlassCard key={i}><CardSkeleton /></GlassCard>)}
            </div>
          )}
          {tranches.error && <p style={{ color: 'var(--color-error)', fontSize: 13 }}>{tranches.error}</p>}
          {!tranches.loading && (
            <BentoGrid columns={3} gap={16}>
              {TRANCHE_NAMES.map((name) => {
                const t = tranches.data[name]
                const cfg = TRANCHE_CFG[name]
                if (!t) return null
                return (
                  <motion.div key={name} variants={cardVariants}>
                    <BentoCard glowColor={cfg.rgb} style={{ position: 'relative', overflow: 'hidden' }}>
                      {/* accent top line */}
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: cfg.accent }} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                        <span style={{
                          padding: '3px 10px',
                          borderRadius: 99,
                          fontSize: 11,
                          fontWeight: 700,
                          background: `rgba(${cfg.rgb}, 0.12)`,
                          color: cfg.color,
                          border: `1px solid rgba(${cfg.rgb}, 0.2)`,
                        }}>
                          {cfg.label}
                        </span>
                      </div>
                      <div className={s.statsGrid}>
                        <StatWidget label="Total Deposits" value={formatUsdc(t.totalDeposits ?? 0)} />
                        <StatWidget label="Total Shares" value={<AnimatedNumber value={(Number(t.totalShares ?? 0) / 1e6)} decimals={2} /> as unknown as string} />
                        <StatWidget label="APR" value={<AnimatedNumber value={Number((t.aprBps ?? 0) / 100)} decimals={2} suffix="%" /> as unknown as string} />
                        <StatWidget label="Share Price" value={`$${(Number(t.sharePrice ?? 1e6) / 1e6).toFixed(4)}`} />
                      </div>
                    </BentoCard>
                  </motion.div>
                )
              })}
            </BentoGrid>
          )}
        </motion.div>

        {/* ── Revenue Waterfall ── */}
        <motion.div variants={cardVariants} style={{ marginBottom: 16 }}>
          <GlassCard>
            <p className={s.cardTitle}>Daily Revenue Waterfall</p>
            {revenue.loading && <CardSkeleton rows={7} />}
            {revenue.error && <p style={{ color: 'var(--color-error)', fontSize: 13 }}>{revenue.error}</p>}
            {revenue.data && (
              <>
                <div className={s.stats4} style={{ marginBottom: 24 }}>
                  <StatWidget label="Agent Revenue" value={formatUsdc(revenue.data.agentRevenue ?? 0)} />
                  <StatWidget label="Protocol Fee" value={formatUsdc(revenue.data.protocolFee ?? 0)} />
                  <StatWidget label="Insurance Fund" value={formatUsdc(revenue.data.insuranceFund ?? 0)} />
                  <StatWidget label="Treasury" value={formatUsdc(revenue.data.treasury ?? 0)} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {REVENUE_ROWS.map((row, idx) => {
                    const val = revenue.data[row.key] ?? 0
                    const maxVal = Math.max(
                      ...REVENUE_ROWS.map(r => revenue.data[r.key] ?? 0), 1
                    )
                    const pct = Math.max((val / maxVal) * 100, 2)
                    return (
                      <div key={row.key} className={s.waterfallRow}>
                        <span className={s.waterfallLabel}>{row.label}</span>
                        <div className={s.waterfallTrack}>
                          <motion.div
                            className={s.waterfallBar}
                            style={{ background: row.color, minWidth: '2%' }}
                            initial={{ width: '2%' }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.8, delay: idx * 0.07, ease: [0.16, 1, 0.3, 1] }}
                          >
                            <span className={s.waterfallValue}>{formatPct(Math.round(pct * 100))}</span>
                          </motion.div>
                        </div>
                        <span className={s.waterfallAmount}>{formatUsdc(val)}</span>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </GlassCard>
        </motion.div>

        {/* ── Loss Buffer ── */}
        <motion.div variants={cardVariants}>
          <BentoCard glowColor="16, 185, 129" style={{ display: 'block' }}>
            <p className={s.cardTitle}>Loss Buffer Status</p>
            {lossBuffer.loading && <CardSkeleton rows={3} />}
            {lossBuffer.error && <p style={{ color: 'var(--color-error)', fontSize: 13 }}>{lossBuffer.error}</p>}
            {lossBuffer.data && (
              <>
                <div className={s.heroStat}>
                  <p className={s.heroStatLabel}>Total Defaults Before Senior Loss</p>
                  <div className={s.heroStatValue}>
                    <AnimatedNumber
                      value={formatUsdcRaw(lossBuffer.data.totalDefaultsBeforeSeniorLoss ?? 0)}
                      decimals={2}
                      prefix="$"
                    />
                  </div>
                  <p className={s.heroStatSub}>Insurance + Junior + Mezzanine equity</p>
                </div>

                <div className={s.stats4} style={{ marginBottom: 24 }}>
                  <StatWidget label="Insurance Balance" value={formatUsdc(lossBuffer.data.insuranceBalance ?? 0)} />
                  <StatWidget label="Insurance Capacity" value={formatUsdc(lossBuffer.data.insuranceCapacity ?? 0)} />
                  <StatWidget label="Junior Buffer" value={formatUsdc(lossBuffer.data.juniorBuffer ?? 0)} />
                  <StatWidget label="Mezzanine Buffer" value={formatUsdc(lossBuffer.data.mezzanineBuffer ?? 0)} />
                </div>

                {/* Buffer stack bar */}
                <div>
                  <p style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
                    Buffer Stack
                  </p>
                  <div className={s.bufferStack}>
                    {(() => {
                      const total = (lossBuffer.data.totalDefaultsBeforeSeniorLoss ?? 1) || 1
                      const ins = ((lossBuffer.data.insuranceBalance ?? 0) / total) * 100
                      const jr  = ((lossBuffer.data.juniorBuffer ?? 0) / total) * 100
                      const mz  = ((lossBuffer.data.mezzanineBuffer ?? 0) / total) * 100
                      return (
                        <>
                          <motion.div className={s.bufferSegment} style={{ background: '#F59E0B' }}
                            initial={{ width: 0 }} animate={{ width: `${ins}%` }}
                            transition={{ duration: 0.9, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                          />
                          <motion.div className={s.bufferSegment} style={{ background: '#F97316' }}
                            initial={{ width: 0 }} animate={{ width: `${jr}%` }}
                            transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                          />
                          <motion.div className={s.bufferSegment} style={{ background: '#8B5CF6' }}
                            initial={{ width: 0 }} animate={{ width: `${mz}%` }}
                            transition={{ duration: 0.9, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                          />
                        </>
                      )
                    })()}
                  </div>
                  <div className={s.bufferLegend}>
                    {[
                      { label: 'Insurance', color: '#F59E0B' },
                      { label: 'Junior',    color: '#F97316' },
                      { label: 'Mezzanine', color: '#8B5CF6' },
                    ].map(item => (
                      <div key={item.label} className={s.bufferLegendItem}>
                        <div className={s.bufferDot} style={{ background: item.color }} />
                        {item.label}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </BentoCard>
        </motion.div>

      </motion.div>
    </SolanaLayout>
  )
}
