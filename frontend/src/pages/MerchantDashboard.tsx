import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { merchantApi, vaultsApi, oracleApi } from '../api/client'
import type { ApiMerchantStats, ApiVault, ApiOraclePayment, CreateVaultParams } from '../api/types'
import { formatUSDC, weiToNumber, truncateAddress, parseUSDCToWei } from '../lib/format'
import { useContractTx } from '../hooks/useContractTx'
import { WaterfallChart } from '../components/charts/WaterfallChart'
import { mockMerchantStats, mockVaults, mockPayments } from '../lib/mockData'
import { StatRowSkeleton } from '../components/ui/StatRowSkeleton'
import { Star, ChevronRight, ChevronDown, Activity, Wallet, Loader2, Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import { STATUS_CONFIG } from '../lib/statusConfig'
import styles from './MerchantDashboard.module.css'

// ─── Credit tier parameters ───────────────────────────────────────────────────
// Based on a demo estimated monthly revenue of $120,000
const MONTHLY_REVENUE_ESTIMATE = 120_000

interface TierParams {
  limitMultiplier: number  // × monthly revenue → credit limit
  apy: number              // annual percentage rate
  maxMonths: number        // maximum loan term
  label: string
}

const TIER_PARAMS: Record<string, TierParams> = {
  A: { limitMultiplier: 1.5, apy: 12, maxMonths: 12, label: 'Full access, best rates' },
  B: { limitMultiplier: 1.0, apy: 14, maxMonths: 9,  label: 'Full access' },
  C: { limitMultiplier: 0.5, apy: 16, maxMonths: 6,  label: 'Full access' },
  D: { limitMultiplier: 0,   apy: 20, maxMonths: 0,  label: 'Blocked — improve score' },
}

export default function MerchantDashboard() {
  const navigate = useNavigate()
  const { address: walletAddress } = useAccount()
  const { execute: executeTx, txHash, txUrl, status: txStatus } = useContractTx()

  const [merchant, setMerchant] = useState<ApiMerchantStats | null>(null)
  const [vaults, setVaults] = useState<ApiVault[]>([])
  const [payments, setPayments] = useState<ApiOraclePayment[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [isRegistered, setIsRegistered] = useState<boolean | null>(null)
  const [registering, setRegistering] = useState(false)

  // Quick Apply state
  const [quickAmount, setQuickAmount] = useState(50_000)
  const [quickMonths, setQuickMonths] = useState(6)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Advanced form state (power-user customisation)
  const [form, setForm] = useState({
    targetAmount: '50000',
    interestRate: '12',
    durationMonths: '6',
    numTranches: '2',
    lateFeeBps: '100',
    gracePeriodDays: '7',
  })

  type FormErrors = Partial<typeof form>
  const [formErrors, setFormErrors] = useState<FormErrors>({})

  useEffect(() => {
    if (!walletAddress) {
      setMerchant(null); setVaults([]); setPayments([])
      return
    }
    setLoading(true)
    Promise.all([
      merchantApi.stats(walletAddress)
        .then(r => { setMerchant(r.data ?? null); setIsRegistered(true) })
        .catch((err) => {
          setMerchant(null)
          setIsRegistered(err?.response?.status === 404 ? false : null)
        }),
      merchantApi.vaults(walletAddress).then(r => setVaults(r.data?.vaults ?? [])).catch(() => setVaults([])),
      oracleApi.payments({ limit: 10 }).then(r => setPayments(r.data?.payments ?? [])).catch(() => setPayments([])),
    ]).finally(() => setLoading(false))
  }, [walletAddress])

  // ── Credit limit derived from tier ──────────────────────────────────────────
  const displayMerchant = merchant ?? (import.meta.env.DEV && walletAddress ? mockMerchantStats : null)
  const displayVaults = vaults.length > 0 ? vaults : (import.meta.env.DEV && walletAddress ? mockVaults.slice(0, 3) : [])
  const displayPayments = payments.length > 0 ? payments : (import.meta.env.DEV && walletAddress ? mockPayments : [])

  const tier = displayMerchant?.creditTier ?? 'D'
  const tierParams = TIER_PARAMS[tier] ?? TIER_PARAMS.D
  const creditLimit = Math.round(MONTHLY_REVENUE_ESTIMATE * tierParams.limitMultiplier / 1000) * 1000

  const clampedAmount = Math.min(quickAmount, creditLimit)
  const monthlyRepayment = useMemo(() => {
    const principal = clampedAmount / quickMonths
    const interest = (clampedAmount * tierParams.apy) / 100 / 12
    return Math.round(principal + interest)
  }, [clampedAmount, quickMonths, tierParams.apy])

  const totalToRepay = useMemo(() =>
    Math.round(clampedAmount + (clampedAmount * tierParams.apy / 100) * (quickMonths / 12)),
    [clampedAmount, quickMonths, tierParams.apy]
  )

  const availableTerms = [3, 6, 9, 12].filter(m => m <= tierParams.maxMonths)
  const hasVault = displayVaults.length > 0
  const isEligible = isRegistered && displayMerchant?.creditValid && tier !== 'D'

  // ── Register ────────────────────────────────────────────────────────────────
  const handleRegister = async () => {
    if (!walletAddress) return
    setRegistering(true)
    try {
      const { data: unsignedTx } = await merchantApi.register({ metadataURI: 'ipfs://krexa' })
      const hash = await executeTx(unsignedTx)
      if (hash) {
        setIsRegistered(true)
        merchantApi.stats(walletAddress).then(r => setMerchant(r.data ?? null)).catch(() => {})
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setRegistering(false)
    }
  }

  // ── Quick Apply (one-click) ──────────────────────────────────────────────────
  const handleQuickApply = async () => {
    if (!walletAddress) return
    setCreating(true)
    try {
      const params: CreateVaultParams = {
        agent: walletAddress,
        targetAmount: parseUSDCToWei(String(clampedAmount)),
        interestRateBps: tierParams.apy * 100,
        durationSeconds: Math.round(quickMonths * 30.44 * 86400),
        numTranches: 2,
        lateFeeBps: 100,
        gracePeriodSeconds: 7 * 86400,
      }
      const { data: result } = await vaultsApi.create(params)
      if (result.txHash) {
        toast.success('Vault created! It will appear shortly.')
        setTimeout(() => {
          if (walletAddress)
            merchantApi.vaults(walletAddress).then(r => setVaults(r.data?.vaults ?? [])).catch(() => {})
        }, 6000)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create vault')
    } finally {
      setCreating(false)
    }
  }

  // ── Advanced form submit ─────────────────────────────────────────────────────
  const validateForm = (): FormErrors => {
    const errors: FormErrors = {}
    const amount = parseFloat(form.targetAmount)
    if (!form.targetAmount || isNaN(amount) || amount < 1000) errors.targetAmount = 'Minimum $1,000 USDC'
    const rate = parseFloat(form.interestRate)
    if (isNaN(rate) || rate < 1 || rate > 50) errors.interestRate = 'Must be 1%–50%'
    const months = parseInt(form.durationMonths)
    if (isNaN(months) || months < 1 || months > 24) errors.durationMonths = 'Must be 1–24 months'
    const tranches = parseInt(form.numTranches)
    if (isNaN(tranches) || tranches < 1 || tranches > 12) errors.numTranches = 'Must be 1–12'
    const lateFee = parseInt(form.lateFeeBps)
    if (isNaN(lateFee) || lateFee < 0 || lateFee > 1000) errors.lateFeeBps = 'Must be 0–1000 BPS'
    const grace = parseInt(form.gracePeriodDays)
    if (isNaN(grace) || grace < 1 || grace > 30) errors.gracePeriodDays = 'Must be 1–30 days'
    return errors
  }

  const handleCreateCustomVault = async () => {
    if (!walletAddress) return
    const errors = validateForm()
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return }
    setFormErrors({})
    setCreating(true)
    try {
      const params: CreateVaultParams = {
        agent: walletAddress,
        targetAmount: parseUSDCToWei(form.targetAmount),
        interestRateBps: Math.round(parseFloat(form.interestRate) * 100),
        durationSeconds: Math.round(parseFloat(form.durationMonths) * 30.44 * 86400),
        numTranches: parseInt(form.numTranches),
        lateFeeBps: parseInt(form.lateFeeBps),
        gracePeriodSeconds: parseInt(form.gracePeriodDays) * 86400,
      }
      const { data: result } = await vaultsApi.create(params)
      if (result.txHash) {
        toast.success('Vault submitted!')
        setShowAdvanced(false)
        setTimeout(() => {
          if (walletAddress)
            merchantApi.vaults(walletAddress).then(r => setVaults(r.data?.vaults ?? [])).catch(() => {})
        }, 6000)
      }
    } catch {
      // error handled by toast
    } finally {
      setCreating(false)
    }
  }

  // ── Early returns ────────────────────────────────────────────────────────────
  if (!walletAddress) {
    return (
      <div className={styles.page}>
        <div className={styles.connectPrompt}>
          <Wallet size={48} strokeWidth={1} />
          <h2>Connect Your Wallet</h2>
          <p>Connect your wallet to access the merchant dashboard</p>
        </div>
      </div>
    )
  }

  if (!loading && isRegistered === false) {
    return (
      <div className={styles.page}>
        <div className={styles.connectPrompt}>
          <Star size={48} strokeWidth={1} />
          <h2>Not Registered as Merchant</h2>
          <p>Register your wallet to start accessing working capital.</p>
          <button
            className={styles.createBtn}
            onClick={handleRegister}
            disabled={registering}
            style={{ marginTop: 16, padding: '12px 28px', fontSize: 14 }}
          >
            {registering ? <><Loader2 size={14} className={styles.spinner} /> Registering...</> : 'Register as Merchant'}
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.hero}>
          <div className={styles.heroInner}>
            <div className={styles.heroLabel}>Merchant Dashboard</div>
            <div style={{ height: 48 }} />
          </div>
        </div>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 24px' }}>
          <StatRowSkeleton count={4} />
        </div>
      </div>
    )
  }

  const creditScore = displayMerchant?.creditTier ?? '—'
  const creditRating = displayMerchant?.creditRating ?? 'Unknown'
  const totalBorrowed = displayMerchant ? formatUSDC(displayMerchant.totalBorrowed) : '$0'
  const totalRepaid = displayMerchant ? formatUSDC(displayMerchant.totalRepaid) : '$0'
  const activeLoanCount = displayMerchant?.activeLoanCount ?? 0

  return (
    <div className={styles.page}>
      {/* Hero Band */}
      <div className={styles.hero}>
        <motion.div
          className={styles.heroInner}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className={styles.heroLabel}>Merchant Dashboard</div>
          <h1 className={styles.heroTitle}>Credit Tier: {creditScore}</h1>
          <div className={styles.heroSub}>{creditRating} Rating</div>
        </motion.div>
      </div>

      {/* Stats Row */}
      <div className={styles.statsRow}>
        {[
          { value: totalBorrowed, label: 'Total Borrowed', sub: `${activeLoanCount} active loans` },
          { value: totalRepaid, label: 'Total Repaid', sub: displayMerchant?.creditValid ? 'Score valid' : 'Score expired' },
          { value: String(activeLoanCount), label: 'Active Loans', sub: 'Currently running' },
          { value: String(displayMerchant?.totalVaults ?? 0), label: 'Total Vaults', sub: 'All time' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            className={styles.statCard}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: i * 0.06 }}
          >
            <div className={styles.statValue}>{stat.value}</div>
            <div className={styles.statLabel}>{stat.label}</div>
            <div className={styles.statSub}>{stat.sub}</div>
          </motion.div>
        ))}
      </div>

      {/* White Section */}
      <div className={styles.body}>

        {/* ── Quick Apply Card (shown when no vault yet) ── */}
        {!hasVault && (
          <motion.div
            className={styles.quickApply}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Header */}
            <div className={styles.qaHeader}>
              <div>
                <div className={styles.qaEyebrow}>Working Capital Available</div>
                <div className={styles.qaTitle}>
                  {isEligible
                    ? `Credit Limit: $${creditLimit.toLocaleString()}`
                    : tier === 'D' ? 'Credit Blocked — Tier D' : 'Credit Score Expired'}
                </div>
                <div className={styles.qaMeta}>
                  Based on Tier {tier} credit score and estimated revenue ($120K/month)
                  {isEligible && ` · ${tierParams.apy}% APY · Up to ${tierParams.maxMonths} months`}
                </div>
              </div>
              <div className={styles.qaTierBadge} data-tier={tier}>
                Tier {tier}
              </div>
            </div>

            {isEligible ? (
              <>
                {/* Controls */}
                <div className={styles.qaControls}>
                  {/* Amount Slider */}
                  <div className={styles.qaField}>
                    <div className={styles.qaFieldHeader}>
                      <span className={styles.qaFieldLabel}>Loan Amount</span>
                      <span className={styles.qaAmountVal}>${quickAmount.toLocaleString()}</span>
                    </div>
                    <input
                      type="range"
                      className={styles.qaSlider}
                      min={10_000}
                      max={creditLimit}
                      step={5_000}
                      value={quickAmount}
                      onChange={e => setQuickAmount(Number(e.target.value))}
                    />
                    <div className={styles.qaSliderBounds}>
                      <span>$10,000</span>
                      <span>${creditLimit.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Term Pills */}
                  <div className={styles.qaField}>
                    <span className={styles.qaFieldLabel}>Term</span>
                    <div className={styles.qaTermPills}>
                      {availableTerms.map(m => (
                        <button
                          key={m}
                          className={`${styles.qaTermPill} ${quickMonths === m ? styles.qaTermActive : ''}`}
                          onClick={() => setQuickMonths(m)}
                        >
                          {m} mo
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Summary */}
                  <div className={styles.qaSummary}>
                    <div className={styles.qaSummaryRow}>
                      <span>Monthly repayment</span>
                      <span className={styles.qaSummaryVal}>~${monthlyRepayment.toLocaleString()}</span>
                    </div>
                    <div className={styles.qaSummaryRow}>
                      <span>Total to repay</span>
                      <span className={styles.qaSummaryVal}>${totalToRepay.toLocaleString()}</span>
                    </div>
                    <div className={styles.qaSummaryRow}>
                      <span>Payment split</span>
                      <span className={styles.qaSummaryVal}>20% of incoming x402 payments</span>
                    </div>
                  </div>
                </div>

                {/* CTA */}
                <div className={styles.qaFooter}>
                  <button
                    className={styles.qaCta}
                    onClick={handleQuickApply}
                    disabled={creating || txStatus === 'signing' || txStatus === 'confirming'}
                  >
                    {creating ? (
                      <><Loader2 size={16} className={styles.spinner} /> Processing...</>
                    ) : (
                      <><Zap size={16} /> Get Working Capital</>
                    )}
                  </button>

                  {txHash && txUrl && (
                    <a className={styles.qaExplorerLink} href={txUrl} target="_blank" rel="noopener noreferrer">
                      View on BaseScan ↗
                    </a>
                  )}

                  <button
                    className={styles.advancedToggle}
                    onClick={() => setShowAdvanced(v => !v)}
                  >
                    Advanced Options
                    <ChevronDown
                      size={14}
                      className={`${styles.advancedChevron} ${showAdvanced ? styles.advancedChevronOpen : ''}`}
                    />
                  </button>
                </div>

                {/* Advanced Options (collapsible) */}
                <AnimatePresence>
                  {showAdvanced && (
                    <motion.div
                      className={styles.advancedSection}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div className={styles.advancedInner}>
                        <div className={styles.advancedTitle}>Custom Terms</div>

                        {displayMerchant && (displayMerchant.creditTier === 'D' || !displayMerchant.creditValid) && (
                          <div className={styles.creditWarning}>
                            {displayMerchant.creditTier === 'D'
                              ? 'Tier D — vault creation blocked. Improve your credit score first.'
                              : 'Credit score expired. Renew your score before creating a vault.'}
                          </div>
                        )}

                        <div className={styles.formRow}>
                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Target Amount (USDC)</label>
                            <input
                              className={`${styles.formInput} ${formErrors.targetAmount ? styles.inputError : ''}`}
                              type="number" placeholder="50000"
                              value={form.targetAmount}
                              onChange={e => setForm(f => ({ ...f, targetAmount: e.target.value }))}
                            />
                            {formErrors.targetAmount && <span className={styles.fieldError}>{formErrors.targetAmount}</span>}
                          </div>
                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Interest Rate (%)</label>
                            <input
                              className={`${styles.formInput} ${formErrors.interestRate ? styles.inputError : ''}`}
                              type="number" placeholder="12"
                              value={form.interestRate}
                              onChange={e => setForm(f => ({ ...f, interestRate: e.target.value }))}
                            />
                            {formErrors.interestRate && <span className={styles.fieldError}>{formErrors.interestRate}</span>}
                          </div>
                        </div>
                        <div className={styles.formRow}>
                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Duration (Months)</label>
                            <input
                              className={`${styles.formInput} ${formErrors.durationMonths ? styles.inputError : ''}`}
                              type="number" placeholder="6"
                              value={form.durationMonths}
                              onChange={e => setForm(f => ({ ...f, durationMonths: e.target.value }))}
                            />
                            {formErrors.durationMonths && <span className={styles.fieldError}>{formErrors.durationMonths}</span>}
                          </div>
                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Number of Tranches</label>
                            <input
                              className={`${styles.formInput} ${formErrors.numTranches ? styles.inputError : ''}`}
                              type="number" placeholder="2"
                              value={form.numTranches}
                              onChange={e => setForm(f => ({ ...f, numTranches: e.target.value }))}
                            />
                            {formErrors.numTranches && <span className={styles.fieldError}>{formErrors.numTranches}</span>}
                          </div>
                        </div>
                        <div className={styles.formRow}>
                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Late Fee (BPS)</label>
                            <input
                              className={`${styles.formInput} ${formErrors.lateFeeBps ? styles.inputError : ''}`}
                              type="number" placeholder="100"
                              value={form.lateFeeBps}
                              onChange={e => setForm(f => ({ ...f, lateFeeBps: e.target.value }))}
                            />
                            {formErrors.lateFeeBps && <span className={styles.fieldError}>{formErrors.lateFeeBps}</span>}
                          </div>
                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Grace Period (Days)</label>
                            <input
                              className={`${styles.formInput} ${formErrors.gracePeriodDays ? styles.inputError : ''}`}
                              type="number" placeholder="7"
                              value={form.gracePeriodDays}
                              onChange={e => setForm(f => ({ ...f, gracePeriodDays: e.target.value }))}
                            />
                            {formErrors.gracePeriodDays && <span className={styles.fieldError}>{formErrors.gracePeriodDays}</span>}
                          </div>
                        </div>

                        <div className={styles.advancedActions}>
                          <button
                            className={styles.submitBtn}
                            onClick={handleCreateCustomVault}
                            disabled={creating || displayMerchant?.creditTier === 'D'}
                          >
                            {creating
                              ? <><Loader2 size={14} className={styles.spinner} /> Creating...</>
                              : 'Create with Custom Terms'}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            ) : (
              <div className={styles.qaBlocked}>
                {tier === 'D'
                  ? 'Your credit tier (D) does not qualify for working capital. Improve your on-chain payment history to unlock access.'
                  : 'Your credit score has expired. Contact your account manager to renew it.'}
              </div>
            )}
          </motion.div>
        )}

        {/* ── Content Panels ── */}
        <div className={styles.contentGrid}>
          {/* Oracle Payments */}
          <motion.div
            className={styles.panel}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          >
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitle}>
                <Activity size={15} className={styles.sectionIcon} />
                Oracle Payments
              </div>
              <span className={styles.liveBadge}>
                <span className={styles.liveDot} />
                Live
              </span>
            </div>

            <div className={styles.paymentList}>
              {displayPayments.length === 0 ? (
                <div className={styles.emptyPayments}>No payments yet</div>
              ) : (
                displayPayments.map((p, i) => (
                  <motion.div
                    key={p.id}
                    className={styles.paymentRow}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: i * 0.04 }}
                  >
                    <div className={styles.paymentLeft}>
                      <span className={styles.paymentSource}>{truncateAddress(p.from)}</span>
                      <span className={styles.paymentVault}>{truncateAddress(p.vault)}</span>
                    </div>
                    <div className={styles.paymentRight}>
                      <span className={styles.paymentAmount}>{formatUSDC(p.amount)}</span>
                      <span className={styles.paymentTime}>{p.status}</span>
                    </div>
                    <ChevronRight size={14} className={styles.paymentChevron} />
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>

          {/* Vault Management */}
          <motion.div
            className={styles.panel}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
          >
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitle}>Your Vaults</div>
            </div>

            {displayVaults.length > 0 && weiToNumber(displayVaults[0].totalRaised) > 0 && (
              <div style={{ marginBottom: 20 }}>
                <WaterfallChart
                  totalAmount={weiToNumber(displayVaults[0].totalRaised)}
                  seniorPayment={0}
                  poolPayment={0}
                  userPayment={0}
                />
              </div>
            )}

            <div className={styles.vaultList}>
              {displayVaults.length === 0 ? (
                <div className={styles.emptyVaults}>
                  <p>No vaults yet. Use the Quick Apply above to get started.</p>
                </div>
              ) : (
                displayVaults.map((vault, i) => {
                  const status = STATUS_CONFIG[vault.state] ?? STATUS_CONFIG.fundraising
                  return (
                    <motion.div
                      key={vault.address}
                      className={styles.vaultItem}
                      initial={{ opacity: 0, y: 12 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: i * 0.06 }}
                    >
                      <div className={styles.vaultTop}>
                        <div>
                          <h4 className={styles.vaultName}>{truncateAddress(vault.address, 6)}</h4>
                          <div className={styles.vaultMeta}>
                            {vault.interestRate}% APY · {vault.durationMonths}mo · {vault.numTranches} tranches
                          </div>
                        </div>
                        <span
                          className={styles.vaultStatus}
                          style={{ color: status.color, borderColor: `${status.color}33`, background: `${status.color}18` }}
                        >
                          {status.label}
                        </span>
                      </div>

                      <div className={styles.vaultAmounts}>
                        <div>
                          <span className={styles.vaultAmtVal}>{formatUSDC(vault.totalRaised)}</span>
                          <span className={styles.vaultAmtLbl}>Raised</span>
                        </div>
                        {(vault.state === 'active' || vault.state === 'repaying') && (
                          <div>
                            <span className={styles.vaultAmtVal}>{formatUSDC(vault.totalRepaid)}</span>
                            <span className={styles.vaultAmtLbl}>Repaid</span>
                          </div>
                        )}
                      </div>

                      <div className={styles.vaultProgressBar}>
                        <motion.div
                          className={styles.vaultProgressFill}
                          initial={{ width: 0 }}
                          whileInView={{ width: `${vault.percentFunded}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
                        />
                      </div>
                      <div className={styles.vaultProgressMeta}>
                        <span>{vault.percentFunded}% funded</span>
                      </div>

                      <div className={styles.vaultActions}>
                        <button
                          className={styles.copyBtn}
                          onClick={() => { navigator.clipboard.writeText(vault.address); toast.success('Copied!') }}
                          title={vault.address}
                        >
                          Copy Address
                        </button>
                        <button className={styles.manageBtn} onClick={() => navigate(`/app/vaults/${vault.address}`)}>
                          Details
                        </button>
                      </div>
                    </motion.div>
                  )
                })
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
