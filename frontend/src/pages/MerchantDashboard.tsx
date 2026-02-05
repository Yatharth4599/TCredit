import { useState, useEffect } from 'react'
import styles from './MerchantDashboard.module.css'

// Mock merchant data
const merchantData = {
    businessName: 'Dubai Electronics Store',
    creditScore: 785,
    creditRating: 'Excellent',
    totalBorrowed: 185000,
    activeLoanCount: 2,
    totalRepaid: 142500,
    onTimePayments: 100,
    accountAge: 8,
    availableCredit: 75000,
}

const merchantVaults = [
    {
        id: '1',
        name: 'Q1 Inventory Financing',
        purpose: 'Electronics inventory for seasonal demand',
        targetAmount: 50000,
        raisedAmount: 50000,
        interestRate: 12,
        duration: 6,
        status: 'active',
        repaidAmount: 28500,
        nextPayment: new Date('2026-02-15'),
        investorCount: 24,
    },
    {
        id: '2',
        name: 'Equipment Upgrade',
        purpose: 'New POS systems and displays',
        targetAmount: 30000,
        raisedAmount: 15000,
        interestRate: 10,
        duration: 4,
        status: 'fundraising',
        repaidAmount: 0,
        nextPayment: null,
        investorCount: 12,
    },
]

const repaymentSchedule = [
    { date: 'Feb 15, 2026', vault: 'Q1 Inventory Financing', amount: 4750, status: 'upcoming' },
    { date: 'Mar 15, 2026', vault: 'Q1 Inventory Financing', amount: 4750, status: 'scheduled' },
    { date: 'Apr 15, 2026', vault: 'Q1 Inventory Financing', amount: 4750, status: 'scheduled' },
]

export default function MerchantDashboard() {
    const [mounted, setMounted] = useState(false)
    const [showCreateModal, setShowCreateModal] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    const getStatusConfig = (status: string) => {
        const configs: Record<string, { label: string; class: string }> = {
            active: { label: 'Active', class: styles.statusActive },
            fundraising: { label: 'Fundraising', class: styles.statusFundraising },
            completed: { label: 'Completed', class: styles.statusCompleted },
        }
        return configs[status] || configs.active
    }

    const calculateProgress = (raised: number, target: number) => {
        return Math.min((raised / target) * 100, 100)
    }

    return (
        <div className={styles.merchant}>
            {/* Ambient Effects */}
            <div className={styles.ambientGlow} />

            {/* Header */}
            <header className={`${styles.header} ${mounted ? styles.visible : ''}`}>
                <div className={styles.headerContent}>
                    <span className={styles.overline}>Merchant Dashboard</span>
                    <h1 className={styles.title}>{merchantData.businessName}</h1>
                </div>
                <button className={styles.createBtn} onClick={() => setShowCreateModal(true)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 5v14M5 12h14" />
                    </svg>
                    Create Vault
                </button>
            </header>

            {/* Main Content */}
            <div className={styles.content}>
                {/* Left Column */}
                <div className={styles.leftColumn}>
                    {/* Credit Score Card */}
                    <div className={`${styles.creditCard} ${mounted ? styles.visible : ''}`}>
                        <div className={styles.creditHeader}>
                            <span>FairScale Credit Score</span>
                            <span className={styles.ratingBadge}>{merchantData.creditRating}</span>
                        </div>
                        <div className={styles.creditScoreContainer}>
                            <div className={styles.creditScoreRing}>
                                <svg viewBox="0 0 120 120">
                                    <circle
                                        cx="60"
                                        cy="60"
                                        r="52"
                                        fill="none"
                                        stroke="rgba(255,255,255,0.08)"
                                        strokeWidth="12"
                                    />
                                    <circle
                                        cx="60"
                                        cy="60"
                                        r="52"
                                        fill="none"
                                        stroke="url(#creditGradient)"
                                        strokeWidth="12"
                                        strokeLinecap="round"
                                        strokeDasharray={`${(merchantData.creditScore / 850) * 327} 327`}
                                        transform="rotate(-90 60 60)"
                                    />
                                    <defs>
                                        <linearGradient id="creditGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                            <stop offset="0%" stopColor="#34d399" />
                                            <stop offset="100%" stopColor="#22c55e" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                                <div className={styles.creditScoreValue}>
                                    <span className={styles.scoreNumber}>{merchantData.creditScore}</span>
                                    <span className={styles.scoreMax}>/ 850</span>
                                </div>
                            </div>
                        </div>
                        <div className={styles.creditDetails}>
                            <div className={styles.creditDetailRow}>
                                <span>Payment History</span>
                                <span className={styles.creditDetailValue}>{merchantData.onTimePayments}%</span>
                            </div>
                            <div className={styles.creditDetailRow}>
                                <span>Account Age</span>
                                <span className={styles.creditDetailValue}>{merchantData.accountAge} months</span>
                            </div>
                            <div className={styles.creditDetailRow}>
                                <span>Available Credit</span>
                                <span className={styles.creditDetailValue}>${merchantData.availableCredit.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className={styles.statsGrid}>
                        <div className={`${styles.statCard} ${mounted ? styles.visible : ''}`} style={{ transitionDelay: '0.1s' }}>
                            <span className={styles.statLabel}>Total Borrowed</span>
                            <span className={styles.statValue}>${merchantData.totalBorrowed.toLocaleString()}</span>
                        </div>
                        <div className={`${styles.statCard} ${mounted ? styles.visible : ''}`} style={{ transitionDelay: '0.15s' }}>
                            <span className={styles.statLabel}>Total Repaid</span>
                            <span className={styles.statValue}>${merchantData.totalRepaid.toLocaleString()}</span>
                        </div>
                        <div className={`${styles.statCard} ${mounted ? styles.visible : ''}`} style={{ transitionDelay: '0.2s' }}>
                            <span className={styles.statLabel}>Active Loans</span>
                            <span className={styles.statValue}>{merchantData.activeLoanCount}</span>
                        </div>
                    </div>

                    {/* Repayment Schedule */}
                    <div className={`${styles.scheduleCard} ${mounted ? styles.visible : ''}`} style={{ transitionDelay: '0.25s' }}>
                        <h3 className={styles.cardTitle}>Upcoming Payments</h3>
                        <div className={styles.scheduleList}>
                            {repaymentSchedule.map((payment, index) => (
                                <div key={index} className={styles.scheduleItem}>
                                    <div className={styles.scheduleInfo}>
                                        <span className={styles.scheduleDate}>{payment.date}</span>
                                        <span className={styles.scheduleVault}>{payment.vault}</span>
                                    </div>
                                    <div className={styles.scheduleRight}>
                                        <span className={styles.scheduleAmount}>${payment.amount.toLocaleString()}</span>
                                        {payment.status === 'upcoming' && (
                                            <button className={styles.payNowBtn}>Pay Now</button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Column - Vaults */}
                <div className={styles.rightColumn}>
                    <div className={`${styles.vaultsCard} ${mounted ? styles.visible : ''}`} style={{ transitionDelay: '0.15s' }}>
                        <div className={styles.vaultsHeader}>
                            <h2>Your Vaults</h2>
                            <span className={styles.vaultCount}>{merchantVaults.length} vaults</span>
                        </div>

                        <div className={styles.vaultsList}>
                            {merchantVaults.map((vault) => {
                                const status = getStatusConfig(vault.status)
                                const fundingProgress = calculateProgress(vault.raisedAmount, vault.targetAmount)
                                const repaymentProgress = vault.status === 'active'
                                    ? calculateProgress(vault.repaidAmount, vault.targetAmount * (1 + vault.interestRate / 100))
                                    : 0

                                return (
                                    <div key={vault.id} className={styles.vaultItem}>
                                        <div className={styles.vaultHeader}>
                                            <div className={styles.vaultInfo}>
                                                <h4>{vault.name}</h4>
                                                <p className={styles.vaultPurpose}>{vault.purpose}</p>
                                            </div>
                                            <span className={status.class}>{status.label}</span>
                                        </div>

                                        <div className={styles.vaultStats}>
                                            <div className={styles.vaultStat}>
                                                <span className={styles.vaultStatValue}>${vault.targetAmount.toLocaleString()}</span>
                                                <span className={styles.vaultStatLabel}>Target</span>
                                            </div>
                                            <div className={styles.vaultStat}>
                                                <span className={styles.vaultStatValue}>{vault.interestRate}%</span>
                                                <span className={styles.vaultStatLabel}>APY</span>
                                            </div>
                                            <div className={styles.vaultStat}>
                                                <span className={styles.vaultStatValue}>{vault.duration}mo</span>
                                                <span className={styles.vaultStatLabel}>Term</span>
                                            </div>
                                            <div className={styles.vaultStat}>
                                                <span className={styles.vaultStatValue}>{vault.investorCount}</span>
                                                <span className={styles.vaultStatLabel}>Investors</span>
                                            </div>
                                        </div>

                                        {vault.status === 'fundraising' && (
                                            <div className={styles.vaultProgress}>
                                                <div className={styles.progressHeader}>
                                                    <span>Funding Progress</span>
                                                    <span>${vault.raisedAmount.toLocaleString()} / ${vault.targetAmount.toLocaleString()}</span>
                                                </div>
                                                <div className={styles.progressBar}>
                                                    <div className={styles.progressFill} style={{ width: `${fundingProgress}%` }} />
                                                </div>
                                                <span className={styles.progressPercent}>{fundingProgress.toFixed(0)}% funded</span>
                                            </div>
                                        )}

                                        {vault.status === 'active' && (
                                            <div className={styles.vaultProgress}>
                                                <div className={styles.progressHeader}>
                                                    <span>Repayment Progress</span>
                                                    <span>${vault.repaidAmount.toLocaleString()} repaid</span>
                                                </div>
                                                <div className={styles.progressBar}>
                                                    <div className={`${styles.progressFill} ${styles.progressGreen}`} style={{ width: `${repaymentProgress}%` }} />
                                                </div>
                                                <div className={styles.nextPaymentInfo}>
                                                    <span>Next payment: {vault.nextPayment?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                                </div>
                                            </div>
                                        )}

                                        <div className={styles.vaultActions}>
                                            {vault.status === 'active' && (
                                                <button className={styles.repayBtn}>Make Payment</button>
                                            )}
                                            <button className={styles.manageBtn}>
                                                {vault.status === 'fundraising' ? 'Edit Vault' : 'View Details'}
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className={`${styles.actionsCard} ${mounted ? styles.visible : ''}`} style={{ transitionDelay: '0.3s' }}>
                        <h3 className={styles.cardTitle}>Quick Actions</h3>
                        <div className={styles.actionsList}>
                            <button className={styles.actionItem}>
                                <div className={styles.actionIcon}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                                    </svg>
                                </div>
                                <div className={styles.actionInfo}>
                                    <span className={styles.actionTitle}>Early Repayment</span>
                                    <span className={styles.actionDesc}>Pay off loans early and save on interest</span>
                                </div>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M9 18l6-6-6-6" />
                                </svg>
                            </button>
                            <button className={styles.actionItem}>
                                <div className={styles.actionIcon}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                        <polyline points="14 2 14 8 20 8" />
                                    </svg>
                                </div>
                                <div className={styles.actionInfo}>
                                    <span className={styles.actionTitle}>Download Statements</span>
                                    <span className={styles.actionDesc}>Get detailed transaction history</span>
                                </div>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M9 18l6-6-6-6" />
                                </svg>
                            </button>
                            <button className={styles.actionItem}>
                                <div className={styles.actionIcon}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                        <circle cx="12" cy="12" r="3" />
                                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                                    </svg>
                                </div>
                                <div className={styles.actionInfo}>
                                    <span className={styles.actionTitle}>Account Settings</span>
                                    <span className={styles.actionDesc}>Manage your business profile</span>
                                </div>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M9 18l6-6-6-6" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Create Vault Modal */}
            {showCreateModal && (
                <div className={styles.modalOverlay} onClick={() => setShowCreateModal(false)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>Create New Vault</h2>
                            <button className={styles.modalClose} onClick={() => setShowCreateModal(false)}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M18 6L6 18M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className={styles.modalBody}>
                            <div className={styles.formGroup}>
                                <label>Vault Name</label>
                                <input type="text" placeholder="e.g., Q2 Inventory Expansion" />
                            </div>
                            <div className={styles.formGroup}>
                                <label>Purpose</label>
                                <textarea placeholder="Describe what the funds will be used for..." rows={3} />
                            </div>
                            <div className={styles.formRow}>
                                <div className={styles.formGroup}>
                                    <label>Target Amount</label>
                                    <div className={styles.inputWithPrefix}>
                                        <span>$</span>
                                        <input type="number" placeholder="50,000" />
                                    </div>
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Term (Months)</label>
                                    <input type="number" placeholder="6" />
                                </div>
                            </div>
                            <div className={styles.formInfo}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10" />
                                    <path d="M12 16v-4M12 8h.01" />
                                </svg>
                                <span>Interest rate will be calculated based on your credit score and term length.</span>
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
