import { useState } from 'react'
import { mockInvestments } from '../lib/mockData'
import styles from './Portfolio.module.css'

export default function Portfolio() {
    return (
        <div className={styles.portfolio}>
            <div className="container">
                <header className={styles.header}>
                    <h1 className="animate-fade-in">My Portfolio</h1>
                    <div className={styles.summaryGrid}>
                        <div className={`${styles.summaryCard} animate-slide-up delay-100`}>
                            <span className={styles.label}>Total Invested</span>
                            <span className={styles.value}>$16,000</span>
                        </div>
                        <div className={`${styles.summaryCard} animate-slide-up delay-200`}>
                            <span className={styles.label}>Active Returns</span>
                            <span className={styles.value}>$18,120</span>
                            <span className={styles.subtext}>+13.25%</span>
                        </div>
                        <div className={`${styles.summaryCard} animate-slide-up delay-300`}>
                            <span className={styles.label}>Claimable</span>
                            <span className={styles.value}>$1,250</span>
                            <button className={styles.claimButton}>Claim All</button>
                        </div>
                    </div>
                </header>

                <div className={`${styles.investments} animate-slide-up delay-400`}>
                    <h2>Your Investments</h2>
                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Vault / Merchant</th>
                                    <th>Status</th>
                                    <th>Invested</th>
                                    <th>Debt Tokens</th>
                                    <th>Returns</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {mockInvestments.map((inv) => (
                                    <tr key={inv.vaultId}>
                                        <td>
                                            <div className={styles.merchantCell}>
                                                <span className={styles.merchantName}>{inv.merchant}</span>
                                                <span className={styles.date}>
                                                    {new Date(inv.investedAt).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`${styles.statusBadge} ${styles[inv.status]}`}>
                                                {inv.status}
                                            </span>
                                        </td>
                                        <td>${inv.amountInvested.toLocaleString()}</td>
                                        <td>{inv.debtTokens.toLocaleString()}</td>
                                        <td>
                                            <div className={styles.returnsCell}>
                                                <span>${inv.totalReturns.toLocaleString()}</span>
                                                <span className={styles.claimed}>
                                                    Claimed: ${inv.claimedReturns.toLocaleString()}
                                                </span>
                                            </div>
                                        </td>
                                        <td>
                                            {inv.status === 'repaying' || inv.status === 'completed' ? (
                                                <button className={styles.actionButton}>Claim</button>
                                            ) : (
                                                <span className={styles.noAction}>-</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}
