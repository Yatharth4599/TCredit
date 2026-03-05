import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import { AnimatedNumber } from '../components/ui/AnimatedNumber'
import { ArrowRight, Check, ExternalLink, CreditCard, Star, FileCheck, Banknote } from 'lucide-react'
import styles from './MerchantMarketing.module.css'

const ease = [0.16, 1, 0.3, 1] as const

export default function MerchantMarketing() {
    const navigate = useNavigate()
    const [card1Visible, setCard1Visible] = useState(false)
    const [merchantScore, setMerchantScore] = useState(0)
    const card1Ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const node = card1Ref.current
        if (!node) return
        const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setCard1Visible(true); obs.disconnect() } }, { threshold: 0.3 })
        obs.observe(node)
        return () => obs.disconnect()
    }, [])

    useEffect(() => {
        if (!card1Visible) return
        const target = 742
        const start = performance.now()
        let rafId: number
        const tick = (now: number) => {
            const p = Math.min((now - start) / 1200, 1)
            setMerchantScore(Math.round((1 - Math.pow(1 - p, 3)) * target))
            if (p < 1) rafId = requestAnimationFrame(tick)
        }
        rafId = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(rafId)
    }, [card1Visible])

    return (
        <div className={styles.page}>
            {/* ── Hero ──────────────────────────────── */}
            <section className={styles.hero}>
                <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease }}>
                    <div className={styles.heroLabel}>Merchant Infrastructure</div>
                    <h1 className={styles.heroTitle}>Merchant Dashboard</h1>
                </motion.div>
                <motion.p className={styles.heroSubtitle}
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease, delay: 0.15 }}>
                    Access working capital, build on-chain credit, and manage your vaults — all from one place. No collateral. No paperwork. Just revenue.
                </motion.p>
                <motion.div className={styles.heroActions}
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease, delay: 0.3 }}>
                    <button className={styles.launchBtn} onClick={() => navigate('/app/merchant')}>Launch App <ArrowRight size={18} /></button>
                    <a href="#features" className={styles.ghostBtn}>How It Works</a>
                </motion.div>
                <motion.div className={styles.heroStats}
                    initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease, delay: 0.45 }}>
                    {[
                        { value: '0–1000', label: 'FairScale Score' },
                        { value: 'No Collateral', label: 'Required' },
                        { value: 'x402', label: 'Payment Standard' },
                        { value: '< 2s', label: 'Settlement Time' },
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
                    Bill through Krexa. Your payment history becomes your credit score in real-time. Access working capital up to 12 months — rates improve as your FairScale score grows.
                </motion.h2>
            </section>

            {/* ── Feature 1: Credit Score ──────────── */}
            <section className={styles.featureSection} id="features">
                <div className={styles.featureInner}>
                    <motion.div className={styles.featureContent}
                        initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.6, ease }}>
                        <div className={styles.featureLabel}>Reputation System</div>
                        <h2 className={styles.featureTitle}>On-Chain Credit Score</h2>
                        <p className={styles.featureDesc}>
                            Build a verifiable credit history through on-chain payments. Every successful repayment increases your FairScale score — unlocking larger credit lines and better terms. Your score is calculated from revenue consistency, payment volume, frequency, and counterparty diversity. It updates with every transaction, not once a year.
                        </p>
                        <ul className={styles.featureList}>
                            <li><Check size={16} className={styles.checkIcon} /> Scored 0–1000 across four credit tiers: A, B, C, D</li>
                            <li><Check size={16} className={styles.checkIcon} /> Higher score = larger vaults, lower interest rates</li>
                            <li><Check size={16} className={styles.checkIcon} /> Transparent, immutable record on BaseScan</li>
                            <li><Check size={16} className={styles.checkIcon} /> No credit bureau, no bank relationship needed</li>
                        </ul>
                    </motion.div>
                    <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.6, ease, delay: 0.15 }}>
                        <div ref={card1Ref} className={styles.card}>
                            <div className={styles.shimmer} />
                            <div className={styles.cardHeader}>
                                <span>Merchant Profile</span>
                                <span className={styles.liveBadge}><span className={styles.liveDot} /> Live</span>
                            </div>
                            <div className={styles.creditScoreWrap}>
                                <div className={styles.creditCircle}>
                                    <span className={styles.creditValue}>{merchantScore}</span>
                                    <svg className={styles.creditSvg} viewBox="0 0 130 130">
                                        <circle cx="65" cy="65" r="56" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
                                        <motion.circle cx="65" cy="65" r="56" fill="none" stroke="#FF8533" strokeWidth="8" strokeLinecap="round"
                                            strokeDasharray={2 * Math.PI * 56}
                                            initial={{ strokeDashoffset: 2 * Math.PI * 56 }}
                                            whileInView={{ strokeDashoffset: 2 * Math.PI * 56 * (1 - 0.742) }}
                                            viewport={{ once: true }}
                                            transition={{ duration: 1.5, ease, delay: 0.3 }} />
                                    </svg>
                                </div>
                                <div className={styles.creditMeta}>
                                    <span className={styles.creditTier}>Tier A — Excellent</span>
                                    <span className={styles.creditLabel}>FairScale Score out of 1,000</span>
                                </div>
                            </div>
                            <div className={styles.divider} />
                            <div className={styles.creditDetails}>
                                {[
                                    { label: 'Revenue Consistency', value: '98%' },
                                    { label: 'x402 Payments', value: '1,247' },
                                    { label: 'Total Capital Accessed', value: '$185,000' },
                                    { label: 'Current Repayment Rate', value: '100%' },
                                    { label: 'Active Vaults', value: '1 of 2' },
                                ].map((row, i) => (
                                    <motion.div key={row.label} className={styles.creditRow}
                                        initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                                        transition={{ duration: 0.4, ease, delay: 0.5 + i * 0.08 }}>
                                        <span>{row.label}</span><span>{row.value}</span>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* ── Feature 2: Payment Processing ──── */}
            <section className={styles.featureSection}>
                <div className={`${styles.featureInner} ${styles.featureReverse}`}>
                    <motion.div className={styles.featureContent}
                        initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.6, ease }}>
                        <div className={styles.featureLabel}>Oracle-Verified</div>
                        <h2 className={styles.featureTitle}>Automated Payments</h2>
                        <p className={styles.featureDesc}>
                            Process payments through the PaymentRouter — each transaction is signed by the oracle and recorded on-chain. Supports USDC, local bank rails, and card payments via on-ramp partners. Your payment history builds your credit score automatically with every settlement.
                        </p>
                        <ul className={styles.featureList}>
                            <li><Check size={16} className={styles.checkIcon} /> Oracle-signed ECDSA transactions</li>
                            <li><Check size={16} className={styles.checkIcon} /> Instant settlement on Base L2 in under 2 seconds</li>
                            <li><Check size={16} className={styles.checkIcon} /> Full payment audit trail on BaseScan</li>
                            <li><Check size={16} className={styles.checkIcon} /> Auto-repayment splits from incoming revenue</li>
                        </ul>
                    </motion.div>
                    <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.6, ease, delay: 0.15 }}>
                        <div className={styles.card}>
                            <div className={styles.shimmer} />
                            <div className={styles.cardHeader}><span>Payment Flow</span></div>
                            <div className={styles.paymentFlow}>
                                {[
                                    { name: 'Merchant initiates payment', desc: 'USDC amount + invoice reference submitted', color: '#FF8533' },
                                    { name: 'Oracle verifies & signs', desc: 'ECDSA signature generated from payment data', color: '#FF5C00' },
                                    { name: 'PaymentRouter executes', desc: 'On-chain settlement on Base L2 in <2s', color: '#CC4A00' },
                                    { name: 'Revenue split applied', desc: 'Auto-repayment deducted, remainder to merchant', color: '#993700' },
                                    { name: 'Credit score updated', desc: 'FairScale reputation increases immediately', color: '#663300' },
                                ].map((step, i) => (
                                    <motion.div key={step.name} className={styles.paymentStep}
                                        initial={{ opacity: 0, x: -15 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                                        transition={{ duration: 0.4, ease, delay: 0.2 + i * 0.1 }}>
                                        <span className={styles.paymentDot} style={{ background: step.color }} />
                                        <div className={styles.paymentInfo}>
                                            <div className={styles.paymentName}>{step.name}</div>
                                            <div className={styles.paymentDesc}>{step.desc}</div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* ── Statement 2 ────────────────────────── */}
            <section className={styles.statement}>
                <motion.h2 className={styles.statementText}
                    initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-100px' }} transition={{ duration: 0.7, ease }}>
                    No collateral. No banks. No 6-week reviews. Process payments through x402, build a FairScale score, and access structured credit — all enforced by smart contracts.
                </motion.h2>
            </section>

            {/* ── Feature 3: Vault Management ──────── */}
            <section className={styles.featureSection}>
                <div className={styles.featureInner}>
                    <motion.div className={styles.featureContent}
                        initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.6, ease }}>
                        <div className={styles.featureLabel}>Borrower Tools</div>
                        <h2 className={styles.featureTitle}>Manage Your Vaults</h2>
                        <p className={styles.featureDesc}>
                            Create credit vaults, set terms (amount, APY, duration, tranches), track fundraising progress, submit milestone proofs, and make repayments — all from your merchant dashboard. Loan terms from 3–12 months with 2–8 configurable tranches. Typical cost: ~2% monthly.
                        </p>
                        <ul className={styles.featureList}>
                            <li><Check size={16} className={styles.checkIcon} /> Create and configure vaults with custom terms</li>
                            <li><Check size={16} className={styles.checkIcon} /> Track funding progress in real time</li>
                            <li><Check size={16} className={styles.checkIcon} /> Submit milestone proofs for tranche release</li>
                            <li><Check size={16} className={styles.checkIcon} /> View complete repayment history and waterfall status</li>
                        </ul>
                    </motion.div>
                    <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.6, ease, delay: 0.15 }}>
                        <div className={styles.card}>
                            <div className={styles.shimmer} />
                            <div className={styles.cardHeader}><span>Recent Activity</span></div>
                            <div className={styles.timelineList}>
                                {[
                                    { name: 'Vault Created', desc: '$50,000 target, 12.5% APY, 6mo', amount: '$50,000', color: '#FF8533' },
                                    { name: 'Fundraising Complete', desc: '47 investors participated', amount: '100%', color: '#2CFF05' },
                                    { name: 'Tranche 1 Released', desc: 'Milestone verified by oracle', amount: '$16,666', color: '#FF5C00' },
                                    { name: 'Payment Processed', desc: 'x402 settlement via PaymentRouter', amount: '$2,400', color: '#00FFF0' },
                                    { name: 'Tranche 2 Released', desc: 'Revenue milestone approved', amount: '$16,666', color: '#FF5C00' },
                                    { name: 'Repayment Auto-Split', desc: 'Waterfall: Senior → Pool → Community', amount: '$4,800', color: '#2CFF05' },
                                ].map((item, i) => (
                                    <motion.div key={`${item.name}-${i}`} className={styles.timelineItem}
                                        initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                                        transition={{ duration: 0.4, ease, delay: 0.15 + i * 0.06 }}>
                                        <div className={styles.timelineIcon} style={{ background: item.color }}><Check size={14} /></div>
                                        <div className={styles.timelineInfo}>
                                            <div className={styles.timelineName}>{item.name}</div>
                                            <div className={styles.timelineDesc}>{item.desc}</div>
                                        </div>
                                        <span className={styles.timelineAmount}>{item.amount}</span>
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
                    <h2 className={styles.stepsTitle}>Everything a merchant needs</h2>
                </motion.div>
                <div className={styles.stepsGrid}>
                    {[
                        { icon: <CreditCard size={24} />, title: 'x402 Payments', desc: 'Bill customers through Krexa payment endpoints. Supports USDC, bank rails, and card payments via on-ramp partners.' },
                        { icon: <Star size={24} />, title: 'FairScale Scoring', desc: 'Build a live credit profile from payment data. Revenue consistency, volume, frequency, and counterparty diversity.' },
                        { icon: <Banknote size={24} />, title: 'Working Capital', desc: 'Access 3–12 month credit facilities. No collateral — your revenue history is the collateral. Typical cost: ~2%/month.' },
                        { icon: <FileCheck size={24} />, title: 'Milestone Proofs', desc: 'Submit verifiable milestones to unlock tranches. Oracle verifies, smart contract releases. Fully automated.' },
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
                        { value: 38, label: 'Registered Merchants', prefix: '', suffix: '' },
                        { value: 742, label: 'Avg Credit Score', prefix: '', suffix: '' },
                        { value: 1247, label: 'Payments Processed', prefix: '', suffix: '' },
                        { value: 98.5, label: 'On-Time Rate', prefix: '', suffix: '%' },
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
                    Build your on-chain reputation.
                </motion.h2>
                <motion.p className={styles.ctaSubtitle}
                    initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, ease, delay: 0.1 }}>
                    Register, process payments, build your FairScale score, and unlock credit — all in one dashboard.
                </motion.p>
                <motion.div className={styles.ctaActions}
                    initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, ease, delay: 0.2 }}>
                    <button className={styles.launchBtn} onClick={() => navigate('/app/merchant')}>Launch App <ArrowRight size={18} /></button>
                    <a href="https://sepolia.basescan.org/address/0xAEa7C5CCACebB1423b163b765d3214752f1496A4" target="_blank" rel="noopener noreferrer" className={styles.secondaryBtn}>
                        View on BaseScan <ExternalLink size={14} />
                    </a>
                </motion.div>
            </section>
        </div>
    )
}
