import { useState } from 'react'
import styles from './MerchantDashboard.module.css'

export default function MerchantDashboard() {
    const [activeTab, setActiveTab] = useState('overview')

    return (
        <div className={styles.merchant}>
            <div className="container">
                <header className={styles.header}>
                    <h1 className="animate-fade-in">Merchant Dashboard</h1>
                    <button className={styles.createButton}>+ Create New Vault</button>
                </header>

                <div className={styles.statsGrid}>
                    <div className={`${styles.statCard} animate-slide-up delay-100`}>
                        <h3>Total Borrowed</h3>
                        <p className={styles.value}>$185,000</p>
                    </div>
                    <div className={`${styles.statCard} animate-slide-up delay-200`}>
                        <h3>Active Loans</h3>
                        <p className={styles.value}>3</p>
                    </div>
                    <div className={`${styles.statCard} animate-slide-up delay-300`}>
                        <h3>Next Repayment</h3>
                        <p className={styles.value}>$12,500</p>
                        <p className={styles.subtext}>Due in 5 days</p>
                    </div>
                    <div className={`${styles.statCard} animate-slide-up delay-400`}>
                        <h3>Credit Score</h3>
                        <p className={styles.value}>785</p>
                        <p className={styles.subtext}>Excellent (FairScale)</p>
                    </div>
                </div>

                <div className={`${styles.content} animate-slide-up delay-500`}>
                    <div className={styles.tabs}>
                        <button
                            className={activeTab === 'overview' ? styles.activeTab : ''}
                            onClick={() => setActiveTab('overview')}
                        >
                            Active Vaults
                        </button>
                        <button
                            className={activeTab === 'history' ? styles.activeTab : ''}
                            onClick={() => setActiveTab('history')}
                        >
                            History
                        </button>
                        <button
                            className={activeTab === 'settings' ? styles.activeTab : ''}
                            onClick={() => setActiveTab('settings')}
                        >
                            Settings
                        </button>
                    </div>

                    <div className={styles.vaultList}>
                        <div className={styles.vaultItem}>
                            <div className={styles.vaultInfo}>
                                <h4>Q1 Inventory Financing</h4>
                                <span className={styles.statusActive}>Active</span>
                            </div>
                            <div className={styles.progress}>
                                <div className={styles.progressInfo}>
                                    <span>$50,000 / $50,000</span>
                                    <span>100% Funded</span>
                                </div>
                                <div className={styles.progressBar}>
                                    <div className={styles.progressFill} style={{ width: '100%' }} />
                                </div>
                            </div>
                            <button className={styles.repayButton}>Make Repayment</button>
                        </div>

                        <div className={styles.vaultItem}>
                            <div className={styles.vaultInfo}>
                                <h4>Equipment Upgrade</h4>
                                <span className={styles.statusFundraising}>Fundraising</span>
                            </div>
                            <div className={styles.progress}>
                                <div className={styles.progressInfo}>
                                    <span>$15,000 / $30,000</span>
                                    <span>50% Funded</span>
                                </div>
                                <div className={styles.progressBar}>
                                    <div className={styles.progressFill} style={{ width: '50%' }} />
                                </div>
                            </div>
                            <button className={styles.manageButton}>Manage Vault</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
