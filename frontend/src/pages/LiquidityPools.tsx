import { useState, useEffect } from 'react'
import { mockLiquidityPools, mockPoolAllocations } from '../lib/mockData'
import styles from './LiquidityPools.module.css'

function fmt(n: number) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n)
}

export default function LiquidityPools() {
    const [mounted, setMounted] = useState(false)
    const [activeTab, setActiveTab] = useState<'all' | 'treasury' | 'co-owned'>('all')

    useEffect(() => { setMounted(true) }, [])

    const totalCapital = mockLiquidityPools.reduce((s, p) => s + p.totalCapital, 0)
    const totalDeployed = mockLiquidityPools.reduce((s, p) => s + p.deployed, 0)
    const totalAvailable = mockLiquidityPools.reduce((s, p) => s + p.available, 0)
    const avgApy = (mockLiquidityPools.reduce((s, p) => s + p.apy, 0) / mockLiquidityPools.length).toFixed(1)
    const utilization = ((totalDeployed / totalCapital) * 100).toFixed(1)

    const filteredPools = mockLiquidityPools.filter(p => {
        if (activeTab === 'all') return true
        return p.type === activeTab
    })

    return (
        <div className={styles.page}>
            <div className={styles.ambientGlow} />

            {/* Header */}
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
                <div className={styles.statCard}>
                    <span className={styles.statLabel}>Total Liquidity</span>
                    <span className={styles.statValue}>{fmt(totalCapital)}</span>
                </div>
                <div className={styles.statCard}>
                    <span className={styles.statLabel}>Deployed</span>
                    <span className={styles.statValue}>{fmt(totalDeployed)}</span>
                </div>
                <div className={styles.statCard}>
                    <span className={styles.statLabel}>Available</span>
                    <span className={styles.statValue}>{fmt(totalAvailable)}</span>
                </div>
                <div className={styles.statCard}>
                    <span className={styles.statLabel}>Utilization</span>
                    <span className={styles.statValue}>{utilization}%</span>
                </div>
                <div className={styles.statCard}>
                    <span className={styles.statLabel}>Avg APY</span>
                    <span className={`${styles.statValue} ${styles.apyValue}`}>{avgApy}%</span>
                </div>
            </div>

            {/* Filters */}
            <div className={`${styles.filters} ${mounted ? styles.visible : ''}`} style={{ transitionDelay: '0.15s' }}>
                {(['all', 'treasury', 'co-owned'] as const).map(tab => (
                    <button
                        key={tab}
                        className={`${styles.filterBtn} ${activeTab === tab ? styles.filterActive : ''}`}
                        onClick={() => setActiveTab(tab)}
                    >
                        {tab === 'all' ? 'All Pools' : tab === 'treasury' ? 'Treasury' : 'Co-owned'}
                    </button>
                ))}
            </div>

            {/* Pool Cards */}
            <div className={styles.poolGrid}>
                {filteredPools.map((pool, i) => (
                    <div
                        key={pool.id}
                        className={`${styles.poolCard} ${pool.type === 'treasury' ? styles.treasuryCard : ''} ${mounted ? styles.visible : ''}`}
                        style={{ transitionDelay: `${0.2 + i * 0.08}s` }}
                    >
                        <div className={styles.poolHeader}>
                            <div>
                                <div className={styles.poolType}>
                                    {pool.type === 'treasury' ? '🏛️ Treasury' : '🤝 Co-owned'}
                                </div>
                                <h3 className={styles.poolName}>{pool.name}</h3>
                            </div>
                            <div className={`${styles.statusBadge} ${pool.status === 'near-cap' ? styles.nearCap : styles.activeBadge}`}>
                                {pool.status === 'near-cap' ? 'Near Cap' : 'Active'}
                            </div>
                        </div>

                        {/* Utilization bar */}
                        <div className={styles.utilizationSection}>
                            <div className={styles.utilizationInfo}>
                                <span>Utilization</span>
                                <span>{((pool.deployed / pool.totalCapital) * 100).toFixed(0)}%</span>
                            </div>
                            <div className={styles.utilizationBar}>
                                <div
                                    className={styles.utilizationFill}
                                    style={{ width: `${(pool.deployed / pool.totalCapital) * 100}%` }}
                                />
                            </div>
                        </div>

                        {/* Pool Stats */}
                        <div className={styles.poolStats}>
                            <div className={styles.poolStat}>
                                <span className={styles.poolStatValue}>{fmt(pool.totalCapital)}</span>
                                <span className={styles.poolStatLabel}>Total Capital</span>
                            </div>
                            <div className={styles.poolStat}>
                                <span className={styles.poolStatValue}>{fmt(pool.deployed)}</span>
                                <span className={styles.poolStatLabel}>Deployed</span>
                            </div>
                            <div className={styles.poolStat}>
                                <span className={styles.poolStatValue}>{fmt(pool.available)}</span>
                                <span className={styles.poolStatLabel}>Available</span>
                            </div>
                        </div>

                        <div className={styles.poolFooter}>
                            <div className={styles.poolMeta}>
                                <span>{pool.apy}% APY</span>
                                <span>·</span>
                                <span>{pool.vaultAllocations} vaults</span>
                                <span>·</span>
                                <span>{pool.partnerCount} {pool.partnerCount === 1 ? 'partner' : 'partners'}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Allocations Table */}
            <div className={`${styles.allocationsSection} ${mounted ? styles.visible : ''}`} style={{ transitionDelay: '0.4s' }}>
                <h2 className={styles.sectionTitle}>Recent Allocations</h2>
                <div className={styles.allocationsTable}>
                    <div className={styles.tableHeader}>
                        <span>Pool</span>
                        <span>Vault</span>
                        <span>Amount</span>
                        <span>Date</span>
                        <span>Status</span>
                    </div>
                    {mockPoolAllocations.map(alloc => (
                        <div key={alloc.id} className={styles.tableRow}>
                            <span className={styles.cellPool}>{alloc.pool}</span>
                            <span className={styles.cellVault}>{alloc.vault}</span>
                            <span className={styles.cellAmount}>{fmt(alloc.amount)}</span>
                            <span className={styles.cellDate}>{alloc.date}</span>
                            <span className={`${styles.cellStatus} ${styles[`status${alloc.status.charAt(0).toUpperCase() + alloc.status.slice(1)}`]}`}>
                                {alloc.status}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
