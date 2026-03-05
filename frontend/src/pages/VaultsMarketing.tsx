import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import { AnimatedNumber } from '../components/ui/AnimatedNumber'
import { ArrowRight, Check, ExternalLink, Shield, TrendingUp, Layers, Clock } from 'lucide-react'
import styles from './VaultsMarketing.module.css'

const ease = [0.16, 1, 0.3, 1] as const

function Counter({ visible, end, prefix = '', suffix = '', decimals = 0 }: {
    visible: boolean; end: number; prefix?: string; suffix?: string; decimals?: number
}) {
    const [value, setValue] = useState(0)
    const raf = useRef(0)
    useEffect(() => {
        if (!visible) { setValue(0); return }
        const start = performance.now()
        const tick = (now: number) => {
            const p = Math.min((now - start) / 1500, 1)
            setValue((1 - Math.pow(1 - p, 3)) * end)
            if (p < 1) raf.current = requestAnimationFrame(tick)
        }
        raf.current = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(raf.current)
    }, [visible, end])
    return <>{prefix}{decimals > 0 ? value.toFixed(decimals) : Math.round(value).toLocaleString()}{suffix}</>
}

export default function VaultsMarketing() {
    const navigate = useNavigate()
    const [card1Visible, setCard1Visible] = useState(false)
    const [_card2Visible, setCard2Visible] = useState(false)
    const [_card3Visible, setCard3Visible] = useState(false)
    const card1Ref = useRef<HTMLDivElement>(null)
    const card2Ref = useRef<HTMLDivElement>(null)
    const card3Ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const observe = (ref: React.RefObject<HTMLDivElement | null>, setter: (v: boolean) => void) => {
            const node = ref.current
            if (!node) return
            const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setter(true); obs.disconnect() } }, { threshold: 0.3 })
            obs.observe(node)
            return () => obs.disconnect()
        }
        const c1 = observe(card1Ref, setCard1Visible)
        const c2 = observe(card2Ref, setCard2Visible)
        const c3 = observe(card3Ref, setCard3Visible)
        return () => { c1?.(); c2?.(); c3?.() }
    }, [])

    return (
        <div className={styles.page}>
            {/* ── Hero ──────────────────────────────────── */}
            <section className={styles.hero}>
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, ease }}
                >
                    <div className={styles.heroLabel}>Structured Credit Infrastructure</div>
                    <h1 className={styles.heroTitle}>Credit Vaults</h1>
                </motion.div>
                <motion.p
                    className={styles.heroSubtitle}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, ease, delay: 0.15 }}
                >
                    Fund real businesses. Earn real yield. Every repayment enforced on-chain through waterfall smart contracts on Base.
                </motion.p>
                <motion.div
                    className={styles.heroActions}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease, delay: 0.3 }}
                >
                    <button className={styles.launchBtn} onClick={() => navigate('/app/vaults')}>
                        Launch App <ArrowRight size={18} />
                    </button>
                    <a href="#how-it-works" className={styles.ghostBtn}>How It Works</a>
                </motion.div>

                <motion.div
                    className={styles.heroStats}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease, delay: 0.45 }}
                >
                    {[
                        { value: '$20M+', label: 'Total Value Locked' },
                        { value: '8–15%', label: 'APY Range' },
                        { value: '100%', label: 'On-Chain' },
                        { value: 'Base L2', label: 'Network' },
                    ].map(s => (
                        <div key={s.label} className={styles.heroStat}>
                            <span className={styles.heroStatValue}>{s.value}</span>
                            <span className={styles.heroStatLabel}>{s.label}</span>
                        </div>
                    ))}
                </motion.div>
            </section>

            {/* ── Big Statement ─────────────────────────── */}
            <section className={styles.statement}>
                <motion.h2
                    className={styles.statementText}
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-100px' }}
                    transition={{ duration: 0.7, ease }}
                >
                    Each vault is a structured credit facility for a real business — funded by investors, enforced by smart contracts, and repaid through revenue.
                </motion.h2>
            </section>

            {/* ── Feature 1: Invest in Real Revenue ────── */}
            <section className={styles.featureSection} id="how-it-works">
                <div className={styles.featureInner}>
                    <motion.div
                        className={styles.featureContent}
                        initial={{ opacity: 0, x: -30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true, margin: '-80px' }}
                        transition={{ duration: 0.6, ease }}
                    >
                        <div className={styles.featureLabel}>For Investors</div>
                        <h2 className={styles.featureTitle}>
                            Invest in Real Revenue
                        </h2>
                        <p className={styles.featureDesc}>
                            Each vault represents a structured credit facility for a verified business.
                            Capital is deployed in milestone-gated tranches — you invest in a business's
                            actual revenue stream, not speculative tokens. Repayment flows through an
                            on-chain waterfall where senior lenders always get paid first.
                        </p>
                        <ul className={styles.featureList}>
                            <li><Check size={16} className={styles.checkIcon} /> Fixed-rate yields from 8–15% APY, backed by business cash flow</li>
                            <li><Check size={16} className={styles.checkIcon} /> Milestone-gated capital release — funds unlock only on verified progress</li>
                            <li><Check size={16} className={styles.checkIcon} /> Transparent on-chain repayments auditable on BaseScan</li>
                            <li><Check size={16} className={styles.checkIcon} /> Choose your risk tier — Senior, Pool, or Community tranche</li>
                        </ul>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-80px' }}
                        transition={{ duration: 0.6, ease, delay: 0.15 }}
                    >
                        <div ref={card1Ref} className={styles.card}>
                            <div className={styles.shimmer} />
                            <div className={styles.cardHeader}>
                                <span>Vault Performance</span>
                                <span className={styles.liveBadge}>
                                    <span className={styles.liveDot} /> Live
                                </span>
                            </div>
                            <div className={styles.bigStat}>
                                <span className={styles.statBig}>
                                    <Counter visible={card1Visible} end={12.5} suffix="%" decimals={1} />
                                </span>
                                <span className={styles.statLabel}>Average APY</span>
                            </div>
                            <div className={styles.statRow}>
                                <div>
                                    <span className={styles.statSmallValue}>
                                        $<Counter visible={card1Visible} end={375000} prefix="" />
                                    </span>
                                    <span className={styles.statSmallLabel}>Total Raised</span>
                                </div>
                                <div>
                                    <span className={styles.statSmallValue}>
                                        <Counter visible={card1Visible} end={6} /> mo
                                    </span>
                                    <span className={styles.statSmallLabel}>Avg Duration</span>
                                </div>
                            </div>
                            <div className={styles.divider} />
                            <div className={styles.statRow}>
                                <div>
                                    <span className={styles.statSmallValue}>
                                        <Counter visible={card1Visible} end={25} />
                                    </span>
                                    <span className={styles.statSmallLabel}>Active Vaults</span>
                                </div>
                                <div>
                                    <span className={styles.statSmallValue}>
                                        <Counter visible={card1Visible} end={847} />
                                    </span>
                                    <span className={styles.statSmallLabel}>Repayments</span>
                                </div>
                            </div>
                            <div className={styles.progressBar}>
                                <motion.div
                                    className={styles.progressFill}
                                    initial={{ width: 0 }}
                                    whileInView={{ width: '72%' }}
                                    viewport={{ once: true }}
                                    transition={{ duration: 1.2, ease, delay: 0.3 }}
                                />
                            </div>
                            <div className={styles.progressMeta}>
                                <span>72% funded</span>
                                <span>$270K / $375K</span>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* ── Big Statement 2 ───────────────────────── */}
            <section className={styles.statement}>
                <motion.h2
                    className={styles.statementText}
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-100px' }}
                    transition={{ duration: 0.7, ease }}
                >
                    When revenue is programmable, repayment becomes automatic. No courts. No collection agencies. Just code.
                </motion.h2>
            </section>

            {/* ── Feature 2: Waterfall Repayment ─────── */}
            <section className={styles.featureSection}>
                <div className={`${styles.featureInner} ${styles.featureReverse}`}>
                    <motion.div
                        className={styles.featureContent}
                        initial={{ opacity: 0, x: 30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true, margin: '-80px' }}
                        transition={{ duration: 0.6, ease }}
                    >
                        <div className={styles.featureLabel}>Risk Management</div>
                        <h2 className={styles.featureTitle}>
                            Waterfall Repayment
                        </h2>
                        <p className={styles.featureDesc}>
                            Every vault enforces a strict repayment waterfall. When revenue flows in,
                            repayment cascades top-down — senior lenders are paid first, then liquidity pools,
                            then community investors. The merchant receives surplus only after all obligations are met.
                            No manual intervention — the smart contract handles everything.
                        </p>
                        <ul className={styles.featureList}>
                            <li><Check size={16} className={styles.checkIcon} /> Senior tranche gets priority — lowest risk, reliable returns</li>
                            <li><Check size={16} className={styles.checkIcon} /> Automated on-chain distribution — no intermediaries</li>
                            <li><Check size={16} className={styles.checkIcon} /> Real-time waterfall tracking on every vault detail page</li>
                            <li><Check size={16} className={styles.checkIcon} /> Late fees calculated and enforced at the protocol layer</li>
                        </ul>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-80px' }}
                        transition={{ duration: 0.6, ease, delay: 0.15 }}
                    >
                        <div ref={card2Ref} className={styles.card}>
                            <div className={styles.shimmer} />
                            <div className={styles.cardHeader}>
                                <span>Repayment Waterfall</span>
                                <span className={styles.liveBadge}>
                                    <span className={styles.liveDot} /> Active
                                </span>
                            </div>
                            <div className={styles.waterfallFlow}>
                                {[
                                    { name: 'Senior Pool', amount: '$120,000', pct: '32%', color: '#2CFF05', width: 85 },
                                    { name: 'Liquidity Pool', amount: '$80,000', pct: '21%', color: '#00FFF0', width: 60 },
                                    { name: 'Community Investors', amount: '$175,000', pct: '47%', color: '#FF5C00', width: 45 },
                                ].map((step, i) => (
                                    <motion.div
                                        key={step.name}
                                        className={styles.waterfallStep}
                                        initial={{ opacity: 0, x: -20 }}
                                        whileInView={{ opacity: 1, x: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ duration: 0.5, ease, delay: 0.2 + i * 0.12 }}
                                    >
                                        <span className={styles.waterfallDot} style={{ background: step.color }} />
                                        <div style={{ flex: 1 }}>
                                            <div className={styles.waterfallInfo}>
                                                <span className={styles.waterfallName}>{step.name}</span>
                                                <div className={styles.waterfallRight}>
                                                    <span className={styles.waterfallPct}>{step.pct}</span>
                                                    <span className={styles.waterfallAmount}>{step.amount}</span>
                                                </div>
                                            </div>
                                            <div className={styles.waterfallBar}>
                                                <motion.div
                                                    className={styles.waterfallBarFill}
                                                    style={{ background: step.color }}
                                                    initial={{ width: 0 }}
                                                    whileInView={{ width: `${step.width}%` }}
                                                    viewport={{ once: true }}
                                                    transition={{ duration: 1, ease, delay: 0.4 + i * 0.15 }}
                                                />
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                            <div className={styles.divider} />
                            <div className={styles.waterfallTotal}>
                                <span>Total Vault Size</span>
                                <span className={styles.waterfallTotalVal}>$375,000</span>
                            </div>
                            <div className={styles.waterfallTotal}>
                                <span>Repaid So Far</span>
                                <span className={styles.waterfallTotalVal} style={{ color: '#2CFF05' }}>$218,400</span>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* ── How It Works — Steps ──────────────────── */}
            <section className={styles.stepsSection}>
                <motion.div
                    className={styles.stepsHeader}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, ease }}
                >
                    <div className={styles.featureLabel} style={{ textAlign: 'center' }}>The Lifecycle</div>
                    <h2 className={styles.stepsTitle}>How a vault works, step by step</h2>
                </motion.div>
                <div className={styles.stepsGrid}>
                    {[
                        { icon: <TrendingUp size={24} />, num: '01', title: 'Merchant creates vault', desc: 'Sets target amount, interest rate, duration, and number of tranches. Vault deploys as a smart contract on Base.' },
                        { icon: <Layers size={24} />, num: '02', title: 'Investors fund tranches', desc: 'Senior pool, liquidity pools, and community investors contribute USDC. Each tier has different risk/return.' },
                        { icon: <Clock size={24} />, num: '03', title: 'Milestones unlock capital', desc: 'Oracle verifies business milestones. Each approved milestone releases the next tranche to the merchant.' },
                        { icon: <Shield size={24} />, num: '04', title: 'Revenue repays the vault', desc: 'x402 payment splits auto-route repayment. Waterfall ensures senior → pool → community priority.' },
                    ].map((step, i) => (
                        <motion.div
                            key={step.num}
                            className={styles.stepCard}
                            initial={{ opacity: 0, y: 24 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, ease, delay: i * 0.1 }}
                        >
                            <div className={styles.stepIcon}>{step.icon}</div>
                            <span className={styles.stepNum}>{step.num}</span>
                            <h3 className={styles.stepTitle}>{step.title}</h3>
                            <p className={styles.stepDesc}>{step.desc}</p>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* ── Feature 3: Milestone-Gated Tranches ─── */}
            <section className={styles.featureSection}>
                <div className={styles.featureInner}>
                    <motion.div
                        className={styles.featureContent}
                        initial={{ opacity: 0, x: -30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true, margin: '-80px' }}
                        transition={{ duration: 0.6, ease }}
                    >
                        <div className={styles.featureLabel}>Capital Safety</div>
                        <h2 className={styles.featureTitle}>
                            Milestone-Gated Tranches
                        </h2>
                        <p className={styles.featureDesc}>
                            Capital isn't released all at once. Each tranche is unlocked only
                            after the borrower hits verified milestones — confirmed by
                            an oracle. If milestones fail, remaining funds stay protected.
                            Loan terms range from 3–12 months with structured tranche schedules.
                        </p>
                        <ul className={styles.featureList}>
                            <li><Check size={16} className={styles.checkIcon} /> Oracle-verified milestones before each release</li>
                            <li><Check size={16} className={styles.checkIcon} /> Partial release reduces counterparty risk</li>
                            <li><Check size={16} className={styles.checkIcon} /> Auto-cancel on missed deadlines — capital returned to investors</li>
                            <li><Check size={16} className={styles.checkIcon} /> Configurable: 2–8 tranches per vault</li>
                        </ul>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-80px' }}
                        transition={{ duration: 0.6, ease, delay: 0.15 }}
                    >
                        <div ref={card3Ref} className={styles.card}>
                            <div className={styles.shimmer} />
                            <div className={styles.cardHeader}>
                                <span>Tranche Release Schedule</span>
                            </div>
                            <div className={styles.trancheList}>
                                {[
                                    { idx: 'T1', amount: '$62,500', pct: 100, status: 'Released', approved: true, date: 'Jan 15' },
                                    { idx: 'T2', amount: '$62,500', pct: 100, status: 'Released', approved: true, date: 'Feb 28' },
                                    { idx: 'T3', amount: '$62,500', pct: 65, status: 'In Review', approved: false, date: 'Mar 15' },
                                    { idx: 'T4', amount: '$62,500', pct: 0, status: 'Pending', approved: false, date: 'Apr 30' },
                                    { idx: 'T5', amount: '$62,500', pct: 0, status: 'Locked', approved: false, date: 'Jun 15' },
                                    { idx: 'T6', amount: '$62,500', pct: 0, status: 'Locked', approved: false, date: 'Jul 31' },
                                ].map((t, i) => (
                                    <motion.div
                                        key={t.idx}
                                        className={styles.trancheItem}
                                        initial={{ opacity: 0, y: 10 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ duration: 0.4, ease, delay: 0.15 + i * 0.06 }}
                                    >
                                        <span className={styles.trancheIndex}>{t.idx}</span>
                                        <div className={styles.trancheBar}>
                                            <motion.div
                                                className={styles.trancheBarFill}
                                                initial={{ width: 0 }}
                                                whileInView={{ width: `${t.pct}%` }}
                                                viewport={{ once: true }}
                                                transition={{ duration: 1, ease, delay: 0.3 + i * 0.08 }}
                                            />
                                        </div>
                                        <span className={styles.trancheAmount}>{t.amount}</span>
                                        <span className={`${styles.trancheStatus} ${t.approved ? styles.trancheApproved : styles.tranchePending}`}>
                                            {t.status}
                                        </span>
                                    </motion.div>
                                ))}
                            </div>
                            <div className={styles.divider} />
                            <div className={styles.waterfallTotal}>
                                <span>Total Vault</span>
                                <span className={styles.waterfallTotalVal}>$375,000</span>
                            </div>
                            <div className={styles.waterfallTotal}>
                                <span>Released</span>
                                <span className={styles.waterfallTotalVal} style={{ color: '#2CFF05' }}>$125,000 (33%)</span>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* ── Stats Band (dark) ──────────────────── */}
            <section className={styles.statsBand}>
                <div className={styles.statsBandInner}>
                    {[
                        { value: 25, label: 'Active Vaults', suffix: '', prefix: '' },
                        { value: 20, label: 'Total Value Locked', suffix: 'M+', prefix: '$' },
                        { value: 11.2, label: 'Average APY', suffix: '%', prefix: '' },
                        { value: 847, label: 'On-Chain Repayments', suffix: '', prefix: '' },
                    ].map((stat, i) => (
                        <motion.div
                            key={stat.label}
                            className={styles.bandCard}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, ease, delay: i * 0.08 }}
                        >
                            <div className={styles.bandValue}>
                                {stat.prefix}
                                <AnimatedNumber
                                    value={stat.value}
                                    suffix={stat.suffix}
                                    decimals={stat.value % 1 !== 0 ? 1 : 0}
                                />
                            </div>
                            <div className={styles.bandLabel}>{stat.label}</div>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* ── Key Features Grid ──────────────────── */}
            <section className={styles.featuresGrid}>
                <motion.div
                    className={styles.stepsHeader}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, ease }}
                >
                    <h2 className={styles.stepsTitle}>Built for serious capital</h2>
                </motion.div>
                <div className={styles.stepsGrid}>
                    {[
                        { title: 'USDC Denominated', desc: 'All vaults settle in USDC on Base L2. No volatile collateral, no wrapped tokens. Pure stablecoin yield.' },
                        { title: 'Configurable Terms', desc: '3–12 month durations. 2–8 tranches. 8–15% APY. Merchants set terms, investors choose their profile.' },
                        { title: 'Auto-Cancel Protection', desc: 'If a vault misses fundraising deadline or milestone, the keeper auto-cancels and returns all investor funds.' },
                        { title: 'On-Chain Transparency', desc: 'Every deposit, tranche release, repayment, and waterfall distribution is verifiable on BaseScan. No black boxes.' },
                        { title: 'FairScale Credit Scoring', desc: 'Merchants are scored 0–1000 based on x402 payment history. Better scores unlock larger vaults and lower rates.' },
                        { title: 'Smart Contract Enforced', desc: 'No manual collections. Repayment is routed from x402 payment splits at the protocol level. Code enforces terms.' },
                    ].map((feat, i) => (
                        <motion.div
                            key={feat.title}
                            className={styles.featureCard}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.4, ease, delay: i * 0.06 }}
                        >
                            <h3 className={styles.featureCardTitle}>{feat.title}</h3>
                            <p className={styles.featureCardDesc}>{feat.desc}</p>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* ── CTA Footer ─────────────────────────── */}
            <section className={styles.ctaSection}>
                <motion.h2
                    className={styles.ctaTitle}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, ease }}
                >
                    Ready to earn yield from real revenue?
                </motion.h2>
                <motion.p
                    className={styles.ctaSubtitle}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, ease, delay: 0.1 }}
                >
                    Browse active vaults, pick your tranche, and start investing in minutes.
                </motion.p>
                <motion.div
                    className={styles.ctaActions}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, ease, delay: 0.2 }}
                >
                    <button className={styles.launchBtn} onClick={() => navigate('/app/vaults')}>
                        Launch App <ArrowRight size={18} />
                    </button>
                    <a
                        href="https://sepolia.basescan.org/address/0xf8fDa17F877dEFFCD80784E0465F33d585644360"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.secondaryBtn}
                    >
                        View on BaseScan <ExternalLink size={14} />
                    </a>
                </motion.div>
            </section>
        </div>
    )
}
