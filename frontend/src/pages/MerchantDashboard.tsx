import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { merchantApi, vaultsApi, oracleApi } from '../api/client'
import type { ApiMerchantStats, ApiVault, ApiOraclePayment, ApiSettlement, CreateVaultParams } from '../api/types'
import { formatUSDC, weiToNumber, truncateAddress, parseUSDCToWei, bpsToPercent } from '../lib/format'
import { useContractTx } from '../hooks/useContractTx'
import { useUSDCApproval } from '../hooks/useUSDCApproval'
import { CONTRACTS } from '../config/contracts'
import toast from 'react-hot-toast'
import { BentoGrid, BentoCard } from '../components/ui/BentoGrid'
import { WaterfallChart } from '../components/charts/WaterfallChart'
import { DollarSign, Star, CreditCard, Zap, ChevronRight, Plus, Activity, Wallet, Loader2, ArrowDownCircle, Clock, CheckCircle2, XCircle } from 'lucide-react'
import { STATUS_CONFIG } from '../lib/statusConfig'
import styles from './MerchantDashboard.module.css'

export default function MerchantDashboard() {
  const navigate = useNavigate()
  const { address: walletAddress } = useAccount()
  const { execute: executeTx } = useContractTx()

  const [merchant, setMerchant] = useState<ApiMerchantStats | null>(null)
  const [vaults, setVaults] = useState<ApiVault[]>([])
  const [payments, setPayments] = useState<ApiOraclePayment[]>([])
  const [loading, setLoading] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [isRegistered, setIsRegistered] = useState<boolean | null>(null)
  const [registering, setRegistering] = useState(false)

  // Repayment state
  const [settlement, setSettlement] = useState<ApiSettlement | null>(null)
  const [repayments, setRepayments] = useState<ApiOraclePayment[]>([])
  const [showRepayModal, setShowRepayModal] = useState(false)
  const [repayAmount, setRepayAmount] = useState('')
  const [repaying, setRepaying] = useState(false)
  const [repayStep, setRepayStep] = useState<'input' | 'approve' | 'submit' | 'success'>('input')
  const [repayTxHash, setRepayTxHash] = useState<string | null>(null)
  const { needsApproval, approve, isApproving } = useUSDCApproval(CONTRACTS.paymentRouter)

  // Create vault form state
  const [form, setForm] = useState({
    targetAmount: '',
    interestRate: '12',
    durationMonths: '6',
    numTranches: '3',
    lateFeeBps: '100',
    gracePeriodDays: '7',
  })

  type FormErrors = Partial<typeof form>
  const [formErrors, setFormErrors] = useState<FormErrors>({})

  // Fetch merchant data
  useEffect(() => {
    if (!walletAddress) {
      setMerchant(null)
      setVaults([])
      setPayments([])
      return
    }
    setLoading(true)
    Promise.all([
      merchantApi.stats(walletAddress)
        .then(r => { setMerchant(r.data ?? null); setIsRegistered(true) })
        .catch((err) => { setMerchant(null); setIsRegistered(err?.response?.status === 404 ? false : null) }),
      merchantApi.vaults(walletAddress).then(r => setVaults(r.data?.vaults ?? [])).catch(() => setVaults([])),
      oracleApi.payments({ limit: 10 }).then(r => setPayments(r.data?.payments ?? [])).catch(() => setPayments([])),
      merchantApi.settlement(walletAddress).then(r => setSettlement(r.data ?? null)).catch(() => setSettlement(null)),
      merchantApi.repayments(walletAddress).then(r => setRepayments(r.data?.repayments ?? [])).catch(() => setRepayments([])),
    ]).finally(() => setLoading(false))
  }, [walletAddress])

  const handleRegister = async () => {
    if (!walletAddress) return
    setRegistering(true)
    try {
      const { data: unsignedTx } = await merchantApi.register({ metadataURI: '' })
      await executeTx(unsignedTx)
      setIsRegistered(true)
      merchantApi.stats(walletAddress).then(r => setMerchant(r.data ?? null)).catch(() => {})
    } catch {
      // Error handled by toast
    } finally {
      setRegistering(false)
    }
  }

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

  const handleCreateVault = async () => {
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
        durationSeconds: Math.round(parseFloat(form.durationMonths) * 30 * 24 * 3600),
        numTranches: parseInt(form.numTranches),
        lateFeeBps: parseInt(form.lateFeeBps),
        gracePeriodSeconds: parseInt(form.gracePeriodDays) * 86400,
      }
      const { data } = await vaultsApi.create(params)
      if (data?.success) {
        toast.success('Vault created successfully!')
        setShowCreateModal(false)
        merchantApi.vaults(walletAddress).then(r => setVaults(r.data?.vaults ?? [])).catch(() => {})
      } else {
        toast.error('Vault creation failed')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Vault creation failed'
      toast.error(msg)
    } finally {
      setCreating(false)
    }
  }

  // Repayment calculations
  const repayAmountNum = parseFloat(repayAmount) || 0
  const rateBps = settlement?.repaymentRateBps ?? 3000
  const grossNeeded = rateBps > 0 ? repayAmountNum * 10000 / rateBps : 0
  const netReturned = grossNeeded - repayAmountNum
  const grossWei = rateBps > 0 ? parseUSDCToWei(grossNeeded.toFixed(6)) : '0'

  const handleRepay = async () => {
    if (!walletAddress || repayAmountNum <= 0) return
    setRepaying(true)
    try {
      // Step 1: Check if approval needed
      const grossBigInt = BigInt(grossWei)
      if (needsApproval(grossBigInt)) {
        setRepayStep('approve')
        const approved = await approve(grossBigInt)
        if (!approved) {
          setRepaying(false)
          setRepayStep('input')
          return
        }
      }

      // Step 2: Submit repayment
      setRepayStep('submit')
      const repayWei = parseUSDCToWei(repayAmountNum.toFixed(6))
      const { data } = await merchantApi.repay(walletAddress, { repaymentAmount: repayWei })
      setRepayTxHash(data.txHash)
      setRepayStep('success')
      toast.success('Repayment submitted successfully!')

      // Refresh data
      merchantApi.stats(walletAddress).then(r => setMerchant(r.data ?? null)).catch(() => {})
      merchantApi.vaults(walletAddress).then(r => setVaults(r.data?.vaults ?? [])).catch(() => {})
      merchantApi.repayments(walletAddress).then(r => setRepayments(r.data?.repayments ?? [])).catch(() => {})
      merchantApi.settlement(walletAddress).then(r => setSettlement(r.data ?? null)).catch(() => {})
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Repayment failed'
      toast.error(msg)
      setRepayStep('input')
    } finally {
      setRepaying(false)
    }
  }

  const openRepayModal = () => {
    setRepayAmount('')
    setRepayStep('input')
    setRepayTxHash(null)
    setShowRepayModal(true)
  }

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
          <p>You need to register your wallet as a merchant before creating vaults.</p>
          <button
            className={styles.createBtn}
            onClick={handleRegister}
            disabled={registering}
            style={{ marginTop: 16, padding: '10px 24px', fontSize: 14 }}
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
        <div className={styles.loadingState}>
          <Loader2 size={28} className={styles.spinner} />
          <span>Loading dashboard...</span>
        </div>
      </div>
    )
  }

  const creditScore = merchant?.creditTier ?? '—'
  const creditRating = merchant?.creditRating ?? 'Unknown'
  const totalBorrowed = merchant ? formatUSDC(merchant.totalBorrowed) : '$0'
  const totalRepaid = merchant ? formatUSDC(merchant.totalRepaid) : '$0'
  const activeLoanCount = merchant?.activeLoanCount ?? 0

  return (
    <div className={styles.page}>
      {/* Stats Row */}
      <BentoGrid columns={4} gap={14}>
        {[
          { icon: <Star size={16} />, label: 'Credit Tier', value: creditScore, sub: creditRating },
          { icon: <CreditCard size={16} />, label: 'Total Borrowed', value: totalBorrowed, sub: `${activeLoanCount} active loans` },
          { icon: <DollarSign size={16} />, label: 'Total Repaid', value: totalRepaid, sub: merchant?.creditValid ? 'Score valid' : 'Score expired' },
          { icon: <Zap size={16} />, label: 'Total Vaults', value: String(merchant?.totalVaults ?? 0), sub: 'All time' },
        ].map((stat, i) => (
          <BentoCard key={stat.label}>
            <motion.div
              className={styles.bentoStat}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: i * 0.08 }}
            >
              <div className={styles.bentoStatHeader}>
                <span className={styles.bentoStatIcon}>{stat.icon}</span>
                <span className={styles.bentoStatLabel}>{stat.label}</span>
              </div>
              <div className={styles.bentoStatValue}>{stat.value}</div>
              <div className={styles.bentoStatSub}>{stat.sub}</div>
            </motion.div>
          </BentoCard>
        ))}
      </BentoGrid>

      {/* Main Content */}
      <BentoGrid columns={3} gap={14}>
        {/* Live Oracle Payments */}
        <BentoCard colSpan="span 1" rowSpan="span 2">
          <div className={styles.bentoInner}>
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
              {payments.length === 0 ? (
                <div className={styles.emptyPayments}>No payments yet</div>
              ) : (
                payments.map((p) => (
                  <div key={p.id} className={styles.paymentRow}>
                    <div className={styles.paymentLeft}>
                      <span className={styles.paymentSource}>{truncateAddress(p.from)}</span>
                      <span className={styles.paymentVault}>{truncateAddress(p.vault)}</span>
                    </div>
                    <div className={styles.paymentRight}>
                      <span className={styles.paymentAmount}>{formatUSDC(p.amount)}</span>
                      <span className={styles.paymentTime}>{p.status}</span>
                    </div>
                    <ChevronRight size={14} className={styles.paymentChevron} />
                  </div>
                ))
              )}
            </div>
          </div>
        </BentoCard>

        {/* Waterfall Breakdown — show first vault's waterfall if active */}
        <BentoCard colSpan="span 2">
          <div className={styles.bentoInner}>
            {vaults.length > 0 && weiToNumber(vaults[0].totalRaised) > 0 ? (
              <WaterfallChart
                totalAmount={weiToNumber(vaults[0].totalRaised)}
                seniorPayment={0}
                poolPayment={0}
                userPayment={0}
              />
            ) : (
              <div className={styles.emptyChart}>
                <p>Create a vault to see waterfall distribution</p>
              </div>
            )}
          </div>
        </BentoCard>

        {/* Loan Repayment */}
        <BentoCard colSpan="span 2">
          <div className={styles.bentoInner}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitle}>
                <ArrowDownCircle size={15} className={styles.sectionIcon} />
                Loan Repayment
              </div>
              {settlement?.active && (
                <span className={styles.rateBadge}>
                  {bpsToPercent(rateBps)} to vault
                </span>
              )}
            </div>

            {vaults.filter(v => v.state === 'active' || v.state === 'repaying').length === 0 ? (
              <div className={styles.emptyPayments}>No active loans to repay</div>
            ) : (
              <div className={styles.repaymentSection}>
                {vaults.filter(v => v.state === 'active' || v.state === 'repaying').map((vault) => {
                  const outstanding = BigInt(vault.totalToRepay) - BigInt(vault.totalRepaid)
                  const repaidPct = BigInt(vault.totalToRepay) > 0n
                    ? Number(BigInt(vault.totalRepaid) * 100n / BigInt(vault.totalToRepay))
                    : 0
                  return (
                    <div key={vault.address} className={styles.repayVaultRow}>
                      <div className={styles.repayVaultInfo}>
                        <span className={styles.repayVaultAddr}>{truncateAddress(vault.address, 6)}</span>
                        <span className={styles.repayVaultOutstanding}>
                          {formatUSDC(outstanding.toString())} remaining
                        </span>
                      </div>
                      <div className={styles.repayProgressBar}>
                        <div
                          className={styles.repayProgressFill}
                          style={{ width: `${Math.min(repaidPct, 100)}%` }}
                        />
                      </div>
                      <div className={styles.repayProgressMeta}>
                        <span>{formatUSDC(vault.totalRepaid)} / {formatUSDC(vault.totalToRepay)}</span>
                        <span>{repaidPct}% repaid</span>
                      </div>
                    </div>
                  )
                })}
                <button className={styles.repayBtn} onClick={openRepayModal}>
                  Make Repayment
                </button>
              </div>
            )}
          </div>
        </BentoCard>

        {/* Repayment History */}
        <BentoCard colSpan="span 1">
          <div className={styles.bentoInner}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitle}>
                <Clock size={15} className={styles.sectionIcon} />
                Repayments
              </div>
            </div>
            <div className={styles.paymentList}>
              {repayments.length === 0 ? (
                <div className={styles.emptyPayments}>No repayments yet</div>
              ) : (
                repayments.slice(0, 8).map((r) => (
                  <div key={r.id} className={styles.paymentRow}>
                    <div className={styles.paymentLeft}>
                      <span className={styles.paymentSource}>{formatUSDC(r.amount)}</span>
                      <span className={styles.paymentVault}>{new Date(r.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className={styles.paymentRight}>
                      <span className={`${styles.statusBadge} ${styles[`status_${r.status}`] || ''}`}>
                        {r.status === 'confirmed' && <CheckCircle2 size={11} />}
                        {r.status === 'failed' && <XCircle size={11} />}
                        {(r.status === 'pending' || r.status === 'submitted') && <Loader2 size={11} className={styles.spinner} />}
                        {r.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </BentoCard>

        {/* Vault Management */}
        <BentoCard colSpan="span 2">
          <div className={styles.bentoInner}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitle}>Your Vaults</div>
              <button className={styles.createBtn} onClick={() => setShowCreateModal(true)}>
                <Plus size={13} />
                New Vault
              </button>
            </div>

            <div className={styles.vaultList}>
              {vaults.length === 0 ? (
                <div className={styles.emptyVaults}>
                  <p>No vaults yet. Create one to get started.</p>
                </div>
              ) : (
                vaults.map((vault) => {
                  const status = STATUS_CONFIG[vault.state] ?? STATUS_CONFIG.fundraising

                  return (
                    <div key={vault.address} className={styles.vaultItem}>
                      <div className={styles.vaultTop}>
                        <div>
                          <h4 className={styles.vaultName}>{truncateAddress(vault.address, 6)}</h4>
                          <div className={styles.vaultMeta}>
                            {vault.interestRate}% APY · {vault.durationMonths}mo · {vault.numTranches} tranches
                          </div>
                        </div>
                        <span
                          className={styles.vaultStatus}
                          style={{ color: status.color, borderColor: `${status.color}33`, background: `${status.color}12` }}
                        >
                          {status.label}
                        </span>
                      </div>

                      <div className={styles.vaultAmounts}>
                        <div className={styles.vaultAmt}>
                          <span className={styles.vaultAmtVal}>{formatUSDC(vault.totalRaised)}</span>
                          <span className={styles.vaultAmtLbl}>Raised</span>
                        </div>
                        {(vault.state === 'active' || vault.state === 'repaying') && (
                          <div className={styles.vaultAmt}>
                            <span className={styles.vaultAmtVal}>{formatUSDC(vault.totalRepaid)}</span>
                            <span className={styles.vaultAmtLbl}>Repaid</span>
                          </div>
                        )}
                      </div>

                      <div className={styles.vaultProgressBar}>
                        <div
                          className={styles.vaultProgressFill}
                          style={{
                            width: `${vault.percentFunded}%`,
                            background: status.color,
                          }}
                        />
                      </div>
                      <div className={styles.vaultProgressMeta}>
                        <span>{vault.percentFunded}% funded</span>
                      </div>

                      <div className={styles.vaultActions}>
                        <button className={styles.manageBtn} onClick={() => navigate(`/app/vaults/${vault.address}`)}>
                          Details
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </BentoCard>
      </BentoGrid>

      {/* Create Vault Modal */}
      {showCreateModal && (
        <div className={styles.modalOverlay} onClick={() => setShowCreateModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Create New Vault</h2>
              <button className={styles.modalClose} onClick={() => setShowCreateModal(false)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              {merchant && (merchant.creditTier === 'D' || !merchant.creditValid) && (
                <div className={styles.creditWarning}>
                  {merchant.creditTier === 'D'
                    ? '⚠ D-tier credit — vault may not raise funding. Improve your FairScale score first.'
                    : '⚠ Credit score expired — renew your score before creating a vault.'}
                </div>
              )}
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Target Amount (USDC)</label>
                  <input
                    className={`${styles.formInput} ${formErrors.targetAmount ? styles.inputError : ''}`}
                    type="number"
                    placeholder="50000"
                    value={form.targetAmount}
                    onChange={(e) => setForm(f => ({ ...f, targetAmount: e.target.value }))}
                  />
                  {formErrors.targetAmount && <span className={styles.fieldError}>{formErrors.targetAmount}</span>}
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Interest Rate (%)</label>
                  <input
                    className={`${styles.formInput} ${formErrors.interestRate ? styles.inputError : ''}`}
                    type="number"
                    placeholder="12"
                    value={form.interestRate}
                    onChange={(e) => setForm(f => ({ ...f, interestRate: e.target.value }))}
                  />
                  {formErrors.interestRate && <span className={styles.fieldError}>{formErrors.interestRate}</span>}
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Duration (Months)</label>
                  <input
                    className={`${styles.formInput} ${formErrors.durationMonths ? styles.inputError : ''}`}
                    type="number"
                    placeholder="6"
                    value={form.durationMonths}
                    onChange={(e) => setForm(f => ({ ...f, durationMonths: e.target.value }))}
                  />
                  {formErrors.durationMonths && <span className={styles.fieldError}>{formErrors.durationMonths}</span>}
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Number of Tranches</label>
                  <input
                    className={`${styles.formInput} ${formErrors.numTranches ? styles.inputError : ''}`}
                    type="number"
                    placeholder="3"
                    value={form.numTranches}
                    onChange={(e) => setForm(f => ({ ...f, numTranches: e.target.value }))}
                  />
                  {formErrors.numTranches && <span className={styles.fieldError}>{formErrors.numTranches}</span>}
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Late Fee (BPS)</label>
                  <input
                    className={`${styles.formInput} ${formErrors.lateFeeBps ? styles.inputError : ''}`}
                    type="number"
                    placeholder="100"
                    value={form.lateFeeBps}
                    onChange={(e) => setForm(f => ({ ...f, lateFeeBps: e.target.value }))}
                  />
                  {formErrors.lateFeeBps && <span className={styles.fieldError}>{formErrors.lateFeeBps}</span>}
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Grace Period (Days)</label>
                  <input
                    className={`${styles.formInput} ${formErrors.gracePeriodDays ? styles.inputError : ''}`}
                    type="number"
                    placeholder="7"
                    value={form.gracePeriodDays}
                    onChange={(e) => setForm(f => ({ ...f, gracePeriodDays: e.target.value }))}
                  />
                  {formErrors.gracePeriodDays && <span className={styles.fieldError}>{formErrors.gracePeriodDays}</span>}
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={() => setShowCreateModal(false)}>Cancel</button>
              <button
                className={styles.submitBtn}
                onClick={handleCreateVault}
                disabled={creating}
              >
                {creating ? <><Loader2 size={14} className={styles.spinner} /> Creating...</> : 'Create Vault'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Repay Modal */}
      {showRepayModal && (
        <div className={styles.modalOverlay} onClick={() => setShowRepayModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Make Repayment</h2>
              <button className={styles.modalClose} onClick={() => setShowRepayModal(false)}>&#x2715;</button>
            </div>
            <div className={styles.modalBody}>
              {repayStep === 'success' ? (
                <div className={styles.repaySuccess}>
                  <CheckCircle2 size={40} />
                  <h3>Repayment Submitted</h3>
                  <p>Your repayment of {formatUSDC(parseUSDCToWei(repayAmountNum.toFixed(6)))} has been processed.</p>
                  {repayTxHash && (
                    <a
                      href={`https://sepolia.basescan.org/tx/${repayTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.txLink}
                    >
                      View transaction
                    </a>
                  )}
                </div>
              ) : (
                <>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Repayment Amount (USDC to vault)</label>
                    <input
                      className={styles.formInput}
                      type="number"
                      placeholder="300"
                      value={repayAmount}
                      onChange={(e) => setRepayAmount(e.target.value)}
                      disabled={repayStep !== 'input'}
                    />
                  </div>

                  {repayAmountNum > 0 && (
                    <div className={styles.repayBreakdown}>
                      <div className={styles.repayBreakdownRow}>
                        <span>Gross USDC needed</span>
                        <span className={styles.repayBreakdownVal}>${grossNeeded.toFixed(2)}</span>
                      </div>
                      <div className={styles.repayBreakdownRow}>
                        <span>To vault ({bpsToPercent(rateBps)})</span>
                        <span className={styles.repayBreakdownVal}>${repayAmountNum.toFixed(2)}</span>
                      </div>
                      <div className={styles.repayBreakdownRow}>
                        <span>Returned to you</span>
                        <span className={styles.repayBreakdownVal}>${netReturned.toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  {repayStep === 'approve' && (
                    <div className={styles.repayStepIndicator}>
                      <Loader2 size={14} className={styles.spinner} />
                      <span>Step 1/2: Approve USDC spending...</span>
                    </div>
                  )}
                  {repayStep === 'submit' && (
                    <div className={styles.repayStepIndicator}>
                      <Loader2 size={14} className={styles.spinner} />
                      <span>Step 2/2: Submitting repayment...</span>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className={styles.modalFooter}>
              {repayStep === 'success' ? (
                <button className={styles.submitBtn} onClick={() => setShowRepayModal(false)}>
                  Done
                </button>
              ) : (
                <>
                  <button className={styles.cancelBtn} onClick={() => setShowRepayModal(false)}>Cancel</button>
                  <button
                    className={styles.submitBtn}
                    onClick={handleRepay}
                    disabled={repaying || isApproving || repayAmountNum <= 0}
                  >
                    {repaying || isApproving ? (
                      <><Loader2 size={14} className={styles.spinner} /> Processing...</>
                    ) : (
                      'Repay'
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
