import { useState } from 'react'
import { mockVaults } from '../lib/mockData'
import { Lamp } from '../components/ui/Lamp'
import styles from './Vaults.module.css'

type Vault = typeof mockVaults[0]

export default function Vaults() {
    const [filter, setFilter] = useState('all')
    const [search, setSearch] = useState('')
    const [selectedVault, setSelectedVault] = useState<Vault | null>(null)
    const [investAmount, setInvestAmount] = useState('')

    const filters = [
        { id: 'all', label: 'All' },
        { id: 'fundraising', label: 'Fundraising' },
        { id: 'active', label: 'Active' },
    ]

    const filteredVaults = mockVaults.filter(vault => {
        const matchesFilter = filter === 'all' || vault.status === filter
        const matchesSearch = vault.merchant.toLowerCase().includes(search.toLowerCase()) ||
            vault.category.toLowerCase().includes(search.toLowerCase())
        return matchesFilter && matchesSearch
    })

    const getStatusBadge = (status: string) => {
        const badges: Record<string, { label: string; class: string }> = {
            fundraising: { label: 'Fundraising', class: styles.tagFundraising },
            active: { label: 'Active', class: styles.tagActive },
            repaying: { label: 'Repaying', class: styles.tagRepaying },
            completed: { label: 'Completed', class: styles.tagCompleted },
        }
        return badges[status] || badges.fundraising
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

    const handleInvest = () => {
        if (!selectedVault || !investAmount) return
        alert(`Investment of $${investAmount} in ${selectedVault.merchant} successful!`)
        setInvestAmount('')
    }

    // Vaults sorted by APY for comparison
    const vaultsByAPY = [...mockVaults].sort((a, b) => b.interestRate - a.interestRate)

    return (
        <div className={styles.dashboard}>
            {/* Left Sidebar - Vault List */}
            <aside className={styles.sidebar}>
                <div className={styles.searchBox}>
                    <input
                        type="text"
                        placeholder="Search vaults..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className={styles.filters}>
                    {filters.map((f) => (
                        <button
                            key={f.id}
                            className={`${styles.filterTag} ${filter === f.id ? styles.filterActive : ''}`}
                            onClick={() => setFilter(f.id)}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                <div className={styles.vaultList}>
                    {filteredVaults.map((vault) => {
                        const badge = getStatusBadge(vault.status)
                        const isSelected = selectedVault?.id === vault.id

                        return (
                            <div
                                key={vault.id}
                                className={`${styles.vaultItem} ${isSelected ? styles.vaultItemSelected : ''}`}
                                onClick={() => setSelectedVault(vault)}
                            >
                                <div className={styles.vaultHeader}>
                                    <h3>{vault.merchant}</h3>
                                    <span className={badge.class}>{badge.label}</span>
                                </div>
                                <p className={styles.vaultDesc}>{vault.description}</p>
                                <span className={styles.vaultMeta}>
                                    {vault.category} · {vault.interestRate}% APY
                                </span>
                            </div>
                        )
                    })}

                    {filteredVaults.length === 0 && (
                        <div className={styles.emptyList}>
                            <p>No vaults found</p>
                        </div>
                    )}
                </div>
            </aside>

            {/* Center - Vault Details with Lamp */}
            <main className={styles.detailPanel}>
                <Lamp active={!!selectedVault}>
                    {selectedVault ? (
                        <div className={styles.detailContent}>
                            <div className={styles.detailHeader}>
                                <div>
                                    <h1>{selectedVault.merchant}</h1>
                                    <p className={styles.detailCategory}>{selectedVault.category}</p>
                                </div>
                                <div className={styles.riskBadge}>
                                    <span className={styles.riskLabel}>Risk</span>
                                    <span className={styles.riskValue}>{selectedVault.riskScore}</span>
                                </div>
                            </div>

                            <p className={styles.detailDescription}>{selectedVault.description}</p>

                            <div className={styles.statsRow}>
                                <div className={styles.statItem}>
                                    <span className={styles.statValue}>{selectedVault.interestRate}%</span>
                                    <span className={styles.statLabel}>APY</span>
                                </div>
                                <div className={styles.statItem}>
                                    <span className={styles.statValue}>{selectedVault.duration}</span>
                                    <span className={styles.statLabel}>Months</span>
                                </div>
                                <div className={styles.statItem}>
                                    <span className={styles.statValue}>{selectedVault.investorCount}</span>
                                    <span className={styles.statLabel}>Investors</span>
                                </div>
                            </div>

                            <div className={styles.fundingSection}>
                                <div className={styles.fundingHeader}>
                                    <span className={styles.fundingRaised}>{formatCurrency(selectedVault.totalRaised)}</span>
                                    <span className={styles.fundingTarget}>of {formatCurrency(selectedVault.targetAmount)}</span>
                                </div>
                                <div className={styles.progressBar}>
                                    <div
                                        className={styles.progressFill}
                                        style={{ width: `${calculateProgress(selectedVault.totalRaised, selectedVault.targetAmount)}%` }}
                                    />
                                </div>
                                <span className={styles.fundingPercent}>
                                    {calculateProgress(selectedVault.totalRaised, selectedVault.targetAmount).toFixed(0)}% funded
                                </span>
                            </div>

                            <div className={styles.investCard}>
                                <h3>Invest in this Vault</h3>
                                <div className={styles.investInput}>
                                    <span className={styles.inputPrefix}>$</span>
                                    <input
                                        type="number"
                                        placeholder="Enter amount"
                                        value={investAmount}
                                        onChange={(e) => setInvestAmount(e.target.value)}
                                        min="100"
                                    />
                                    <span className={styles.inputSuffix}>USDC</span>
                                </div>

                                {investAmount && parseFloat(investAmount) >= 100 && (
                                    <div className={styles.returnPreview}>
                                        <div className={styles.returnRow}>
                                            <span>Expected Return</span>
                                            <span>${(parseFloat(investAmount) * (1 + selectedVault.interestRate / 100)).toFixed(2)}</span>
                                        </div>
                                        <div className={styles.returnRow}>
                                            <span>Profit</span>
                                            <span className={styles.profit}>+${(parseFloat(investAmount) * selectedVault.interestRate / 100).toFixed(2)}</span>
                                        </div>
                                    </div>
                                )}

                                <button
                                    className={styles.investBtn}
                                    disabled={!investAmount || parseFloat(investAmount) < 100}
                                    onClick={handleInvest}
                                >
                                    Invest Now
                                </button>
                                <p className={styles.minInvest}>Min. $100 · Max. $10,000</p>
                            </div>
                        </div>
                    ) : (
                        <div className={styles.emptyState}>
                            <h2>Select a Vault</h2>
                            <p>Choose a vault to view details and invest</p>
                        </div>
                    )}
                </Lamp>
            </main>

            {/* Right Sidebar - APY Comparison */}
            <aside className={styles.comparePanel}>
                <div className={styles.compareHeader}>
                    <h2>APY Ranking</h2>
                </div>
                <div className={styles.compareList}>
                    {vaultsByAPY.map((vault, index) => {
                        const progress = calculateProgress(vault.totalRaised, vault.targetAmount)
                        const isSelected = selectedVault?.id === vault.id

                        return (
                            <div
                                key={vault.id}
                                className={`${styles.compareRow} ${isSelected ? styles.compareRowActive : ''}`}
                                onClick={() => setSelectedVault(vault)}
                            >
                                <span className={`${styles.rank} ${index < 3 ? styles[`rank${index + 1}`] : ''}`}>
                                    {index + 1}
                                </span>
                                <div className={styles.compareInfo}>
                                    <span className={styles.compareName}>{vault.merchant}</span>
                                    <div className={styles.compareMeta}>
                                        <span className={styles.compareRisk}>{vault.riskScore}</span>
                                        <span className={styles.compareDuration}>{vault.duration}mo</span>
                                    </div>
                                </div>
                                <div className={styles.compareRight}>
                                    <span className={styles.compareApy}>{vault.interestRate}%</span>
                                    <div className={styles.miniBar}>
                                        <div className={styles.miniBarFill} style={{ width: `${progress}%` }} />
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </aside>
        </div>
    )
}
