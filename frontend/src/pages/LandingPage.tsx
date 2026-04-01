import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, animate } from 'motion/react'
import {
  ChevronDown, ChevronUp, ArrowDown,
  Activity, Wallet, Layers, Eye,
} from 'lucide-react'
import AsciiRain from '../components/ui/AsciiRain'
import styles from './LandingPage.module.css'

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
}

const stagger = {
  visible: { transition: { staggerChildren: 0.12 } },
}

const waterfallStagger = {
  visible: { transition: { staggerChildren: 0.15 } },
}

const faqItems = [
  {
    q: 'Why simple interest, not compound?',
    a: 'At 36–69% APR, compound interest would be extremely punitive. Simple interest keeps cost proportional to time — an agent can calculate break-even precisely. It\'s also cheaper on-chain: one multiplication vs exponentiation.',
  },
  {
    q: 'How does an agent build credit?',
    a: 'Every x402 payment builds a Krexit Score (200–850) from 5 components: repayment history (30%), profitability (25%), behavioral health (20%), usage patterns (15%), and account maturity (10%). No applications, no bureaus — revenue is the signal.',
  },
  {
    q: 'What happens if an agent defaults?',
    a: 'Insurance reserve absorbs first. Then Junior tranche, then Mezzanine, then Senior. It takes 384 simultaneous defaults to reach Senior LP capital. The insurance reserve alone covers 93+ Level 2 defaults.',
  },
  {
    q: 'Why four oracle sources?',
    a: 'Single oracle = single point of failure. Jupiter down? Pyth takes over. All three down? Birdeye covers it. All four down? Keeper pauses — no mass liquidation. Defense in depth.',
  },
  {
    q: 'What\'s the minimum collateral?',
    a: 'Zero. Krexa operates with zero collateral at every level. But agents who choose to deposit collateral get lower rates — and the collateral earns ~16-20% APR in the Senior pool.',
  },
  {
    q: 'How are haircuts determined?',
    a: 'Two factors: liquidity and volatility. Hard to sell AND volatile? 35% haircut. One factor? 15-20%. No price available? Valued at $0. Conservative by design.',
  },
]

/* ── Bento SVG Icons ─────────────────────────────────────── */
const AgentIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="#2DD4BF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.bentoIcon}>
    <rect x="8" y="4" width="16" height="12" rx="2" />
    <circle cx="13" cy="10" r="1.5" fill="#2DD4BF" stroke="none" />
    <circle cx="19" cy="10" r="1.5" fill="#2DD4BF" stroke="none" />
    <path d="M12 20v4M20 20v4M10 24h12M16 16v4" />
    <path d="M4 10h4M24 10h4" />
  </svg>
)

const VaultIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="#034694" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.bentoIcon}>
    <rect x="4" y="6" width="24" height="20" rx="2" />
    <circle cx="16" cy="16" r="5" />
    <circle cx="16" cy="16" r="2" />
    <path d="M16 6v-2M16 2l-3 3M16 2l3 3" />
  </svg>
)

const MerchantIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.bentoIcon}>
    <path d="M4 12h24V26a2 2 0 01-2 2H6a2 2 0 01-2-2V12z" />
    <path d="M4 12L8 4h16l4 8" />
    <path d="M12 18h8v10h-8z" />
    <path d="M20 6l2 3M12 6l-2 3" />
  </svg>
)

const ChainIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="#034694" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.bentoIcon}>
    <path d="M16 4l10 6v12l-10 6L6 22V10l10-6z" />
    <path d="M16 10l5 3v6l-5 3-5-3v-6l5-3z" />
    <line x1="16" y1="4" x2="16" y2="10" />
    <line x1="26" y1="10" x2="21" y2="13" />
    <line x1="6" y1="10" x2="11" y2="13" />
  </svg>
)


export default function LandingPage() {
  const navigate = useNavigate()
  const [navVisible, setNavVisible] = useState(true)
  const [navScrolled, setNavScrolled] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [scoreInView, setScoreInView] = useState(false)
  const lastScrollY = useRef(0)
  const scoreRef = useRef<HTMLDivElement>(null)
  const scoreNumRef = useRef<HTMLDivElement>(null)
  const [activeRepayStep, setActiveRepayStep] = useState(0)
  const [activeLossStep, setActiveLossStep] = useState(0)
  const [copiedStep, setCopiedStep] = useState<string | null>(null)

  const handleCopy = (code: string, num: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedStep(num)
      setTimeout(() => setCopiedStep(null), 2000)
    }).catch(() => {})
  }

  // Waterfall: cycle highlight every 1s
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveRepayStep((p) => (p + 1) % 5)
      setActiveLossStep((p) => (p + 1) % 4)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  // Nav: hide on scroll down, show on scroll up
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY
      const delta = y - lastScrollY.current
      setNavScrolled(y > 10)
      if (Math.abs(delta) > 5) {
        setNavVisible(delta < 0 || y < 80)
      }
      lastScrollY.current = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Krexit Score: animate on scroll into view
  useEffect(() => {
    const el = scoreRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setScoreInView(true) },
      { threshold: 0.3 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (!scoreInView || !scoreNumRef.current) return
    const ctrl = animate(200, 780, {
      duration: 2.5,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        if (scoreNumRef.current) scoreNumRef.current.textContent = String(Math.round(v))
      },
    })
    return () => ctrl.stop()
  }, [scoreInView])

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className={styles.page}>

      {/* ── Nav ──────────────────────────────────────────────── */}
      <nav className={`${styles.nav} ${navScrolled ? styles.navScrolled : ''} ${!navVisible ? styles.navHidden : ''}`}>
        <div className={styles.navInner}>
          <div className={styles.navBrand}>
            <img src="/images/krexa-logo-mark.png" alt="Krexa" className={styles.navLogoImg} />
          </div>
          <div className={styles.navLinks}>
            <button className={styles.navLink} onClick={() => scrollTo('how-it-works')}>
              PROTOCOL
            </button>
            <button className={styles.navLink} onClick={() => scrollTo('krexit-score')}>
              KREXIT SCORE
            </button>
            <a
              href="https://github.com/Yatharth4599/TCredit"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.navLink}
            >
              GITHUB
            </a>
            <button className={styles.navCta} onClick={() => navigate('/app')}>
              Launch App →
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className={styles.hero}>
        <AsciiRain />
        <motion.div initial="hidden" animate="visible" variants={stagger} className={styles.heroContent}>
          <motion.div variants={fadeUp} className={styles.heroBadge}>
            DEVNET_LIVE — 5 PROGRAMS DEPLOYED
          </motion.div>
          <motion.h1 variants={fadeUp} className={styles.heroHeadline}>
            THE CREDIT LAYER
            <br />
            <span className={styles.heroAccent}>FOR THE AGENT ECONOMY</span>
          </motion.h1>
          <motion.p variants={fadeUp} className={styles.heroSubtitle}>
            Revenue-enforced credit for AI agents. Krexit Score 200–850.
            Zero collateral. Waterfall repayment enforced by code, not courts.
          </motion.p>
          <motion.div variants={fadeUp} className={styles.heroCtas}>
            <button className={styles.heroBtn} onClick={() => navigate('/app')}>Launch App →</button>
            <button className={styles.heroBtnSecondary} onClick={() => scrollTo('how-it-works')}>Read Protocol</button>
          </motion.div>
          <motion.div variants={fadeUp} className={styles.techBadges}>
            {['SOLANA', 'ANCHOR', 'x402', 'USDC', 'ZERO COLLATERAL'].map((t, i) => (
              <span key={i}>
                {i > 0 && <span className={styles.techSep}>·</span>}
                <span className={styles.techBadge}>{t}</span>
              </span>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* ── Stats — WHITE ────────────────────────────────────── */}
      <section className={styles.statsSection}>
        <div className={styles.statsGrid}>
          {[
            { val: '200–850', label: 'KREXIT SCORE RANGE' },
            { val: '8', label: 'SAFETY LAYERS' },
            { val: '4', label: 'ORACLE SOURCES' },
            { val: '384', label: 'DEFAULTS TO REACH SENIOR' },
          ].map((m, i) => (
            <div key={i} className={styles.statItem}>
              <div className={styles.statVal}>{m.val}</div>
              <div className={styles.statLabel}>{m.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works — BLACK ──────────────────────────────── */}
      <section className={styles.sectionDark} id="how-it-works">
        <div className={styles.container}>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }} variants={stagger}>
            <motion.span variants={fadeUp} className={styles.sectionTag}>THE_PROTOCOL</motion.span>
            <motion.h2 variants={fadeUp} className={styles.sectionTitle}>HOW IT WORKS</motion.h2>
            <motion.div className={styles.stepsGrid} variants={stagger}>
              {[
                {
                  num: '01',
                  title: 'Register your agent',
                  code: `$ npx @krexa/cli init --type service --name "Bot"`,
                  desc: 'One command creates your identity, PDA wallet, and credit profile on Solana.',
                },
                {
                  num: '02',
                  title: 'Borrow working capital',
                  code: `$ krexa borrow 500\n✓ Credit line opened: $500.00 USDC`,
                  desc: '',
                },
                {
                  num: '03',
                  title: 'Revenue auto-repays',
                  code: `Revenue: $0.25 (x402) → Revenue Router\n  Protocol fee:  $0.025  → Treasury\n  LP yield:      $0.035  → Senior tranche\n  Agent receives: $0.19`,
                  desc: 'Every dollar earned flows through the Revenue Router. We take what\'s owed. You get the rest.',
                },
              ].map((s) => (
                <motion.div key={s.num} variants={fadeUp} className={styles.stepCard}>
                  <span className={styles.stepNum}>{s.num}</span>
                  <h3 className={styles.stepTitle}>{s.title}</h3>
                  <div className={styles.stepCodeWrap}>
                    <pre className={styles.stepCode}>{s.code}</pre>
                    <button
                      className={styles.copyBtn}
                      onClick={() => handleCopy(s.code, s.num)}
                      title="Copy"
                    >
                      {copiedStep === s.num ? (
                        <span className={styles.copiedLabel}>COPIED</span>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {s.desc && <p className={styles.stepDesc}>{s.desc}</p>}
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── Krexit Score — WHITE ─────────────────────────────── */}
      <section className={styles.sectionLight} id="krexit-score">
        <div className={styles.container}>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }} variants={stagger}>
            <motion.span variants={fadeUp} className={styles.sectionTagDark}>CREDIT_ENGINE</motion.span>
            <motion.h2 variants={fadeUp} className={styles.sectionTitleDark}>THE KREXIT SCORE</motion.h2>

            <motion.div variants={fadeUp} className={styles.scoreSection} ref={scoreRef}>
              <div className={styles.scoreLeft}>
                <div className={styles.scoreBig} ref={scoreNumRef}>200</div>
                <div className={styles.scoreLabel}>SAMPLE AGENT SCORE</div>
                <div className={styles.scoreBar}>
                  <div className={styles.scoreBarRed} />
                  <div className={styles.scoreBarYellow} />
                  <div className={styles.scoreBarGreen} />
                  <div className={styles.scoreBarMarker} style={{ left: scoreInView ? '89%' : '0%' }} />
                </div>
                <div className={styles.scoreRange}>
                  <span>200</span>
                  <span>525</span>
                  <span>850</span>
                </div>
              </div>

              <div className={styles.scoreRight}>
                <div className={styles.scoreFormula}>
                  <span className={styles.formulaLabel}>HOW IT WORKS</span>
                  <p className={styles.formulaDesc}>
                    Your Krexit Score starts at 200 and grows to 850 based on five on-chain factors.
                    Every payment builds your credit history automatically — no applications, no bureaus.
                  </p>
                </div>
                {[
                  { name: 'REPAYMENT_HISTORY', weight: '30%', w: 30 },
                  { name: 'PROFITABILITY', weight: '25%', w: 25 },
                  { name: 'BEHAVIORAL_HEALTH', weight: '20%', w: 20 },
                  { name: 'USAGE_PATTERNS', weight: '15%', w: 15 },
                  { name: 'ACCOUNT_MATURITY', weight: '10%', w: 10 },
                ].map((c, i) => (
                  <div key={c.name} className={styles.componentRow}>
                    <span className={styles.componentName}>{c.name}</span>
                    <div className={styles.componentBarTrack}>
                      <div
                        className={styles.componentBarFill}
                        style={{ width: scoreInView ? `${c.w * 3.3}%` : '0%', transitionDelay: `${i * 0.15}s` }}
                      />
                    </div>
                    <span className={styles.componentWeight}>{c.weight}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Credit Levels */}
            <motion.div variants={fadeUp} className={styles.levelsGrid}>
              {[
                { level: 'L1', name: 'MICRO', rate: '0.19%/day', apr: '69.35%', max: '$500', trigger: '90%', color: '#A3A3A3' },
                { level: 'L2', name: 'STANDARD', rate: '0.16%/day', apr: '58.40%', max: '$20K', trigger: '85%', color: '#2DD4BF' },
                { level: 'L3', name: 'GROWTH', rate: '0.12%/day', apr: '43.80%', max: '$50K', trigger: '80%', color: '#034694' },
                { level: 'L4', name: 'PRIME', rate: '0.10%/day', apr: '36.50%', max: '$500K', trigger: '80%', color: '#034694' },
              ].map((l) => (
                <div key={l.level} className={styles.levelCard}>
                  <div className={styles.levelBadge} style={{ borderColor: l.color, color: l.color }}>{l.level}</div>
                  <div className={styles.levelName}>{l.name}</div>
                  <div className={styles.levelMax}>{l.max}</div>
                  <div className={styles.levelMeta}>
                    <div><span className={styles.levelMetaLabel}>RATE</span><span className={styles.levelMetaVal}>{l.rate}</span></div>
                    <div><span className={styles.levelMetaLabel}>APR</span><span className={styles.levelMetaVal}>{l.apr}</span></div>
                    <div><span className={styles.levelMetaLabel}>NAV TRIGGER</span><span className={styles.levelMetaVal}>{l.trigger}</span></div>
                  </div>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── Waterfall Economics — WHITE ──────────────────────── */}
      <section className={styles.sectionLight} id="waterfall">
        <div className={styles.container}>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }} variants={stagger}>
            <motion.span variants={fadeUp} className={styles.sectionTagDark}>TRANCHE_ECONOMICS</motion.span>
            <motion.h2 variants={fadeUp} className={styles.sectionTitleDark}>THE WATERFALL</motion.h2>

            <motion.div variants={stagger} className={styles.waterfallLayout}>
              <motion.div variants={fadeUp} className={styles.waterfallCol}>
                <div className={styles.waterfallColTitle}>REPAYMENT WATERFALL</div>
                <div className={styles.waterfallColSub}>Who gets paid — in order</div>
                <motion.div className={styles.waterfallSteps} variants={waterfallStagger} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                  {[
                    { label: 'PROTOCOL FEE', value: '10%', desc: 'Treasury' },
                    { label: 'SENIOR TRANCHE', value: '20% APR', desc: '50% of capital · First to eat' },
                    { label: 'MEZZANINE', value: '31% APR', desc: '30% of capital · Middle risk' },
                    { label: 'JUNIOR TRANCHE', value: '55% APR', desc: '20% of capital · Last to eat' },
                    { label: 'SURPLUS', value: '→', desc: '60% insurance · 40% treasury' },
                  ].map((step, i) => (
                    <motion.div key={i} variants={fadeUp} className={`${styles.waterfallStep} ${activeRepayStep === i ? styles.waterfallStepActive : ''}`}>
                      <div className={styles.waterfallStepLabel}>{step.label}</div>
                      <div className={styles.waterfallStepValue}>{step.value}</div>
                      <div className={styles.waterfallStepDesc}>{step.desc}</div>
                      {i < 4 && <ArrowDown size={14} className={styles.waterfallArrow} />}
                    </motion.div>
                  ))}
                </motion.div>
              </motion.div>

              <motion.div variants={fadeUp} className={styles.waterfallCol}>
                <div className={styles.waterfallColTitle}>LOSS WATERFALL</div>
                <div className={styles.waterfallColSub}>Who absorbs losses — opposite direction</div>
                <motion.div className={styles.waterfallSteps} variants={waterfallStagger} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                  {[
                    { label: 'INSURANCE RESERVE', value: '93+', desc: 'L2 defaults absorbed' },
                    { label: 'JUNIOR TRANCHE', value: '116', desc: 'Additional defaults covered' },
                    { label: 'MEZZANINE', value: '175', desc: 'Additional defaults covered' },
                    { label: 'SENIOR TRANCHE', value: 'LAST', desc: 'Last resort — never reached' },
                  ].map((step, i) => (
                    <motion.div key={i} variants={fadeUp} className={`${styles.waterfallStep} ${styles.waterfallStepLoss} ${activeLossStep === i ? styles.waterfallStepActiveLoss : ''}`}>
                      <div className={styles.waterfallStepLabel}>{step.label}</div>
                      <div className={styles.waterfallStepValue}>{step.value}</div>
                      <div className={styles.waterfallStepDesc}>{step.desc}</div>
                      {i < 3 && <ArrowDown size={14} className={styles.waterfallArrow} />}
                    </motion.div>
                  ))}
                </motion.div>
              </motion.div>
            </motion.div>

            <motion.div variants={fadeUp} className={styles.waterfallStat}>
              <span className={styles.waterfallStatNum}>384</span>
              <span className={styles.waterfallStatText}>simultaneous defaults before Senior tranche is touched</span>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── Risk Model Bento — BLACK ─────────────────────────── */}
      <section className={styles.sectionDark} id="risk">
        <div className={styles.container}>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }} variants={stagger}>
            <motion.span variants={fadeUp} className={styles.sectionTag}>RISK_ENGINE</motion.span>
            <motion.h2 variants={fadeUp} className={styles.sectionTitle}>THE RISK MODEL</motion.h2>

            <motion.div className={styles.riskBento} variants={stagger}>
              <motion.div variants={fadeUp} className={styles.riskCardLarge}>
                <Eye size={24} className={styles.riskIcon} />
                <span className={styles.riskLabel}>NAV_ENGINE</span>
                <h3 className={styles.riskTitle}>REAL-TIME HEALTH CHECK</h3>
                <p className={styles.riskDesc}>
                  We check every agent wallet&apos;s value every 2 seconds. If it drops too low,
                  the system acts before losses pile up. Interest owed never triggers a false alarm.
                </p>
                <div className={styles.riskTags}>
                  <span>REAL-TIME</span><span>PER-SECOND</span><span>CONSERVATIVE</span>
                </div>
              </motion.div>

              <motion.div variants={fadeUp} className={styles.riskCardSmall}>
                <Layers size={24} className={styles.riskIcon} />
                <span className={styles.riskLabel}>TOKEN_HAIRCUTS</span>
                <h3 className={styles.riskTitle}>RISK-ADJUSTED VALUE</h3>
                <p className={styles.riskDesc}>
                  Risky tokens count for less. Hard to sell and volatile? Worth 35% less on paper.
                  No market price? Counted as zero. Conservative by design.
                </p>
              </motion.div>

              <motion.div variants={fadeUp} className={styles.riskCardBlue}>
                <Activity size={24} className={styles.riskIcon} />
                <span className={styles.riskLabel}>HHI_DETECTION</span>
                <h3 className={styles.riskTitle}>CONCENTRATION RISK</h3>
                <p className={styles.riskDesc}>
                  All eggs in one basket? Penalized. 80% in a single token gets a 10% health penalty.
                  Diversification is enforced, not suggested.
                </p>
              </motion.div>

              <motion.div variants={fadeUp} className={styles.riskCardLarge}>
                <Wallet size={24} className={styles.riskIcon} />
                <span className={styles.riskLabel}>ORACLE_CHAIN</span>
                <h3 className={styles.riskTitle}>4-SOURCE PRICE FEED</h3>
                <p className={styles.riskDesc}>
                  Prices from four independent sources. If one goes down, the next takes over.
                  If all four fail, the system pauses safely — no panic selling.
                </p>
                <div className={styles.riskTags}>
                  <span>JUPITER</span><span>PYTH</span><span>SWITCHBOARD</span><span>BIRDEYE</span>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── Who It's For — WHITE — Bento Grid ────────────────── */}
      <section className={styles.sectionLight}>
        <div className={styles.container}>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }} variants={stagger}>
            <motion.span variants={fadeUp} className={styles.sectionTagDark}>ACTIVE_DOSSIERS</motion.span>
            <motion.h2 variants={fadeUp} className={styles.sectionTitleDark}>WHO IT&apos;S FOR</motion.h2>

            <motion.div className={styles.bentoGrid} variants={stagger}>
              <motion.div variants={fadeUp} className={styles.cardDark}>
                <div>
                  <AgentIcon />
                  <span className={styles.categoryLabel}>CREDIT_INFRA</span>
                  <h3 className={styles.bentoTitle}>FOR AI AGENTS</h3>
                  <p className={styles.bentoDesc}>
                    Get credit lines from $500 to $500K. Build a Krexit Score automatically from x402 revenue —
                    5 components, recency-weighted, asymmetric penalties. Zero collateral. PDA wallet with 8 safety layers.
                  </p>
                  <div className={styles.techTags}>
                    <span className={styles.techTag}>SOLANA</span>
                    <span className={styles.techTag}>x402</span>
                    <span className={styles.techTag}>KREXIT</span>
                    <span className={styles.techTag}>PDA WALLET</span>
                  </div>
                </div>
                <button className={styles.pillBtn} onClick={() => navigate('/app/lifecycle')}>ACCESS FILES →</button>
              </motion.div>

              <motion.div variants={fadeUp} className={styles.cardLight}>
                <div>
                  <VaultIcon />
                  <span className={styles.categoryLabel}>YIELD_LAYER</span>
                  <h3 className={styles.bentoTitle}>FOR INVESTORS</h3>
                  <p className={styles.bentoDesc}>
                    Senior tranche: 20% APR, first to eat, last to bleed. Junior: 55% APR for risk-seekers.
                    Real revenue yield — not token emissions. 384 defaults before Senior is touched.
                  </p>
                </div>
                <button className={styles.pillLink} onClick={() => navigate('/app/vaults')}>BROWSE_VAULTS ↗</button>
              </motion.div>

              <motion.div variants={fadeUp} className={styles.cardBlue}>
                <div>
                  <MerchantIcon />
                  <span className={styles.categoryLabel}>MERCHANT_OS</span>
                  <h3 className={styles.bentoTitle}>FOR MERCHANTS</h3>
                  <p className={styles.bentoDesc}>
                    Working capital against your revenue. No collateral. No 6-week wait.
                    Automatic repayment via PaymentRouter — enforced by smart contract, not courts.
                  </p>
                </div>
                <span className={styles.statusBadge}>ACT_LINK: ON</span>
              </motion.div>

              <motion.div variants={fadeUp} className={styles.cardLight}>
                <div>
                  <ChainIcon />
                  <span className={styles.categoryLabel}>LIVE &nbsp;&nbsp; SOLANA DEVNET — 2026</span>
                  <h3 className={styles.bentoTitle}>KREXA ON SOLANA</h3>
                  <p className={styles.bentoDesc}>
                    5 programs on devnet: PaymentRouter, AgentRegistry, CreditVault, VenueWhitelist, AgentWallet.
                    NAV engine, oracle chain, keeper bot — full credit lifecycle running on-chain.
                  </p>
                </div>
                <button className={styles.pillLink} onClick={() => navigate('/app')}>LAUNCH_APP ↗</button>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── Three Ways — BLACK ──────────────────────────────── */}
      <section className={styles.sectionDark}>
        <div className={styles.container}>
          <motion.span initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className={styles.sectionTag}>DEVELOPER_READY</motion.span>
          <motion.h2 initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className={styles.sectionTitle}>THREE WAYS TO USE KREXA</motion.h2>

          <div className={styles.usageGrid}>
            {/* Card 1 — CLI */}
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className={styles.usageCard}>
              <div className={styles.usageIcon}>
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="#2DD4BF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6,10 14,16 6,22" />
                  <line x1="17" y1="22" x2="26" y2="22" />
                </svg>
              </div>
              <h3 className={styles.usageCardTitle}>CLI</h3>
              <div className={styles.usageCodeBlock}>
                <code className={styles.usageCode}>npx @krexa/cli init</code>
              </div>
              <p className={styles.usageCardDesc}>One command. Full setup. Borrow in seconds.</p>
            </motion.div>

            {/* Card 2 — Skill */}
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className={styles.usageCard}>
              <div className={styles.usageIcon}>
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="#2DD4BF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 4h12l6 6v18H8V4z" />
                  <polyline points="20,4 20,10 26,10" />
                  <line x1="12" y1="16" x2="22" y2="16" />
                  <line x1="12" y1="20" x2="22" y2="20" />
                  <line x1="12" y1="24" x2="18" y2="24" />
                </svg>
              </div>
              <h3 className={styles.usageCardTitle}>SKILL</h3>
              <div className={styles.usageCodeBlock}>
                <code className={styles.usageCode}>krexa.xyz/skill.md</code>
              </div>
              <p className={styles.usageCardDesc}>Paste into your agent&apos;s prompt. It learns Krexa instantly.</p>
            </motion.div>

            {/* Card 3 — MCP */}
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className={styles.usageCard}>
              <div className={styles.usageIcon}>
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="#2DD4BF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 4a7 7 0 00-9.9 9.9L4 21l3 3 7.1-7.1A7 7 0 0021 4z" />
                  <line x1="20" y1="5" x2="14" y2="11" />
                  <line x1="17" y1="8" x2="22" y2="13" />
                </svg>
              </div>
              <h3 className={styles.usageCardTitle}>MCP</h3>
              <div className={styles.usageCodeBlock}>
                <code className={styles.usageCode}>claude mcp add krexa -- npx @krexa/cli mcp</code>
              </div>
              <p className={styles.usageCardDesc}>Works with Claude Code, Cursor, and 14+ AI clients.</p>
            </motion.div>
          </div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className={styles.codeLinks}>
            <a href="https://github.com/Yatharth4599/TCredit" target="_blank" rel="noopener noreferrer" className={styles.codeLink}>View on GitHub →</a>
            <button className={styles.codeLink} onClick={() => navigate('/app/lifecycle')}>Live Demo →</button>
          </motion.div>
        </div>
      </section>

      {/* ── FAQ — WHITE ──────────────────────────────────────── */}
      <section className={styles.sectionLight} id="faq">
        <div className={styles.container}>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }} variants={stagger}>
            <motion.span variants={fadeUp} className={styles.sectionTagDark}>KNOWLEDGE_BASE</motion.span>
            <motion.h2 variants={fadeUp} className={styles.sectionTitleDark}>FAQ</motion.h2>
            <motion.div variants={fadeUp} className={styles.faqList}>
              {faqItems.map((item, i) => (
                <div key={i} className={`${styles.faqItem} ${openFaq === i ? styles.faqOpen : ''}`}>
                  <button className={styles.faqQuestion} onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                    <span>{item.q}</span>
                    {openFaq === i ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                  {openFaq === i && <div className={styles.faqAnswer}>{item.a}</div>}
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── Final CTA — BLACK ────────────────────────────────── */}
      <section className={styles.ctaSection}>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }} variants={stagger} className={styles.ctaInner}>
          <motion.h2 variants={fadeUp} className={styles.ctaTitle}>
            READY TO BUILD<br /><span className={styles.heroAccent}>ON KREXA?</span>
          </motion.h2>
          <motion.div variants={fadeUp}>
            <button className={styles.ctaBtn} onClick={() => navigate('/app')}>Launch App →</button>
          </motion.div>
          <motion.div variants={fadeUp} className={styles.ctaSocials}>
            <a href="https://t.me/tigerpayx" target="_blank" rel="noopener noreferrer" className={styles.ctaSocialLink}>Telegram</a>
            <span className={styles.techSep}>·</span>
            <a href="https://x.com/krexa_xyz" target="_blank" rel="noopener noreferrer" className={styles.ctaSocialLink}>Twitter</a>
            <span className={styles.techSep}>·</span>
            <a href="https://github.com/Yatharth4599/TCredit" target="_blank" rel="noopener noreferrer" className={styles.ctaSocialLink}>GitHub</a>
          </motion.div>
        </motion.div>
      </section>

      {/* ── Footer ───────────────────────────────────────── */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          {/* Top: Brand left + Link cards right */}
          <div className={styles.footerTop}>
            <div className={styles.footerLeft}>
              <div className={styles.footerBrandRow}>
                <img src="/images/krexa-logo-mark.png" alt="Krexa" className={styles.footerLogoImg} />
                <span className={styles.footerBrand}>Krexa</span>
              </div>
              <p className={styles.footerTagline}>The credit layer for the agent economy. Revenue-enforced lending for AI agents, built on Solana.</p>
              <p className={styles.footerAddr}>krexa.xyz</p>
            </div>

            <div className={styles.footerRight}>
              <div className={styles.footerColGroup}>
                <h4 className={styles.footerColTitle}>PRODUCT</h4>
                <div className={styles.footerCards}>
                  <button className={styles.footerCard} onClick={() => navigate('/app')}>
                    <span className={styles.footerCardLabel}>Launch App</span>
                    <span className={styles.footerCardArrow}>→</span>
                  </button>
                  <button className={styles.footerCard} onClick={() => navigate('/app/vaults')}>
                    <span className={styles.footerCardLabel}>Vaults</span>
                    <span className={styles.footerCardArrow}>→</span>
                  </button>
                  <button className={styles.footerCard} onClick={() => navigate('/app/identity')}>
                    <span className={styles.footerCardLabel}>Krexit Score</span>
                    <span className={styles.footerCardArrow}>→</span>
                  </button>
                </div>
              </div>

              <div className={styles.footerColGroup}>
                <h4 className={styles.footerColTitle}>COMMUNITY</h4>
                <div className={styles.footerCards}>
                  <a href="https://x.com/krexa_xyz" target="_blank" rel="noopener noreferrer" className={styles.footerCard}>
                    <span className={styles.footerCardLabel}>Twitter (X)</span>
                    <span className={styles.footerCardArrow}>↗</span>
                  </a>
                  <a href="https://t.me/tigerpayx" target="_blank" rel="noopener noreferrer" className={styles.footerCard}>
                    <span className={styles.footerCardLabel}>Telegram</span>
                    <span className={styles.footerCardArrow}>↗</span>
                  </a>
                  <a href="https://github.com/Yatharth4599/TCredit" target="_blank" rel="noopener noreferrer" className={styles.footerCard}>
                    <span className={styles.footerCardLabel}>GitHub</span>
                    <span className={styles.footerCardArrow}>↗</span>
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className={styles.footerDivider} />
          <div className={styles.footerBottom}>
            <span className={styles.footerCopyright}>© 2026 Krexa Protocol · Built on Solana</span>
            <span className={styles.footerLegal}>Privacy Policy · Terms · Disclaimer</span>
          </div>
        </div>
      </footer>

    </div>
  )
}
