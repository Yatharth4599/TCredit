import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { investApi } from '../api/client'
import type { ApiPortfolioInvestment, ApiPortfolioSummary } from '../api/types'
import { formatUSDC, weiToNumber, truncateAddress } from '../lib/format'
import { useContractTx } from '../hooks/useContractTx'
import { Loader2, Wallet } from 'lucide-react'
import styles from './Portfolio.module.css'

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
    fundraising: { label: 'Fundraising', class: styles.statusActive },
    active: { label: 'Active', class: styles.statusActive },
    repaying: { label: 'Repaying', class: styles.statusRepaying },
    completed: { label: 'Completed', class: styles.statusCompleted },
    defaulted: { label: 'Defaulted', class: styles.statusCompleted },
    cancelled: { label: 'Cancelled', class: styles.statusCompleted },
}

export default function Portfolio() {
    const navigate = useNavigate()
    const { address: walletAddress } = useAccount()
    const [mounted, setMounted] = useState(false)
    const [activeTab, setActiveTab] = useState<'all' | 'active' | 'completed'>('all')
    const [investments, setInvestments] = useState<ApiPortfolioInvestment[]>([])
    const [summary, setSummary] = useState<ApiPortfolioSummary | null>(null)
    const [loading, setLoading] = useState(false)
    const [claimingVault, setClaimingVault] = useState<string | null>(null)

    const { execute: executeTx } = useContractTx()

    useEffect(() => {
        setMounted(true)
    }, [])

    // Fetch portfolio when wallet connects
    useEffect(() => {
        if (!walletAddress) {
            setInvestments([])
            setSummary(null)
            return
        }
        setLoading(true)
        investApi.portfolio(walletAddress)
            .then(({ data }) => {
                setInvestments(data.investments)
                setSummary(data.summary)
            })
            .catch(() => {
                setInvestments([])
                setSummary(null)
            })
            .finally(() => setLoading(false))
    }, [walletAddress])

    const handleClaim = async (vaultAddress: string) => {
        setClaimingVault(vaultAddress)
        try {
            const { data: unsignedTx } = await investApi.claim({ vaultAddress })
            await executeTx(unsignedTx)
            // Refresh portfolio
            if (walletAddress) {
                const { data } = await investApi.portfolio(walletAddress)
                setInvestments(data.investments)
                setSummary(data.summary)
            }
        } catch {
            // Error handled by toast
        } finally {
            setClaimingVault(null)
        }
    }

    const totalInvested = summary ? weiToNumber(summary.totalInvested) : 0
    const totalClaimable = summary ? weiToNumber(summary.totalClaimable) : 0

    const filteredInvestments = investments.filter(inv => {
        if (activeTab === 'all') return true
        if (activeTab === 'active') return inv.state === 'active' || inv.state === 'repaying' || inv.state === 'fundraising'
        return inv.state === 'completed'
    })

    // Wallet not connected state
    if (!walletAddress) {
        return (
            <div className={styles.portfolio}>
                <div className={styles.ambientGlow} />
                <div className={styles.connectPrompt}>
                    <Wallet size={48} strokeWidth={1} />
                    <h2>Connect Your Wallet</h2>
                    <p>Connect your wallet to view your investment portfolio</p>
                </div>
            </div>
        )
    }

    return (
        <div className={styles.portfolio}>
            <div className={styles.ambientGlow} />

            <header className={`${styles.header} ${mounted ? styles.visible : ''}`}>
                <div className={styles.headerContent}>
                    <span className={styles.overline}>Investor Dashboard</span>
                    <h1 className={styles.title}>My Portfolio</h1>
                </div>
            </header>

            <div className={styles.content}>
                {/* Left Column - Stats */}
                <div className={styles.leftColumn}>
                    <div className={`${styles.overviewCard} ${mounted ? styles.visible : ''}`}>
                        <div className={styles.overviewHeader}>
                            <span>Portfolio Value</span>
                            <span className={styles.liveBadge}>Live</span>
                        </div>
                        {loading ? (
                            <div className={styles.loadingInline}>
                                <Loader2 size={20} className={styles.spinner} />
                            </div>
                        ) : (
                            <>
                                <div className={styles.overviewValue}>
                                    <span className={styles.currency}>$</span>
                                    <span className={styles.amount}>{totalInvested.toLocaleString()}</span>
                                </div>

                                <div className={styles.overviewStats}>
                                    <div className={styles.overviewStat}>
                                        <span className={styles.overviewStatValue}>{formatUSDC(summary?.totalInvested || '0')}</span>
                                        <span className={styles.overviewStatLabel}>Invested</span>
                                    </div>
                                    <div className={styles.overviewStatDivider} />
                                    <div className={styles.overviewStat}>
                                        <span className={styles.overviewStatValue}>{formatUSDC(summary?.totalClaimable || '0')}</span>
                                        <span className={styles.overviewStatLabel}>Claimable</span>
                                    </div>
                                    <div className={styles.overviewStatDivider} />
                                    <div className={styles.overviewStat}>
                                        <span className={styles.overviewStatValue}>{investments.length}</span>
                                        <span className={styles.overviewStatLabel}>Positions</span>
                                    </div>
                                </div>

                                {totalClaimable > 0 && (
                                    <div className={styles.claimSection}>
                                        <div className={styles.claimInfo}>
                                            <span className={styles.claimLabel}>Available to Claim</span>
                                            <span className={styles.claimValue}>{formatUSDC(summary?.totalClaimable || '0')}</span>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Allocation Breakdown */}
                    {investments.length > 0 && (
                        <div className={`${styles.allocationCard} ${mounted ? styles.visible : ''}`} style={{ transitionDelay: '0.1s' }}>
                            <h3 className={styles.cardTitle}>Allocation by Status</h3>
                            <div className={styles.allocationList}>
                                {['active', 'repaying', 'completed'].map((status) => {
                                    const statusInvestments = investments.filter(inv => inv.state === status)
                                    const statusTotal = statusInvestments.reduce((sum, inv) => sum + weiToNumber(inv.amountInvested), 0)
                                    const percentage = totalInvested > 0 ? (statusTotal / totalInvested * 100).toFixed(0) : '0'

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
                                    const statusInvestments = investments.filter(inv => inv.state === status)
                                    const statusTotal = statusInvestments.reduce((sum, inv) => sum + weiToNumber(inv.amountInvested), 0)
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
                    )}
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
                            {loading ? (
                                <div className={styles.emptyState}>
                                    <Loader2 size={24} className={styles.spinner} />
                                    <p>Loading investments...</p>
                                </div>
                            ) : filteredInvestments.length === 0 ? (
                                <div className={styles.emptyState}>
                                    <p>{investments.length === 0 ? 'No investments yet' : 'No investments in this category'}</p>
                                    {investments.length === 0 && (
                                        <button className={styles.claimSmallBtn} onClick={() => navigate('/vaults')}>
                                            Browse Vaults
                                        </button>
                                    )}
                                </div>
                            ) : (
                                filteredInvestments.map((inv) => {
                                    const status = STATUS_CONFIG[inv.state] || STATUS_CONFIG.active
                                    const invested = weiToNumber(inv.amountInvested)
                                    const claimable = weiToNumber(inv.claimable)

                                    return (
                                        <div key={inv.vaultAddress} className={styles.investmentItem}>
                                            <div className={styles.investmentMain}>
                                                <div className={styles.investmentInfo}>
                                                    <h4>{truncateAddress(inv.agent, 6)}</h4>
                                                    <div className={styles.investmentMeta}>
                                                        <span className={status.class}>{status.label}</span>
                                                        <span className={styles.investmentDate}>{inv.interestRate}% APY · {inv.durationMonths}mo</span>
                                                    </div>
                                                </div>
                                                <div className={styles.investmentStats}>
                                                    <div className={styles.investmentStat}>
                                                        <span className={styles.investmentStatValue}>{formatUSDC(inv.amountInvested)}</span>
                                                        <span className={styles.investmentStatLabel}>Invested</span>
                                                    </div>
                                                    <div className={styles.investmentStat}>
                                                        <span className={styles.investmentStatValue}>{formatUSDC(inv.claimable)}</span>
                                                        <span className={styles.investmentStatLabel}>Claimable</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className={styles.investmentActions}>
                                                {claimable > 0 && (
                                                    <button
                                                        className={styles.claimSmallBtn}
                                                        onClick={() => handleClaim(inv.vaultAddress)}
                                                        disabled={claimingVault === inv.vaultAddress}
                                                    >
                                                        {claimingVault === inv.vaultAddress ? (
                                                            <><Loader2 size={14} className={styles.spinner} /> Claiming...</>
                                                        ) : (
                                                            `Claim ${formatUSDC(inv.claimable)}`
                                                        )}
                                                    </button>
                                                )}
                                                <button
                                                    className={styles.detailsBtn}
                                                    onClick={() => navigate(`/vaults/${inv.vaultAddress}`)}
                                                >
                                                    View Details
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
