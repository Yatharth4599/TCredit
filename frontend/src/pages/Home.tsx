import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { vaultsApi, platformApi } from '../api/client'
import { formatUSDCCompact } from '../lib/format'
import type { ApiVault } from '../api/types'
import styles from './Home.module.css'

const STATE_COLOR: Record<string, string> = {
  fundraising: '#eab308',
  active: '#2DD4BF',
  repaying: '#034694',
  completed: '#5E5E5E',
  defaulted: '#ef4444',
  cancelled: '#5E5E5E',
}

function VaultCard({ vault }: { vault: ApiVault }) {
  const navigate = useNavigate()
  const pct = Math.min(vault.percentFunded, 100)
  const color = STATE_COLOR[vault.state] ?? '#5E5E5E'
  const shortAddr = `${vault.address.slice(0, 6)}…${vault.address.slice(-4)}`

  return (
    <button className={styles.vaultCard} onClick={() => navigate(`/app/vaults/${vault.address}`)}>
      <div className={styles.vaultCardTop}>
        <span className={styles.vaultAddr}>{shortAddr}</span>
        <span className={styles.vaultBadge} style={{ color, borderColor: color }}>
          {vault.state.toUpperCase()}
        </span>
      </div>
      <div className={styles.vaultTarget}>{formatUSDCCompact(vault.targetAmount)}</div>
      <div className={styles.vaultMeta}>
        {vault.interestRate.toFixed(1)}% APR · {vault.numTranches} tranches · {vault.durationMonths}mo
      </div>
      <div className={styles.vaultBar}>
        <div className={styles.vaultBarFill} style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className={styles.vaultPct}>{pct.toFixed(0)}% funded</div>
    </button>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const { isConnected } = useAccount()
  const [vaults, setVaults] = useState<ApiVault[]>([])
  const [stats, setStats] = useState({ totalVaults: 0, activeVaults: 0, tvl: '0', totalRepaid: '0' })

  useEffect(() => {
    vaultsApi.list().then(({ data }) => setVaults(data.vaults.slice(0, 6))).catch(() => {})
    platformApi.stats().then(({ data }) => setStats(data)).catch(() => {})
  }, [])

  return (
    <div className={styles.page}>

      {/* ── Hero ──────────────────────────────────────────── */}
      <section className={styles.hero}>
        <span className={styles.tag}>DASHBOARD</span>
        <h1 className={styles.headline}>
          KREXA<br />
          <span className={styles.headlineAccent}>PROTOCOL</span>
        </h1>
        <p className={styles.subtitle}>
          Revenue-enforced credit for AI agents. Connect wallet to interact with live vaults.
        </p>
        <div className={styles.heroCtas}>
          <button className={styles.btnPrimary} onClick={() => navigate('/app/vaults')}>
            Browse Vaults →
          </button>
          <button className={styles.btnSecondary} onClick={() => navigate('/app/identity')}>
            Krexit Score
          </button>
        </div>
      </section>

      {/* ── Stats ─────────────────────────────────────────── */}
      <section className={styles.statsRow}>
        {[
          { val: formatUSDCCompact(stats.tvl), label: 'TOTAL VALUE LOCKED' },
          { val: String(stats.totalVaults), label: 'TOTAL VAULTS' },
          { val: String(stats.activeVaults), label: 'ACTIVE VAULTS' },
          { val: formatUSDCCompact(stats.totalRepaid), label: 'TOTAL REPAID' },
        ].map((s, i) => (
          <div key={i} className={styles.statCard}>
            <div className={styles.statVal}>{s.val}</div>
            <div className={styles.statLabel}>{s.label}</div>
          </div>
        ))}
      </section>

      {/* ── Live Vaults ───────────────────────────────────── */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div>
            <span className={styles.tag}>LIVE_VAULTS</span>
            <h2 className={styles.sectionTitle}>ON-CHAIN CREDIT</h2>
          </div>
          <button className={styles.btnOutline} onClick={() => navigate('/app/vaults')}>
            View All →
          </button>
        </div>

        {vaults.length === 0 ? (
          <div className={styles.empty}>Loading vaults…</div>
        ) : (
          <div className={styles.vaultsGrid}>
            {vaults.map(v => <VaultCard key={v.address} vault={v} />)}
          </div>
        )}
      </section>

      {/* ── Quick Actions ─────────────────────────────────── */}
      <section className={styles.section}>
        <span className={styles.tag}>QUICK_ACTIONS</span>
        <h2 className={styles.sectionTitle}>GET STARTED</h2>

        <div className={styles.actionsGrid}>
          {[
            { title: 'BROWSE VAULTS', desc: 'Explore live credit vaults. Pick a tranche, deposit, earn yield.', href: '/app/vaults', label: 'VIEW_VAULTS →' },
            { title: 'KREXIT SCORE', desc: 'Check your on-chain credit score. 200–850, 5 components, recency-weighted.', href: '/app/identity', label: 'CHECK_SCORE →' },
            { title: 'LIQUIDITY POOLS', desc: 'Deposit into Senior or General pools. Earn from real agent revenue.', href: '/app/pools', label: 'VIEW_POOLS →' },
            { title: 'MERCHANT', desc: 'Register as a merchant. Access working capital against your revenue.', href: '/app/merchant', label: 'REGISTER →' },
            { title: 'PORTFOLIO', desc: 'Track your positions across vaults. Claim returns, monitor PnL.', href: '/app/portfolio', label: 'VIEW_PORTFOLIO →' },
            { title: 'DEMO', desc: 'See the full Krexa lifecycle in action. Step-by-step walkthrough.', href: '/demo', label: 'WATCH_DEMO →' },
          ].map((action, i) => (
            <button key={i} className={styles.actionCard} onClick={() => navigate(action.href)}>
              <h3 className={styles.actionTitle}>{action.title}</h3>
              <p className={styles.actionDesc}>{action.desc}</p>
              <span className={styles.actionLink}>{action.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Connection Status ─────────────────────────────── */}
      {!isConnected && (
        <section className={styles.connectBanner}>
          <div className={styles.connectInner}>
            <span className={styles.connectText}>Connect your wallet to interact with live vaults and check your Krexit Score.</span>
          </div>
        </section>
      )}
    </div>
  )
}
