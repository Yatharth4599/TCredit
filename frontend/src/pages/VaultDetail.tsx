import { useParams, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { mockVaults } from '../lib/mockData'
import styles from './VaultDetail.module.css'

export default function VaultDetail() {
    const { id } = useParams()
    const navigate = useNavigate()
    const [investAmount, setInvestAmount] = useState('')
    const [showInvestModal, setShowInvestModal] = useState(false)

    const vault = mockVaults.find(v => v.id === id)

    if (!vault) {
        return (
            <div className={styles.notFound}>
                <h1>Vault not found</h1>
                <button onClick={() => navigate('/vaults')}>Back to Vaults</button>
            </div>
        )
    }

    const progress = Math.min((vault.totalRaised / vault.targetAmount) * 100, 100)
    const remaining = vault.targetAmount - vault.totalRaised

    const handleInvest = () => {
        // Mock investment
        alert(`Investment of $${investAmount} successful! You'll receive ${investAmount} debt tokens.`)
        setShowInvestModal(false)
        setInvestAmount('')
    }

    return (
        <div className={styles.vaultDetail}>
            <div className="container">
                <button className={styles.backButton} onClick={() => navigate('/vaults')}>
                    ← Back to Vaults
                </button>

                <div className={styles.content}>
                    <div className={styles.main}>
                        <header className={styles.header}>
                            <div>
                                <h1 className="animate-fade-in">{vault.merchant}</h1>
                                <p className={styles.category}>{vault.category}</p>
                            </div>
                            <div className={styles.riskBadge}>
                                Risk Score: {vault.riskScore}
                            </div>
                        </header>

                        <p className={styles.description}>{vault.description}</p>

                        <div className={styles.progressSection}>
                            <div className={styles.progressHeader}>
                                <span>${vault.totalRaised.toLocaleString()} raised</span>
                                <span>${vault.targetAmount.toLocaleString()} goal</span>
                            </div>
                            <div className={styles.progressBar}>
                                <div className={styles.progressFill} style={{ width: `${progress}%` }} />
                            </div>
                            <p className={styles.progressText}>
                                {progress.toFixed(1)}% funded • ${remaining.toLocaleString()} remaining
                            </p>
                        </div>

                        <div className={styles.statsGrid}>
                            <div className={styles.statCard}>
                                <span className={styles.statLabel}>Interest Rate</span>
                                <span className={styles.statValue}>{vault.interestRate}% APY</span>
                            </div>
                            <div className={styles.statCard}>
                                <span className={styles.statLabel}>Duration</span>
                                <span className={styles.statValue}>{vault.duration} months</span>
                            </div>
                            <div className={styles.statCard}>
                                <span className={styles.statLabel}>Tranches</span>
                                <span className={styles.statValue}>{vault.numTranches}</span>
                            </div>
                            <div className={styles.statCard}>
                                <span className={styles.statLabel}>Investors</span>
                                <span className={styles.statValue}>{vault.investorCount}</span>
                            </div>
                        </div>

                        <div className={styles.details}>
                            <h2>Vault Details</h2>
                            <div className={styles.detailItem}>
                                <span>Status</span>
                                <span className={styles.statusBadge}>{vault.status}</span>
                            </div>
                            <div className={styles.detailItem}>
                                <span>Minimum Investment</span>
                                <span>$100</span>
                            </div>
                            <div className={styles.detailItem}>
                                <span>Maximum Investment</span>
                                <span>$10,000</span>
                            </div>
                            <div className={styles.detailItem}>
                                <span>Repayment Schedule</span>
                                <span>Monthly</span>
                            </div>
                        </div>
                    </div>

                    <div className={styles.sidebar}>
                        <div className={styles.investCard}>
                            <h3>Invest in this Vault</h3>
                            <p>Earn {vault.interestRate}% APY on your investment</p>

                            <div className={styles.inputGroup}>
                                <label>Investment Amount (USDC)</label>
                                <input
                                    type="number"
                                    placeholder="Enter amount"
                                    value={investAmount}
                                    onChange={(e) => setInvestAmount(e.target.value)}
                                    min="100"
                                    max="10000"
                                />
                            </div>

                            {investAmount && (
                                <div className={styles.returns}>
                                    <div className={styles.returnItem}>
                                        <span>You'll receive</span>
                                        <span>{investAmount} Debt Tokens</span>
                                    </div>
                                    <div className={styles.returnItem}>
                                        <span>Estimated returns</span>
                                        <span>
                                            ${(parseFloat(investAmount) * (1 + vault.interestRate / 100)).toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            )}

                            <button
                                className={styles.investButton}
                                onClick={() => setShowInvestModal(true)}
                                disabled={!investAmount || parseFloat(investAmount) < 100}
                            >
                                Invest Now
                            </button>

                            <p className={styles.disclaimer}>
                                * Returns are not guaranteed. Please review vault details carefully.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {showInvestModal && (
                <div className={styles.modal} onClick={() => setShowInvestModal(false)}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <h2>Confirm Investment</h2>
                        <p>You're about to invest ${investAmount} in {vault.merchant}</p>
                        <div className={styles.modalStats}>
                            <div>
                                <span>Amount</span>
                                <span>${investAmount}</span>
                            </div>
                            <div>
                                <span>Debt Tokens</span>
                                <span>{investAmount}</span>
                            </div>
                            <div>
                                <span>Expected Returns</span>
                                <span>
                                    ${(parseFloat(investAmount) * (1 + vault.interestRate / 100)).toFixed(2)}
                                </span>
                            </div>
                        </div>
                        <div className={styles.modalActions}>
                            <button onClick={handleInvest} className={styles.confirmButton}>
                                Confirm Investment
                            </button>
                            <button onClick={() => setShowInvestModal(false)} className={styles.cancelButton}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
