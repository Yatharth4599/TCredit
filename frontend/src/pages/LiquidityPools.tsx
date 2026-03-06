import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { motion } from 'motion/react'
import { poolsApi } from '../api/client'
import type { ApiPool, ApiPoolsSummary } from '../api/types'
import { formatUSDC, weiToNumber, parseUSDCToWei } from '../lib/format'
import { useContractTx } from '../hooks/useContractTx'
import { useUSDCApproval } from '../hooks/useUSDCApproval'
import { AnimatedNumber } from '../components/ui/AnimatedNumber'
import { Loader2 } from 'lucide-react'
import { Skeleton } from '../components/ui/Skeleton'
import styles from './LiquidityPools.module.css'

export default function LiquidityPools() {
    const { address: walletAddress } = useAccount()
    const { execute: executeTx } = useContractTx()
    const [pools, setPools] = useState<ApiPool[]>([])
    const [summary, setSummary] = useState<ApiPoolsSummary | null>(null)
    const [loading, setLoading] = useState(true)

    // Deposit/Withdraw modal state
    const [actionModal, setActionModal] = useState<{ pool: ApiPool; type: 'deposit' | 'withdraw' } | null>(null)
    const [actionAmount, setActionAmount] = useState('')
    const [acting, setActing] = useState(false)

    const { needsApproval, approve } = useUSDCApproval(actionModal?.pool.address || '')


    useEffect(() => {
        setLoading(true)
        poolsApi.list()
            .then(({ data }) => {
                setPools(data?.pools ?? [])
                setSummary(data?.summary ?? null)
            })
            .catch(() => {
                setPools([])
                setSummary(null)
            })
            .finally(() => setLoading(false))
    }, [])

    const handleAction = async () => {
        if (!actionModal || !actionAmount || !walletAddress) return
        setActing(true)
        try {
            const weiAmount = parseUSDCToWei(actionAmount)

            if (actionModal.type === 'deposit') {
                // Approve USDC if needed
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
            // Refresh
            poolsApi.list().then(({ data }) => { setPools(data?.pools ?? []); setSummary(data?.summary ?? null) }).catch(() => {})
        } catch {
            // Error handled by toast
        } finally {
            setActing(false)
        }
    }

    const totalDeposits = summary ? weiToNumber(summary.totalDeposits) : 0
    const totalAllocated = summary ? weiToNumber(summary.totalAllocated) : 0
    const utilization = totalDeposits > 0 ? ((totalAllocated / totalDeposits) * 100).toFixed(1) : '0'

    return (
        <div className={styles.page}>
            <div className={styles.ambientGlow} />

            <motion.header
                className={styles.header}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
                <div className={styles.headerContent}>
                    <span className={styles.overline}>Liquidity Infrastructure</span>
                    <h1 className={styles.title}>Liquidity Pools</h1>
                    <p className={styles.subtitle}>
                        Capital pools that fill vault shortfalls — powering programmable credit at scale.
                    </p>
                </div>
            </motion.header>

            {/* Stats Row */}
            <motion.div
                className={styles.statsRow}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
            >
                {loading ? (
                    <>
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className={styles.statCard}>
                                <Skeleton width={80} height={11} borderRadius={4} style={{ marginBottom: 10 }} />
                                <Skeleton width={120} height={22} borderRadius={6} />
                            </div>
                        ))}
                    </>
                ) : (
                    <>
                        <div className={styles.statCard}>
                            <span className={styles.statLabel}>Total Deposits</span>
                            <span className={styles.statValue}>{formatUSDC(summary?.totalDeposits || '0')}</span>
                        </div>
                        <div className={styles.statCard}>
                            <span className={styles.statLabel}>Deployed</span>
                            <span className={styles.statValue}>{formatUSDC(summary?.totalAllocated || '0')}</span>
                        </div>
                        <div className={styles.statCard}>
                            <span className={styles.statLabel}>Available</span>
                            <span className={styles.statValue}>{formatUSDC(summary?.totalAvailable || '0')}</span>
                        </div>
                        <div className={styles.statCard}>
                            <span className={styles.statLabel}>Utilization</span>
                            <AnimatedNumber
                                value={parseFloat(utilization)}
                                suffix="%"
                                decimals={1}
                                className={`${styles.statValue} ${styles.apyValue}`}
                            />
                        </div>
                    </>
                )}
            </motion.div>

            {/* Pool Cards */}
            <div className={styles.poolGrid}>
                {loading ? (
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
                                <Skeleton width={90} height={36} borderRadius={999} />
                                <Skeleton width={90} height={36} borderRadius={999} />
                            </div>
                        </div>
                    ))
                ) : pools.length === 0 ? (
                    <div className={styles.emptyState}>No pools available.</div>
                ) : (
                    pools.map((pool, i) => (
                        <motion.div
                            key={pool.address}
                            className={`${styles.poolCard} ${pool.isAlpha ? styles.treasuryCard : ''}`}
                            initial={{ opacity: 0, y: 24 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: '-40px' }}
                            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.2 + i * 0.08 }}
                            whileHover={{ y: -3, transition: { duration: 0.2 } }}
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

                            {/* Utilization bar — animated, no label */}
                            <div className={styles.utilizationBar}>
                                <motion.div
                                    className={styles.utilizationFill}
                                    initial={{ width: 0 }}
                                    whileInView={{ width: `${pool.utilizationPct}%` }}
                                    viewport={{ once: true }}
                                    transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.3 + i * 0.08 }}
                                />
                            </div>

                            {/* Pool Stats */}
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
                                <div className={styles.poolActions}>
                                    <button
                                        className={styles.depositBtn}
                                        onClick={() => { setActionModal({ pool, type: 'deposit' }); setActionAmount('') }}
                                        disabled={!walletAddress}
                                    >
                                        Deposit
                                    </button>
                                    <button
                                        className={styles.withdrawBtn}
                                        onClick={() => { setActionModal({ pool, type: 'withdraw' }); setActionAmount('') }}
                                        disabled={!walletAddress}
                                    >
                                        Withdraw
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    ))
                )}
            </div>

            {/* Deposit/Withdraw Modal */}
            {actionModal && (
                <div className={styles.modalOverlay} onClick={() => setActionModal(null)}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
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
                    </div>
                </div>
            )}
        </div>
    )
}
