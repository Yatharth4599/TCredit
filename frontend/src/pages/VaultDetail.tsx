import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect, useMemo } from 'react'
import { motion } from 'motion/react'
import { useAccount } from 'wagmi'
import { vaultsApi, investApi } from '../api/client'
import type { ApiVaultDetail, ApiInvestor, ApiTrancheResponse, ApiMilestone, ApiVaultEvent } from '../api/types'
import { formatUSDC, weiToNumber, truncateAddress, parseUSDCToWei } from '../lib/format'
import { useContractTx } from '../hooks/useContractTx'
import { useUSDCApproval } from '../hooks/useUSDCApproval'
import { AnimatedNumber } from '../components/ui/AnimatedNumber'
import { Skeleton } from '../components/ui/Skeleton'
import { ErrorState } from '../components/ui/ErrorState'
import { STATUS_CONFIG } from '../lib/statusConfig'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from 'recharts'
import {
  ArrowLeft, Loader2, CheckCircle, Clock, AlertTriangle, Users, Layers,
  TrendingUp, ExternalLink, Copy, Zap,
} from 'lucide-react'
import toast from 'react-hot-toast'
import styles from './VaultDetail.module.css'

// Extract payment amount from event data defensively
function getEventAmount(evt: ApiVaultEvent): number {
  const d = evt.data
  for (const key of ['amount', 'totalAmount', 'grossAmount', 'paymentAmount', 'value']) {
    const v = d[key]
    if (typeof v === 'string' && v.length > 0 && v !== '0') return weiToNumber(v)
  }
  return 0
}

// Extract sender address from event data defensively
function getEventFrom(evt: ApiVaultEvent): string {
  const d = evt.data
  for (const key of ['from', 'payer', 'sender']) {
    const v = d[key]
    if (typeof v === 'string' && v.startsWith('0x')) return v
  }
  return ''
}

export default function VaultDetail() {
  const { address } = useParams<{ address: string }>()
  const navigate = useNavigate()
  const { address: walletAddress } = useAccount()

  const [vault, setVault] = useState<ApiVaultDetail | null>(null)
  const [fetchError, setFetchError] = useState(false)
  const [investors, setInvestors] = useState<ApiInvestor[]>([])
  const [tranches, setTranches] = useState<ApiTrancheResponse | null>(null)
  const [milestones, setMilestones] = useState<ApiMilestone[]>([])
  const [repayments, setRepayments] = useState<ApiVaultEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [investAmount, setInvestAmount] = useState('')
  const [investing, setInvesting] = useState(false)
  const [showAllRepayments, setShowAllRepayments] = useState(false)

  const { execute: executeTx } = useContractTx()
  const { needsApproval, approve } = useUSDCApproval(address || '')

  const loadVault = () => {
    if (!address) return
    setLoading(true)
    setFetchError(false)

    Promise.all([
      vaultsApi.detail(address).then(r => setVault(r.data ?? null)).catch((err) => {
        const is404 = err?.response?.status === 404
        setVault(null)
        if (!is404) setFetchError(true)
      }),
      vaultsApi.investors(address).then(r => setInvestors(r.data?.investors ?? [])).catch(() => {}),
      vaultsApi.tranches(address).then(r => setTranches(r.data ?? null)).catch(() => {}),
      vaultsApi.milestones(address).then(r => setMilestones(r.data?.milestones ?? [])).catch(() => {}),
      vaultsApi.repayments(address).then(r => setRepayments(r.data?.repayments ?? [])).catch(() => {}),
    ]).finally(() => setLoading(false))
  }

  useEffect(() => { loadVault() }, [address])

  const handleInvest = async () => {
    if (!address || !investAmount || !walletAddress) return
    setInvesting(true)
    try {
      const weiAmount = parseUSDCToWei(investAmount)
      const amountBigInt = BigInt(weiAmount)
      if (needsApproval(amountBigInt)) {
        const approved = await approve(amountBigInt)
        if (!approved) { setInvesting(false); return }
      }
      const { data: unsignedTx } = await investApi.invest({ vaultAddress: address, amount: weiAmount })
      await executeTx(unsignedTx)
      setInvestAmount('')
    } catch {
      // Error handled by hook toasts
    } finally {
      setInvesting(false)
    }
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.pageInner}>
          <Skeleton height={32} width={120} style={{ marginBottom: 24 }} />
          <div className={styles.layout}>
            <main className={styles.main}>
              <Skeleton height={220} style={{ borderRadius: 16, marginBottom: 20 }} />
              <Skeleton height={180} style={{ borderRadius: 16, marginBottom: 20 }} />
              <Skeleton height={160} style={{ borderRadius: 16 }} />
            </main>
            <aside className={styles.sidebar}>
              <div className={styles.sidebarInner}>
                <Skeleton height={380} style={{ borderRadius: 16 }} />
              </div>
            </aside>
          </div>
        </div>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className={styles.page}>
        <div className={styles.pageInner}>
          <button className={styles.backButton} onClick={() => navigate('/vaults')}>
            <ArrowLeft size={15} /> Back to Vaults
          </button>
          <ErrorState onRetry={loadVault} />
        </div>
      </div>
    )
  }

  if (!vault) {
    return (
      <div className={styles.page}>
        <div className={styles.pageInner}>
          <div className={styles.notFound}>
            <AlertTriangle size={32} />
            <h2>Vault not found</h2>
            <p>No vault exists at this address.</p>
            <button className={styles.backButton} onClick={() => navigate('/vaults')}>
              <ArrowLeft size={15} /> Back to Vaults
            </button>
          </div>
        </div>
      </div>
    )
  }

  const status = STATUS_CONFIG[vault.state] ?? STATUS_CONFIG.fundraising
  const isRepaying = vault.state === 'active' || vault.state === 'repaying'
  const loanAmount = weiToNumber(vault.totalRaised)
  const totalRepaid = weiToNumber(vault.totalRepaid)
  const totalToRepay = weiToNumber(vault.totalToRepay)
  const outstanding = Math.max(totalToRepay - totalRepaid, 0)
  const repayPct = totalToRepay > 0 ? Math.min((totalRepaid / totalToRepay) * 100, 100) : 0
  const fundPct = Math.min(vault.percentFunded, 100)

  const maturityDate = vault.activatedAt && vault.durationSeconds
    ? new Date(new Date(vault.activatedAt).getTime() + vault.durationSeconds * 1000)
    : null
  const daysToMaturity = maturityDate
    ? Math.max(0, Math.round((maturityDate.getTime() - Date.now()) / 86400000))
    : null
  const maturityStr = maturityDate
    ? maturityDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—'

  const EX = 2500
  const exFee = +(EX * 0.025).toFixed(2)
  const exNet = +(EX - exFee).toFixed(2)
  const exSenior = +(exNet * 0.20).toFixed(2)
  const exPool = +(exNet * 0.10).toFixed(2)
  const exCommunity = +(exNet * 0.05).toFixed(2)
  const exMerchant = +(exNet - exSenior - exPool - exCommunity).toFixed(2)

  return (
    <div className={styles.page}>
      <div className={styles.pageInner}>

        {/* Back button */}
        <button className={styles.backButton} onClick={() => navigate('/vaults')}>
          <ArrowLeft size={15} /> Back to Vaults
        </button>

        <div className={styles.layout}>

          {/* MAIN COLUMN */}
          <main className={styles.main}>

            {/* SECTION 1: VAULT HEADER */}
            <motion.div
              className={styles.card}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Top row: title + status badge */}
              <div className={styles.vaultTitleRow}>
                <div>
                  <h1 className={styles.vaultTitle}>
                    Agent Vault
                  </h1>
                  <div className={styles.vaultMeta}>
                    <span className={styles.monoAddr}>{truncateAddress(vault.agent, 6)}</span>
                    <button
                      className={styles.copyBtn}
                      onClick={() => { navigator.clipboard.writeText(vault.address); toast.success('Address copied!') }}
                    >
                      <Copy size={11} /> Copy
                    </button>
                    {vault.activatedAt && (
                      <span className={styles.metaDot}>
                        Started {new Date(vault.activatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>
                <span
                  className={styles.statusBadge}
                  style={{ color: status.color, background: `${status.color}18`, border: `1px solid ${status.color}33` }}
                >
                  <span className={styles.statusDot} style={{ background: status.color }} />
                  {status.label}
                </span>
              </div>

              {isRepaying ? (
                <>
                  <div className={styles.metricsRow}>
                    <div className={styles.metric}>
                      <span className={styles.metricLabel}>Loan Amount</span>
                      <span className={styles.metricValue}>
                        $<AnimatedNumber value={loanAmount} decimals={2} />
                      </span>
                    </div>
                    <div className={styles.metricDivider} />
                    <div className={styles.metric}>
                      <span className={styles.metricLabel}>Repaid</span>
                      <span className={styles.metricValue} style={{ color: 'var(--color-success)' }}>
                        $<AnimatedNumber value={totalRepaid} decimals={2} />
                      </span>
                    </div>
                    <div className={styles.metricDivider} />
                    <div className={styles.metric}>
                      <span className={styles.metricLabel}>Outstanding</span>
                      <span className={styles.metricValue} style={{ color: 'var(--color-orange, var(--accent))' }}>
                        $<AnimatedNumber value={outstanding} decimals={2} />
                      </span>
                    </div>
                  </div>

                  {/* Repayment progress bar */}
                  <div className={styles.progressWrap}>
                    <div className={styles.progressTrack}>
                      <motion.div
                        className={styles.progressFill}
                        initial={{ width: 0 }}
                        animate={{ width: `${repayPct}%` }}
                        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
                      />
                    </div>
                    <div className={styles.progressLabels}>
                      <span className={styles.progressPct}>{repayPct.toFixed(1)}% repaid</span>
                      <span className={styles.progressTarget}>{formatUSDC(vault.totalToRepay)} total obligation</span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className={styles.metricsRow}>
                    <div className={styles.metric}>
                      <span className={styles.metricLabel}>Target</span>
                      <span className={styles.metricValue}>
                        $<AnimatedNumber value={weiToNumber(vault.targetAmount)} decimals={0} />
                      </span>
                    </div>
                    <div className={styles.metricDivider} />
                    <div className={styles.metric}>
                      <span className={styles.metricLabel}>Raised</span>
                      <span className={styles.metricValue} style={{ color: 'var(--color-success)' }}>
                        $<AnimatedNumber value={loanAmount} decimals={0} />
                      </span>
                    </div>
                    <div className={styles.metricDivider} />
                    <div className={styles.metric}>
                      <span className={styles.metricLabel}>Remaining</span>
                      <span className={styles.metricValue}>
                        $<AnimatedNumber value={Math.max(weiToNumber(vault.targetAmount) - loanAmount, 0)} decimals={0} />
                      </span>
                    </div>
                  </div>

                  <div className={styles.progressWrap}>
                    <div className={styles.progressTrack}>
                      <motion.div
                        className={styles.progressFill}
                        initial={{ width: 0 }}
                        animate={{ width: `${fundPct}%` }}
                        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
                      />
                    </div>
                    <div className={styles.progressLabels}>
                      <span className={styles.progressPct}>{fundPct.toFixed(0)}% funded</span>
                      <span className={styles.progressTarget}>{formatUSDC(vault.targetAmount)} target</span>
                    </div>
                  </div>
                </>
              )}

              {/* Terms row */}
              <div className={styles.termsRow}>
                {[
                  { icon: <TrendingUp size={13} />, label: 'APY', value: `${vault.interestRate}%` },
                  { icon: <Clock size={13} />, label: 'Term', value: `${vault.durationMonths} months` },
                  { icon: null, label: 'Maturity', value: maturityStr },
                  { icon: <Layers size={13} />, label: 'Tranches', value: `${vault.tranchesReleased}/${vault.numTranches}` },
                  { icon: <Users size={13} />, label: 'Investors', value: String(vault.investorCount) },
                ].map((t) => (
                  <div key={t.label} className={styles.termItem}>
                    {t.icon && <span className={styles.termIcon}>{t.icon}</span>}
                    <span className={styles.termLabel}>{t.label}</span>
                    <span className={styles.termValue}>{t.value}</span>
                  </div>
                ))}
                {daysToMaturity !== null && (
                  <div className={styles.termItem}>
                    <span className={styles.termLabel}>Days Left</span>
                    <span className={styles.termValue} style={{ color: daysToMaturity < 30 ? 'var(--color-error)' : 'inherit' }}>
                      {daysToMaturity}d
                    </span>
                  </div>
                )}
              </div>
            </motion.div>


            {/* SECTION 2: HOW REPAYMENT WORKS */}
            {isRepaying && (
              <motion.div
                className={styles.card}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
                <h2 className={styles.cardTitle}>How Repayment Works</h2>
                <p className={styles.cardDesc}>
                  Every payment this merchant receives through Krexa's x402 PaymentRouter is automatically split on-chain:
                </p>

                {/* Flow diagram */}
                <div className={styles.flowDiagram}>
                  <div className={styles.flowNode}>
                    <div className={styles.flowNodeIcon}>💳</div>
                    <div className={styles.flowNodeLabel}>Customer pays</div>
                    <div className={styles.flowNodeValue}>${EX.toLocaleString()}</div>
                  </div>
                  <div className={styles.flowArrow}>→</div>
                  <div className={styles.flowNode}>
                    <div className={styles.flowNodeIcon}>⛓️</div>
                    <div className={styles.flowNodeLabel}>PaymentRouter</div>
                    <div className={styles.flowNodeValue}>on-chain</div>
                  </div>
                  <div className={styles.flowArrow}>→</div>
                  <div className={styles.flowSplit}>
                    {[
                      { label: 'Platform Fee', value: exFee, color: '#6b7280' },
                      { label: 'Senior Tranche', value: exSenior, color: 'var(--accent)' },
                      { label: 'Liquidity Pool', value: exPool, color: '#a78bfa' },
                      { label: 'Community', value: exCommunity, color: '#34d399' },
                      { label: 'Merchant', value: exMerchant, color: '#60a5fa' },
                    ].map((row) => (
                      <div key={row.label} className={styles.flowSplitRow}>
                        <span className={styles.flowSplitDot} style={{ background: row.color }} />
                        <span className={styles.flowSplitLabel}>{row.label}</span>
                        <span className={styles.flowSplitValue}>${row.value.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Callout */}
                <div className={styles.repayCallout}>
                  <Zap size={14} />
                  <span>Repayment is automatic. The merchant cannot receive revenue without the vault being repaid first.</span>
                </div>

                {/* CTA */}
                <button
                  className={styles.tryLiveBtn}
                  onClick={() => navigate('/x402')}
                >
                  Try it Live — Simulate a Payment <ExternalLink size={13} />
                </button>
              </motion.div>
            )}


            {/* SECTION 3: WATERFALL BREAKDOWN */}
            {isRepaying && vault.waterfall && (
              <motion.div
                className={styles.card}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
                <h2 className={styles.cardTitle}>Repayment Waterfall</h2>
                <p className={styles.cardDesc}>How the {formatUSDC(vault.totalRepaid)} repaid so far has been distributed.</p>

                <div className={styles.waterfallBars}>
                  {[
                    {
                      label: 'Senior Tranche',
                      repaid: weiToNumber(vault.waterfall.seniorRepaid),
                      target: weiToNumber(vault.waterfall.seniorFunded),
                      color: 'var(--accent)',
                    },
                    {
                      label: 'Liquidity Pool',
                      repaid: weiToNumber(vault.waterfall.poolRepaid),
                      target: weiToNumber(vault.waterfall.poolFunded),
                      color: '#a78bfa',
                    },
                    {
                      label: 'Community Investors',
                      repaid: weiToNumber(vault.waterfall.communityRepaid),
                      target: weiToNumber(vault.waterfall.userFunded),
                      color: '#34d399',
                    },
                  ].map((tier, i) => {
                    const pct = tier.target > 0 ? Math.min((tier.repaid / tier.target) * 100, 100) : 0
                    return (
                      <div key={tier.label} className={styles.waterfallRow}>
                        <div className={styles.waterfallMeta}>
                          <span className={styles.waterfallLabel}>{tier.label}</span>
                          <span className={styles.waterfallAmount}>{formatUSDC(String(Math.round(tier.repaid * 1e6)))}</span>
                          <span className={styles.waterfallPct}>{pct.toFixed(0)}%</span>
                        </div>
                        <div className={styles.waterfallTrack}>
                          <motion.div
                            className={styles.waterfallFill}
                            style={{ background: tier.color }}
                            initial={{ width: 0 }}
                            whileInView={{ width: `${pct}%` }}
                            viewport={{ once: true }}
                            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.1 + i * 0.08 }}
                          />
                        </div>
                        <span className={styles.waterfallTarget}>
                          of {formatUSDC(String(Math.round(tier.target * 1e6)))} funded
                        </span>
                      </div>
                    )
                  })}
                </div>
              </motion.div>
            )}


            {/* SECTION 4: REPAYMENT HISTORY */}
            {(vault.state !== 'fundraising') && (
              <motion.div
                className={styles.card}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className={styles.cardTitleRow}>
                  <h2 className={styles.cardTitle}>Repayment History</h2>
                  {repayments.length > 0 && (
                    <span className={styles.cardBadge}>{repayments.length} payments</span>
                  )}
                </div>

                {repayments.length === 0 ? (
                  <div className={styles.emptySection}>
                    <Clock size={20} />
                    <span>No repayments recorded yet</span>
                  </div>
                ) : (
                  <>
                    <div className={styles.repayTable}>
                      <div className={styles.repayTableHeader}>
                        <span>Date</span>
                        <span>Amount</span>
                        <span>Source</span>
                        <span>Transaction</span>
                      </div>
                      {(showAllRepayments ? repayments : repayments.slice(0, 5)).map((evt) => {
                        const amt = getEventAmount(evt)
                        const from = getEventFrom(evt)
                        return (
                          <div key={evt.id} className={styles.repayTableRow}>
                            <span className={styles.repayDate}>
                              {new Date(evt.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                            <span className={styles.repayAmount}>
                              {amt > 0 ? formatUSDC(String(Math.round(amt * 1e6))) : '—'}
                            </span>
                            <span className={styles.repaySource}>
                              {from ? truncateAddress(from, 4) : <span className={styles.dimText}>{evt.eventType}</span>}
                            </span>
                            <a
                              href={`https://sepolia.basescan.org/tx/${evt.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.txLink}
                            >
                              {truncateAddress(evt.txHash, 4)} <ExternalLink size={11} />
                            </a>
                          </div>
                        )
                      })}
                    </div>
                    {repayments.length > 5 && (
                      <button
                        className={styles.showMoreBtn}
                        onClick={() => setShowAllRepayments(v => !v)}
                      >
                        {showAllRepayments ? 'Show less' : `Show all ${repayments.length} payments`}
                      </button>
                    )}
                  </>
                )}
              </motion.div>
            )}


            {/* SECTION 5: REPAYMENT CHART */}
            <ChartSection vault={vault} repayments={repayments} styles={styles} />


            {/* SECTION 6: TRANCHE STATUS */}
            <TrancheSection vault={vault} tranches={tranches} milestones={milestones} styles={styles} />


            {/* SECTION 7: INVESTOR POSITIONS */}
            {investors.length > 0 && (
              <motion.div
                className={styles.card}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className={styles.cardTitleRow}>
                  <h2 className={styles.cardTitle}>Investor Positions</h2>
                  <span className={styles.cardBadge}>{investors.length}</span>
                </div>
                <div className={styles.investorTable}>
                  <div className={styles.investorHeader}>
                    <span>Address</span>
                    <span>Invested</span>
                    <span>Claimable</span>
                    <span></span>
                  </div>
                  {investors.slice(0, 10).map((inv) => {
                    const claimable = weiToNumber(inv.claimable)
                    const isOwn = walletAddress?.toLowerCase() === inv.investor.toLowerCase()
                    return (
                      <div key={inv.investor} className={`${styles.investorRow} ${isOwn ? styles.ownRow : ''}`}>
                        <span className={styles.investorAddr}>
                          {truncateAddress(inv.investor, 5)}
                          {isOwn && <span className={styles.youBadge}>You</span>}
                        </span>
                        <span className={styles.investorBalance}>{formatUSDC(inv.balance)}</span>
                        <span className={styles.investorClaimable} style={{ color: claimable > 0 ? 'var(--color-success)' : 'var(--text-tertiary)' }}>
                          {claimable > 0 ? formatUSDC(inv.claimable) : '—'}
                        </span>
                        <span>
                          {claimable > 0 && isOwn && (
                            <span className={styles.claimNote}>claim in portfolio</span>
                          )}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </motion.div>
            )}

          </main>

          {/* SIDEBAR */}
          <aside className={styles.sidebar}>
            <div className={styles.sidebarInner}>

              {vault.state === 'fundraising' ? (
                /* Invest card */
                <div className={styles.sideCard}>
                  <h3 className={styles.sideCardTitle}>Invest in this Vault</h3>
                  <p className={styles.sideCardDesc}>Earn {vault.interestRate}% APY on your investment</p>
                  <div className={styles.inputGroup}>
                    <label className={styles.inputLabel}>Amount (USDC)</label>
                    <input
                      type="number"
                      className={styles.amountInput}
                      placeholder="Enter amount"
                      value={investAmount}
                      onChange={(e) => setInvestAmount(e.target.value)}
                      min="1"
                    />
                  </div>
                  {investAmount && parseFloat(investAmount) > 0 && (
                    <div className={styles.returnPreview}>
                      <span className={styles.returnLabel}>Expected returns</span>
                      <span className={styles.returnVal}>
                        {formatUSDC(String(Math.round(parseFloat(investAmount) * (1 + vault.interestRate / 100) * 1e6)))}
                      </span>
                    </div>
                  )}
                  <button
                    className={styles.investBtn}
                    onClick={handleInvest}
                    disabled={!walletAddress || !investAmount || parseFloat(investAmount) < 1 || investing}
                  >
                    {investing
                      ? <><Loader2 size={15} className={styles.spinner} /> Processing...</>
                      : !walletAddress
                      ? 'Connect Wallet to Invest'
                      : 'Invest Now'
                    }
                  </button>
                  <p className={styles.disclaimer}>Returns are not guaranteed.</p>
                </div>
              ) : vault.state === 'repaying' || vault.state === 'active' ? (
                /* Live status card */
                <div className={styles.sideCard}>
                  <div className={styles.liveStatus}>
                    <span className={styles.liveDot} />
                    <span className={styles.liveLabel}>Live Repayment</span>
                  </div>
                  <div className={styles.sideStats}>
                    <div className={styles.sideStat}>
                      <span className={styles.sideStatLabel}>Repaid to date</span>
                      <span className={styles.sideStatValue} style={{ color: 'var(--color-success)' }}>
                        {formatUSDC(vault.totalRepaid)}
                      </span>
                    </div>
                    <div className={styles.sideStat}>
                      <span className={styles.sideStatLabel}>Outstanding</span>
                      <span className={styles.sideStatValue}>
                        {formatUSDC(String(Math.round(outstanding * 1e6)))}
                      </span>
                    </div>
                    {maturityDate && (
                      <div className={styles.sideStat}>
                        <span className={styles.sideStatLabel}>Expected Maturity</span>
                        <span className={styles.sideStatValue}>{maturityStr}</span>
                      </div>
                    )}
                    {daysToMaturity !== null && (
                      <div className={styles.sideStat}>
                        <span className={styles.sideStatLabel}>Days remaining</span>
                        <span className={styles.sideStatValue} style={{ color: daysToMaturity < 30 ? 'var(--color-error)' : 'inherit' }}>
                          {daysToMaturity}d
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Mini repayment progress */}
                  <div className={styles.miniProgress}>
                    <motion.div
                      className={styles.miniProgressFill}
                      initial={{ width: 0 }}
                      animate={{ width: `${repayPct}%` }}
                      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.5 }}
                    />
                  </div>
                  <div className={styles.miniProgressLabel}>{repayPct.toFixed(1)}% complete</div>

                  <button
                    className={styles.tryBtn}
                    onClick={() => navigate('/x402')}
                  >
                    <Zap size={13} /> Simulate a Payment
                  </button>
                </div>
              ) : vault.state === 'completed' ? (
                <div className={styles.sideCard}>
                  <div className={styles.statusIcon}>
                    <CheckCircle size={28} style={{ color: 'var(--color-success)' }} />
                  </div>
                  <h3 className={styles.sideCardTitle}>Vault Completed</h3>
                  <p className={styles.sideCardDesc}>This vault has been fully repaid. All investors have received their returns.</p>
                  <div className={styles.sideStat}>
                    <span className={styles.sideStatLabel}>Total Repaid</span>
                    <span className={styles.sideStatValue} style={{ color: 'var(--color-success)' }}>
                      {formatUSDC(vault.totalRepaid)}
                    </span>
                  </div>
                </div>
              ) : vault.state === 'defaulted' ? (
                <div className={styles.sideCard}>
                  <div className={styles.statusIcon}>
                    <AlertTriangle size={28} style={{ color: 'var(--color-error)' }} />
                  </div>
                  <h3 className={styles.sideCardTitle}>Vault Defaulted</h3>
                  <p className={styles.sideCardDesc}>This vault has been marked as defaulted. Recovery procedures may be in progress.</p>
                </div>
              ) : (
                <div className={styles.sideCard}>
                  <div className={styles.statusIcon}>
                    <Clock size={28} style={{ color: 'var(--text-tertiary)' }} />
                  </div>
                  <h3 className={styles.sideCardTitle}>Vault {status.label}</h3>
                </div>
              )}

              {/* Vault address card */}
              <div className={styles.addrCard}>
                <span className={styles.addrLabel}>Vault Address</span>
                <span className={styles.addrValue}>{truncateAddress(vault.address, 8)}</span>
                <div className={styles.addrActions}>
                  <button
                    className={styles.addrBtn}
                    onClick={() => { navigator.clipboard.writeText(vault.address); toast.success('Copied!') }}
                  >
                    <Copy size={12} /> Copy
                  </button>
                  <a
                    href={`https://sepolia.basescan.org/address/${vault.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.addrBtn}
                  >
                    <ExternalLink size={12} /> BaseScan
                  </a>
                </div>
              </div>

            </div>
          </aside>

        </div>
      </div>
    </div>
  )
}

// Sub-component for chart section (isolates useMemo)
function ChartSection({
  vault,
  repayments,
  styles,
}: {
  vault: ApiVaultDetail
  repayments: ApiVaultEvent[]
  styles: Record<string, string>
}) {
  const chartData = useMemo(() => {
    if (!vault) return []
    const total = weiToNumber(vault.totalToRepay)
    const sorted = [...repayments]
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const startDate = vault.activatedAt
      ? new Date(vault.activatedAt)
      : sorted.length > 0 ? new Date(sorted[0].timestamp) : new Date()
    const points: { date: string; repaid: number; outstanding: number }[] = [
      { date: fmt(startDate), repaid: 0, outstanding: +total.toFixed(2) },
    ]
    let cum = 0
    for (const r of sorted) {
      const amt = getEventAmount(r)
      if (amt <= 0) continue
      cum += amt
      points.push({
        date: fmt(new Date(r.timestamp)),
        repaid: +Math.min(cum, total).toFixed(2),
        outstanding: +Math.max(total - cum, 0).toFixed(2),
      })
    }
    return points
  }, [vault, repayments])

  if (chartData.length <= 1) return null

  return (
    <motion.div
      className={styles.card}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <h2 className={styles.cardTitle}>Repayment Over Time</h2>
      <div className={styles.chartLegend}>
        <span className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: 'var(--accent)' }} /> Cumulative Repaid
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: 'rgba(255,255,255,0.3)' }} /> Outstanding
        </span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="date"
            tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}K`}
            tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--surface-3)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: 'var(--text-secondary)' }}
            formatter={(value: number | string | undefined) => [`$${Number(value ?? 0).toLocaleString()}`, '']}
          />
          <Line
            type="monotone"
            dataKey="repaid"
            name="Repaid"
            stroke="var(--accent)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: 'var(--accent)' }}
          />
          <Line
            type="monotone"
            dataKey="outstanding"
            name="Outstanding"
            stroke="rgba(255,255,255,0.3)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: 'rgba(255,255,255,0.4)' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </motion.div>
  )
}

// Sub-component for tranche section (isolates useMemo)
function TrancheSection({
  vault,
  tranches,
  milestones,
  styles,
}: {
  vault: ApiVaultDetail
  tranches: ApiTrancheResponse | null
  milestones: ApiMilestone[]
  styles: Record<string, string>
}) {
  const trancheItems = useMemo(() => {
    if (!tranches || !vault) return []
    const perTranche = weiToNumber(vault.targetAmount) / tranches.numTranches
    return tranches.tranches.map(t => ({
      ...t,
      amount: perTranche,
      milestone: milestones.find(m => m.trancheIndex === t.index) ?? null,
    }))
  }, [tranches, milestones, vault])

  if (trancheItems.length === 0) return null

  return (
    <motion.div
      className={styles.card}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <h2 className={styles.cardTitle}>Tranches</h2>
      <div className={styles.trancheList}>
        {trancheItems.map((t, i) => {
          const ms = t.milestone
          const isApproved = ms?.status === 'approved'
          const isSubmitted = ms?.status === 'submitted'
          return (
            <div
              key={t.index}
              className={`${styles.trancheCard} ${t.released ? styles.trancheReleased : ''}`}
            >
              <div className={styles.trancheNum}>#{i + 1}</div>
              <div className={styles.trancheInfo}>
                <span className={styles.trancheAmount}>{formatUSDC(String(Math.round(t.amount * 1e6)))}</span>
                <span className={styles.trancheStatus}>
                  {t.released ? (
                    <><CheckCircle size={13} className={styles.iconSuccess} /> Released</>
                  ) : (
                    <><Clock size={13} className={styles.iconMuted} /> Locked</>
                  )}
                </span>
              </div>
              {ms && (
                <div className={styles.trancheMilestone}>
                  {isApproved
                    ? <span className={styles.msApproved}><CheckCircle size={12} /> Gate Open</span>
                    : isSubmitted
                    ? <span className={styles.msReview}><Clock size={12} /> Under Review</span>
                    : <span className={styles.msPending}><Clock size={12} /> Milestone Pending</span>
                  }
                </div>
              )}
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}
