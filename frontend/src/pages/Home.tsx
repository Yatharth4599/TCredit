import { useNavigate } from 'react-router-dom'
import styles from './Home.module.css'

const ACTIONS = [
  { label: 'CREDIT DASHBOARD', desc: "Manage your agent's credit line and loan status", href: '/app/solana/credit', cta: 'OPEN →' },
  { label: 'KREXIT SCORE',     desc: 'On-chain credit score. 200–850, 5 components, recency-weighted.', href: '/app/solana/score', cta: 'CHECK →' },
  { label: 'VAULT STATS',      desc: 'Protocol vault stats. Senior, Mezzanine, Junior tranches.', href: '/app/solana/vault', cta: 'VIEW →' },
  { label: 'LP POSITIONS',     desc: 'Deposit into tranches. Earn from real agent revenue.', href: '/app/solana/lp', cta: 'MANAGE →' },
  { label: 'MY AGENTS',        desc: 'Track all agents you own. Full loan + health overview.', href: '/app/my-agents', cta: 'VIEW →' },
  { label: 'LIVE DEMO',        desc: 'See the full Krexa lifecycle in action. Step-by-step walkthrough.', href: '/demo', cta: 'WATCH →' },
]

const COMPARE_ROWS = [
  { feature: 'Agent-compatible',     banks: 'No (requires KYC)',          defi: 'Partial (collateral only)', krexa: 'Yes — x402-native' },
  { feature: 'Collateral required',  banks: 'Physical assets',            defi: '150%+ overcollat.',         krexa: 'Revenue history only' },
  { feature: 'Credit assessment',    banks: 'Annual review, paperwork',   defi: 'None (purely collateral)',   krexa: 'Real-time Krexit Score' },
  { feature: 'Repayment',            banks: 'Manual monthly',             defi: 'Manual or liquidation',     krexa: 'Auto waterfall split' },
  { feature: 'Settlement speed',     banks: '4–6 weeks',                  defi: 'Instant, but risky',        krexa: 'Instant, enforceable' },
  { feature: 'AI Agent Support',     banks: 'No',                         defi: 'No',                        krexa: 'Native, first-class' },
]

export default function Home() {
  const navigate = useNavigate()

  return (
    <div className={styles.page}>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className={styles.hero}>
        <span className={styles.tag}>DASHBOARD</span>
        <h1 className={styles.headline}>
          KREXA<br />
          <span className={styles.headlineAccent}>PROTOCOL</span>
        </h1>
        <p className={styles.subtitle}>
          Revenue-enforced credit for AI agents on Solana.
        </p>
        <div className={styles.heroCtas}>
          <button className={styles.btnPrimary} onClick={() => navigate('/app/solana/credit')}>
            Open Credit Dashboard →
          </button>
          <button className={styles.btnSecondary} onClick={() => navigate('/app/solana/score')}>
            Check Krexit Score
          </button>
        </div>
      </section>

      {/* ── Stats row ────────────────────────────────────────── */}
      <section className={styles.statsRow}>
        {[
          { val: '$2.4M',  label: 'TOTAL VALUE LOCKED' },
          { val: '128',    label: 'AGENTS ONBOARDED' },
          { val: '47',     label: 'ACTIVE VAULTS' },
          { val: '12.5%',  label: 'AVG TRANCHE APY' },
        ].map((s) => (
          <div key={s.label} className={styles.statCard}>
            <div className={styles.statVal}>{s.val}</div>
            <div className={styles.statLabel}>{s.label}</div>
          </div>
        ))}
      </section>

      {/* ── Quick actions ────────────────────────────────────── */}
      <section className={styles.section}>
        <span className={styles.tag}>QUICK_ACTIONS</span>
        <h2 className={styles.sectionTitle}>GET STARTED</h2>
        <div className={styles.actionsGrid}>
          {ACTIONS.map((a) => (
            <button key={a.href} className={styles.actionCard} onClick={() => navigate(a.href)}>
              <h3 className={styles.actionTitle}>{a.label}</h3>
              <p className={styles.actionDesc}>{a.desc}</p>
              <span className={styles.actionLink}>{a.cta}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Why Krexa ────────────────────────────────────────── */}
      <section className={styles.sectionAlt}>
        <span className={styles.tag}>WHY_KREXA</span>
        <h2 className={styles.sectionTitle}>CREDIT, REIMAGINED</h2>
        <div className={styles.tableWrap}>
          <table className={styles.compareTable}>
            <thead>
              <tr>
                <th className={styles.thFeature}>FEATURE</th>
                <th className={styles.thNeg}>TRADITIONAL BANKS</th>
                <th className={styles.thMid}>DEFI</th>
                <th className={styles.thPos}>KREXA</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((row) => (
                <tr key={row.feature} className={styles.tableRow}>
                  <td className={styles.tdFeature}>{row.feature}</td>
                  <td className={styles.tdNeg}>{row.banks}</td>
                  <td className={styles.tdMid}>{row.defi}</td>
                  <td className={styles.tdPos}>{row.krexa}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── CTA band ─────────────────────────────────────────── */}
      <section className={styles.ctaBand}>
        <h2 className={styles.ctaHeadline}>The credit layer for the agent economy</h2>
        <p className={styles.ctaSubtitle}>
          Whether you're building AI agents that need capital or seeking yield from real agent revenue —
          Krexa is the protocol where repayment is enforced by code, not courts.
        </p>
        <button className={styles.btnPrimary} onClick={() => navigate('/app/solana/credit')}>
          Launch App →
        </button>
      </section>

    </div>
  )
}
