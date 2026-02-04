import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { mockVaults } from '../lib/mockData'
import styles from './Vaults.module.css'

export default function Vaults() {
    const navigate = useNavigate()
    const [filter, setFilter] = useState('all')

    const filteredVaults = mockVaults.filter(vault => {
        if (filter === 'all') return true
        return vault.status === filter
    })

    const getStatusBadge = (status: string) => {
        const badges = {
            fundraising: { label: 'Fundraising', class: styles.statusFundraising },
            active: { label: 'Active', class: styles.statusActive },
            repaying: { label: 'Repaying', class: styles.statusRepaying },
            completed: { label: 'Completed', class: styles.statusCompleted },
        }
        return badges[status as keyof typeof badges] || badges.fundraising
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
        }).format(amount)
    }

    const calculateProgress = (raised: number, target: number) => {
        return Math.min((raised / target) * 100, 100)
    }

    const getDaysRemaining = (deadline: number) => {
        const days = Math.ceil((deadline - Date.now()) / (1000 * 60 * 60 * 24))
        return days > 0 ? `${days} days left` : 'Ended'
    }

    const getRiskColor = (score: string) => {
        if (score.includes('A')) return styles.riskA
        if (score.includes('B')) return styles.riskB
        if (score.includes('C')) return styles.riskC
        return styles.riskDefault
    }

    return (
        <div className={styles.vaults}>
            <div className="container">
                <header className={styles.header}>
                    <h1 className="animate-fade-in">Active Vaults</h1>
                    <p className={`${styles.subtitle} animate-slide-up delay-100`}>
                        Browse and invest in merchant funding vaults
                    </p>
                </header>

                <div className={`${styles.filters} animate-slide-up delay-200`}>
                    <button
                        className={filter === 'all' ? styles.filterActive : ''}
                        onClick={() => setFilter('all')}
                    >
                        All Vaults
                    </button>
                    <button
                        className={filter === 'fundraising' ? styles.filterActive : ''}
                        onClick={() => setFilter('fundraising')}
                    >
                        Fundraising
                    </button>
                    <button
                        className={filter === 'active' ? styles.filterActive : ''}
                        onClick={() => setFilter('active')}
                    >
                        Active
                    </button>
                    <button
                        className={filter === 'repaying' ? styles.filterActive : ''}
                        onClick={() => setFilter('repaying')}
                    >
                        Repaying
                    </button>
                    <button
                        className={filter === 'completed' ? styles.filterActive : ''}
                        onClick={() => setFilter('completed')}
                    >
                        Completed
                    </button>
                </div>

                <div className={styles.grid}>
                    {filteredVaults.map((vault, index) => {
                        const badge = getStatusBadge(vault.status)
                        const progress = calculateProgress(vault.totalRaised, vault.targetAmount)
                        const riskClass = getRiskColor(vault.riskScore)

                        return (
                            <div
                                key={vault.id}
                                className={`${styles.vaultCard} animate-slide-up`}
                                style={{ animationDelay: `${(index % 6) * 100}ms` }}
                                onClick={() => navigate(`/vaults/${vault.id}`)}
                            >
                                <div className={`${styles.riskBadge} ${riskClass}`}>
                                    <span>{vault.riskScore}</span>
                                </div>
                                <div className={styles.cardHeader}>
                                    <div>
                                        <h3>{vault.merchant}</h3>
                                        <span className={styles.category}>{vault.category}</span>
                                    </div>
                                    <span className={badge.class}>{badge.label}</span>
                                </div>

                                <p className={styles.description}>{vault.description}</p>

                                <div className={styles.stats}>
                                    <div className={styles.stat}>
                                        <span className={styles.statLabel}>Raised</span>
                                        <span className={styles.statValue}>
                                            {formatCurrency(vault.totalRaised)}
                                        </span>
                                    </div>
                                    <div className={styles.stat}>
                                        <span className={styles.statLabel}>Target</span>
                                        <span className={styles.statValue}>
                                            {formatCurrency(vault.targetAmount)}
                                        </span>
                                    </div>
                                    <div className={styles.stat}>
                                        <span className={styles.statLabel}>APY</span>
                                        <span className={styles.statValue}>{vault.interestRate}%</span>
                                    </div>
                                </div>

                                <div className={styles.progressBar}>
                                    <div
                                        className={styles.progressFill}
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>

                                <div className={styles.cardFooter}>
                                    <div className={styles.footerInfo}>
                                        <span>👥 {vault.investorCount} investors</span>
                                        <span>⏱ {vault.duration} months</span>
                                    </div>
                                    {vault.status === 'fundraising' && (
                                        <span className={styles.deadline}>
                                            {getDaysRemaining(vault.deadline)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>

                {filteredVaults.length === 0 && (
                    <div className={styles.empty}>
                        <p>No vaults found for this filter.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
