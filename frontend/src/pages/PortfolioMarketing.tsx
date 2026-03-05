import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import { AnimatedNumber } from '../components/ui/AnimatedNumber'
import { ArrowRight, Check, ExternalLink, PieChart, Wallet, BarChart3, Bell } from 'lucide-react'
import styles from './PortfolioMarketing.module.css'

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

export default function PortfolioMarketing() {
    const navigate = useNavigate()
    const [card1Visible, setCard1Visible] = useState(false)
    const [_card2Visible, setCard2Visible] = useState(false)
    const card1Ref = useRef<HTMLDivElement>(null)
    const card2Ref = useRef<HTMLDivElement>(null)

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
        return () => { c1?.(); c2?.() }
    }, [])

    return (
        <div className={styles.page}>
            {/* ── Hero ──────────────────────────────── */}
            <section className={styles.hero}>
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, ease }}
                >
                    <div className={styles.heroLabel}>Investor Dashboard</div>
                    <h1 className={styles.heroTitle}>Portfolio Tracker</h1>
                </motion.div>
                <motion.p
                    className={styles.heroSubtitle}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, ease, delay: 0.15 }}
                >
                    Track every investment, claim accumulated yield, and monitor vault performance across your entire portfolio — all from one dashboard, powered by live on-chain data.
                </motion.p>
                <motion.div
                    className={styles.heroActions}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease, delay: 0.3 }}
                >
                    <button className={styles.launchBtn} onClick={() => navigate('/app/portfolio')}>
                        Launch App <ArrowRight size={18} />
                    </button>
                    <a href="#features" className={styles.ghostBtn}>See Features</a>
                </motion.div>

                <motion.div
                    className={styles.heroStats}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease, delay: 0.45 }}
                >
                    {[
                        { value: 'Real-Time', label: 'On-Chain Data' },
                        { value: '1-Click', label: 'Yield Claiming' },
                        { value: 'All Vaults', label: 'Single View' },
                        { value: 'Base L2', label: 'Network' },
                    ].map(s => (
                        <div key={s.label} className={styles.heroStat}>
                            <span className={styles.heroStatValue}>{s.value}</span>
                            <span className={styles.heroStatLabel}>{s.label}</span>
                        </div>
                    ))}
                </motion.div>
            </section>

            {/* ── Big Statement ─────────────────────── */}
            <section className={styles.statement}>
                <motion.h2
                    className={styles.statementText}
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-100px' }}
                    transition={{ duration: 0.7, ease }}
                >
                    Every position, every tranche, every claimable dollar — visible in real time. Your investments are fully transparent because they live on-chain.
                </motion.h2>
            </section>

            {/* ── Feature 1: Portfolio Overview ──── */}
            <section className={styles.featureSection} id="features">
                <div className={styles.featureInner}>
                    <motion.div
                        className={styles.featureContent}
                        initial={{ opacity: 0, x: -30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true, margin: '-80px' }}
                        transition={{ duration: 0.6, ease }}
                    >
                        <div className={styles.featureLabel}>Real-Time Data</div>
                        <h2 className={styles.featureTitle}>Track Every Position</h2>
                        <p className={styles.featureDesc}>
                            See your total invested capital, claimable yield, and active positions
                            across all vaults — updated in real time from on-chain data. Each vault
                            shows its current state (fundraising, active, repaying, completed),
                            APY, duration, and your individual share of the total raise.
                        </p>
                        <ul className={styles.featureList}>
                            <li><Check size={16} className={styles.checkIcon} /> Live portfolio valuation from on-chain reads</li>
                            <li><Check size={16} className={styles.checkIcon} /> Per-vault P&L breakdown with interest rates and terms</li>
                            <li><Check size={16} className={styles.checkIcon} /> Historical investment tracking across all vault states</li>
                            <li><Check size={16} className={styles.checkIcon} /> Filter by Active, Repaying, or Completed</li>
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
                                <span>Portfolio Overview</span>
                                <span className={styles.liveBadge}><span className={styles.liveDot} /> Live</span>
                            </div>
                            <div className={styles.bigStat}>
                                <span className={styles.statBig}>
                                    $<Counter visible={card1Visible} end={42500} />
                                </span>
                                <span className={styles.statLabel}>Total Invested</span>
                            </div>
                            <div className={styles.statRow}>
                                <div>
                                    <span className={styles.statSmallValue}>
                                        $<Counter visible={card1Visible} end={3240} />
                                    </span>
                                    <span className={styles.statSmallLabel}>Claimable Yield</span>
                                </div>
                                <div>
                                    <span className={styles.statSmallValue}>
                                        +<Counter visible={card1Visible} end={11.4} decimals={1} suffix="%" />
                                    </span>
                                    <span className={styles.statSmallLabel}>Blended APY</span>
                                </div>
                            </div>
                            <div className={styles.divider} />
                            <div className={styles.statRow}>
                                <div>
                                    <span className={styles.statSmallValue}><Counter visible={card1Visible} end={7} /></span>
                                    <span className={styles.statSmallLabel}>Active Positions</span>
                                </div>
                                <div>
                                    <span className={styles.statSmallValue}>
                                        $<Counter visible={card1Visible} end={2847} />
                                    </span>
                                    <span className={styles.statSmallLabel}>Returns Earned</span>
                                </div>
                            </div>
                            <div className={styles.divider} />
                            <div className={styles.statRow}>
                                <div>
                                    <span className={styles.statSmallValue}>Senior</span>
                                    <span className={styles.statSmallLabel}>Primary Tranche</span>
                                </div>
                                <div>
                                    <span className={styles.statSmallValue}>
                                        <Counter visible={card1Visible} end={42} suffix=" days" />
                                    </span>
                                    <span className={styles.statSmallLabel}>Avg. Maturity</span>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* ── Feature 2: Investment Management ── */}
            <section className={styles.featureSection}>
                <div className={`${styles.featureInner} ${styles.featureReverse}`}>
                    <motion.div
                        className={styles.featureContent}
                        initial={{ opacity: 0, x: 30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true, margin: '-80px' }}
                        transition={{ duration: 0.6, ease }}
                    >
                        <div className={styles.featureLabel}>Investment Management</div>
                        <h2 className={styles.featureTitle}>Manage & Claim Yield</h2>
                        <p className={styles.featureDesc}>
                            Filter by status, view individual vault details, and claim
                            accumulated yield — all in one click. Every claim is a transparent
                            on-chain transaction signed by your wallet. See exactly which
                            vaults have claimable returns and collect them instantly.
                        </p>
                        <ul className={styles.featureList}>
                            <li><Check size={16} className={styles.checkIcon} /> One-click yield claiming — wallet signs, contract distributes</li>
                            <li><Check size={16} className={styles.checkIcon} /> Filter by Active, Repaying, or Completed states</li>
                            <li><Check size={16} className={styles.checkIcon} /> Direct navigation to any vault's detail page</li>
                            <li><Check size={16} className={styles.checkIcon} /> Claim banner highlights total available yield</li>
                        </ul>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-80px' }}
                        transition={{ duration: 0.6, ease, delay: 0.15 }}
                    >
                        <div className={styles.card}>
                            <div className={styles.shimmer} />
                            <div className={styles.cardHeader}>
                                <span>Your Investments</span>
                            </div>
                            <div className={styles.investmentList}>
                                {[
                                    { name: '0xA1B2...F3D4', amount: '$15,000', apy: '12.5% APY', status: 'Active', active: true, claimable: '$840' },
                                    { name: '0xC5D6...E7F8', amount: '$10,000', apy: '9.8% APY', status: 'Repaying', active: false, claimable: '$1,200' },
                                    { name: '0x9A0B...1C2D', amount: '$17,500', apy: '11.2% APY', status: 'Active', active: true, claimable: '$1,200' },
                                ].map((inv, i) => (
                                    <motion.div
                                        key={inv.name}
                                        className={styles.investmentItem}
                                        initial={{ opacity: 0, x: -15 }}
                                        whileInView={{ opacity: 1, x: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ duration: 0.4, ease, delay: 0.2 + i * 0.1 }}
                                    >
                                        <div className={styles.investmentLeft}>
                                            <div className={styles.investmentName}>{inv.name}</div>
                                            <div className={styles.investmentApy}>{inv.apy} · {inv.status}</div>
                                        </div>
                                        <div className={styles.investmentRight}>
                                            <span className={styles.investmentAmount}>{inv.amount}</span>
                                            <span className={styles.investmentClaimable}>Claim {inv.claimable}</span>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* ── Big Statement 2 ───────────────────── */}
            <section className={styles.statement}>
                <motion.h2
                    className={styles.statementText}
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-100px' }}
                    transition={{ duration: 0.7, ease }}
                >
                    DeFi investing shouldn't mean guessing. Every dollar you invest, every dollar you earn — auditable on BaseScan, claimable in one click.
                </motion.h2>
            </section>

            {/* ── Feature 3: Allocation Insights ──── */}
            <section className={styles.featureSection}>
                <div className={styles.featureInner}>
                    <motion.div
                        className={styles.featureContent}
                        initial={{ opacity: 0, x: -30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true, margin: '-80px' }}
                        transition={{ duration: 0.6, ease }}
                    >
                        <div className={styles.featureLabel}>Analytics</div>
                        <h2 className={styles.featureTitle}>Allocation Insights</h2>
                        <p className={styles.featureDesc}>
                            Understand how your capital is distributed across active,
                            repaying, and completed vaults. Visual breakdowns help
                            you optimize your portfolio strategy and rebalance across
                            risk tiers.
                        </p>
                        <ul className={styles.featureList}>
                            <li><Check size={16} className={styles.checkIcon} /> Status-based allocation view with percentage breakdown</li>
                            <li><Check size={16} className={styles.checkIcon} /> Visual progress bars per category</li>
                            <li><Check size={16} className={styles.checkIcon} /> Dollar amounts and percentages for each tier</li>
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
                            <div className={styles.cardHeader}><span>Allocation by Status</span></div>
                            <div className={styles.allocationBar}>
                                <motion.div className={styles.allocationSegment} style={{ background: '#00FFF0' }}
                                    initial={{ width: 0 }} whileInView={{ width: '55%' }} viewport={{ once: true }} transition={{ duration: 1, ease, delay: 0.3 }} />
                                <motion.div className={styles.allocationSegment} style={{ background: '#FFA500' }}
                                    initial={{ width: 0 }} whileInView={{ width: '30%' }} viewport={{ once: true }} transition={{ duration: 1, ease, delay: 0.45 }} />
                                <motion.div className={styles.allocationSegment} style={{ background: '#666' }}
                                    initial={{ width: 0 }} whileInView={{ width: '15%' }} viewport={{ once: true }} transition={{ duration: 1, ease, delay: 0.6 }} />
                            </div>
                            <div className={styles.allocationLegend}>
                                {[
                                    { name: 'Active', color: '#00FFF0', value: '$23,375', pct: '55%' },
                                    { name: 'Repaying', color: '#FFA500', value: '$12,750', pct: '30%' },
                                    { name: 'Completed', color: '#666', value: '$6,375', pct: '15%' },
                                ].map((item, i) => (
                                    <motion.div key={item.name} className={styles.legendItem}
                                        initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                                        transition={{ duration: 0.4, ease, delay: 0.3 + i * 0.08 }}>
                                        <div className={styles.legendLeft}>
                                            <span className={styles.legendDot} style={{ background: item.color }} />
                                            <span>{item.name}</span>
                                        </div>
                                        <span className={styles.legendValue}>{item.value} ({item.pct})</span>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* ── Capabilities Grid ──────────────── */}
            <section className={styles.stepsSection}>
                <motion.div className={styles.stepsHeader}
                    initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, ease }}>
                    <h2 className={styles.stepsTitle}>Everything you need to manage investments</h2>
                </motion.div>
                <div className={styles.stepsGrid}>
                    {[
                        { icon: <Wallet size={24} />, title: 'Wallet-Connected', desc: 'Connect your wallet and instantly see all positions across every Krexa vault you\'ve invested in.' },
                        { icon: <PieChart size={24} />, title: 'Allocation View', desc: 'Visual breakdown of your capital across active, repaying, and completed vaults with percentage splits.' },
                        { icon: <BarChart3 size={24} />, title: 'Per-Vault Details', desc: 'Tap any investment to see APY, duration, tranche info, claimable amount, and vault state.' },
                        { icon: <Bell size={24} />, title: 'Claim Notifications', desc: 'Claim banner appears when any vault has distributable yield. One click to collect across all positions.' },
                    ].map((step, i) => (
                        <motion.div key={step.title} className={styles.stepCard}
                            initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                            transition={{ duration: 0.5, ease, delay: i * 0.1 }}>
                            <div className={styles.stepIcon}>{step.icon}</div>
                            <h3 className={styles.stepTitle}>{step.title}</h3>
                            <p className={styles.stepDesc}>{step.desc}</p>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* ── Stats Band (dark) ──────────────── */}
            <section className={styles.statsBand}>
                <div className={styles.statsBandInner}>
                    {[
                        { value: 42500, label: 'Total Invested', prefix: '$', suffix: '' },
                        { value: 3240, label: 'Claimable Yield', prefix: '$', suffix: '' },
                        { value: 7, label: 'Active Positions', prefix: '', suffix: '' },
                        { value: 11.4, label: 'Avg Portfolio APY', prefix: '', suffix: '%' },
                    ].map((stat, i) => (
                        <motion.div key={stat.label} className={styles.bandCard}
                            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                            transition={{ duration: 0.5, ease, delay: i * 0.08 }}>
                            <div className={styles.bandValue}>
                                {stat.prefix}<AnimatedNumber value={stat.value} suffix={stat.suffix} decimals={stat.value % 1 !== 0 ? 1 : 0} />
                            </div>
                            <div className={styles.bandLabel}>{stat.label}</div>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* ── CTA Footer ─────────────────────── */}
            <section className={styles.ctaSection}>
                <motion.h2 className={styles.ctaTitle}
                    initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, ease }}>
                    Your investments, fully transparent.
                </motion.h2>
                <motion.p className={styles.ctaSubtitle}
                    initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, ease, delay: 0.1 }}>
                    Connect your wallet, see your positions, and claim yield — all in real time.
                </motion.p>
                <motion.div className={styles.ctaActions}
                    initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, ease, delay: 0.2 }}>
                    <button className={styles.launchBtn} onClick={() => navigate('/app/portfolio')}>Launch App <ArrowRight size={18} /></button>
                    <a href="https://sepolia.basescan.org/address/0xf8fDa17F877dEFFCD80784E0465F33d585644360" target="_blank" rel="noopener noreferrer" className={styles.secondaryBtn}>
                        View on BaseScan <ExternalLink size={14} />
                    </a>
                </motion.div>
            </section>
        </div>
    )
}
