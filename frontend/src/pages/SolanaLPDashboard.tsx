import { useState } from 'react'
import { lpApi } from '../api/solanaClient'
import styles from './SolanaLPDashboard.module.css'

function formatUsdc(raw: number | string): string {
  const val = Number(raw) / 1e6
  return val.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function formatPct(bps: number): string {
  return (bps / 100).toFixed(2) + '%'
}

function LoadingSpinner() {
  return (
    <div className={styles.spinnerWrap}>
      <div className={styles.spinner} />
    </div>
  )
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className={styles.errorBanner}>
      {message}
    </div>
  )
}

function StatItem({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className={styles.statLabel}>{label}</p>
      <p className={styles.statValue}>{value}</p>
      {sub && <p className={styles.statSub}>{sub}</p>}
    </div>
  )
}

const TRANCHES = ['senior', 'mezzanine', 'junior'] as const

const TRANCHE_STYLES: Record<string, { borderColor: string; color: string }> = {
  senior:    { borderColor: '#034694', color: '#034694' },
  mezzanine: { borderColor: '#A855F7', color: '#A855F7' },
  junior:    { borderColor: '#f97316', color: '#f97316' },
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyData = any

export default function SolanaLPDashboard() {
  const [address, setAddress] = useState('')
  const [searched, setSearched] = useState(false)

  const [positions, setPositions] = useState<{ data: AnyData; loading: boolean; error: string | null }>({ data: null, loading: false, error: null })

  // Deposit preview
  const [depositTranche, setDepositTranche] = useState<string>('senior')
  const [depositAmount, setDepositAmount] = useState('')
  const [depositPreview, setDepositPreview] = useState<{ data: AnyData; loading: boolean; error: string | null }>({ data: null, loading: false, error: null })

  // Withdraw preview
  const [withdrawTranche, setWithdrawTranche] = useState<string>('senior')
  const [withdrawShares, setWithdrawShares] = useState('')
  const [withdrawPreview, setWithdrawPreview] = useState<{ data: AnyData; loading: boolean; error: string | null }>({ data: null, loading: false, error: null })

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!address.trim()) return
    setSearched(true)
    setPositions({ data: null, loading: true, error: null })
    try {
      const res = await lpApi.getPositions(address)
      setPositions({ data: res.data, loading: false, error: null })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Request failed'
      setPositions({ data: null, loading: false, error: message })
    }
  }

  const handleDepositPreview = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!depositAmount) return
    setDepositPreview({ data: null, loading: true, error: null })
    try {
      const res = await lpApi.previewDeposit(depositTranche, depositAmount)
      setDepositPreview({ data: res.data, loading: false, error: null })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Request failed'
      setDepositPreview({ data: null, loading: false, error: message })
    }
  }

  const handleWithdrawPreview = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!withdrawShares) return
    setWithdrawPreview({ data: null, loading: true, error: null })
    try {
      const res = await lpApi.previewWithdraw(withdrawTranche, withdrawShares)
      setWithdrawPreview({ data: res.data, loading: false, error: null })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Request failed'
      setWithdrawPreview({ data: null, loading: false, error: message })
    }
  }

  // Compute summary stats from positions
  const totalDeposited = positions.data?.positions
    ? positions.data.positions.reduce((sum: number, p: AnyData) => sum + (p.deposits ?? 0), 0)
    : 0
  const totalYield = positions.data?.positions
    ? positions.data.positions.reduce((sum: number, p: AnyData) => sum + (p.yieldEarned ?? 0), 0)
    : 0

  return (
    <div className={styles.page}>
      <div className={styles.container}>

        {/* Header */}
        <div>
          <span className={styles.headerTag}>Liquidity Protocol</span>
          <h1 className={styles.headerTitle}>LP Dashboard</h1>
          <p className={styles.headerSubtitle}>View LP positions, preview deposits, and calculate withdrawals.</p>
        </div>

        {/* Wallet Lookup */}
        <form onSubmit={handleLookup} className={styles.lookupForm}>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Enter LP wallet address..."
            className={styles.lookupInput}
          />
          <button
            type="submit"
            disabled={!address.trim()}
            className={styles.btnPrimary}
            style={{ width: 'auto' }}
          >
            Lookup Positions
          </button>
        </form>

        <div className={styles.sections}>

          {/* LP Positions */}
          {searched && (
            <div>
              <h2 className={styles.sectionLabel}>LP Positions</h2>
              {positions.loading && <LoadingSpinner />}
              {positions.error && <ErrorBanner message={positions.error} />}
              {positions.data && (
                <div>
                  {/* Portfolio summary */}
                  <div className={styles.summaryCard}>
                    <h3 className={styles.summaryCardHeading}>Portfolio Summary</h3>
                    <div className={styles.summaryStatsGrid}>
                      <div>
                        <p className={styles.statLabel}>Total Deposited</p>
                        <p className={styles.summaryStatValue}>{formatUsdc(totalDeposited)}</p>
                      </div>
                      <div>
                        <p className={styles.statLabel}>Total Yield Earned</p>
                        <p className={styles.summaryStatValue}>{formatUsdc(totalYield)}</p>
                      </div>
                      <div>
                        <p className={styles.statLabel}>Active Positions</p>
                        <p className={styles.summaryStatValue}>{String(positions.data.positions?.length ?? 0)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Individual tranche cards */}
                  <div className={styles.positionsGrid}>
                    {positions.data.positions?.map((pos: AnyData) => {
                      const tranche = (pos.tranche ?? '').toLowerCase()
                      const trancheStyle = TRANCHE_STYLES[tranche] ?? TRANCHE_STYLES.senior
                      return (
                        <div
                          key={pos.tranche}
                          className={styles.positionCard}
                          style={{ borderColor: trancheStyle.borderColor }}
                        >
                          <span
                            className={styles.trancheBadge}
                            style={{ borderColor: trancheStyle.color, color: trancheStyle.color }}
                          >
                            {pos.tranche}
                          </span>
                          <div className={styles.positionStatsGrid}>
                            <StatItem label="Deposits" value={formatUsdc(pos.deposits ?? 0)} />
                            <StatItem label="Shares" value={(Number(pos.shares ?? 0) / 1e6).toLocaleString()} />
                            <StatItem label="Est. Value" value={formatUsdc(pos.estimatedValue ?? 0)} />
                            <StatItem label="Yield Earned" value={formatUsdc(pos.yieldEarned ?? 0)} />
                          </div>
                        </div>
                      )
                    })}
                    {(!positions.data.positions || positions.data.positions.length === 0) && (
                      <div className={styles.noPositions}>
                        No LP positions found for this wallet.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Deposit Preview */}
          <div className={styles.card}>
            <h2 className={styles.cardHeading}>Deposit Preview</h2>
            <form onSubmit={handleDepositPreview}>
              <div className={styles.formGrid}>
                <div>
                  <label className={styles.fieldLabel}>Tranche</label>
                  <select
                    value={depositTranche}
                    onChange={(e) => setDepositTranche(e.target.value)}
                    className={styles.fieldSelect}
                  >
                    {TRANCHES.map((t) => (
                      <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={styles.fieldLabel}>Amount (USDC)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="1000.00"
                    className={styles.fieldInput}
                  />
                </div>
                <div className={styles.fieldBtnWrap}>
                  <button
                    type="submit"
                    disabled={!depositAmount}
                    className={styles.btnPrimary}
                  >
                    Preview
                  </button>
                </div>
              </div>
            </form>
            {depositPreview.loading && <LoadingSpinner />}
            {depositPreview.error && (
              <div className={styles.mt4}>
                <ErrorBanner message={depositPreview.error} />
              </div>
            )}
            {depositPreview.data && (
              <div className={styles.previewResults4}>
                <StatItem label="Shares Received" value={(Number(depositPreview.data.sharesReceived ?? 0) / 1e6).toLocaleString()} />
                <StatItem label="Share Price" value={`$${(Number(depositPreview.data.sharePrice ?? 1e6) / 1e6).toFixed(4)}`} />
                <StatItem label="Est. APY" value={formatPct(depositPreview.data.estimatedApyBps ?? 0)} />
                <StatItem label="Daily Yield" value={formatUsdc(depositPreview.data.estimatedDailyYield ?? 0)} />
              </div>
            )}
          </div>

          {/* Withdrawal Preview */}
          <div className={styles.card}>
            <h2 className={styles.cardHeading}>Withdrawal Preview</h2>
            <form onSubmit={handleWithdrawPreview}>
              <div className={styles.formGrid}>
                <div>
                  <label className={styles.fieldLabel}>Tranche</label>
                  <select
                    value={withdrawTranche}
                    onChange={(e) => setWithdrawTranche(e.target.value)}
                    className={styles.fieldSelect}
                  >
                    {TRANCHES.map((t) => (
                      <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={styles.fieldLabel}>Shares to Withdraw</label>
                  <input
                    type="number"
                    step="0.01"
                    value={withdrawShares}
                    onChange={(e) => setWithdrawShares(e.target.value)}
                    placeholder="500.00"
                    className={styles.fieldInput}
                  />
                </div>
                <div className={styles.fieldBtnWrap}>
                  <button
                    type="submit"
                    disabled={!withdrawShares}
                    className={styles.btnPrimary}
                  >
                    Preview
                  </button>
                </div>
              </div>
            </form>
            {withdrawPreview.loading && <LoadingSpinner />}
            {withdrawPreview.error && (
              <div className={styles.mt4}>
                <ErrorBanner message={withdrawPreview.error} />
              </div>
            )}
            {withdrawPreview.data && (
              <div className={styles.previewResults3}>
                <StatItem label="USDC Received" value={formatUsdc(withdrawPreview.data.usdcReceived ?? 0)} />
                <StatItem label="Share Price" value={`$${(Number(withdrawPreview.data.sharePrice ?? 1e6) / 1e6).toFixed(4)}`} />
                <StatItem label="Withdrawal Fee" value={formatUsdc(withdrawPreview.data.fee ?? 0)} />
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
