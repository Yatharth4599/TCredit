import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import { AnimatedNumber } from '../components/ui/AnimatedNumber'
import { ArrowRight, Check, ExternalLink, Droplets, Shield, Zap, BarChart3 } from 'lucide-react'
import styles from './PoolsMarketing.module.css'

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

export default function PoolsMarketing() {
    const navigate = useNavigate()
    const [card1Visible, setCard1Visible] = useState(false)
    const card1Ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const node = card1Ref.current
        if (!node) return
        const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setCard1Visible(true); obs.disconnect() } }, { threshold: 0.3 })
        obs.observe(node)
        return () => obs.disconnect()
    }, [])

    return (
        <div className={styles.page}>
            {/* ── Hero ──────────────────────────────── */}
            <section className={styles.hero}>
                <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease }}>
                    <div className={styles.heroLabel}>Liquidity Infrastructure</div>
                    <h1 className={styles.heroTitle}>Liquidity Pools</h1>
                </motion.div>
                <motion.p className={styles.heroSubtitle}
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease, delay: 0.15 }}>
                    Capital pools that fill vault shortfalls — powering programmable credit at scale. Deposit USDC, earn passive yield from real business lending.
                </motion.p>
                <motion.div className={styles.heroActions}
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease, delay: 0.3 }}>
                    <button className={styles.launchBtn} onClick={() => navigate('/app/pools')}>Launch App <ArrowRight size={18} /></button>
                    <a href="#features" className={styles.ghostBtn}>Learn More</a>
                </motion.div>
                <motion.div className={styles.heroStats}
                    initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease, delay: 0.45 }}>
                    {[
                        { value: '$15M+', label: 'Pool Liquidity' },
                        { value: '67%', label: 'Utilization Rate' },
                        { value: '2 Tiers', label: 'Senior + General' },
                        { value: 'USDC', label: 'Settlement' },
                    ].map(s => (
                        <div key={s.label} className={styles.heroStat}>
                            <span className={styles.heroStatValue}>{s.value}</span>
                            <span className={styles.heroStatLabel}>{s.label}</span>
                        </div>
                    ))}
                </motion.div>
            </section>

            {/* ── Statement ──────────────────────────── */}
            <section className={styles.statement}>
                <motion.h2 className={styles.statementText}
                    initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-100px' }} transition={{ duration: 0.7, ease }}>
                    Liquidity pools are the backbone of Krexa's credit engine. LPs deposit USDC, capital flows to vetted vaults, and repayment cascades back through the waterfall.
                </motion.h2>
            </section>

            {/* ── Feature 1: Passive Yield ──────────── */}
            <section className={styles.featureSection} id="features">
                <div className={styles.featureInner}>
                    <motion.div className={styles.featureContent}
                        initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.6, ease }}>
                        <div className={styles.featureLabel}>For LPs</div>
                        <h2 className={styles.featureTitle}>Earn Passive Yield</h2>
                        <p className={styles.featureDesc}>
                            Deposit USDC into liquidity pools and earn yield as your capital is allocated to vetted credit vaults. The Senior Pool gets priority repayment with lower risk; the General Pool earns higher rates with more exposure. Choose your tier, deposit, and let the protocol work.
                        </p>
                        <ul className={styles.featureList}>
                            <li><Check size={16} className={styles.checkIcon} /> Deposit and withdraw USDC at any time</li>
                            <li><Check size={16} className={styles.checkIcon} /> Automated capital deployment to vetted vaults</li>
                            <li><Check size={16} className={styles.checkIcon} /> Senior Pool: priority repayment, lower risk</li>
                            <li><Check size={16} className={styles.checkIcon} /> General Pool: higher yield, more exposure</li>
                        </ul>
                    </motion.div>
                    <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.6, ease, delay: 0.15 }}>
                        <div ref={card1Ref} className={styles.card}>
                            <div className={styles.shimmer} />
                            <div className={styles.cardHeader}>
                                <span>Pool Metrics</span>
                                <span className={styles.liveBadge}><span className={styles.liveDot} /> Live</span>
                            </div>
                            <div className={styles.bigStat}>
                                <span className={styles.statBig}>$<Counter visible={card1Visible} end={15} decimals={1} suffix="M" /></span>
                                <span className={styles.statLabel}>Total Pool Liquidity</span>
                            </div>
                            <div className={styles.statRow}>
                                <div>
                                    <span className={styles.statSmallValue}>$<Counter visible={card1Visible} end={10} decimals={1} suffix="M" /></span>
                                    <span className={styles.statSmallLabel}>Deployed to Vaults</span>
                                </div>
                                <div>
                                    <span className={styles.statSmallValue}>$<Counter visible={card1Visible} end={5} decimals={1} suffix="M" /></span>
                                    <span className={styles.statSmallLabel}>Available</span>
                                </div>
                            </div>
                            <div className={styles.divider} />
                            <div className={styles.statRow}>
                                <div>
                                    <span className={styles.statSmallValue}><Counter visible={card1Visible} end={67.4} decimals={1} suffix="%" /></span>
                                    <span className={styles.statSmallLabel}>Utilization</span>
                                </div>
                                <div>
                                    <span className={styles.statSmallValue}><Counter visible={card1Visible} end={156} /></span>
                                    <span className={styles.statSmallLabel}>LP Positions</span>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* ── Feature 2: Utilization ────────────── */}
            <section className={styles.featureSection}>
                <div className={`${styles.featureInner} ${styles.featureReverse}`}>
                    <motion.div className={styles.featureContent}
                        initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.6, ease }}>
                        <div className={styles.featureLabel}>Capital Efficiency</div>
                        <h2 className={styles.featureTitle}>Dynamic Utilization</h2>
                        <p className={styles.featureDesc}>
                            Pool capital is dynamically allocated to vaults that need funding. Track utilization in real time — when demand rises, so does your effective yield. The protocol balances deployment across active vaults to maximize capital efficiency while maintaining withdrawal liquidity.
                        </p>
                        <ul className={styles.featureList}>
                            <li><Check size={16} className={styles.checkIcon} /> Real-time utilization tracking on every pool</li>
                            <li><Check size={16} className={styles.checkIcon} /> Dynamic allocation engine manages vault deployment</li>
                            <li><Check size={16} className={styles.checkIcon} /> Yield scales with demand — higher util = higher returns</li>
                            <li><Check size={16} className={styles.checkIcon} /> Withdrawal buffer maintained for LP flexibility</li>
                        </ul>
                    </motion.div>
                    <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.6, ease, delay: 0.15 }}>
                        <div className={styles.card}>
                            <div className={styles.shimmer} />
                            <div className={styles.cardHeader}><span>Pool Utilization</span></div>
                            <div className={styles.gaugeWrap}>
                                <div className={styles.gaugeCircle}>
                                    <span className={styles.gaugeValue}><AnimatedNumber value={67.4} decimals={1} />%</span>
                                    <svg className={styles.gaugeSvg} viewBox="0 0 120 120">
                                        <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
                                        <motion.circle cx="60" cy="60" r="52" fill="none" stroke="#FF6B8A" strokeWidth="8" strokeLinecap="round"
                                            strokeDasharray={2 * Math.PI * 52}
                                            initial={{ strokeDashoffset: 2 * Math.PI * 52 }}
                                            whileInView={{ strokeDashoffset: 2 * Math.PI * 52 * (1 - 0.674) }}
                                            viewport={{ once: true }}
                                            transition={{ duration: 1.5, ease, delay: 0.3 }} />
                                    </svg>
                                </div>
                                <span className={styles.gaugeLabel}>Capital Utilization Rate</span>
                            </div>
                            <div className={styles.divider} />
                            <div className={styles.statRow}>
                                <div>
                                    <span className={styles.statSmallValue}>Senior</span>
                                    <span className={styles.statSmallLabel}>72.1% utilized</span>
                                </div>
                                <div>
                                    <span className={styles.statSmallValue}>General</span>
                                    <span className={styles.statSmallLabel}>58.3% utilized</span>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* ── Statement 2 ────────────────────────── */}
            <section className={styles.statement}>
                <motion.h2 className={styles.statementText}
                    initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-100px' }} transition={{ duration: 0.7, ease }}>
                    Two pool tiers. One waterfall. Senior gets paid first — always. General earns more — when everything works.
                </motion.h2>
            </section>

            {/* ── Feature 3: Capital Flow ────────────── */}
            <section className={styles.featureSection}>
                <div className={styles.featureInner}>
                    <motion.div className={styles.featureContent}
                        initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.6, ease }}>
                        <div className={styles.featureLabel}>Architecture</div>
                        <h2 className={styles.featureTitle}>How Capital Flows</h2>
                        <p className={styles.featureDesc}>
                            LPs deposit into pools. Pools allocate to vaults. Vaults disburse to merchants through milestone-gated tranches. Merchants repay through x402 payment splits. Your capital is always working — and always protected by the repayment priority waterfall.
                        </p>
                        <ul className={styles.featureList}>
                            <li><Check size={16} className={styles.checkIcon} /> LP → Pool → Vault → Merchant → Repayment</li>
                            <li><Check size={16} className={styles.checkIcon} /> Waterfall-protected returns at every stage</li>
                            <li><Check size={16} className={styles.checkIcon} /> Fully on-chain lifecycle from deposit to withdrawal</li>
                        </ul>
                    </motion.div>
                    <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.6, ease, delay: 0.15 }}>
                        <div className={styles.card}>
                            <div className={styles.shimmer} />
                            <div className={styles.cardHeader}><span>Capital Flow</span></div>
                            <div className={styles.flowSteps}>
                                {[
                                    { label: '01', name: 'LP deposits USDC into pool', desc: 'Capital enters Senior or General pool', color: '#FF6B8A' },
                                    { label: '02', name: 'Pool allocates to active vault', desc: 'Capital deployed to vetted credit facility', color: '#FF2A55' },
                                    { label: '03', name: 'Vault disburses to merchant', desc: 'Milestone-gated tranche release', color: '#CC2244' },
                                    { label: '04', name: 'x402 payments auto-repay', desc: 'Revenue splits route repayment on-chain', color: '#992233' },
                                    { label: '05', name: 'Waterfall distributes yield', desc: 'Senior → Pool → Community → Merchant', color: '#661122' },
                                ].map((step, i) => (
                                    <motion.div key={step.label} className={styles.flowStep}
                                        initial={{ opacity: 0, x: -15 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                                        transition={{ duration: 0.4, ease, delay: 0.2 + i * 0.1 }}>
                                        <div className={styles.flowIcon} style={{ background: step.color }}>{step.label}</div>
                                        <div className={styles.flowInfo}>
                                            <div className={styles.flowName}>{step.name}</div>
                                            <div className={styles.flowDesc}>{step.desc}</div>
                                        </div>
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
                    <h2 className={styles.stepsTitle}>Built for institutional-grade liquidity</h2>
                </motion.div>
                <div className={styles.stepsGrid}>
                    {[
                        { icon: <Droplets size={24} />, title: 'Two Pool Tiers', desc: 'Senior Pool gets priority repayment with lower risk. General Pool earns higher yield. Pick your exposure level.' },
                        { icon: <Shield size={24} />, title: 'Waterfall Protection', desc: 'Repayment cascades top-down. Senior is always paid first. Pool capital is protected before community investors.' },
                        { icon: <Zap size={24} />, title: 'Instant Settlement', desc: 'All pool operations settle on Base L2. Deposits, withdrawals, and yield distributions are near-instant.' },
                        { icon: <BarChart3 size={24} />, title: 'Transparent Metrics', desc: 'Utilization, deployed capital, available balance, and LP count — all visible on-chain and in the dashboard.' },
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
                        { value: 15, label: 'Pool Liquidity', prefix: '$', suffix: 'M' },
                        { value: 67.4, label: 'Utilization Rate', prefix: '', suffix: '%' },
                        { value: 2, label: 'Active Pools', prefix: '', suffix: '' },
                        { value: 156, label: 'LP Positions', prefix: '', suffix: '' },
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
                    Put your capital to work.
                </motion.h2>
                <motion.p className={styles.ctaSubtitle}
                    initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, ease, delay: 0.1 }}>
                    Deposit into a pool and start earning passive yield from real credit facilities.
                </motion.p>
                <motion.div className={styles.ctaActions}
                    initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, ease, delay: 0.2 }}>
                    <button className={styles.launchBtn} onClick={() => navigate('/app/pools')}>Launch App <ArrowRight size={18} /></button>
                    <a href="https://sepolia.basescan.org/address/0xDf980d0734b00888e4Ac350027515B4D6E473bBa" target="_blank" rel="noopener noreferrer" className={styles.secondaryBtn}>
                        View on BaseScan <ExternalLink size={14} />
                    </a>
                </motion.div>
            </section>
        </div>
    )
}
