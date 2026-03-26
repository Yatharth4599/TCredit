import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { lpApi } from '../api/solanaClient'
import { BentoGrid, BentoCard } from '../components/ui/BentoGrid'
import { GlassCard } from '../components/ui/GlassCard'
import { StatWidget } from '../components/ui/StatWidget'
import { AnimatedNumber } from '../components/ui/AnimatedNumber'
import { Skeleton } from '../components/ui/Skeleton'
import SolanaLayout from '../components/layout/SolanaLayout'
import { formatUsdc, formatUsdcRaw } from '../utils/dashboardHelpers'
import { containerVariants, cardVariants } from '../utils/motionVariants'
import s from './SolanaLPDashboard.module.css'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyData = any

const TRANCHES = ['senior', 'mezzanine', 'junior'] as const

const TRANCHE_CFG = {
  senior:    { label: 'Senior',    rgb: '59, 130, 246',  color: '#3B82F6', accent: 'linear-gradient(90deg, #2563EB, #3B82F6)' },
  mezzanine: { label: 'Mezzanine', rgb: '139, 92, 246',  color: '#8B5CF6', accent: 'linear-gradient(90deg, #7C3AED, #8B5CF6)' },
  junior:    { label: 'Junior',    rgb: '249, 115, 22',  color: '#F97316', accent: 'linear-gradient(90deg, #EA580C, #F97316)' },
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

export default function SolanaLPDashboard() {
  const [address, setAddress] = useState('')
  const [searched, setSearched] = useState(false)
  const [positions, setPositions] = useState<{ data: AnyData; loading: boolean; error: string | null }>({ data: null, loading: false, error: null })

  const [depositTranche, setDepositTranche] = useState<typeof TRANCHES[number]>('senior')
  const [depositAmount, setDepositAmount] = useState('')
  const [depositPreview, setDepositPreview] = useState<{ data: AnyData; loading: boolean; error: string | null }>({ data: null, loading: false, error: null })

  const [withdrawTranche, setWithdrawTranche] = useState<typeof TRANCHES[number]>('senior')
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
      setPositions({ data: null, loading: false, error: err instanceof Error ? err.message : 'Request failed' })
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
      setDepositPreview({ data: null, loading: false, error: err instanceof Error ? err.message : 'Request failed' })
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
      setWithdrawPreview({ data: null, loading: false, error: err instanceof Error ? err.message : 'Request failed' })
    }
  }

  const totalDeposited = positions.data?.positions?.reduce((sum: number, p: AnyData) => sum + (p.deposits ?? 0), 0) ?? 0
  const totalYield     = positions.data?.positions?.reduce((sum: number, p: AnyData) => sum + (p.yieldEarned ?? 0), 0) ?? 0

  return (
    <SolanaLayout
      title="LP Dashboard"
      subtitle="View liquidity positions, preview deposits, and calculate withdrawals."
      dataLoaded={!!positions.data}
    >
      <motion.div variants={containerVariants} initial="hidden" animate="visible">

        {/* Wallet Lookup */}
        <motion.div variants={cardVariants} style={{ marginBottom: 16 }}>
          <GlassCard variant="highlight">
            <form onSubmit={handleLookup} className={s.searchInner}>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Enter LP wallet address..."
                className={s.searchInput}
                spellCheck={false}
              />
              <button
                type="submit"
                disabled={!address.trim()}
                className="btn-primary"
                style={{ borderRadius: 'var(--radius-lg)', padding: '14px 28px' }}
              >
                Lookup Positions
              </button>
            </form>
          </GlassCard>
        </motion.div>

        {/* Empty state */}
        <AnimatePresence>
          {!searched && (
            <motion.div
              className={s.emptyState}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            >
              <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="1.2">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
              </svg>
              <p className={s.emptyText}>Enter a wallet address to view LP positions</p>
              <p className={s.emptyHint}>Or use the previews below to simulate deposits and withdrawals</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Positions */}
        {searched && (
          <motion.div variants={cardVariants} style={{ marginBottom: 16 }}>
            {positions.loading && (
              <GlassCard><CardSkeleton rows={5} /></GlassCard>
            )}
            {positions.error && (
              <GlassCard>
                <p style={{ color: 'var(--color-error)', fontSize: 13 }}>{positions.error}</p>
              </GlassCard>
            )}
            {positions.data && (
              <>
                {/* Portfolio summary */}
                <BentoCard glowColor="6, 182, 212" style={{ display: 'block', marginBottom: 16 }}>
                  <p className={s.cardTitle}>Portfolio Summary</p>
                  <div className={s.stats3}>
                    <StatWidget
                      label="Total Deposited"
                      value={<AnimatedNumber value={formatUsdcRaw(totalDeposited)} decimals={2} prefix="$" /> as unknown as string}
                    />
                    <StatWidget
                      label="Total Yield Earned"
                      value={<AnimatedNumber value={formatUsdcRaw(totalYield)} decimals={2} prefix="$" /> as unknown as string}
                      trend="up"
                    />
                    <StatWidget
                      label="Active Positions"
                      value={<AnimatedNumber value={positions.data.positions?.length ?? 0} /> as unknown as string}
                    />
                  </div>
                </BentoCard>

                {/* Individual position cards */}
                {positions.data.positions?.length > 0 ? (
                  <BentoGrid columns={3} gap={16}>
                    {positions.data.positions.map((pos: AnyData) => {
                      const tranche = (pos.tranche ?? 'senior').toLowerCase() as typeof TRANCHES[number]
                      const cfg = TRANCHE_CFG[tranche] ?? TRANCHE_CFG.senior
                      return (
                        <motion.div key={pos.tranche} variants={cardVariants}>
                          <BentoCard glowColor={cfg.rgb} style={{ position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: cfg.accent }} />
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                              <span style={{
                                padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                                background: `rgba(${cfg.rgb}, 0.12)`, color: cfg.color,
                                border: `1px solid rgba(${cfg.rgb}, 0.2)`,
                              }}>
                                {pos.tranche}
                              </span>
                            </div>
                            <div className={s.stats2}>
                              <StatWidget label="Deposits" value={formatUsdc(pos.deposits ?? 0)} />
                              <StatWidget label="Shares" value={<AnimatedNumber value={Number(pos.shares ?? 0) / 1e6} decimals={2} /> as unknown as string} />
                              <StatWidget label="Est. Value" value={formatUsdc(pos.estimatedValue ?? 0)} />
                              <StatWidget label="Yield Earned" value={formatUsdc(pos.yieldEarned ?? 0)} trend="up" />
                            </div>
                          </BentoCard>
                        </motion.div>
                      )
                    })}
                  </BentoGrid>
                ) : (
                  <GlassCard>
                    <p style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '32px 0', fontSize: 14 }}>
                      No LP positions found for this wallet.
                    </p>
                  </GlassCard>
                )}
              </>
            )}
          </motion.div>
        )}

        {/* Deposit Preview */}
        <motion.div variants={cardVariants} style={{ marginBottom: 16 }}>
          <GlassCard variant="interactive">
            <p className={s.cardTitle}>Deposit Preview</p>
            <form onSubmit={handleDepositPreview}>
              {/* Tranche toggles */}
              <div className={s.trancheToggle}>
                {TRANCHES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setDepositTranche(t)}
                    className={`${s.toggleBtn} ${s[`toggle${t.charAt(0).toUpperCase() + t.slice(1)}` as keyof typeof s]} ${depositTranche === t ? s.active : ''}`}
                  >
                    {TRANCHE_CFG[t].label}
                  </button>
                ))}
              </div>
              <div className={s.formRow}>
                <div className={s.formField}>
                  <label className={s.formLabel}>Amount (USDC)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="1000.00"
                    className={s.formInput}
                  />
                </div>
                <div />
                <button
                  type="submit"
                  disabled={!depositAmount}
                  className="btn-primary"
                  style={{ padding: '12px 24px' }}
                >
                  Preview
                </button>
              </div>
            </form>
            {depositPreview.loading && (
              <div style={{ marginTop: 16 }}><CardSkeleton rows={2} /></div>
            )}
            {depositPreview.error && (
              <p style={{ color: 'var(--color-error)', fontSize: 13, marginTop: 12 }}>{depositPreview.error}</p>
            )}
            <AnimatePresence>
              {depositPreview.data && (
                <motion.div
                  className={s.resultsGrid}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35 }}
                >
                  <StatWidget label="Shares Received" value={<AnimatedNumber value={Number(depositPreview.data.sharesReceived ?? 0) / 1e6} decimals={2} /> as unknown as string} />
                  <StatWidget label="Share Price" value={`$${(Number(depositPreview.data.sharePrice ?? 1e6) / 1e6).toFixed(4)}`} />
                  <StatWidget label="Est. APY" value={<AnimatedNumber value={Number(depositPreview.data.estimatedApyBps ?? 0) / 100} decimals={2} suffix="%" /> as unknown as string} />
                  <StatWidget label="Daily Yield" value={formatUsdc(depositPreview.data.estimatedDailyYield ?? 0)} trend="up" />
                </motion.div>
              )}
            </AnimatePresence>
          </GlassCard>
        </motion.div>

        {/* Withdrawal Preview */}
        <motion.div variants={cardVariants}>
          <GlassCard variant="interactive">
            <p className={s.cardTitle}>Withdrawal Preview</p>
            <form onSubmit={handleWithdrawPreview}>
              <div className={s.trancheToggle}>
                {TRANCHES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setWithdrawTranche(t)}
                    className={`${s.toggleBtn} ${s[`toggle${t.charAt(0).toUpperCase() + t.slice(1)}` as keyof typeof s]} ${withdrawTranche === t ? s.active : ''}`}
                  >
                    {TRANCHE_CFG[t].label}
                  </button>
                ))}
              </div>
              <div className={s.formRow}>
                <div className={s.formField}>
                  <label className={s.formLabel}>Shares to Withdraw</label>
                  <input
                    type="number"
                    step="0.01"
                    value={withdrawShares}
                    onChange={(e) => setWithdrawShares(e.target.value)}
                    placeholder="500.00"
                    className={s.formInput}
                  />
                </div>
                <div />
                <button
                  type="submit"
                  disabled={!withdrawShares}
                  className="btn-primary"
                  style={{ padding: '12px 24px' }}
                >
                  Preview
                </button>
              </div>
            </form>
            {withdrawPreview.loading && (
              <div style={{ marginTop: 16 }}><CardSkeleton rows={2} /></div>
            )}
            {withdrawPreview.error && (
              <p style={{ color: 'var(--color-error)', fontSize: 13, marginTop: 12 }}>{withdrawPreview.error}</p>
            )}
            <AnimatePresence>
              {withdrawPreview.data && (
                <motion.div
                  className={s.resultsGrid3}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35 }}
                >
                  <StatWidget label="USDC Received" value={<AnimatedNumber value={formatUsdcRaw(withdrawPreview.data.usdcReceived ?? 0)} decimals={2} prefix="$" /> as unknown as string} />
                  <StatWidget label="Share Price" value={`$${(Number(withdrawPreview.data.sharePrice ?? 1e6) / 1e6).toFixed(4)}`} />
                  <StatWidget label="Withdrawal Fee" value={formatUsdc(withdrawPreview.data.fee ?? 0)} />
                </motion.div>
              )}
            </AnimatePresence>
          </GlassCard>
        </motion.div>

      </motion.div>
    </SolanaLayout>
  )
}
