import { useState } from 'react'
import { mockVaults } from '../lib/mockData'
import { GlassCard } from '../components/ui/GlassCard'
import { WaterfallChart } from '../components/charts/WaterfallChart'
import { TrendingUp, Users, Clock, Shield, X } from 'lucide-react'
import styles from './Vaults.module.css'

type Vault = typeof mockVaults[0]

const FILTERS = [
  { id: 'all', label: 'All Vaults' },
  { id: 'fundraising', label: 'Fundraising' },
  { id: 'active', label: 'Active' },
  { id: 'repaying', label: 'Repaying' },
]

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  fundraising: { label: 'Fundraising', color: '#FF6B35' },
  active: { label: 'Active', color: '#22c55e' },
  repaying: { label: 'Repaying', color: '#3b82f6' },
  completed: { label: 'Completed', color: '#888' },
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n)
}

export default function Vaults() {
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Vault | null>(null)
  const [investAmount, setInvestAmount] = useState('')

  const filtered = mockVaults.filter((v) => {
    const matchFilter = filter === 'all' || v.status === filter
    const matchSearch = v.merchant.toLowerCase().includes(search.toLowerCase()) ||
      v.category.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  const handleInvest = () => {
    if (!selected || !investAmount) return
    alert(`Investment of $${investAmount} in ${selected.merchant} submitted!`)
    setInvestAmount('')
  }

  return (
    <div className={styles.page}>
      <div className={styles.controls}>
        <input
          className={styles.search}
          type="text"
          placeholder="Search vaults or categories..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className={styles.filters}>
          {FILTERS.map((f) => (
            <button
              key={f.id}
              className={`${styles.pill} ${filter === f.id ? styles.pillActive : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.layout}>
        <div className={styles.grid}>
          {filtered.map((vault) => {
            const status = STATUS_CONFIG[vault.status] ?? STATUS_CONFIG.fundraising
            const progress = Math.min((vault.totalRaised / vault.targetAmount) * 100, 100)
            const isSelected = selected?.id === vault.id

            return (
              <GlassCard
                key={vault.id}
                variant={isSelected ? 'highlight' : 'interactive'}
                onClick={() => setSelected(vault)}
              >
                <div className={styles.cardTop}>
                  <div>
                    <h3 className={styles.merchant}>{vault.merchant}</h3>
                    <span className={styles.category}>{vault.category}</span>
                  </div>
                  <span
                    className={styles.statusBadge}
                    style={{ color: status.color, borderColor: `${status.color}33`, background: `${status.color}12` }}
                  >
                    {status.label}
                  </span>
                </div>

                <p className={styles.desc}>{vault.description}</p>

                <div className={styles.stats}>
                  <div className={styles.stat}>
                    <TrendingUp size={12} />
                    <span className={styles.statVal}>{vault.interestRate}%</span>
                    <span className={styles.statLbl}>APY</span>
                  </div>
                  <div className={styles.stat}>
                    <Clock size={12} />
                    <span className={styles.statVal}>{vault.duration}mo</span>
                    <span className={styles.statLbl}>Term</span>
                  </div>
                  <div className={styles.stat}>
                    <Users size={12} />
                    <span className={styles.statVal}>{vault.investorCount}</span>
                    <span className={styles.statLbl}>Investors</span>
                  </div>
                  <div className={styles.stat}>
                    <Shield size={12} />
                    <span className={styles.statVal}>{vault.riskScore}</span>
                    <span className={styles.statLbl}>Risk</span>
                  </div>
                </div>

                <div className={styles.progress}>
                  <div className={styles.progressHeader}>
                    <span>{fmt(vault.totalRaised)}</span>
                    <span className={styles.progressTarget}>of {fmt(vault.targetAmount)}</span>
                  </div>
                  <div className={styles.progressBar}>
                    <div className={styles.progressFill} style={{ width: `${progress}%` }} />
                  </div>
                </div>
              </GlassCard>
            )
          })}
          {filtered.length === 0 && (
            <div className={styles.empty}>No vaults match your search.</div>
          )}
        </div>

        {selected && (
          <aside className={styles.detail}>
            <GlassCard variant="highlight">
              <div className={styles.detailHeader}>
                <div>
                  <h2 className={styles.detailTitle}>{selected.merchant}</h2>
                  <span className={styles.detailCategory}>{selected.category}</span>
                </div>
                <button className={styles.closeBtn} onClick={() => setSelected(null)}>
                  <X size={16} />
                </button>
              </div>

              <p className={styles.detailDesc}>{selected.description}</p>

              <div className={styles.detailStats}>
                {[
                  { label: 'APY', value: `${selected.interestRate}%` },
                  { label: 'Term', value: `${selected.duration} mo` },
                  { label: 'Risk', value: selected.riskScore },
                  { label: 'Investors', value: String(selected.investorCount) },
                ].map((s) => (
                  <div key={s.label} className={styles.detailStat}>
                    <span className={styles.detailStatVal}>{s.value}</span>
                    <span className={styles.detailStatLbl}>{s.label}</span>
                  </div>
                ))}
              </div>

              {(selected.status === 'active' || selected.status === 'repaying') && (
                <div className={styles.waterfallSection}>
                  <WaterfallChart
                    totalAmount={selected.totalRaised}
                    seniorPayment={Math.round(selected.totalRaised * 0.5)}
                    poolPayment={Math.round(selected.totalRaised * 0.3)}
                    userPayment={Math.round(selected.totalRaised * 0.2)}
                  />
                </div>
              )}

              {selected.status === 'fundraising' && (
                <div className={styles.investSection}>
                  <h4 className={styles.investTitle}>Invest</h4>
                  <div className={styles.investInput}>
                    <span className={styles.inputPrefix}>USDC</span>
                    <input
                      type="number"
                      placeholder="100"
                      value={investAmount}
                      onChange={(e) => setInvestAmount(e.target.value)}
                      min="100"
                    />
                  </div>
                  {investAmount && parseFloat(investAmount) >= 100 && (
                    <div className={styles.returnPreview}>
                      <span>Expected return</span>
                      <span className={styles.returnVal}>
                        +{fmt(parseFloat(investAmount) * selected.interestRate / 100)}
                      </span>
                    </div>
                  )}
                  <button
                    className={styles.investBtn}
                    disabled={!investAmount || parseFloat(investAmount) < 100}
                    onClick={handleInvest}
                  >
                    Invest Now
                  </button>
                  <p className={styles.minNote}>Min. $100 · Max. $10,000 USDC</p>
                </div>
              )}
            </GlassCard>
          </aside>
        )}
      </div>
    </div>
  )
}
