import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { motion } from 'motion/react'
import { investApi } from '../api/client'
import type { ApiPortfolioInvestment, ApiPortfolioSummary } from '../api/types'
import { formatUSDC, weiToNumber, truncateAddress } from '../lib/format'
import { useContractTx } from '../hooks/useContractTx'
import { AnimatedNumber } from '../components/ui/AnimatedNumber'
import { mockInvestments, mockPortfolioSummary } from '../lib/mockData'
import { Loader2, Wallet } from 'lucide-react'
import { Skeleton } from '../components/ui/Skeleton'
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
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'completed'>('all')
  const [investments, setInvestments] = useState<ApiPortfolioInvestment[]>([])
  const [summary, setSummary] = useState<ApiPortfolioSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [claimingVault, setClaimingVault] = useState<string | null>(null)

  const { execute: executeTx } = useContractTx()

  useEffect(() => {
    if (!walletAddress) {
      setInvestments([])
      setSummary(null)
      return
    }
    setLoading(true)
    investApi.portfolio(walletAddress)
      .then(({ data }) => {
        setInvestments(data?.investments ?? [])
        setSummary(data?.summary ?? null)
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
      if (walletAddress) {
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

  // Use mock data as fallback in dev
  const displayInvestments = investments.length > 0 ? investments : (import.meta.env.DEV && walletAddress ? mockInvestments : [])
  const displaySummary = summary ?? (import.meta.env.DEV && walletAddress ? mockPortfolioSummary : null)

  const totalInvested = displaySummary ? weiToNumber(displaySummary.totalInvested) : 0
  const totalClaimable = displaySummary ? weiToNumber(displaySummary.totalClaimable) : 0

  const filteredInvestments = displayInvestments.filter(inv => {
    if (activeTab === 'all') return true
    if (activeTab === 'active') return inv.state === 'active' || inv.state === 'repaying' || inv.state === 'fundraising'
    return inv.state === 'completed'
  })

  if (!walletAddress) {
    return (
      <div className={styles.portfolio}>
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
      {/* Hero Band */}
      <div className={styles.hero}>
        <motion.div
          className={styles.heroInner}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className={styles.heroLabel}>Investor Dashboard</div>
          <h1 className={styles.heroTitle}>My Portfolio</h1>
          {!loading && (
            <div className={styles.heroValue}>
              <span className={styles.heroCurrency}>$</span>
              <span className={styles.heroAmount}>
                <AnimatedNumber value={totalInvested} decimals={0} />
              </span>
            </div>
          )}
        </motion.div>
      </div>

      {/* Stats Row (dark bg) */}
      <div className={styles.statsRow}>
        {[
          { value: loading ? null : formatUSDC(displaySummary?.totalInvested || '0'), label: 'Invested' },
          { value: loading ? null : formatUSDC(displaySummary?.totalClaimable || '0'), label: 'Claimable' },
          { value: loading ? null : String(displayInvestments.length), label: 'Positions' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            className={styles.statCard}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.1 + i * 0.06 }}
          >
            <div className={styles.statValue}>
              {stat.value === null ? <Skeleton width={100} height={28} borderRadius={6} /> : stat.value}
            </div>
            <div className={styles.statLabel}>{stat.label}</div>
          </motion.div>
        ))}
      </div>

      {/* White Section — Investments */}
      <div className={styles.body}>
        <div className={styles.bodyInner}>
          {totalClaimable > 0 && (
            <div className={styles.claimBanner}>
              <div className={styles.claimInfo}>
                <span className={styles.claimLabel}>Available to Claim</span>
                <span className={styles.claimValue}>{formatUSDC(displaySummary?.totalClaimable || '0')}</span>
              </div>
            </div>
          )}

          <motion.div
            className={styles.investmentsCard}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
          >
            <div className={styles.investmentsHeader}>
              <span className={styles.investmentsTitle}>Your Investments</span>
              <div className={styles.tabs}>
                {(['all', 'active', 'completed'] as const).map((tab) => (
                  <button
                    key={tab}
                    className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.investmentsList}>
              {loading ? (
                <div style={{ padding: '8px 0' }}>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className={styles.investmentItem}>
                      <div className={styles.investmentMain}>
                        <div className={styles.investmentInfo}>
                          <Skeleton width={100} height={16} borderRadius={6} style={{ marginBottom: 8 }} />
                          <Skeleton width={160} height={12} borderRadius={4} />
                        </div>
                        <div style={{ display: 'flex', gap: 20 }}>
                          <div>
                            <Skeleton width={80} height={18} borderRadius={6} style={{ marginBottom: 4 }} />
                            <Skeleton width={50} height={11} borderRadius={4} />
                          </div>
                          <div>
                            <Skeleton width={80} height={18} borderRadius={6} style={{ marginBottom: 4 }} />
                            <Skeleton width={50} height={11} borderRadius={4} />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredInvestments.length === 0 ? (
                <div className={styles.emptyState}>
                  <p>{displayInvestments.length === 0 ? 'No investments yet' : 'No investments in this category'}</p>
                  {displayInvestments.length === 0 && (
                    <button className={styles.claimSmallBtn} onClick={() => navigate('/vaults')}>
                      Browse Vaults
                    </button>
                  )}
                </div>
              ) : (
                filteredInvestments.map((inv, i) => {
                  const status = STATUS_CONFIG[inv.state] || STATUS_CONFIG.active
                  const claimable = weiToNumber(inv.claimable)

                  return (
                    <motion.div
                      key={inv.vaultAddress}
                      className={styles.investmentItem}
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: i * 0.04 }}
                    >
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
                    </motion.div>
                  )
                })
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Allocation (dark bg section) */}
      {displayInvestments.length > 0 && (
        <div className={styles.allocationSection}>
          <div className={styles.allocationInner}>
            <motion.div
              className={styles.allocationCard}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
            >
              <h3 className={styles.cardTitle}>Allocation by Status</h3>
              <div className={styles.allocationList}>
                {['active', 'repaying', 'completed'].map((status) => {
                  const statusInvestments = displayInvestments.filter(inv => inv.state === status)
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
                  const statusInvestments = displayInvestments.filter(inv => inv.state === status)
                  const statusTotal = statusInvestments.reduce((sum, inv) => sum + weiToNumber(inv.amountInvested), 0)
                  const percentage = totalInvested > 0 ? (statusTotal / totalInvested * 100) : 0

                  if (percentage === 0) return null

                  return (
                    <motion.div
                      key={status}
                      className={`${styles.allocationBarSegment} ${styles[`bar${status.charAt(0).toUpperCase() + status.slice(1)}`]}`}
                      initial={{ width: 0 }}
                      whileInView={{ width: `${percentage}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
                    />
                  )
                })}
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </div>
  )
}
