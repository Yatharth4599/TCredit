import { useState } from 'react'
import { GlassCard } from '../components/ui/GlassCard'
import { StatWidget } from '../components/ui/StatWidget'
import { WaterfallChart } from '../components/charts/WaterfallChart'
import { DollarSign, Star, CreditCard, Zap, ChevronRight, Plus, Activity } from 'lucide-react'
import styles from './MerchantDashboard.module.css'

// Mock data — will be replaced with API hooks
const MERCHANT = {
  businessName: 'Dubai Electronics Store',
  creditScore: 785,
  creditRating: 'Excellent',
  totalBorrowed: 185000,
  activeLoanCount: 2,
  totalRepaid: 142500,
  onTimePayments: 100,
  availableCredit: 75000,
}

const VAULTS = [
  { id: '1', name: 'Q1 Inventory Financing', targetAmount: 50000, raisedAmount: 50000, repaidAmount: 28500, interestRate: 12, duration: 6, status: 'active', investorCount: 24, nextPayment: 'Mar 15, 2026' },
  { id: '2', name: 'Equipment Upgrade', targetAmount: 30000, raisedAmount: 15000, repaidAmount: 0, interestRate: 10, duration: 4, status: 'fundraising', investorCount: 12, nextPayment: null },
]

// Mock live x402 payment stream
const LIVE_PAYMENTS = [
  { id: 'p1', source: '9xPq...3kRt', amount: 420, vault: 'Q1 Inventory', split: { senior: 210, pool: 126, merchant: 84 }, ts: '08:22:11' },
  { id: 'p2', source: '7mBf...8sNw', amount: 680, vault: 'Q1 Inventory', split: { senior: 340, pool: 204, merchant: 136 }, ts: '08:19:03' },
  { id: 'p3', source: '2rKv...1zTp', amount: 150, vault: 'Q1 Inventory', split: { senior: 75, pool: 45, merchant: 30 }, ts: '08:14:57' },
]

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: { label: 'Active', color: '#22c55e' },
  fundraising: { label: 'Fundraising', color: '#FF6B35' },
  completed: { label: 'Completed', color: '#888' },
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n)
}

export default function MerchantDashboard() {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [activePayment, setActivePayment] = useState(LIVE_PAYMENTS[0])

  return (
    <div className={styles.page}>
      {/* Stats Row */}
      <div className={styles.statsRow}>
        <StatWidget
          label="Credit Score"
          value={MERCHANT.creditScore}
          sub={MERCHANT.creditRating}
          trend="up"
          trendValue="+12 pts"
          icon={<Star size={14} />}
        />
        <StatWidget
          label="Total Borrowed"
          value={fmt(MERCHANT.totalBorrowed)}
          sub={`${MERCHANT.activeLoanCount} active loans`}
          icon={<CreditCard size={14} />}
        />
        <StatWidget
          label="Total Repaid"
          value={fmt(MERCHANT.totalRepaid)}
          sub={`${MERCHANT.onTimePayments}% on-time`}
          trend="up"
          trendValue="100%"
          icon={<DollarSign size={14} />}
        />
        <StatWidget
          label="Available Credit"
          value={fmt(MERCHANT.availableCredit)}
          sub="Instant approval"
          icon={<Zap size={14} />}
        />
      </div>

      {/* Main Content */}
      <div className={styles.main}>
        {/* Left: Live Payment Monitor */}
        <div className={styles.leftCol}>
          <GlassCard>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitle}>
                <Activity size={15} className={styles.sectionIcon} />
                Live x402 Payments
              </div>
              <span className={styles.liveBadge}>
                <span className={styles.liveDot} />
                Live
              </span>
            </div>

            <div className={styles.paymentList}>
              {LIVE_PAYMENTS.map((p) => (
                <div
                  key={p.id}
                  className={`${styles.paymentRow} ${activePayment.id === p.id ? styles.paymentRowActive : ''}`}
                  onClick={() => setActivePayment(p)}
                >
                  <div className={styles.paymentLeft}>
                    <span className={styles.paymentSource}>{p.source}</span>
                    <span className={styles.paymentVault}>{p.vault}</span>
                  </div>
                  <div className={styles.paymentRight}>
                    <span className={styles.paymentAmount}>{fmt(p.amount)}</span>
                    <span className={styles.paymentTime}>{p.ts}</span>
                  </div>
                  <ChevronRight size={14} className={styles.paymentChevron} />
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Waterfall breakdown for selected payment */}
          <GlassCard variant="highlight">
            <WaterfallChart
              totalAmount={activePayment.amount}
              seniorPayment={activePayment.split.senior}
              poolPayment={activePayment.split.pool}
              userPayment={activePayment.split.merchant}
            />
          </GlassCard>
        </div>

        {/* Right: Vault Management */}
        <div className={styles.rightCol}>
          <GlassCard>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitle}>Your Vaults</div>
              <button className={styles.createBtn} onClick={() => setShowCreateModal(true)}>
                <Plus size={13} />
                New Vault
              </button>
            </div>

            <div className={styles.vaultList}>
              {VAULTS.map((vault) => {
                const status = STATUS_CONFIG[vault.status] ?? STATUS_CONFIG.active
                const fundProgress = (vault.raisedAmount / vault.targetAmount) * 100
                const repayProgress = vault.status === 'active'
                  ? (vault.repaidAmount / (vault.targetAmount * 1.12)) * 100
                  : 0

                return (
                  <div key={vault.id} className={styles.vaultItem}>
                    <div className={styles.vaultTop}>
                      <div>
                        <h4 className={styles.vaultName}>{vault.name}</h4>
                        <div className={styles.vaultMeta}>
                          {vault.interestRate}% APY · {vault.duration}mo · {vault.investorCount} investors
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
                        <span className={styles.vaultAmtVal}>{fmt(vault.raisedAmount)}</span>
                        <span className={styles.vaultAmtLbl}>Raised</span>
                      </div>
                      {vault.status === 'active' && (
                        <div className={styles.vaultAmt}>
                          <span className={styles.vaultAmtVal}>{fmt(vault.repaidAmount)}</span>
                          <span className={styles.vaultAmtLbl}>Repaid</span>
                        </div>
                      )}
                    </div>

                    <div className={styles.vaultProgressBar}>
                      <div
                        className={styles.vaultProgressFill}
                        style={{
                          width: `${vault.status === 'active' ? repayProgress : fundProgress}%`,
                          background: vault.status === 'active' ? '#22c55e' : 'var(--gradient-primary)',
                        }}
                      />
                    </div>
                    <div className={styles.vaultProgressMeta}>
                      {vault.status === 'active' ? (
                        <span>Next payment: {vault.nextPayment}</span>
                      ) : (
                        <span>{fundProgress.toFixed(0)}% funded</span>
                      )}
                    </div>

                    <div className={styles.vaultActions}>
                      {vault.status === 'active' && (
                        <button className={styles.repayBtn}>Make Payment</button>
                      )}
                      <button className={styles.manageBtn}>
                        {vault.status === 'fundraising' ? 'Edit' : 'Details'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Create Vault Modal */}
      {showCreateModal && (
        <div className={styles.modalOverlay} onClick={() => setShowCreateModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Create New Vault</h2>
              <button className={styles.modalClose} onClick={() => setShowCreateModal(false)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <label className={styles.formLabel}>Vault Name</label>
              <input className={styles.formInput} type="text" placeholder="e.g. Q2 Inventory Expansion" />
              <label className={styles.formLabel}>Purpose</label>
              <textarea className={styles.formInput} placeholder="Describe what the funds will be used for..." rows={3} />
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Target (USDC)</label>
                  <input className={styles.formInput} type="number" placeholder="50000" />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Term (Months)</label>
                  <input className={styles.formInput} type="number" placeholder="6" />
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={() => setShowCreateModal(false)}>Cancel</button>
              <button className={styles.submitBtn}>Create Vault</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
