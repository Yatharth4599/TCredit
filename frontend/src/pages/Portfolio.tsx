import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { motion, AnimatePresence } from 'motion/react'
import { investApi, vaultsApi } from '../api/client'
import type {
  ApiPortfolioInvestment,
  ApiPortfolioSummary,
  ApiVaultDetail,
  ApiVaultEvent,
} from '../api/types'
import { formatUSDC, weiToNumber, truncateAddress } from '../lib/format'
import { useContractTx } from '../hooks/useContractTx'
import { AnimatedNumber } from '../components/ui/AnimatedNumber'
import { Skeleton } from '../components/ui/Skeleton'
import { ErrorState } from '../components/ui/ErrorState'
import { STATUS_CONFIG } from '../lib/statusConfig'
import { mockInvestments, mockPortfolioSummary } from '../lib/mockData'
import { Loader2, Wallet, CheckCircle, ExternalLink, ArrowRight, Zap, TrendingUp } from 'lucide-react'
import styles from './Portfolio.module.css'

// Extract payment amount from vault event data
function getEventAmount(evt: ApiVaultEvent): number {
  const d = evt.data
  for (const key of ['amount', 'totalAmount', 'grossAmount', 'paymentAmount']) {
    const v = d[key]
    if (typeof v === 'string' && v.length > 0 && v !== '0') return weiToNumber(v)
  }
  return 0
}

// Estimate investor's share of a vault payment
// Community investors (direct depositors) receive 5% of net (97.5% of gross)
// This investor's portion = their share of vault * community pool
function estimateReturn(gross: number, invested: number, totalRaised: number): number {
  if (gross <= 0 || totalRaised <= 0 || invested <= 0) return 0
  return gross * 0.975 * 0.05 * Math.min(invested / totalRaised, 1)
}

export default function Portfolio() {
  const navigate = useNavigate()
  const { address: walletAddress } = useAccount()

  // ── State ────────────────────────────────────────────────────────────────────
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all')
  const [investments, setInvestments] = useState<ApiPortfolioInvestment[]>([])
  const [summary, setSummary] = useState<ApiPortfolioSummary | null>(null)
  const [vaultMap, setVaultMap] = useState<Record<string, ApiVaultDetail>>({})
  const [activityMap, setActivityMap] = useState<Record<string, ApiVaultEvent[]>>({})
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState(false)
  const [claimingVault, setClaimingVault] = useState<string | null>(null)
  const [claimingAll, setClaimingAll] = useState(false)
  const [justClaimed, setJustClaimed] = useState(false)

  const { execute: executeTx } = useContractTx()

  // ── Data loading ─────────────────────────────────────────────────────────────
  const loadPortfolio = useCallback(async (wallet: string) => {
    setLoading(true)
    setFetchError(false)
    try {
      const { data } = await investApi.portfolio(wallet)
      const invs = data?.investments ?? []
      setInvestments(invs)
      setSummary(data?.summary ?? null)

      // Fetch vault details for active/repaying/fundraising positions in parallel
      const activeAddrs = invs
        .filter(inv => ['active', 'repaying', 'fundraising'].includes(inv.state))
        .map(inv => inv.vaultAddress)

      if (activeAddrs.length > 0) {
        const results = await Promise.allSettled(
          activeAddrs.map(addr =>
            vaultsApi.detail(addr).then(r => ({ addr, vault: r.data }))
          )
        )
        const newMap: Record<string, ApiVaultDetail> = {}
        for (const r of results) {
          if (r.status === 'fulfilled') newMap[r.value.addr] = r.value.vault
        }
        setVaultMap(newMap)
      }

      // Fetch recent repayments for top 3 active/repaying vaults
      const repayingAddrs = invs
        .filter(inv => inv.state === 'active' || inv.state === 'repaying')
        .slice(0, 3)
        .map(inv => inv.vaultAddress)

      if (repayingAddrs.length > 0) {
        const results = await Promise.allSettled(
          repayingAddrs.map(addr =>
            vaultsApi.repayments(addr).then(r => ({
              addr,
              events: r.data?.repayments?.slice(0, 5) ?? [],
            }))
          )
        )
        const newAct: Record<string, ApiVaultEvent[]> = {}
        for (const r of results) {
          if (r.status === 'fulfilled' && r.value.events.length > 0) {
            newAct[r.value.addr] = r.value.events
          }
        }
        setActivityMap(newAct)
      }
    } catch {
      setFetchError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!walletAddress) {
      setInvestments([])
      setSummary(null)
      setVaultMap({})
      setActivityMap({})
      setFetchError(false)
      return
    }
    loadPortfolio(walletAddress)
  }, [walletAddress, loadPortfolio])

  // ── Derived data (computed before useMemo hooks) ──────────────────────────────
  const displayInvestments = investments.length > 0
    ? investments
    : (import.meta.env.DEV && walletAddress ? mockInvestments : [])

  const displaySummary = summary
    ?? (import.meta.env.DEV && walletAddress ? mockPortfolioSummary : null)

  // ── Memos ────────────────────────────────────────────────────────────────────
  const effectiveApy = useMemo(() => {
    const active = displayInvestments.filter(
      inv => inv.state === 'active' || inv.state === 'repaying'
    )
    if (active.length === 0) return 0
    const totalActive = active.reduce((s, inv) => s + weiToNumber(inv.amountInvested), 0)
    if (totalActive === 0) return 0
    return +active.reduce((s, inv) =>
      s + inv.interestRate * (weiToNumber(inv.amountInvested) / totalActive),
    0).toFixed(1)
  }, [displayInvestments])

  const allActivity = useMemo(() => {
    return Object.entries(activityMap)
      .flatMap(([addr, events]) => events.map(evt => ({ evt, vaultAddress: addr })))
      .sort((a, b) => new Date(b.evt.timestamp).getTime() - new Date(a.evt.timestamp).getTime())
  }, [activityMap])

  const filtered = useMemo(() => {
    return displayInvestments.filter(inv => {
      if (filter === 'all') return true
      if (filter === 'active') return ['active', 'repaying', 'fundraising'].includes(inv.state)
      return ['completed', 'defaulted', 'cancelled'].includes(inv.state)
    })
  }, [displayInvestments, filter])

  // ── Summary stats ─────────────────────────────────────────────────────────────
  const totalInvested = displaySummary ? weiToNumber(displaySummary.totalInvested) : 0
  const totalClaimable = displaySummary ? weiToNumber(displaySummary.totalClaimable) : 0
  const activePositions = displayInvestments.filter(
    inv => ['active', 'repaying', 'fundraising'].includes(inv.state)
  ).length

  // ── Claim handlers ────────────────────────────────────────────────────────────
  const handleClaim = async (vaultAddress: string) => {
    setClaimingVault(vaultAddress)
    try {
      const { data: unsignedTx } = await investApi.claim({ vaultAddress })
      const hash = await executeTx(unsignedTx)
      if (hash && walletAddress) {
        setJustClaimed(true)
        setTimeout(() => setJustClaimed(false), 3000)
        const { data } = await investApi.portfolio(walletAddress)
        setInvestments(data?.investments ?? [])
        setSummary(data?.summary ?? null)
      }
    } catch {
      // Error handled by toast
    } finally {
      setClaimingVault(null)
    }
  }

  const handleClaimAll = async () => {
    if (!walletAddress || claimingAll) return
    const claimableInvs = displayInvestments.filter(inv => weiToNumber(inv.claimable) > 0)
    if (claimableInvs.length === 0) return
    setClaimingAll(true)
    try {
      for (const inv of claimableInvs) {
        const { data: unsignedTx } = await investApi.claim({ vaultAddress: inv.vaultAddress })
        const hash = await executeTx(unsignedTx)
        if (!hash) break // cancelled
      }
      setJustClaimed(true)
      setTimeout(() => setJustClaimed(false), 3000)
      const { data } = await investApi.portfolio(walletAddress)
      setInvestments(data?.investments ?? [])
      setSummary(data?.summary ?? null)
    } catch {
      // Error handled by toast
    } finally {
      setClaimingAll(false)
    }
  }

  // ── Early returns ─────────────────────────────────────────────────────────────
  if (!walletAddress) {
    return (
      <div className={styles.page}>
        <div className={styles.connectPrompt}>
          <Wallet size={48} strokeWidth={1} />
          <h2>Connect Your Wallet</h2>
          <p>Connect your wallet to view your investment portfolio</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.pageInner}>
          <Skeleton height={36} width={200} style={{ marginBottom: 32 }} />
          <Skeleton height={200} borderRadius={16} style={{ marginBottom: 20 }} />
          <Skeleton height={260} borderRadius={16} style={{ marginBottom: 16 }} />
          <Skeleton height={260} borderRadius={16} style={{ marginBottom: 16 }} />
          <Skeleton height={260} borderRadius={16} />
        </div>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className={styles.page}>
        <div className={styles.pageInner}>
          <ErrorState onRetry={() => walletAddress && loadPortfolio(walletAddress)} />
        </div>
      </div>
    )
  }

  if (displayInvestments.length === 0) {
    return (
      <div className={styles.page}>
        <div className={styles.pageInner}>
          <div className={styles.emptyPrompt}>
            <div className={styles.emptyIcon}>📊</div>
            <h2>No Investments Yet</h2>
            <p>Start earning real yield from on-chain merchant repayments</p>
            <button className={styles.browseBtn} onClick={() => navigate('/vaults')}>
              Browse Vaults <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Main render ───────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <div className={styles.pageInner}>

        {/* Page header */}
        <motion.div
          className={styles.pageHeader}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <h1 className={styles.pageTitle}>My Portfolio</h1>
          <span className={styles.pageAddr}>{truncateAddress(walletAddress, 5)}</span>
        </motion.div>

        {/* ══════════════════════════════════════════════════════════
            SECTION 1: PORTFOLIO SUMMARY
        ══════════════════════════════════════════════════════════ */}
        <motion.div
          className={styles.summaryCard}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
        >
          {/* Success overlay on claim */}
          <AnimatePresence>
            {justClaimed && (
              <motion.div
                className={styles.claimedOverlay}
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ duration: 0.3 }}
              >
                <CheckCircle size={36} style={{ color: 'var(--color-success)' }} />
                <span className={styles.claimedText}>Returns Claimed!</span>
                <span className={styles.claimedSub}>Your wallet has been credited</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 3-metric row */}
          <div className={styles.summaryMetrics}>
            <div className={styles.summaryMetric}>
              <span className={styles.metricLabel}>Total Invested</span>
              <span className={styles.metricValue}>
                $<AnimatedNumber value={totalInvested} decimals={2} />
              </span>
            </div>
            <div className={styles.metricDivider} />
            <div className={styles.summaryMetric}>
              <span className={styles.metricLabel}>Claimable Now</span>
              <span
                className={styles.metricValue}
                style={{ color: totalClaimable > 0 ? 'var(--color-success)' : 'inherit' }}
              >
                $<AnimatedNumber value={totalClaimable} decimals={2} />
              </span>
            </div>
            <div className={styles.metricDivider} />
            <div className={styles.summaryMetric}>
              <span className={styles.metricLabel}>Active Positions</span>
              <span className={styles.metricValue}>
                <AnimatedNumber value={activePositions} decimals={0} />
              </span>
            </div>
          </div>

          {/* Footer: APY + claim all button */}
          <div className={styles.summaryFooter}>
            <div className={styles.summaryMeta}>
              {effectiveApy > 0 && (
                <span className={styles.apyBadge}>
                  <TrendingUp size={12} />
                  {effectiveApy.toFixed(1)}% Effective APY
                </span>
              )}
              <span className={styles.summaryNote}>
                {displayInvestments.length} position{displayInvestments.length !== 1 ? 's' : ''} · yield from on-chain x402 payments
              </span>
            </div>
            {totalClaimable > 0 && (
              <button
                className={styles.claimAllBtn}
                onClick={handleClaimAll}
                disabled={claimingAll}
              >
                {claimingAll ? (
                  <><Loader2 size={15} className={styles.spinner} /> Claiming...</>
                ) : (
                  <>Claim All Returns ({formatUSDC(displaySummary?.totalClaimable || '0')})</>
                )}
              </button>
            )}
          </div>

          {/* Allocation bar */}
          {totalInvested > 0 && (
            <div className={styles.allocWrap}>
              <div className={styles.allocBar}>
                {(['active', 'repaying', 'fundraising', 'completed'] as const).map(st => {
                  const pct = displayInvestments
                    .filter(inv => inv.state === st)
                    .reduce((s, inv) => s + weiToNumber(inv.amountInvested) / totalInvested * 100, 0)
                  if (pct < 0.5) return null
                  const COLOR: Record<string, string> = {
                    active: 'var(--color-success)',
                    repaying: '#60a5fa',
                    fundraising: 'var(--accent)',
                    completed: 'var(--text-tertiary)',
                  }
                  return (
                    <motion.div
                      key={st}
                      className={styles.allocSegment}
                      style={{ background: COLOR[st] ?? 'var(--text-tertiary)' }}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.4 }}
                      title={`${st}: ${pct.toFixed(0)}%`}
                    />
                  )
                })}
              </div>
              <div className={styles.allocLegend}>
                {['active', 'repaying', 'fundraising', 'completed'].map(st => {
                  const count = displayInvestments.filter(inv => inv.state === st).length
                  if (count === 0) return null
                  const COLOR: Record<string, string> = {
                    active: 'var(--color-success)',
                    repaying: '#60a5fa',
                    fundraising: 'var(--accent)',
                    completed: 'var(--text-tertiary)',
                  }
                  return (
                    <span key={st} className={styles.allocLegendItem}>
                      <span className={styles.allocDot} style={{ background: COLOR[st] ?? 'var(--text-tertiary)' }} />
                      {st.charAt(0).toUpperCase() + st.slice(1)} ({count})
                    </span>
                  )
                })}
              </div>
            </div>
          )}
        </motion.div>

        {/* ══════════════════════════════════════════════════════════
            SECTION 2: POSITIONS
        ══════════════════════════════════════════════════════════ */}
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Active Positions</h2>
          <div className={styles.filterPills}>
            {([
              { key: 'all', label: 'All' },
              { key: 'active', label: 'Active' },
              { key: 'completed', label: 'Closed' },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                className={`${styles.pill} ${filter === key ? styles.pillActive : ''}`}
                onClick={() => setFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className={styles.emptyFilter}>
            No {filter === 'active' ? 'active' : 'closed'} positions
          </div>
        ) : (
          <div className={styles.positionsList}>
            {filtered.map((inv, i) => {
              const status = STATUS_CONFIG[inv.state] ?? STATUS_CONFIG.active
              const claimable = weiToNumber(inv.claimable)
              const invested = weiToNumber(inv.amountInvested)
              const estReturn = invested * inv.interestRate / 100 * inv.durationMonths / 12
              const vaultData = vaultMap[inv.vaultAddress]
              const isActive = inv.state === 'active' || inv.state === 'repaying'
              const isFund = inv.state === 'fundraising'
              const activityCount = activityMap[inv.vaultAddress]?.length ?? 0

              // Compute vault progress bar
              let progressPct = 0
              let progressLabel = ''
              let progressColor = 'var(--accent)'
              if (isActive && vaultData) {
                const repaid = weiToNumber(vaultData.totalRepaid)
                const toRepay = weiToNumber(vaultData.totalToRepay)
                progressPct = toRepay > 0 ? Math.min(repaid / toRepay * 100, 100) : 0
                progressLabel = `${progressPct.toFixed(1)}% repaid`
                progressColor = 'var(--color-success)'
              } else if (isFund && vaultData) {
                progressPct = Math.min(vaultData.percentFunded, 100)
                progressLabel = `${progressPct.toFixed(0)}% funded`
                progressColor = 'var(--accent)'
              }

              return (
                <motion.div
                  key={inv.vaultAddress}
                  className={styles.positionCard}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: 0.1 + i * 0.07 }}
                >
                  {/* Top row: status + claim button */}
                  <div className={styles.posTop}>
                    <div className={styles.posLeft}>
                      <span
                        className={styles.posStatus}
                        style={{
                          color: status.color,
                          background: `${status.color}18`,
                          border: `1px solid ${status.color}33`,
                        }}
                      >
                        <span className={styles.statusDot} style={{ background: status.color }} />
                        {status.label}
                      </span>
                      <span className={styles.posAgent}>{truncateAddress(inv.agent, 6)}</span>
                    </div>
                    {claimable > 0 && (
                      <button
                        className={styles.claimBtn}
                        onClick={() => handleClaim(inv.vaultAddress)}
                        disabled={!!claimingVault}
                      >
                        {claimingVault === inv.vaultAddress ? (
                          <><Loader2 size={13} className={styles.spinner} /> Claiming...</>
                        ) : (
                          `Claim ${formatUSDC(inv.claimable)}`
                        )}
                      </button>
                    )}
                  </div>

                  {/* Rate + term */}
                  <div className={styles.posRate}>
                    {inv.interestRate}% APY &middot; {inv.durationMonths} months
                  </div>

                  {/* 3-stat row */}
                  <div className={styles.posStats}>
                    <div className={styles.posStat}>
                      <span className={styles.posStatLabel}>Your Investment</span>
                      <span className={styles.posStatValue}>
                        $<AnimatedNumber value={invested} decimals={2} />
                      </span>
                    </div>
                    <div className={styles.posStatDivider} />
                    <div className={styles.posStat}>
                      <span className={styles.posStatLabel}>Claimable Now</span>
                      <span
                        className={styles.posStatValue}
                        style={{ color: claimable > 0 ? 'var(--color-success)' : 'var(--text-tertiary)' }}
                      >
                        {claimable > 0
                          ? <>${'$'}<AnimatedNumber value={claimable} decimals={2} /></>
                          : '—'}
                      </span>
                    </div>
                    <div className={styles.posStatDivider} />
                    <div className={styles.posStat}>
                      <span className={styles.posStatLabel}>Est. Total Return</span>
                      <span className={styles.posStatValue}>
                        +$<AnimatedNumber value={estReturn} decimals={2} />
                      </span>
                    </div>
                  </div>

                  {/* Vault progress bar */}
                  {(isActive || isFund) && progressPct > 0 && (
                    <div className={styles.posProgress}>
                      <div className={styles.posProgressTrack}>
                        <motion.div
                          className={styles.posProgressFill}
                          style={{ background: progressColor }}
                          initial={{ width: 0 }}
                          animate={{ width: `${progressPct}%` }}
                          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.3 + i * 0.05 }}
                        />
                      </div>
                      <span className={styles.posProgressLabel}>{progressLabel}</span>
                    </div>
                  )}

                  {/* Yield source note */}
                  {isActive && (
                    <div className={styles.yieldNote}>
                      <Zap size={12} />
                      <span>
                        Returns come from x402 payments routed through the on-chain PaymentRouter.
                        {activityCount > 0 && ` ${activityCount} recent payment${activityCount !== 1 ? 's' : ''} verified.`}
                      </span>
                    </div>
                  )}

                  {/* View vault link */}
                  <button
                    className={styles.viewVaultBtn}
                    onClick={() => navigate(`/vaults/${inv.vaultAddress}`)}
                  >
                    View Vault Details <ArrowRight size={13} />
                  </button>
                </motion.div>
              )
            })}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            SECTION 3: RETURNS HISTORY (vault activity)
        ══════════════════════════════════════════════════════════ */}
        {allActivity.length > 0 && (
          <motion.div
            className={styles.card}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.cardTitle}>Returns History</h2>
                <p className={styles.cardDesc}>
                  Every return is traceable to a specific x402 payment processed through the waterfall on-chain.
                </p>
              </div>
            </div>

            <div className={styles.activityTable}>
              <div className={styles.activityHead}>
                <span>Date</span>
                <span>Vault</span>
                <span>Payment In</span>
                <span>Your Return</span>
                <span>Tx</span>
              </div>

              {allActivity.slice(0, 10).map(({ evt, vaultAddress }) => {
                const gross = getEventAmount(evt)
                const inv = displayInvestments.find(i => i.vaultAddress === vaultAddress)
                const vd = vaultMap[vaultAddress]
                const invested = inv ? weiToNumber(inv.amountInvested) : 0
                const totalRaised = vd ? weiToNumber(vd.totalRaised) : 0
                const yourReturn = estimateReturn(gross, invested, totalRaised)

                return (
                  <div key={evt.id} className={styles.activityRow}>
                    <span className={styles.actDate}>
                      {new Date(evt.timestamp).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric',
                      })}
                    </span>
                    <span className={styles.actVault}>
                      {truncateAddress(vaultAddress, 4)}
                    </span>
                    <span className={styles.actAmount}>
                      {gross > 0 ? formatUSDC(String(Math.round(gross * 1e6))) : '—'}
                    </span>
                    <span
                      className={styles.actReturn}
                      style={{ color: yourReturn > 0 ? 'var(--color-success)' : 'var(--text-tertiary)' }}
                    >
                      {yourReturn > 0
                        ? `+${formatUSDC(String(Math.round(yourReturn * 1e6)))}`
                        : '—'}
                    </span>
                    <a
                      href={`https://sepolia.basescan.org/tx/${evt.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.actTx}
                    >
                      {truncateAddress(evt.txHash, 4)} <ExternalLink size={11} />
                    </a>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}

      </div>
    </div>
  )
}
