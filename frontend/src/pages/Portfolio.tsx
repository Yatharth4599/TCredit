import { useState, useEffect } from 'react'
import { mockInvestments, mockVaults } from '../lib/mockData'
import styles from './Portfolio.module.css'

export default function Portfolio() {
    const [mounted, setMounted] = useState(false)
    const [activeTab, setActiveTab] = useState<'all' | 'active' | 'completed'>('all')

    useEffect(() => {
        setMounted(true)
    }, [])

    // Calculate portfolio stats
    const totalInvested = mockInvestments.reduce((sum, inv) => sum + inv.amountInvested, 0)
    const totalReturns = mockInvestments.reduce((sum, inv) => sum + inv.totalReturns, 0)
    const totalClaimed = mockInvestments.reduce((sum, inv) => sum + inv.claimedReturns, 0)
    const claimable = totalReturns - totalClaimed
    const profitPercent = ((totalReturns - totalInvested) / totalInvested * 100).toFixed(1)

    // Filter investments by tab
    const filteredInvestments = mockInvestments.filter(inv => {
        if (activeTab === 'all') return true
        if (activeTab === 'active') return inv.status === 'active' || inv.status === 'repaying'
        return inv.status === 'completed'
    })

    // Get vault details for an investment
    const getVaultDetails = (vaultId: string) => {
        return mockVaults.find(v => v.id === vaultId)
    }

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        })
    }

    const getStatusConfig = (status: string) => {
        const configs: Record<string, { label: string; class: string }> = {
            active: { label: 'Active', class: styles.statusActive },
            repaying: { label: 'Repaying', class: styles.statusRepaying },
            completed: { label: 'Completed', class: styles.statusCompleted },
        }
        return configs[status] || configs.active
    }

    return (
        <div className={styles.portfolio}>
            {/* Ambient Effects */}
            <div className={styles.ambientGlow} />

            {/* Header */}
            <header className={`${styles.header} ${mounted ? styles.visible : ''}`}>
                <div className={styles.headerContent}>
                    <span className={styles.overline}>Investor Dashboard</span>
                    <h1 className={styles.title}>My Portfolio</h1>
                </div>
            </header>

            {/* Main Content */}
            <div className={styles.content}>
                {/* Left Column - Stats & Activity */}
                <div className={styles.leftColumn}>
                    {/* Portfolio Overview Card */}
                    <div className={`${styles.overviewCard} ${mounted ? styles.visible : ''}`}>
                        <div className={styles.overviewHeader}>
                            <span>Portfolio Value</span>
                            <span className={styles.liveBadge}>Live</span>
                        </div>
                        <div className={styles.overviewValue}>
                            <span className={styles.currency}>$</span>
                            <span className={styles.amount}>{totalReturns.toLocaleString()}</span>
                        </div>
                        <div className={styles.overviewChange}>
                            <span className={styles.profit}>+${(totalReturns - totalInvested).toLocaleString()}</span>
                            <span className={styles.percent}>+{profitPercent}%</span>
                        </div>

                        <div className={styles.overviewStats}>
                            <div className={styles.overviewStat}>
                                <span className={styles.overviewStatValue}>${totalInvested.toLocaleString()}</span>
                                <span className={styles.overviewStatLabel}>Invested</span>
                            </div>
                            <div className={styles.overviewStatDivider} />
                            <div className={styles.overviewStat}>
                                <span className={styles.overviewStatValue}>${totalClaimed.toLocaleString()}</span>
                                <span className={styles.overviewStatLabel}>Claimed</span>
                            </div>
                            <div className={styles.overviewStatDivider} />
                            <div className={styles.overviewStat}>
                                <span className={styles.overviewStatValue}>{mockInvestments.length}</span>
                                <span className={styles.overviewStatLabel}>Positions</span>
                            </div>
                        </div>

                        {claimable > 0 && (
                            <div className={styles.claimSection}>
                                <div className={styles.claimInfo}>
                                    <span className={styles.claimLabel}>Available to Claim</span>
                                    <span className={styles.claimValue}>${claimable.toLocaleString()}</span>
                                </div>
                                <button className={styles.claimBtn}>Claim All</button>
                            </div>
                        )}
                    </div>

                    {/* Allocation Breakdown */}
                    <div className={`${styles.allocationCard} ${mounted ? styles.visible : ''}`} style={{ transitionDelay: '0.1s' }}>
                        <h3 className={styles.cardTitle}>Allocation by Status</h3>
                        <div className={styles.allocationList}>
                            {['active', 'repaying', 'completed'].map((status) => {
                                const statusInvestments = mockInvestments.filter(inv => inv.status === status)
                                const statusTotal = statusInvestments.reduce((sum, inv) => sum + inv.amountInvested, 0)
                                const percentage = totalInvested > 0 ? (statusTotal / totalInvested * 100).toFixed(0) : 0

                                if (statusTotal === 0) return null

                                return (
                                    <div key={status} className={styles.allocationItem}>
                                        <div className={styles.allocationInfo}>
                                            <span className={`${styles.allocationDot} ${styles[`dot${status.charAt(0).toUpperCase() + status.slice(1)}`]}`} />
                                            <span className={styles.allocationName}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
                                        </div>
                                        <div className={styles.allocationRight}>
                                            <span className={styles.allocationAmount}>${statusTotal.toLocaleString()}</span>
                                            <span className={styles.allocationPercent}>{percentage}%</span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                        <div className={styles.allocationBar}>
                            {['active', 'repaying', 'completed'].map((status) => {
                                const statusInvestments = mockInvestments.filter(inv => inv.status === status)
                                const statusTotal = statusInvestments.reduce((sum, inv) => sum + inv.amountInvested, 0)
                                const percentage = totalInvested > 0 ? (statusTotal / totalInvested * 100) : 0

                                if (percentage === 0) return null

                                return (
                                    <div
                                        key={status}
                                        className={`${styles.allocationBarSegment} ${styles[`bar${status.charAt(0).toUpperCase() + status.slice(1)}`]}`}
                                        style={{ width: `${percentage}%` }}
                                    />
                                )
                            })}
                        </div>
                    </div>

                    {/* Recent Activity */}
                    <div className={`${styles.activityCard} ${mounted ? styles.visible : ''}`} style={{ transitionDelay: '0.2s' }}>
                        <h3 className={styles.cardTitle}>Recent Activity</h3>
                        <div className={styles.activityList}>
                            <div className={styles.activityItem}>
                                <div className={styles.activityIcon}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                                    </svg>
                                </div>
                                <div className={styles.activityInfo}>
                                    <span className={styles.activityTitle}>Claimed Returns</span>
                                    <span className={styles.activityDesc}>JBR Fitness Center</span>
                                </div>
                                <div className={styles.activityRight}>
                                    <span className={styles.activityAmount}>+$500</span>
                                    <span className={styles.activityTime}>2 days ago</span>
                                </div>
                            </div>
                            <div className={styles.activityItem}>
                                <div className={styles.activityIcon}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="10" />
                                        <path d="M12 6v6l4 2" />
                                    </svg>
                                </div>
                                <div className={styles.activityInfo}>
                                    <span className={styles.activityTitle}>Investment Matured</span>
                                    <span className={styles.activityDesc}>Downtown Cafe Chain</span>
                                </div>
                                <div className={styles.activityRight}>
                                    <span className={styles.activityAmountGreen}>Completed</span>
                                    <span className={styles.activityTime}>1 week ago</span>
                                </div>
                            </div>
                            <div className={styles.activityItem}>
                                <div className={styles.activityIcon}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                                    </svg>
                                </div>
                                <div className={styles.activityInfo}>
                                    <span className={styles.activityTitle}>New Investment</span>
                                    <span className={styles.activityDesc}>Al Barsha Restaurant</span>
                                </div>
                                <div className={styles.activityRight}>
                                    <span className={styles.activityAmount}>$5,000</span>
                                    <span className={styles.activityTime}>Dec 15</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column - Investments List */}
                <div className={styles.rightColumn}>
                    <div className={`${styles.investmentsCard} ${mounted ? styles.visible : ''}`} style={{ transitionDelay: '0.15s' }}>
                        <div className={styles.investmentsHeader}>
                            <h2>Your Investments</h2>
                            <div className={styles.tabs}>
                                {(['all', 'active', 'completed'] as const).map((tab) => (
                                    <button
                                        key={tab}
                                        className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
                                        onClick={() => setActiveTab(tab)}
                                    >
                                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className={styles.investmentsList}>
                            {filteredInvestments.map((inv) => {
                                const vault = getVaultDetails(inv.vaultId)
                                const status = getStatusConfig(inv.status)
                                const returnPercent = ((inv.totalReturns - inv.amountInvested) / inv.amountInvested * 100).toFixed(1)

                                return (
                                    <div key={inv.vaultId} className={styles.investmentItem}>
                                        <div className={styles.investmentMain}>
                                            <div className={styles.investmentInfo}>
                                                <h4>{inv.merchant}</h4>
                                                <div className={styles.investmentMeta}>
                                                    <span className={status.class}>{status.label}</span>
                                                    <span className={styles.investmentCategory}>{vault?.category}</span>
                                                    <span className={styles.investmentDate}>{formatDate(inv.investedAt)}</span>
                                                </div>
                                            </div>
                                            <div className={styles.investmentStats}>
                                                <div className={styles.investmentStat}>
                                                    <span className={styles.investmentStatValue}>${inv.amountInvested.toLocaleString()}</span>
                                                    <span className={styles.investmentStatLabel}>Invested</span>
                                                </div>
                                                <div className={styles.investmentStat}>
                                                    <span className={styles.investmentStatValue}>${inv.totalReturns.toLocaleString()}</span>
                                                    <span className={styles.investmentStatLabel}>Returns</span>
                                                </div>
                                                <div className={styles.investmentStat}>
                                                    <span className={`${styles.investmentStatValue} ${styles.profitValue}`}>+{returnPercent}%</span>
                                                    <span className={styles.investmentStatLabel}>Profit</span>
                                                </div>
                                            </div>
                                        </div>

                                        {vault && (
                                            <div className={styles.investmentProgress}>
                                                <div className={styles.progressInfo}>
                                                    <span>Vault Progress</span>
                                                    <span>{vault.interestRate}% APY · {vault.duration} months</span>
                                                </div>
                                                <div className={styles.progressBar}>
                                                    <div
                                                        className={styles.progressFill}
                                                        style={{ width: `${(inv.claimedReturns / inv.totalReturns) * 100}%` }}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        <div className={styles.investmentActions}>
                                            {inv.status === 'completed' ? (
                                                <span className={styles.completedBadge}>
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path d="M20 6L9 17l-5-5" />
                                                    </svg>
                                                    Fully Claimed
                                                </span>
                                            ) : (
                                                <>
                                                    {inv.totalReturns - inv.claimedReturns > 0 && (
                                                        <button className={styles.claimSmallBtn}>
                                                            Claim ${(inv.totalReturns - inv.claimedReturns).toLocaleString()}
                                                        </button>
                                                    )}
                                                    <button className={styles.detailsBtn}>View Details</button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}

                            {filteredInvestments.length === 0 && (
                                <div className={styles.emptyState}>
                                    <p>No investments found</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
