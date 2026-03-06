import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { useAccount } from 'wagmi'
import { vaultsApi, investApi } from '../api/client'
import type { ApiVaultDetail, ApiInvestor, ApiTrancheResponse, ApiMilestone, ApiVaultEvent } from '../api/types'
import { formatUSDC, weiToNumber, truncateAddress, parseUSDCToWei } from '../lib/format'
import { useContractTx } from '../hooks/useContractTx'
import { useUSDCApproval } from '../hooks/useUSDCApproval'
import { WaterfallChart } from '../components/charts/WaterfallChart'
import { ArrowLeft, Loader2, CheckCircle, Clock, AlertTriangle, Users, Layers, TrendingUp } from 'lucide-react'
import { Skeleton } from '../components/ui/Skeleton'
import { STATUS_CONFIG } from '../lib/statusConfig'
import styles from './VaultDetail.module.css'

export default function VaultDetail() {
    const { address } = useParams<{ address: string }>()
    const navigate = useNavigate()
    const { address: walletAddress } = useAccount()
    const [vault, setVault] = useState<ApiVaultDetail | null>(null)
    const [investors, setInvestors] = useState<ApiInvestor[]>([])
    const [tranches, setTranches] = useState<ApiTrancheResponse | null>(null)
    const [milestones, setMilestones] = useState<ApiMilestone[]>([])
    const [repayments, setRepayments] = useState<ApiVaultEvent[]>([])
    const [loading, setLoading] = useState(true)
    const [investAmount, setInvestAmount] = useState('')
    const [investing, setInvesting] = useState(false)

    const { execute: executeTx } = useContractTx()
    const { needsApproval, approve } = useUSDCApproval(address || '')

    useEffect(() => {
        if (!address) return
        setLoading(true)

        Promise.all([
            vaultsApi.detail(address).then(r => setVault(r.data ?? null)).catch(() => setVault(null)),
            vaultsApi.investors(address).then(r => setInvestors(r.data?.investors ?? [])).catch(() => {}),
            vaultsApi.tranches(address).then(r => setTranches(r.data ?? null)).catch(() => {}),
            vaultsApi.milestones(address).then(r => setMilestones(r.data?.milestones ?? [])).catch(() => {}),
            vaultsApi.repayments(address).then(r => setRepayments(r.data?.repayments ?? [])).catch(() => {}),
        ]).finally(() => setLoading(false))
    }, [address])

    const handleInvest = async () => {
        if (!address || !investAmount || !walletAddress) return
        setInvesting(true)
        try {
            const weiAmount = parseUSDCToWei(investAmount)
            const amountBigInt = BigInt(weiAmount)

            // Step 1: Approve USDC if needed
            if (needsApproval(amountBigInt)) {
                const approved = await approve(amountBigInt)
                if (!approved) { setInvesting(false); return }
            }

            // Step 2: Build + sign invest tx
            const { data: unsignedTx } = await investApi.invest({ vaultAddress: address, amount: weiAmount })
            await executeTx(unsignedTx)
            setInvestAmount('')
        } catch {
            // Error handled by hook toasts
        } finally {
            setInvesting(false)
        }
    }

    if (loading) {
        return (
            <div className={styles.vaultDetail}>
                <div className="container">
                    <Skeleton width={120} height={34} borderRadius={999} style={{ marginBottom: 28 }} />
                    <div className={styles.content}>
                        <div className={styles.main}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                                <div>
                                    <Skeleton width={220} height={32} borderRadius={8} style={{ marginBottom: 8 }} />
                                    <Skeleton width={280} height={14} borderRadius={6} />
                                </div>
                                <Skeleton width={90} height={26} borderRadius={999} />
                            </div>
                            <div style={{ marginBottom: 28 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <Skeleton width={120} height={14} borderRadius={6} />
                                    <Skeleton width={120} height={14} borderRadius={6} />
                                </div>
                                <Skeleton width="100%" height={6} borderRadius={999} style={{ marginBottom: 8 }} />
                                <Skeleton width={160} height={12} borderRadius={4} />
                            </div>
                            <div className={styles.statsGrid}>
                                {Array.from({ length: 4 }).map((_, i) => (
                                    <div key={i} className={styles.statCard}>
                                        <Skeleton width={20} height={20} borderRadius={4} style={{ marginBottom: 10 }} />
                                        <Skeleton width="60%" height={12} borderRadius={4} style={{ marginBottom: 6 }} />
                                        <Skeleton width="80%" height={20} borderRadius={6} />
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className={styles.sidebar}>
                            <Skeleton width="100%" height={280} borderRadius={16} />
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    if (!vault) {
        return (
            <div className={styles.notFound}>
                <h1>Vault not found</h1>
                <button onClick={() => navigate('/app/vaults')}>Back to Vaults</button>
            </div>
        )
    }

    const status = STATUS_CONFIG[vault.state] ?? STATUS_CONFIG.fundraising
    const remaining = weiToNumber(vault.targetAmount) - weiToNumber(vault.totalRaised)

    return (
        <div className={styles.vaultDetail}>
            <div className="container">
                <button className={styles.backButton} onClick={() => navigate('/app/vaults')}>
                    <ArrowLeft size={16} /> Back to Vaults
                </button>

                <div className={styles.content}>
                    <div className={styles.main}>
                        <motion.header
                            className={styles.header}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                        >
                            <div>
                                <h1>{truncateAddress(vault.agent, 6)}</h1>
                                <p className={styles.category}>{truncateAddress(vault.address)}</p>
                            </div>
                            <span
                                className={styles.statusBadge}
                                style={{ color: status.color, borderColor: `${status.color}33`, background: `${status.color}12` }}
                            >
                                {status.label}
                            </span>
                        </motion.header>

                        <motion.div
                            className={styles.progressSection}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.08 }}
                        >
                            <div className={styles.progressHeader}>
                                <span>{formatUSDC(vault.totalRaised)} raised</span>
                                <span>{formatUSDC(vault.targetAmount)} goal</span>
                            </div>
                            <div className={styles.progressBar}>
                                <div className={styles.progressFill} style={{ width: `${vault.percentFunded}%` }} />
                            </div>
                            <p className={styles.progressText}>
                                {vault.percentFunded}% funded · {formatUSDC(String(Math.round(remaining * 1e6)))} remaining
                            </p>
                        </motion.div>

                        <motion.div
                            className={styles.statsGrid}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.16 }}
                        >
                            <div className={styles.statCard}>
                                <TrendingUp size={16} />
                                <span className={styles.statLabel}>Interest Rate</span>
                                <span className={styles.statValue}>{vault.interestRate}% APY</span>
                            </div>
                            <div className={styles.statCard}>
                                <Clock size={16} />
                                <span className={styles.statLabel}>Duration</span>
                                <span className={styles.statValue}>{vault.durationMonths} months</span>
                            </div>
                            <div className={styles.statCard}>
                                <Users size={16} />
                                <span className={styles.statLabel}>Investors</span>
                                <span className={styles.statValue}>{vault.investorCount}</span>
                            </div>
                            <div className={styles.statCard}>
                                <Layers size={16} />
                                <span className={styles.statLabel}>Tranches</span>
                                <span className={styles.statValue}>{vault.tranchesReleased}/{vault.numTranches}</span>
                            </div>
                        </motion.div>

                        {/* Waterfall Chart */}
                        {(vault.state === 'active' || vault.state === 'repaying') && vault.waterfall && (
                            <motion.div
                                className={styles.section}
                                initial={{ opacity: 0, y: 16 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: '-40px' }}
                                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                            >
                                <WaterfallChart
                                    totalAmount={weiToNumber(vault.totalRaised)}
                                    seniorPayment={weiToNumber(vault.waterfall.seniorRepaid)}
                                    poolPayment={weiToNumber(vault.waterfall.poolRepaid)}
                                    userPayment={weiToNumber(vault.waterfall.communityRepaid)}
                                />
                            </motion.div>
                        )}

                        {/* Tranches */}
                        {tranches && (
                            <motion.div
                                className={styles.section}
                                initial={{ opacity: 0, y: 16 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: '-40px' }}
                                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                            >
                                <h2 className={styles.sectionTitle}>Tranches</h2>
                                <div className={styles.trancheGrid}>
                                    {tranches.tranches.map((t) => (
                                        <div key={t.index} className={styles.trancheItem}>
                                            <span className={styles.trancheIndex}>#{t.index + 1}</span>
                                            {t.released ? (
                                                <CheckCircle size={16} className={styles.iconSuccess} />
                                            ) : (
                                                <Clock size={16} className={styles.iconMuted} />
                                            )}
                                            <span>{t.released ? 'Released' : 'Locked'}</span>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}

                        {/* Milestones */}
                        {milestones.length > 0 && (
                            <motion.div
                                className={styles.section}
                                initial={{ opacity: 0, y: 16 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: '-40px' }}
                                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                            >
                                <h2 className={styles.sectionTitle}>Milestones</h2>
                                {milestones.map((m) => (
                                    <div key={m.trancheIndex} className={styles.milestoneItem}>
                                        <div className={styles.milestoneHeader}>
                                            <span>Tranche #{m.trancheIndex + 1}</span>
                                            <span className={`${styles.milestoneStatus} ${m.status === 'approved' ? styles.iconSuccess : m.status === 'submitted' ? styles.iconInfo : styles.iconMuted}`}>
                                                {m.status}
                                            </span>
                                        </div>
                                        <div className={styles.milestoneDetail}>
                                            <span>Approvals: {m.approvalCount}</span>
                                            {m.submittedAt && <span>Submitted: {new Date(m.submittedAt).toLocaleDateString()}</span>}
                                        </div>
                                    </div>
                                ))}
                            </motion.div>
                        )}

                        {/* Investors */}
                        {investors.length > 0 && (
                            <motion.div
                                className={styles.section}
                                initial={{ opacity: 0, y: 16 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: '-40px' }}
                                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                            >
                                <h2 className={styles.sectionTitle}>Investors ({investors.length})</h2>
                                <div className={styles.investorList}>
                                    {investors.slice(0, 10).map((inv) => (
                                        <div key={inv.investor} className={styles.investorItem}>
                                            <span className={styles.investorAddr}>{truncateAddress(inv.investor)}</span>
                                            <span>{formatUSDC(inv.balance)}</span>
                                            <span className={styles.claimable}>{formatUSDC(inv.claimable)} claimable</span>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}

                        {/* Repayment History */}
                        {repayments.length > 0 && (
                            <motion.div
                                className={styles.section}
                                initial={{ opacity: 0, y: 16 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: '-40px' }}
                                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                            >
                                <h2 className={styles.sectionTitle}>Repayment History</h2>
                                {repayments.slice(0, 10).map((evt) => (
                                    <div key={evt.id} className={styles.repaymentItem}>
                                        <span className={styles.repaymentType}>{evt.eventType}</span>
                                        <span className={styles.repaymentDate}>{new Date(evt.timestamp).toLocaleDateString()}</span>
                                        <a
                                            href={`https://sepolia.basescan.org/tx/${evt.txHash}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={styles.txLink}
                                        >
                                            {truncateAddress(evt.txHash)}
                                        </a>
                                    </div>
                                ))}
                            </motion.div>
                        )}
                    </div>

                    {/* Sidebar: Invest panel */}
                    <div className={styles.sidebar}>
                        <div className={styles.investCard}>
                            {vault.state === 'fundraising' ? (
                                <>
                                    <h3>Invest in this Vault</h3>
                                    <p>Earn {vault.interestRate}% APY on your investment</p>

                                    <div className={styles.inputGroup}>
                                        <label>Investment Amount (USDC)</label>
                                        <input
                                            type="number"
                                            placeholder="Enter amount"
                                            value={investAmount}
                                            onChange={(e) => setInvestAmount(e.target.value)}
                                            min="1"
                                        />
                                    </div>

                                    {investAmount && parseFloat(investAmount) > 0 && (
                                        <div className={styles.returns}>
                                            <div className={styles.returnItem}>
                                                <span>Expected returns</span>
                                                <span>
                                                    {formatUSDC(String(Math.round(parseFloat(investAmount) * (1 + vault.interestRate / 100) * 1e6)))}
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    <button
                                        className={styles.investButton}
                                        onClick={handleInvest}
                                        disabled={!walletAddress || !investAmount || parseFloat(investAmount) < 1 || investing}
                                    >
                                        {investing ? (
                                            <><Loader2 size={16} className={styles.spinner} /> Processing...</>
                                        ) : !walletAddress ? (
                                            'Connect Wallet'
                                        ) : (
                                            'Invest Now'
                                        )}
                                    </button>

                                    <p className={styles.disclaimer}>
                                        Returns are not guaranteed. Review vault details carefully.
                                    </p>
                                </>
                            ) : vault.state === 'defaulted' ? (
                                <div className={styles.statusMessage}>
                                    <AlertTriangle size={24} className={styles.iconError} />
                                    <h3>Vault Defaulted</h3>
                                    <p>This vault has been marked as defaulted.</p>
                                </div>
                            ) : vault.state === 'completed' ? (
                                <div className={styles.statusMessage}>
                                    <CheckCircle size={24} className={styles.iconSuccess} />
                                    <h3>Vault Completed</h3>
                                    <p>This vault has been fully repaid.</p>
                                </div>
                            ) : (
                                <div className={styles.statusMessage}>
                                    <Clock size={24} className={styles.iconInfo} />
                                    <h3>Vault {status.label}</h3>
                                    <p>Repaid: {formatUSDC(vault.totalRepaid)} of {formatUSDC(vault.totalToRepay)}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
