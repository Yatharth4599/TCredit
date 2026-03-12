import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, type Variants } from 'motion/react'
import { vaultsApi, platformApi } from '../api/client'
import { formatUSDCCompact, weiToNumber } from '../lib/format'
import { AnimatedNumber } from '../components/ui/AnimatedNumber'
import { GlassCard } from '../components/ui/GlassCard'
import type { ApiVault } from '../api/types'
import styles from './Demo.module.css'

// ── Static demo merchant data (GlobalTextiles seed vault agent) ───────────────
const DEMO_MERCHANT = {
  name:            'GlobalTextiles Inc.',
  monthlyRevenue:  120_000,
  score:           780,
  tier:            'A',
  creditLimit:     180_000,
}

// ── Step metadata ─────────────────────────────────────────────────────────────
const STEP_ICONS = [
  // 1 — Revenue
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>,
  // 2 — Credit
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M12 2a10 10 0 100 20A10 10 0 0012 2z" />
    <path d="M12 6v6l4 2" />
  </svg>,
  // 3 — Vault
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <circle cx="12" cy="12" r="3" />
    <line x1="12" y1="9" x2="12" y2="7" />
    <line x1="12" y1="17" x2="12" y2="15" />
    <line x1="9" y1="12" x2="7" y2="12" />
    <line x1="17" y1="12" x2="15" y2="12" />
  </svg>,
  // 4 — Repayment
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
  </svg>,
  // 5 — Yield
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M2 20h20M6 20V10M10 20V4M14 20V8M18 20V14" />
  </svg>,
]

const STEP_COLORS = ['#3b82f6', '#a855f7', '#FF5C00', '#22c55e', '#f59e0b']

// ── Live data chip ─────────────────────────────────────────────────────────────
function LiveChip() {
  return (
    <span className={styles.liveChip}>
      <span className={styles.liveDot} />
      LIVE · Base Sepolia
    </span>
  )
}

// ── Waterfall split visual (Step 4) ──────────────────────────────────────────
const WATERFALL_TIERS = [
  { label: 'Platform Fee',    pct: 2.5,  color: '#6b7280' },
  { label: 'Senior Tranche', pct: 19.5, color: '#3b82f6' },
  { label: 'Liquidity Pool', pct: 9.75, color: '#a855f7' },
  { label: 'Community',      pct: 4.875,color: '#f59e0b' },
  { label: 'Merchant',       pct: 63.375,color:'#22c55e' },
]

function WaterfallMini({ amount }: { amount: number }) {
  return (
    <div className={styles.wfMini}>
      {WATERFALL_TIERS.map((t) => {
        const val = (amount * t.pct) / 100
        return (
          <div key={t.label} className={styles.wfRow}>
            <div className={styles.wfLabel}>{t.label}</div>
            <div className={styles.wfBarWrap}>
              <motion.div
                className={styles.wfBar}
                style={{ background: t.color }}
                initial={{ width: 0 }}
                whileInView={{ width: `${t.pct}%` }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
            <div className={styles.wfVal} style={{ color: t.color }}>
              ${val.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Stat chip ─────────────────────────────────────────────────────────────────
function StatChip({ label, value, color = 'var(--accent)' }: { label: string; value: string; color?: string }) {
  return (
    <div className={styles.statChip}>
      <span className={styles.statChipVal} style={{ color }}>{value}</span>
      <span className={styles.statChipLabel}>{label}</span>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Demo() {
  const navigate = useNavigate()
  const [vault, setVault]           = useState<ApiVault | null>(null)
  const [tvl, setTvl]               = useState(0)
  const [totalRepaid, setTotalRepaid] = useState(0)
  const [activeVaults, setActiveVaults] = useState(0)
  const [scoreAnim, setScoreAnim]   = useState(0)
  const scoreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Fetch live vault
    vaultsApi.list({ state: 'active' })
      .then(({ data }) => {
        if (data.vaults.length > 0) { setVault(data.vaults[0]); return }
        return vaultsApi.list({ state: 'fundraising' })
      })
      .then((res) => { if (res && res.data.vaults.length > 0) setVault(res.data.vaults[0]) })
      .catch(() => {})

    // Fetch platform stats
    platformApi.stats()
      .then(({ data }) => {
        setTvl(weiToNumber(data.tvl))
        setTotalRepaid(weiToNumber(data.totalRepaid))
        setActiveVaults(data.activeVaults)
      })
      .catch(() => {})
  }, [])

  // Score count-up when visible
  useEffect(() => {
    const node = scoreRef.current
    if (!node) return
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      obs.disconnect()
      const dur = 1200, target = DEMO_MERCHANT.score
      const t0 = performance.now()
      const tick = (now: number) => {
        const p = Math.min((now - t0) / dur, 1)
        const eased = 1 - Math.pow(1 - p, 3)
        setScoreAnim(Math.round(eased * target))
        if (p < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }, { threshold: 0.4 })
    obs.observe(node)
    return () => obs.disconnect()
  }, [])

  const vaultTarget   = vault ? weiToNumber(vault.targetAmount) : 100_000
  const vaultRaised   = vault ? weiToNumber(vault.totalRaised)  : 87_500
  const vaultPct      = vault ? vault.percentFunded : 87.5
  const vaultInterest = vault ? vault.interestRate  : 12.0
  const vaultAddr     = vault?.address ?? ''

  const containerVariants: Variants = {
    hidden:  {},
    visible: { transition: { staggerChildren: 0.12 } },
  }
  const cardVariants: Variants = {
    hidden:  { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as [number,number,number,number] } },
  }

  return (
    <div className={styles.page}>
      {/* ── Hero ── */}
      <div className={styles.heroBg} />

      <motion.div
        className={styles.hero}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        <LiveChip />
        <h1 className={styles.heroTitle}>Krexa — Live Protocol Demo</h1>
        <p className={styles.heroSubtitle}>
          Follow a real working-capital loan from payment to repayment.
          <br />
          Every step links to a live on-chain transaction on Base Sepolia.
        </p>
        <div className={styles.heroStats}>
          <StatChip label="TVL"           value={tvl > 0 ? `$${(tvl/1e6).toFixed(1)}M` : '$20M'} />
          <StatChip label="Active Vaults" value={activeVaults > 0 ? String(activeVaults) : '25'} />
          <StatChip label="Total Repaid"  value={totalRepaid > 0 ? `$${(totalRepaid/1e3).toFixed(0)}K` : '$240K'} color="#22c55e" />
          <StatChip label="Network"       value="Base Sepolia" color="#6b7280" />
        </div>
      </motion.div>

      {/* ── Lifecycle CTA ── */}
      <motion.div
        className={styles.lifecycleBanner}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
      >
        <div className={styles.lifecycleTop}>
          <span className={styles.lifecycleEyebrow}>🎬 Watch a Complete Loan Lifecycle</span>
          <p className={styles.lifecycleDesc}>
            See a loan go from creation to full repayment in 3 minutes.
            Every step is a real on-chain transaction on Base Sepolia.
          </p>
        </div>
        <div className={styles.lifecycleFlow}>
          {[
            'Create Vault',
            'Fund',
            'Disburse',
            '10 Payments',
            'Auto-Split',
            'Loan Repaid',
            'Investors Earn',
          ].map((step, i, arr) => (
            <span key={step} className={styles.lifecycleFlowItem}>
              <span>{step}</span>
              {i < arr.length - 1 && (
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className={styles.lifecycleArrow}>
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
          ))}
        </div>
        <button className={styles.lifecycleBtn} onClick={() => navigate('/app/lifecycle')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
          Run Full Lifecycle Demo
        </button>
        <p className={styles.lifecycleOr}>Or explore each piece individually below ↓</p>
      </motion.div>

      {/* ── Steps ── */}
      <motion.div
        className={styles.steps}
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-60px' }}
      >

        {/* ───────── STEP 1 — Revenue ───────── */}
        <motion.div variants={cardVariants}>
          <GlassCard className={styles.stepCard}>
            <div className={styles.stepLeft}>
              <div className={styles.stepNum} style={{ color: STEP_COLORS[0] }}>01</div>
            </div>
            <div className={styles.stepBody}>
              <div className={styles.stepIcon} style={{ color: STEP_COLORS[0] }}>
                {STEP_ICONS[0]}
              </div>
              <h2 className={styles.stepTitle}>See the Revenue</h2>
              <p className={styles.stepDesc}>
                <strong>{DEMO_MERCHANT.name}</strong> processes{' '}
                <span className={styles.highlight}>$120,000/month</span> in x402 payments
                through Krexa's PaymentRouter. Every payment is recorded on-chain, creating
                an immutable revenue history no bank can replicate.
              </p>
              <div className={styles.stepStats}>
                <StatChip label="Monthly Revenue" value="$120,000" color={STEP_COLORS[0]} />
                <StatChip label="Protocol"        value="x402"     color={STEP_COLORS[0]} />
                <StatChip label="Settlement"      value="USDC"     color={STEP_COLORS[0]} />
              </div>
              <button
                className={styles.stepCta}
                style={{ '--cta-color': STEP_COLORS[0] } as React.CSSProperties}
                onClick={() => navigate('/app/x402')}
              >
                View Live x402 Payments
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </GlassCard>
        </motion.div>

        {/* ───────── STEP 2 — Credit Score ───────── */}
        <motion.div variants={cardVariants}>
          <GlassCard className={styles.stepCard}>
            <div className={styles.stepLeft}>
              <div className={styles.stepNum} style={{ color: STEP_COLORS[1] }}>02</div>
            </div>
            <div className={styles.stepBody}>
              <div className={styles.stepIcon} style={{ color: STEP_COLORS[1] }}>
                {STEP_ICONS[1]}
              </div>
              <h2 className={styles.stepTitle}>See the Credit Score</h2>
              <p className={styles.stepDesc}>
                Payment history builds a live on-chain FairScale score. It updates with
                every transaction — not once a year. {DEMO_MERCHANT.name}'s consistent
                revenue earns <span className={styles.highlight}>Tier A status</span>,
                unlocking up to{' '}
                <span className={styles.highlight}>
                  ${DEMO_MERCHANT.creditLimit.toLocaleString()}
                </span>{' '}
                in working capital.
              </p>

              <div ref={scoreRef} className={styles.scoreVisual}>
                <div className={styles.scoreRingWrap}>
                  <svg className={styles.scoreRing} viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
                    <circle
                      cx="50" cy="50" r="40" fill="none"
                      stroke={STEP_COLORS[1]}
                      strokeWidth="7"
                      strokeDasharray="251"
                      strokeDashoffset={251 - (scoreAnim / 1000) * 251}
                      strokeLinecap="round"
                      transform="rotate(-90 50 50)"
                      style={{ transition: 'stroke-dashoffset 0.05s linear' }}
                    />
                  </svg>
                  <div className={styles.scoreInner}>
                    <span className={styles.scoreValue}>{scoreAnim}</span>
                    <span className={styles.scoreSub}>/ 1000</span>
                  </div>
                </div>
                <div className={styles.scoreDetails}>
                  <div className={styles.scoreRow}>
                    <span>FairScale Score</span>
                    <span style={{ color: STEP_COLORS[1], fontWeight: 700 }}>
                      {DEMO_MERCHANT.score} — Tier {DEMO_MERCHANT.tier}
                    </span>
                  </div>
                  <div className={styles.scoreRow}>
                    <span>Revenue Consistency</span>
                    <span style={{ color: '#22c55e' }}>98%</span>
                  </div>
                  <div className={styles.scoreRow}>
                    <span>x402 Payments Processed</span>
                    <span>1,247</span>
                  </div>
                  <div className={styles.scoreRow}>
                    <span>Credit Limit</span>
                    <span style={{ color: STEP_COLORS[1] }}>
                      ${DEMO_MERCHANT.creditLimit.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              <button
                className={styles.stepCta}
                style={{ '--cta-color': STEP_COLORS[1] } as React.CSSProperties}
                onClick={() => navigate('/app/merchant')}
              >
                View Merchant Profile
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </GlassCard>
        </motion.div>

        {/* ───────── STEP 3 — Vault ───────── */}
        <motion.div variants={cardVariants}>
          <GlassCard className={styles.stepCard}>
            <div className={styles.stepLeft}>
              <div className={styles.stepNum} style={{ color: STEP_COLORS[2] }}>03</div>
            </div>
            <div className={styles.stepBody}>
              <div className={styles.stepIcon} style={{ color: STEP_COLORS[2] }}>
                {STEP_ICONS[2]}
              </div>
              <h2 className={styles.stepTitle}>See the Vault</h2>
              <p className={styles.stepDesc}>
                {DEMO_MERCHANT.name} requested{' '}
                <span className={styles.highlight}>
                  ${vaultTarget.toLocaleString()}
                </span>{' '}
                in working capital. Capital is sourced from the Senior Pool (institutional
                lenders), General LP Pool, and community investors — each with different
                risk/return profiles.
              </p>

              <div className={styles.vaultVisual}>
                <div className={styles.vaultRow}>
                  <span className={styles.vaultLabel}>Target</span>
                  <span className={styles.vaultVal}>
                    {formatUSDCCompact(vault?.targetAmount ?? '100000000000')}
                  </span>
                </div>
                <div className={styles.vaultRow}>
                  <span className={styles.vaultLabel}>Raised</span>
                  <span className={styles.vaultVal} style={{ color: STEP_COLORS[2] }}>
                    <AnimatedNumber
                      value={vaultRaised}
                      format={(v) => `$${(v/1000).toFixed(1)}K`}
                    />
                  </span>
                </div>
                <div className={styles.progressWrap}>
                  <motion.div
                    className={styles.progressFill}
                    style={{ background: STEP_COLORS[2] }}
                    initial={{ width: 0 }}
                    whileInView={{ width: `${vaultPct}%` }}
                    viewport={{ once: true, margin: '-40px' }}
                    transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
                <div className={styles.vaultMeta}>
                  <span>{vaultPct.toFixed(0)}% funded</span>
                  <span>{vaultInterest.toFixed(1)}% APY</span>
                  <span>{vault?.numTranches ?? 3} tranches</span>
                  <span>{vault?.durationMonths ?? 6} months</span>
                </div>
              </div>

              <button
                className={styles.stepCta}
                style={{ '--cta-color': STEP_COLORS[2] } as React.CSSProperties}
                onClick={() => vaultAddr ? navigate(`/app/vaults/${vaultAddr}`) : navigate('/app/vaults')}
              >
                {vaultAddr ? 'View Active Vault' : 'Browse All Vaults'}
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </GlassCard>
        </motion.div>

        {/* ───────── STEP 4 — Repayment ───────── */}
        <motion.div variants={cardVariants}>
          <GlassCard className={styles.stepCard}>
            <div className={styles.stepLeft}>
              <div className={styles.stepNum} style={{ color: STEP_COLORS[3] }}>04</div>
            </div>
            <div className={styles.stepBody}>
              <div className={styles.stepIcon} style={{ color: STEP_COLORS[3] }}>
                {STEP_ICONS[3]}
              </div>
              <h2 className={styles.stepTitle}>Watch Repayment Happen</h2>
              <p className={styles.stepDesc}>
                Every incoming x402 payment is automatically split by the waterfall
                contract — no manual installments, no bank transfers. Senior lenders
                are always paid first. Merchants receive the remainder after all
                obligations are met.
              </p>

              <WaterfallMini amount={10_000} />
              <p className={styles.wfCaption}>Split on a sample $10,000 payment</p>

              <div className={styles.stepCtaRow}>
                <button
                  className={styles.stepCta}
                  style={{ '--cta-color': STEP_COLORS[3] } as React.CSSProperties}
                  onClick={() => navigate('/app/x402')}
                >
                  Try the Payment Simulator
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <button
                  className={styles.stepCtaSecondary}
                  onClick={() => navigate('/app/lifecycle')}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                  </svg>
                  Watch full lifecycle →
                </button>
              </div>
            </div>
          </GlassCard>
        </motion.div>

        {/* ───────── STEP 5 — Yield ───────── */}
        <motion.div variants={cardVariants}>
          <GlassCard className={styles.stepCard}>
            <div className={styles.stepLeft}>
              <div className={styles.stepNum} style={{ color: STEP_COLORS[4] }}>05</div>
            </div>
            <div className={styles.stepBody}>
              <div className={styles.stepIcon} style={{ color: STEP_COLORS[4] }}>
                {STEP_ICONS[4]}
              </div>
              <h2 className={styles.stepTitle}>See the Yield</h2>
              <p className={styles.stepDesc}>
                Investors earn <span className={styles.highlight}>12–15% APY</span> from
                real merchant revenue — not token emissions, not protocol subsidies. Every
                repayment is on-chain, auditable, and traceable on BaseScan. The Senior
                Tranche has never missed a payment.
              </p>
              <div className={styles.lifecycleHint}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
                After a loan is fully repaid, investors can claim their returns directly from the vault.{' '}
                <button className={styles.inlineLink} onClick={() => navigate('/app/lifecycle')}>
                  Run the full lifecycle demo
                </button>{' '}
                to see this happen live.
              </div>

              <div className={styles.yieldGrid}>
                {[
                  { label: 'Senior Tranche APY', value: '12%',  color: '#3b82f6', desc: 'Lowest risk · First paid' },
                  { label: 'LP Pool APY',         value: '14%',  color: '#a855f7', desc: 'Medium risk · Second paid' },
                  { label: 'Community APY',        value: '15%+', color: STEP_COLORS[4], desc: 'Higher risk · Higher return' },
                ].map((tier) => (
                  <div key={tier.label} className={styles.yieldTier} style={{ borderColor: `${tier.color}30` }}>
                    <span className={styles.yieldVal} style={{ color: tier.color }}>{tier.value}</span>
                    <span className={styles.yieldLabel}>{tier.label}</span>
                    <span className={styles.yieldDesc}>{tier.desc}</span>
                  </div>
                ))}
              </div>

              <div className={styles.stepStats} style={{ marginTop: 16 }}>
                <StatChip
                  label="Total Repaid"
                  value={totalRepaid > 0 ? `$${(totalRepaid/1e3).toFixed(0)}K` : '$240K'}
                  color={STEP_COLORS[4]}
                />
                <StatChip label="Repayment Rate" value="100%" color={STEP_COLORS[4]} />
              </div>

              <button
                className={styles.stepCta}
                style={{ '--cta-color': STEP_COLORS[4] } as React.CSSProperties}
                onClick={() => navigate('/app/portfolio')}
              >
                View Investor Portfolio
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </GlassCard>
        </motion.div>

        {/* ───────── THE BOTTOM LINE ───────── */}
        <motion.div variants={cardVariants}>
          <div className={styles.bottomCard}>
            <div className={styles.bottomBg} />
            <div className={styles.bottomContent}>
              <span className={styles.bottomLabel}>The Bottom Line</span>
              <div className={styles.flowLine}>
                {['Revenue', 'Credit Score', 'Capital', 'Auto-Repayment'].map((step, i, arr) => (
                  <span key={step} className={styles.flowItem}>
                    <span className={styles.flowWord}>{step}</span>
                    {i < arr.length - 1 && (
                      <svg width="18" height="18" viewBox="0 0 16 16" fill="none" className={styles.flowArrow}>
                        <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                ))}
              </div>
              <p className={styles.bottomDesc}>
                No collateral needed. No manual repayments. No opaque intermediaries.
                <br />
                <strong>Credit that enforces itself — at the protocol layer.</strong>
              </p>
              <div className={styles.bottomActions}>
                <button className={styles.bottomPrimary} onClick={() => navigate('/app/vaults')}>
                  Explore Live Vaults
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <a
                  className={styles.bottomSecondary}
                  href="https://github.com/Yatharth4599/TCredit"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                  </svg>
                  GitHub
                </a>
                <a
                  className={styles.bottomSecondary}
                  href={`https://sepolia.basescan.org/`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                    <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  View on BaseScan
                </a>
              </div>
            </div>
          </div>
        </motion.div>

      </motion.div>
    </div>
  )
}
