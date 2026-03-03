import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { merchantApi, vaultsApi, oracleApi } from '../api/client'
import type { ApiMerchantStats, ApiVault, ApiOraclePayment, CreateVaultParams } from '../api/types'
import { formatUSDC, weiToNumber, truncateAddress, parseUSDCToWei } from '../lib/format'
import { useContractTx } from '../hooks/useContractTx'
import { BentoGrid, BentoCard } from '../components/ui/BentoGrid'
import { WaterfallChart } from '../components/charts/WaterfallChart'
import { DollarSign, Star, CreditCard, Zap, ChevronRight, Plus, Activity, Wallet, Loader2 } from 'lucide-react'
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

  // Create vault form state
  const [form, setForm] = useState({
    targetAmount: '',
    interestRate: '12',
    durationMonths: '6',
    numTranches: '3',
    lateFeeBps: '100',
    gracePeriodDays: '7',
  })

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
      merchantApi.stats(walletAddress).then(r => setMerchant(r.data ?? null)).catch(() => setMerchant(null)),
      merchantApi.vaults(walletAddress).then(r => setVaults(r.data?.vaults ?? [])).catch(() => setVaults([])),
      oracleApi.payments({ limit: 10 }).then(r => setPayments(r.data?.payments ?? [])).catch(() => setPayments([])),
    ]).finally(() => setLoading(false))
  }, [walletAddress])

  const handleCreateVault = async () => {
    if (!walletAddress || !form.targetAmount) return
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
      const { data: unsignedTx } = await vaultsApi.create(params)
      await executeTx(unsignedTx)
      setShowCreateModal(false)
      // Refresh vaults
      merchantApi.vaults(walletAddress).then(r => setVaults(r.data?.vaults ?? [])).catch(() => {})
    } catch {
      // Error handled by toast
    } finally {
      setCreating(false)
    }
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
        ].map((stat) => (
          <BentoCard key={stat.label}>
            <div className={styles.bentoStat}>
              <div className={styles.bentoStatHeader}>
                <span className={styles.bentoStatIcon}>{stat.icon}</span>
                <span className={styles.bentoStatLabel}>{stat.label}</span>
              </div>
              <div className={styles.bentoStatValue}>{stat.value}</div>
              <div className={styles.bentoStatSub}>{stat.sub}</div>
            </div>
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
                            background: vault.state === 'active' || vault.state === 'repaying' ? '#22c55e' : 'var(--gradient-primary)',
                          }}
                        />
                      </div>
                      <div className={styles.vaultProgressMeta}>
                        <span>{vault.percentFunded}% funded</span>
                      </div>

                      <div className={styles.vaultActions}>
                        <button className={styles.manageBtn} onClick={() => navigate(`/vaults/${vault.address}`)}>
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
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Target Amount (USDC)</label>
                  <input
                    className={styles.formInput}
                    type="number"
                    placeholder="50000"
                    value={form.targetAmount}
                    onChange={(e) => setForm(f => ({ ...f, targetAmount: e.target.value }))}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Interest Rate (%)</label>
                  <input
                    className={styles.formInput}
                    type="number"
                    placeholder="12"
                    value={form.interestRate}
                    onChange={(e) => setForm(f => ({ ...f, interestRate: e.target.value }))}
                  />
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Duration (Months)</label>
                  <input
                    className={styles.formInput}
                    type="number"
                    placeholder="6"
                    value={form.durationMonths}
                    onChange={(e) => setForm(f => ({ ...f, durationMonths: e.target.value }))}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Number of Tranches</label>
                  <input
                    className={styles.formInput}
                    type="number"
                    placeholder="3"
                    value={form.numTranches}
                    onChange={(e) => setForm(f => ({ ...f, numTranches: e.target.value }))}
                  />
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Late Fee (BPS)</label>
                  <input
                    className={styles.formInput}
                    type="number"
                    placeholder="100"
                    value={form.lateFeeBps}
                    onChange={(e) => setForm(f => ({ ...f, lateFeeBps: e.target.value }))}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Grace Period (Days)</label>
                  <input
                    className={styles.formInput}
                    type="number"
                    placeholder="7"
                    value={form.gracePeriodDays}
                    onChange={(e) => setForm(f => ({ ...f, gracePeriodDays: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={() => setShowCreateModal(false)}>Cancel</button>
              <button
                className={styles.submitBtn}
                onClick={handleCreateVault}
                disabled={creating || !form.targetAmount}
              >
                {creating ? <><Loader2 size={14} className={styles.spinner} /> Creating...</> : 'Create Vault'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
