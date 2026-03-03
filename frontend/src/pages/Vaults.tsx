import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { vaultsApi } from '../api/client'
import type { ApiVault, ApiVaultDetail } from '../api/types'
import { formatUSDC, weiToNumber, truncateAddress, bpsToPercent } from '../lib/format'
import { GlassCard } from '../components/ui/GlassCard'
import { WaterfallChart } from '../components/charts/WaterfallChart'
import { TrendingUp, Users, Clock, Layers, X, ExternalLink, Loader2 } from 'lucide-react'
import styles from './Vaults.module.css'

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
  defaulted: { label: 'Defaulted', color: '#ef4444' },
  cancelled: { label: 'Cancelled', color: '#666' },
}

export default function Vaults() {
  const navigate = useNavigate()
  const { address: walletAddress } = useAccount()
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [vaults, setVaults] = useState<ApiVault[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ApiVaultDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [investAmount, setInvestAmount] = useState('')

  // Fetch vaults from API
  useEffect(() => {
    setLoading(true)
    const params = filter !== 'all' ? { state: filter } : undefined
    vaultsApi.list(params)
      .then(({ data }) => setVaults(data.vaults))
      .catch(() => setVaults([]))
      .finally(() => setLoading(false))
  }, [filter])

  // Fetch vault detail when selected
  const selectVault = async (vault: ApiVault) => {
    setDetailLoading(true)
    try {
      const { data } = await vaultsApi.detail(vault.address)
      setSelected(data)
    } catch {
      setSelected(null)
    } finally {
      setDetailLoading(false)
    }
  }

  const filtered = vaults.filter((v) => {
    const matchSearch = v.agent.toLowerCase().includes(search.toLowerCase()) ||
      v.address.toLowerCase().includes(search.toLowerCase())
    return matchSearch
  })

  return (
    <div className={styles.page}>
      <div className={styles.controls}>
        <input
          className={styles.search}
          type="text"
          placeholder="Search by address..."
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
          {loading ? (
            <div className={styles.empty}>
              <Loader2 size={24} className={styles.spinner} />
              <span>Loading vaults...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className={styles.empty}>No vaults match your search.</div>
          ) : (
            filtered.map((vault) => {
              const status = STATUS_CONFIG[vault.state] ?? STATUS_CONFIG.fundraising
              const isSelected = selected?.address === vault.address

              return (
                <GlassCard
                  key={vault.address}
                  variant={isSelected ? 'highlight' : 'interactive'}
                  onClick={() => selectVault(vault)}
                >
                  <div className={styles.cardTop}>
                    <div>
                      <h3 className={styles.merchant}>{truncateAddress(vault.agent, 6)}</h3>
                      <span className={styles.category}>{truncateAddress(vault.address)}</span>
                    </div>
                    <span
                      className={styles.statusBadge}
                      style={{ color: status.color, borderColor: `${status.color}33`, background: `${status.color}12` }}
                    >
                      {status.label}
                    </span>
                  </div>

                  <p className={styles.desc}>
                    {vault.numTranches} tranches · {vault.durationMonths}mo term · {bpsToPercent(vault.interestRateBps)} APY
                  </p>

                  <div className={styles.stats}>
                    <div className={styles.stat}>
                      <TrendingUp size={12} />
                      <span className={styles.statVal}>{vault.interestRate}%</span>
                      <span className={styles.statLbl}>APY</span>
                    </div>
                    <div className={styles.stat}>
                      <Clock size={12} />
                      <span className={styles.statVal}>{vault.durationMonths}mo</span>
                      <span className={styles.statLbl}>Term</span>
                    </div>
                    <div className={styles.stat}>
                      <Layers size={12} />
                      <span className={styles.statVal}>{vault.tranchesReleased}/{vault.numTranches}</span>
                      <span className={styles.statLbl}>Tranches</span>
                    </div>
                    <div className={styles.stat}>
                      <Users size={12} />
                      <span className={styles.statVal}>{vault.percentFunded}%</span>
                      <span className={styles.statLbl}>Funded</span>
                    </div>
                  </div>

                  <div className={styles.progress}>
                    <div className={styles.progressHeader}>
                      <span>{formatUSDC(vault.totalRaised)}</span>
                      <span className={styles.progressTarget}>of {formatUSDC(vault.targetAmount)}</span>
                    </div>
                    <div className={styles.progressBar}>
                      <div className={styles.progressFill} style={{ width: `${vault.percentFunded}%` }} />
                    </div>
                  </div>
                </GlassCard>
              )
            })
          )}
        </div>

        {(selected || detailLoading) && (
          <aside className={styles.detail}>
            <GlassCard variant="highlight">
              {detailLoading ? (
                <div className={styles.empty}>
                  <Loader2 size={20} className={styles.spinner} />
                  <span>Loading details...</span>
                </div>
              ) : selected && (
                <>
                  <div className={styles.detailHeader}>
                    <div>
                      <h2 className={styles.detailTitle}>{truncateAddress(selected.agent, 6)}</h2>
                      <span className={styles.detailCategory}>{truncateAddress(selected.address)}</span>
                    </div>
                    <button className={styles.closeBtn} onClick={() => setSelected(null)}>
                      <X size={16} />
                    </button>
                  </div>

                  <div className={styles.detailStats}>
                    {[
                      { label: 'APY', value: `${selected.interestRate}%` },
                      { label: 'Term', value: `${selected.durationMonths} mo` },
                      { label: 'Tranches', value: `${selected.tranchesReleased}/${selected.numTranches}` },
                      { label: 'Investors', value: String(selected.investorCount) },
                    ].map((s) => (
                      <div key={s.label} className={styles.detailStat}>
                        <span className={styles.detailStatVal}>{s.value}</span>
                        <span className={styles.detailStatLbl}>{s.label}</span>
                      </div>
                    ))}
                  </div>

                  {(selected.state === 'active' || selected.state === 'repaying') && selected.waterfall && (
                    <div className={styles.waterfallSection}>
                      <WaterfallChart
                        totalAmount={weiToNumber(selected.totalRaised)}
                        seniorPayment={weiToNumber(selected.waterfall.seniorRepaid)}
                        poolPayment={weiToNumber(selected.waterfall.poolRepaid)}
                        userPayment={weiToNumber(selected.waterfall.communityRepaid)}
                      />
                    </div>
                  )}

                  {selected.state === 'fundraising' && (
                    <div className={styles.investSection}>
                      <h4 className={styles.investTitle}>Invest</h4>
                      <div className={styles.investInput}>
                        <span className={styles.inputPrefix}>USDC</span>
                        <input
                          type="number"
                          placeholder="100"
                          value={investAmount}
                          onChange={(e) => setInvestAmount(e.target.value)}
                          min="1"
                        />
                      </div>
                      {investAmount && parseFloat(investAmount) >= 1 && (
                        <div className={styles.returnPreview}>
                          <span>Expected return</span>
                          <span className={styles.returnVal}>
                            +{formatUSDC(String(Math.round(parseFloat(investAmount) * selected.interestRate / 100 * 1e6)))}
                          </span>
                        </div>
                      )}
                      <button
                        className={styles.investBtn}
                        disabled={!walletAddress || !investAmount || parseFloat(investAmount) < 1}
                        onClick={() => navigate(`/vaults/${selected.address}`)}
                      >
                        {walletAddress ? 'Invest Now' : 'Connect Wallet'}
                      </button>
                    </div>
                  )}

                  <button
                    className={styles.investBtn}
                    style={{ marginTop: 8, background: 'transparent', border: '1px solid rgba(255,255,255,0.15)' }}
                    onClick={() => navigate(`/vaults/${selected.address}`)}
                  >
                    <ExternalLink size={14} />
                    <span style={{ marginLeft: 6 }}>View Full Details</span>
                  </button>
                </>
              )}
            </GlassCard>
          </aside>
        )}
      </div>
    </div>
  )
}
