import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { motion, AnimatePresence } from 'motion/react'
import { vaultsApi } from '../api/client'
import type { ApiVault, ApiVaultDetail } from '../api/types'
import { formatUSDC, weiToNumber, truncateAddress } from '../lib/format'
import { STATUS_CONFIG } from '../lib/statusConfig'
import { AnimatedNumber } from '../components/ui/AnimatedNumber'
import { WaterfallChart } from '../components/charts/WaterfallChart'
import { X, ExternalLink, Loader2 } from 'lucide-react'
import { Skeleton } from '../components/ui/Skeleton'
import styles from './Vaults.module.css'

const FILTERS = [
  { id: 'all', label: 'All Vaults' },
  { id: 'fundraising', label: 'Fundraising' },
  { id: 'active', label: 'Active' },
  { id: 'repaying', label: 'Repaying' },
]

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

  useEffect(() => {
    setLoading(true)
    const params = filter !== 'all' ? { state: filter } : undefined
    vaultsApi.list(params)
      .then(({ data }) => setVaults(data?.vaults ?? []))
      .catch(() => setVaults([]))
      .finally(() => setLoading(false))
  }, [filter])

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
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={styles.vaultCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <Skeleton width={52} height={34} borderRadius={6} style={{ marginBottom: 4 }} />
                    <Skeleton width={32} height={12} borderRadius={4} />
                  </div>
                  <Skeleton width={80} height={22} borderRadius={999} />
                </div>
                <Skeleton width="55%" height={15} borderRadius={6} style={{ marginBottom: 14 }} />
                <Skeleton width="100%" height={6} borderRadius={999} style={{ marginBottom: 10 }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <Skeleton width={70} height={12} borderRadius={4} />
                  <Skeleton width={50} height={12} borderRadius={4} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Skeleton width={40} height={12} borderRadius={4} />
                  <Skeleton width={80} height={12} borderRadius={4} />
                </div>
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className={styles.empty}>No vaults match your search.</div>
          ) : (
            filtered.map((vault, index) => {
              const status = STATUS_CONFIG[vault.state] ?? STATUS_CONFIG.fundraising
              const isSelected = selected?.address === vault.address

              return (
                <motion.div
                  key={vault.address}
                  className={`${styles.vaultCard} ${isSelected ? styles.selected : ''}`}
                  style={{ '--status-color': status.color } as React.CSSProperties}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: index * 0.06 }}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  onClick={() => selectVault(vault)}
                >
                  <div className={styles.vaultCardTop}>
                    <div className={styles.vaultApy}>
                      <AnimatedNumber
                        value={vault.interestRate}
                        suffix="%"
                        decimals={1}
                        className={styles.vaultApyVal}
                      />
                      <span className={styles.vaultApyLabel}>APY</span>
                    </div>
                    <span
                      className={styles.vaultStatusBadge}
                      style={{ color: status.color, background: `${status.color}18` }}
                    >
                      {status.label}
                    </span>
                  </div>

                  <h3 className={styles.vaultMerchant}>{truncateAddress(vault.agent, 6)}</h3>

                  <div className={styles.vaultProgressWrap}>
                    <div className={styles.vaultProgressTrack}>
                      <motion.div
                        className={styles.vaultProgressFill}
                        style={{ background: status.color }}
                        initial={{ width: 0 }}
                        whileInView={{ width: `${vault.percentFunded}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 + index * 0.06 }}
                      />
                    </div>
                  </div>

                  <div className={styles.vaultMeta}>
                    <span className={styles.vaultRaised}>{formatUSDC(vault.totalRaised)}</span>
                    <span className={styles.vaultTarget}>of {formatUSDC(vault.targetAmount)}</span>
                  </div>

                  <div className={styles.vaultFooter}>
                    <span className={styles.vaultTerm}>{vault.durationMonths}mo</span>
                    <span className={styles.vaultTranches}>{vault.tranchesReleased}/{vault.numTranches} tranches</span>
                  </div>
                </motion.div>
              )
            })
          )}
        </div>

        <AnimatePresence>
          {(selected || detailLoading) && (
            <motion.aside
              className={styles.detail}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className={styles.detailPanel}>
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
                      className={styles.viewDetailBtn}
                      onClick={() => navigate(`/vaults/${selected.address}`)}
                    >
                      <ExternalLink size={14} />
                      <span>View Full Details</span>
                    </button>
                  </>
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
