import { useState, useEffect, useCallback } from 'react'
import { useAccount } from 'wagmi'
import toast from 'react-hot-toast'
import { tradersApi } from '../api/client'
import { useContractTx } from '../hooks/useContractTx'
import type { ApiTraderProfile, ApiTraderVault, PolymarketStats } from '../api/types'
import styles from './TraderDashboard.module.css'

function formatUsdc(wei: string): string {
  const n = Number(wei) / 1e6
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function tierColor(tier: string): string {
  if (tier === 'A') return '#52FFA1'
  if (tier === 'B') return '#5B9EFF'
  if (tier === 'C') return '#FFB84D'
  return '#888'
}

function tierLimit(tier: string): string {
  if (tier === 'A') return '$100,000'
  if (tier === 'B') return '$25,000'
  if (tier === 'C') return '$5,000'
  return 'None'
}

export default function TraderDashboard() {
  const { address, isConnected } = useAccount()

  const [profile, setProfile]   = useState<ApiTraderProfile | null>(null)
  const [vault, setVault]       = useState<ApiTraderVault | null>(null)
  const [pmStats, setPmStats]   = useState<PolymarketStats | null>(null)
  const [loading, setLoading]   = useState(false)

  const [drawAmount, setDrawAmount]   = useState('')
  const [repayAmount, setRepayAmount] = useState('')
  const [isRegistered, setIsRegistered] = useState(false)

  const { execute: executeTx } = useContractTx()

  const loadData = useCallback(async (addr: string) => {
    setLoading(true)
    try {
      const [profileRes, statsRes] = await Promise.allSettled([
        tradersApi.profile(addr),
        tradersApi.stats(addr),
      ])

      if (profileRes.status === 'fulfilled') {
        setProfile(profileRes.value.data)
        setIsRegistered(profileRes.value.data.isRegistered)
      }

      if (statsRes.status === 'fulfilled') {
        setPmStats(statsRes.value.data)
      }

      if (profileRes.status === 'fulfilled' && profileRes.value.data.vault) {
        try {
          const vaultRes = await tradersApi.vault(addr)
          setVault(vaultRes.data)
        } catch { /* no vault yet */ }
      }
    } catch { /* silent — show empty state */ }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (address) loadData(address)
  }, [address, loadData])

  async function handleRegister() {
    try {
      const res = await tradersApi.register()
      const hash = await executeTx(res.data)
      if (hash) {
        setIsRegistered(true)
        toast.success('Registered as a Krexa trader!')
        if (address) loadData(address)
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Registration failed')
    }
  }

  async function handleCreateVault() {
    try {
      const res = await tradersApi.createVault()
      const hash = await executeTx(res.data)
      if (hash) {
        toast.success('Credit vault created!')
        if (address) loadData(address)
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Failed to create vault')
    }
  }

  async function handleDraw() {
    if (!vault?.vault || !drawAmount) return
    const amountWei = String(Math.floor(parseFloat(drawAmount) * 1e6))
    try {
      const res = await tradersApi.draw(vault.vault, { amount: amountWei })
      const hash = await executeTx(res.data)
      if (hash) {
        toast.success(`Drew $${drawAmount} USDC`)
        setDrawAmount('')
        if (address) loadData(address)
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Draw failed')
    }
  }

  async function handleRepay() {
    if (!vault?.vault || !repayAmount) return
    const amountWei = String(Math.floor(parseFloat(repayAmount) * 1e6))
    try {
      const res = await tradersApi.repay(vault.vault, { amount: amountWei })
      const hash = await executeTx(res.data)
      if (hash) {
        toast.success(`Repaid $${repayAmount} USDC`)
        setRepayAmount('')
        if (address) loadData(address)
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Repay failed')
    }
  }

  if (!isConnected) {
    return (
      <div className={styles.page}>
        <div className={styles.connectPrompt}>
          <div className={styles.connectIcon}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
            </svg>
          </div>
          <h2>Connect your wallet</h2>
          <p>Connect your wallet to access the Polymarket Trader Credit dashboard</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Trader Credit</h1>
          <p className={styles.subtitle}>Credit lines for Polymarket traders — backed by your P&amp;L history</p>
        </div>
      </div>

      {loading && !profile && (
        <div className={styles.loadingState}>Loading your trader profile...</div>
      )}

      {/* Registration */}
      {!loading && !isRegistered && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Register as a Trader</h2>
          <p className={styles.cardDesc}>
            Register your wallet on Krexa to get a credit score based on your Polymarket trading history.
            Registration is permissionless and takes one transaction.
          </p>
          {pmStats && (
            <div className={styles.previewBox}>
              <span className={styles.previewLabel}>Polymarket data found</span>
              <span className={styles.previewStat}>{pmStats.totalTrades} trades · ${pmStats.totalVolume.toFixed(0)} volume · {(pmStats.winRate * 100).toFixed(0)}% win rate</span>
              <span className={styles.previewScore}>Suggested credit score: <b>{pmStats.suggestedScore}</b></span>
            </div>
          )}
          <button className={styles.primaryBtn} onClick={handleRegister}>
            Register as Trader
          </button>
        </div>
      )}

      {/* Polymarket Stats */}
      {pmStats && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Polymarket Stats</h2>
          <div className={styles.statsGrid}>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Total Volume</span>
              <span className={styles.statValue}>${pmStats.totalVolume.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Realized P&amp;L</span>
              <span className={styles.statValue} style={{ color: pmStats.realizedPnl >= 0 ? '#52FFA1' : '#FF5B5B' }}>
                {pmStats.realizedPnl >= 0 ? '+' : ''}${pmStats.realizedPnl.toFixed(2)}
              </span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Win Rate</span>
              <span className={styles.statValue}>{(pmStats.winRate * 100).toFixed(1)}%</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Total Trades</span>
              <span className={styles.statValue}>{pmStats.totalTrades}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Open Positions</span>
              <span className={styles.statValue}>{pmStats.openPositions}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Account Age</span>
              <span className={styles.statValue}>{pmStats.accountAgedays}d</span>
            </div>
          </div>
          {pmStats.totalTrades === 0 && (
            <p className={styles.noDataNote}>No trading history found on Polymarket for this address. Complete some trades first to build your credit score.</p>
          )}
        </div>
      )}

      {/* Credit Profile */}
      {isRegistered && profile && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Credit Profile</h2>
          <div className={styles.creditRow}>
            <div className={styles.tierBadge} style={{ borderColor: tierColor(profile.creditTier), color: tierColor(profile.creditTier) }}>
              Tier {profile.creditTier}
            </div>
            <div className={styles.creditDetails}>
              <span className={styles.scoreLabel}>Score: <b>{profile.creditScore}</b> / 1000</span>
              <span className={styles.limitLabel}>Credit limit: <b>{tierLimit(profile.creditTier)}</b></span>
            </div>
          </div>
          <div className={styles.scoreBar}>
            <div className={styles.scoreBarFill} style={{ width: `${(profile.creditScore / 1000) * 100}%`, background: tierColor(profile.creditTier) }} />
          </div>
          {profile.creditScore === 0 && (
            <p className={styles.noScoreNote}>
              Your credit score has not been set yet. An admin will review your Polymarket history and assign a score.
              Tier C (score ≥ 450) required to create a vault.
            </p>
          )}
        </div>
      )}

      {/* Create Vault CTA */}
      {isRegistered && profile && !profile.vault && profile.creditScore >= 450 && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Create Your Credit Vault</h2>
          <p className={styles.cardDesc}>
            Your credit score qualifies you for a <b>{tierLimit(profile.creditTier)}</b> USDC revolving credit line.
            Create your vault and start drawing capital for Polymarket positions.
          </p>
          <button className={styles.primaryBtn} onClick={handleCreateVault}>
            Create Credit Vault
          </button>
        </div>
      )}

      {/* Vault State */}
      {vault && vault.vault && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Your Credit Vault</h2>
          <div className={styles.vaultAddress}>
            <span className={styles.addrLabel}>Vault</span>
            <span className={styles.addrValue}>{vault.vault.slice(0, 10)}...{vault.vault.slice(-8)}</span>
            <button className={styles.copyBtn} onClick={() => {
              navigator.clipboard.writeText(vault.vault!)
              toast.success('Address copied!')
            }}>Copy</button>
          </div>

          {vault.frozen && (
            <div className={styles.frozenBanner}>Vault is frozen — contact support</div>
          )}

          {/* Utilization bar */}
          <div className={styles.utilizationSection}>
            <div className={styles.utilRow}>
              <span>Credit Utilization</span>
              <span><b>{vault.utilizationPct.toFixed(1)}%</b></span>
            </div>
            <div className={styles.utilizationBar}>
              <div
                className={styles.utilizationFill}
                style={{
                  width: `${Math.min(100, vault.utilizationPct)}%`,
                  background: vault.utilizationPct > 80 ? '#FF5B5B' : vault.utilizationPct > 50 ? '#FFB84D' : '#52FFA1',
                }}
              />
            </div>
            <div className={styles.utilLabels}>
              <span>Drawn: ${formatUsdc(vault.drawn)}</span>
              <span>Limit: ${formatUsdc(vault.creditLimit)}</span>
            </div>
          </div>

          <div className={styles.statsGrid}>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Available</span>
              <span className={styles.statValue}>${formatUsdc(vault.available)}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Total Drawn</span>
              <span className={styles.statValue}>${formatUsdc(vault.totalDrawn)}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Total Repaid</span>
              <span className={styles.statValue}>${formatUsdc(vault.totalRepaid)}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Accrued Interest</span>
              <span className={styles.statValue}>${formatUsdc(vault.accruedInterest)}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Interest Rate</span>
              <span className={styles.statValue}>{vault.interestRateBps / 100}% APY</span>
            </div>
          </div>

          {/* Draw / Repay actions */}
          {!vault.frozen && (
            <div className={styles.actions}>
              <div className={styles.actionGroup}>
                <h3 className={styles.actionLabel}>Draw USDC</h3>
                <div className={styles.inputRow}>
                  <input
                    className={styles.input}
                    type="number"
                    placeholder="Amount in USDC"
                    value={drawAmount}
                    onChange={e => setDrawAmount(e.target.value)}
                    min="1"
                    step="0.01"
                  />
                  <button
                    className={styles.primaryBtn}
                    onClick={handleDraw}
                    disabled={!drawAmount || parseFloat(drawAmount) <= 0}
                  >
                    Draw
                  </button>
                </div>
              </div>

              <div className={styles.actionGroup}>
                <h3 className={styles.actionLabel}>Repay USDC</h3>
                <div className={styles.inputRow}>
                  <input
                    className={styles.input}
                    type="number"
                    placeholder="Amount in USDC"
                    value={repayAmount}
                    onChange={e => setRepayAmount(e.target.value)}
                    min="1"
                    step="0.01"
                  />
                  <button
                    className={styles.secondaryBtn}
                    onClick={handleRepay}
                    disabled={!repayAmount || parseFloat(repayAmount) <= 0}
                  >
                    Repay
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* How it works */}
      <div className={styles.howItWorks}>
        <h3>How Trader Credit Works</h3>
        <ol className={styles.steps}>
          <li>Register your wallet (permissionless, one tx)</li>
          <li>We check your Polymarket trading history on Polygon</li>
          <li>Get a credit score based on win rate, volume, and P&amp;L</li>
          <li>Create a credit vault — draw USDC to fund more positions</li>
          <li>Repay from your Polymarket winnings at any time</li>
        </ol>
      </div>
    </div>
  )
}
