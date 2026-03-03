import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { poolsApi } from '../api/client'
import type { ApiPool, ApiPoolsSummary } from '../api/types'
import { formatUSDC, weiToNumber, parseUSDCToWei } from '../lib/format'
import { useContractTx } from '../hooks/useContractTx'
import { useUSDCApproval } from '../hooks/useUSDCApproval'
import { Loader2 } from 'lucide-react'
import styles from './LiquidityPools.module.css'

export default function LiquidityPools() {
    const { address: walletAddress } = useAccount()
    const { execute: executeTx } = useContractTx()
    const [mounted, setMounted] = useState(false)
    const [pools, setPools] = useState<ApiPool[]>([])
    const [summary, setSummary] = useState<ApiPoolsSummary | null>(null)
    const [loading, setLoading] = useState(true)

    // Deposit/Withdraw modal state
    const [actionModal, setActionModal] = useState<{ pool: ApiPool; type: 'deposit' | 'withdraw' } | null>(null)
    const [actionAmount, setActionAmount] = useState('')
    const [acting, setActing] = useState(false)

    const { needsApproval, approve } = useUSDCApproval(actionModal?.pool.address || '')

    useEffect(() => { setMounted(true) }, [])

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
    const totalAvailable = summary ? weiToNumber(summary.totalAvailable) : 0
    const utilization = totalDeposits > 0 ? ((totalAllocated / totalDeposits) * 100).toFixed(1) : '0'

    return (
        <div className={styles.page}>
            <div className={styles.ambientGlow} />

            <header className={`${styles.header} ${mounted ? styles.visible : ''}`}>
                <div className={styles.headerContent}>
                    <span className={styles.overline}>Liquidity Infrastructure</span>
                    <h1 className={styles.title}>Liquidity Pools</h1>
                    <p className={styles.subtitle}>
                        Capital pools that fill vault shortfalls — powering programmable credit at scale.
                    </p>
                </div>
            </header>

            {/* Stats Row */}
            <div className={`${styles.statsRow} ${mounted ? styles.visible : ''}`} style={{ transitionDelay: '0.1s' }}>
                {loading ? (
                    <div className={styles.statCard}>
                        <Loader2 size={20} className={styles.spinner} />
                    </div>
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
                            <span className={styles.statValue}>{utilization}%</span>
                        </div>
                    </>
                )}
            </div>

            {/* Pool Cards */}
            <div className={styles.poolGrid}>
                {loading ? (
                    <div className={styles.loadingState}>
                        <Loader2 size={24} className={styles.spinner} />
                        <span>Loading pools...</span>
                    </div>
                ) : pools.length === 0 ? (
                    <div className={styles.emptyState}>No pools available.</div>
                ) : (
                    pools.map((pool, i) => (
                        <div
                            key={pool.address}
                            className={`${styles.poolCard} ${pool.isAlpha ? styles.treasuryCard : ''} ${mounted ? styles.visible : ''}`}
                            style={{ transitionDelay: `${0.2 + i * 0.08}s` }}
                        >
                            <div className={styles.poolHeader}>
                                <div>
                                    <div className={styles.poolType}>
                                        {pool.isAlpha ? 'Senior Pool' : 'General Pool'}
                                    </div>
                                    <h3 className={styles.poolName}>{pool.name}</h3>
                                </div>
                                <div className={`${styles.statusBadge} ${styles.activeBadge}`}>
                                    {pool.utilizationPct > 80 ? 'High Utilization' : 'Active'}
                                </div>
                            </div>

                            {/* Utilization bar */}
                            <div className={styles.utilizationSection}>
                                <div className={styles.utilizationInfo}>
                                    <span>Utilization</span>
                                    <span>{pool.utilizationPct}%</span>
                                </div>
                                <div className={styles.utilizationBar}>
                                    <div
                                        className={styles.utilizationFill}
                                        style={{ width: `${pool.utilizationPct}%` }}
                                    />
                                </div>
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
                        </div>
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
