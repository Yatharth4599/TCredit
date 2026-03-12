import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { motion } from 'motion/react'
import { poolsApi } from '../api/client'
import type { ApiPool, ApiPoolsSummary } from '../api/types'
import { formatUSDC, weiToNumber, parseUSDCToWei } from '../lib/format'
import { useContractTx } from '../hooks/useContractTx'
import { useUSDCApproval } from '../hooks/useUSDCApproval'
import { AnimatedNumber } from '../components/ui/AnimatedNumber'
import { mockPools, mockPoolsSummary } from '../lib/mockData'
import { Loader2 } from 'lucide-react'
import { Skeleton } from '../components/ui/Skeleton'
import { ErrorState } from '../components/ui/ErrorState'
import styles from './LiquidityPools.module.css'

export default function LiquidityPools() {
    const { address: walletAddress } = useAccount()
    const { execute: executeTx } = useContractTx()
    const [pools, setPools] = useState<ApiPool[]>([])
    const [summary, setSummary] = useState<ApiPoolsSummary | null>(null)
    const [loading, setLoading] = useState(true)
    const [fetchError, setFetchError] = useState(false)

    const [actionModal, setActionModal] = useState<{ pool: ApiPool; type: 'deposit' | 'withdraw' } | null>(null)
    const [actionAmount, setActionAmount] = useState('')
    const [acting, setActing] = useState(false)

    const { needsApproval, approve } = useUSDCApproval(actionModal?.pool.address || '')

    const loadPools = () => {
        setLoading(true)
        setFetchError(false)
        poolsApi.list()
            .then(({ data }) => {
                setPools(data?.pools ?? [])
                setSummary(data?.summary ?? null)
                setFetchError(false)
            })
            .catch(() => {
                setPools([])
                setSummary(null)
                setFetchError(true)
            })
            .finally(() => setLoading(false))
    }

    useEffect(() => { loadPools() }, [])

    const handleAction = async () => {
        if (!actionModal || !actionAmount || !walletAddress) return
        setActing(true)
        try {
            const weiAmount = parseUSDCToWei(actionAmount)

            if (actionModal.type === 'deposit') {
                const amountBigInt = BigInt(weiAmount)
                if (needsApproval(amountBigInt)) {
                    const approved = await approve(amountBigInt)
                    if (!approved) { setActing(false); return }
                }
                const { data: unsignedTx } = await poolsApi.deposit({
                    poolAddress: actionModal.pool.address,
                    amount: weiAmount,
                })
                await executeTx(unsignedTx)
            } else {
                const { data: unsignedTx } = await poolsApi.withdraw({
                    poolAddress: actionModal.pool.address,
                    amount: weiAmount,
                })
                await executeTx(unsignedTx)
            }

            setActionModal(null)
            setActionAmount('')
            poolsApi.list().then(({ data }) => { setPools(data?.pools ?? []); setSummary(data?.summary ?? null) }).catch(() => {})
        } catch {
            // Error handled by toast
        } finally {
            setActing(false)
        }
    }

    // Mock data fallback in dev
    const displayPools = pools.length > 0 ? pools : (import.meta.env.DEV ? mockPools : [])
    const displaySummary = summary ?? (import.meta.env.DEV ? mockPoolsSummary : null)

    const totalDeposits = displaySummary ? weiToNumber(displaySummary.totalDeposits) : 0
    const totalAllocated = displaySummary ? weiToNumber(displaySummary.totalAllocated) : 0
    const utilization = totalDeposits > 0 ? ((totalAllocated / totalDeposits) * 100).toFixed(1) : '0'

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
                    <div className={styles.heroLabel}>Liquidity Infrastructure</div>
                    <h1 className={styles.heroTitle}>Liquidity Pools</h1>
                    <p className={styles.heroSubtitle}>
                        Capital pools that fill vault shortfalls — powering programmable credit at scale.
                    </p>
                </motion.div>
            </div>

            {/* Stats Row (dark bg) */}
            <div className={styles.statsRow}>
                {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className={styles.statCard}>
                            <Skeleton width={80} height={11} borderRadius={4} style={{ marginBottom: 10 }} />
                            <Skeleton width={120} height={22} borderRadius={6} />
                        </div>
                    ))
                ) : (
                    [
                        { label: 'Total Deposits', value: formatUSDC(displaySummary?.totalDeposits || '0') },
                        { label: 'Deployed', value: formatUSDC(displaySummary?.totalAllocated || '0') },
                        { label: 'Available', value: formatUSDC(displaySummary?.totalAvailable || '0') },
                        { label: 'Utilization', value: null, isUtil: true },
                    ].map((stat, i) => (
                        <motion.div
                            key={stat.label}
                            className={styles.statCard}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.1 + i * 0.06 }}
                        >
                            <span className={styles.statLabel}>{stat.label}</span>
                            {stat.isUtil ? (
                                <AnimatedNumber
                                    value={parseFloat(utilization)}
                                    suffix="%"
                                    decimals={1}
                                    className={styles.statValue}
                                />
                            ) : (
                                <span className={styles.statValue}>{stat.value}</span>
                            )}
                        </motion.div>
                    ))
                )}
            </div>

            {/* White Section — Pool Cards */}
            <div className={styles.whiteSection}>
                <div className={styles.whiteSectionInner}>
                    <div className={styles.sectionLabel}>Active Pools</div>

                    <div className={styles.poolGrid}>
                        {fetchError ? (
                            <ErrorState onRetry={loadPools} />
                        ) : loading ? (
                            Array.from({ length: 2 }).map((_, i) => (
                                <div key={i} className={styles.poolCard}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                                        <div>
                                            <Skeleton width={72} height={11} borderRadius={4} style={{ marginBottom: 8 }} />
                                            <Skeleton width={140} height={20} borderRadius={6} />
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <Skeleton width={52} height={28} borderRadius={6} style={{ marginBottom: 4 }} />
                                            <Skeleton width={30} height={11} borderRadius={4} />
                                        </div>
                                    </div>
                                    <Skeleton width="100%" height={8} borderRadius={999} style={{ marginBottom: 20 }} />
                                    <div style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
                                        {Array.from({ length: 3 }).map((_, j) => (
                                            <div key={j}>
                                                <Skeleton width={80} height={18} borderRadius={6} style={{ marginBottom: 6 }} />
                                                <Skeleton width={60} height={11} borderRadius={4} />
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ display: 'flex', gap: 10 }}>
                                        <Skeleton width={90} height={36} borderRadius={8} />
                                        <Skeleton width={90} height={36} borderRadius={8} />
                                    </div>
                                </div>
                            ))
                        ) : displayPools.length === 0 ? (
                            <div className={styles.emptyState}>No pools available.</div>
                        ) : (
                            displayPools.map((pool, i) => (
                                <motion.div
                                    key={pool.address}
                                    className={`${styles.poolCard} ${pool.isAlpha ? styles.treasuryCard : ''}`}
                                    initial={{ opacity: 0, y: 24 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true, margin: '-40px' }}
                                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.2 + i * 0.08 }}
                                    whileHover={{ y: -4, transition: { duration: 0.2 } }}
                                >
                                    <div className={styles.poolHeader}>
                                        <div>
                                            <div className={styles.poolType}>
                                                {pool.isAlpha ? 'Senior Pool' : 'General Pool'}
                                            </div>
                                            <h3 className={styles.poolName}>{pool.name}</h3>
                                        </div>
                                        <div className={styles.poolApyBlock}>
                                            <AnimatedNumber
                                                value={pool.utilizationPct}
                                                suffix="%"
                                                decimals={1}
                                                className={styles.poolApyVal}
                                            />
                                            <span className={styles.poolApyLabel}>Util.</span>
                                        </div>
                                    </div>

                                    <div className={styles.utilizationBar}>
                                        <motion.div
                                            className={styles.utilizationFill}
                                            initial={{ width: 0 }}
                                            whileInView={{ width: `${pool.utilizationPct}%` }}
                                            viewport={{ once: true }}
                                            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.3 + i * 0.08 }}
                                        />
                                    </div>

                                    <div className={styles.poolStats}>
                                        <div className={styles.poolStat}>
                                            <span className={styles.poolStatValue}>{formatUSDC(pool.totalDeposits)}</span>
                                            <span className={styles.poolStatLabel}>Total Deposits</span>
                                        </div>
                                        <div className={styles.poolStat}>
                                            <span className={styles.poolStatValue}>{formatUSDC(pool.totalAllocated)}</span>
                                            <span className={styles.poolStatLabel}>Deployed</span>
                                        </div>
                                        <div className={styles.poolStat}>
                                            <span className={styles.poolStatValue}>{formatUSDC(pool.availableBalance)}</span>
                                            <span className={styles.poolStatLabel}>Available</span>
                                        </div>
                                    </div>

                                    <div className={styles.poolFooter}>
                                        {!walletAddress ? (
                                            <p className={styles.connectHint}>Connect wallet to deposit or withdraw</p>
                                        ) : (
                                            <div className={styles.poolActions}>
                                                <button
                                                    className={styles.depositBtn}
                                                    onClick={() => { setActionModal({ pool, type: 'deposit' }); setActionAmount('') }}
                                                >
                                                    Deposit
                                                </button>
                                                <button
                                                    className={styles.withdrawBtn}
                                                    onClick={() => { setActionModal({ pool, type: 'withdraw' }); setActionAmount('') }}
                                                >
                                                    Withdraw
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Deposit/Withdraw Modal */}
            {actionModal && (
                <motion.div
                    className={styles.modalOverlay}
                    onClick={() => setActionModal(null)}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                >
                    <motion.div
                        className={styles.modalContent}
                        onClick={(e) => e.stopPropagation()}
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <h3>{actionModal.type === 'deposit' ? 'Deposit to' : 'Withdraw from'} {actionModal.pool.name}</h3>
                        <div className={styles.modalInput}>
                            <label>Amount (USDC)</label>
                            <input
                                type="number"
                                placeholder="1000"
                                value={actionAmount}
                                onChange={(e) => setActionAmount(e.target.value)}
                                min="1"
                            />
                        </div>
                        <div className={styles.modalActions}>
                            <button className={styles.cancelBtn} onClick={() => setActionModal(null)}>Cancel</button>
                            <button
                                className={styles.confirmBtn}
                                onClick={handleAction}
                                disabled={acting || !actionAmount || parseFloat(actionAmount) <= 0}
                            >
                                {acting ? <><Loader2 size={14} className={styles.spinner} /> Processing...</> : `${actionModal.type === 'deposit' ? 'Deposit' : 'Withdraw'}`}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </div>
    )
}
