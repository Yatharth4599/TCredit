import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import styles from './Home.module.css'

export default function Home() {
    const navigate = useNavigate()
    const [mounted, setMounted] = useState(false)
    const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set())

    useEffect(() => {
        setMounted(true)

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        setVisibleSections((prev) => new Set([...prev, entry.target.id]))
                    }
                })
            },
            { threshold: 0.1 }
        )

        document.querySelectorAll('section[id]').forEach((section) => {
            observer.observe(section)
        })

        return () => observer.disconnect()
    }, [])

    const isVisible = (id: string) => visibleSections.has(id)

    return (
        <div className={styles.home}>
            <div className={styles.ambientGlow} />
            <div className={styles.ambientGlow2} />

            {/* ── Hero ── */}
            <section className={styles.hero} id="hero">
                <div className={styles.heroContent}>
                    <span className={`${styles.overline} ${mounted ? styles.visible : ''}`}>
                        The Programmable Credit Network
                    </span>

                    <h1 className={styles.headline}>
                        <span className={`${styles.line} ${mounted ? styles.visible : ''}`}>
                            <span className={styles.word}>Revenue-Backed</span>
                        </span>
                        <span className={`${styles.line} ${styles.line2} ${mounted ? styles.visible : ''}`}>
                            <span className={styles.gradientText}>Programmable Credit</span>
                        </span>
                    </h1>

                    <p className={`${styles.subtitle} ${mounted ? styles.visible : ''}`}>
                        Lend against enforceable payment flow — not collateral, not reputation.
                        <br />
                        <span className={styles.subtitleHighlight}>When revenue is programmable, repayment becomes automatic.</span>
                    </p>

                    <div className={`${styles.cta} ${mounted ? styles.visible : ''}`}>
                        <button className={styles.primaryBtn} onClick={() => navigate('/vaults')}>
                            <span>Launch App</span>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>
                        <button className={styles.secondaryBtn}>
                            <span>Read Litepaper</span>
                        </button>
                    </div>

                    <div className={`${styles.stats} ${mounted ? styles.visible : ''}`}>
                        <div className={styles.stat}>
                            <span className={styles.statValue}>$4M+</span>
                            <span className={styles.statLabel}>Pool Liquidity</span>
                        </div>
                        <div className={styles.statDivider} />
                        <div className={styles.stat}>
                            <span className={styles.statValue}>~2%</span>
                            <span className={styles.statLabel}>Monthly Cost</span>
                        </div>
                        <div className={styles.statDivider} />
                        <div className={styles.stat}>
                            <span className={styles.statValue}>400ms</span>
                            <span className={styles.statLabel}>Finality</span>
                        </div>
                        <div className={styles.statDivider} />
                        <div className={styles.stat}>
                            <span className={styles.statValue}>100%</span>
                            <span className={styles.statLabel}>On-Chain</span>
                        </div>
                    </div>
                </div>

                <div className={`${styles.scrollIndicator} ${mounted ? styles.visible : ''}`}>
                    <div className={styles.scrollLine} />
                </div>
            </section>

            {/* ── The Problem ── */}
            <section className={styles.problemSection} id="problem">
                <div className={styles.sectionContainer}>
                    <div className={`${styles.sectionHeader} ${isVisible('problem') ? styles.visible : ''}`}>
                        <span className={styles.sectionLabel}>The Problem</span>
                        <h2 className={styles.sectionTitle}>Capital cannot <span className={styles.gradientInline}>follow commerce</span></h2>
                        <p className={styles.sectionDesc}>
                            Productive companies remain underfunded despite predictable cash flows.
                            The missing layer is not liquidity — it is enforceability.
                        </p>
                    </div>

                    <div className={styles.problemGrid}>
                        <div className={`${styles.problemCard} ${isVisible('problem') ? styles.visible : ''}`} style={{ transitionDelay: '0.1s' }}>
                            <h3 className={styles.problemCardTitle}>Traditional Finance</h3>
                            <ul className={styles.problemList}>
                                <li><span className={styles.xIcon}>✕</span> Requires local presence</li>
                                <li><span className={styles.xIcon}>✕</span> Relies on collateral</li>
                                <li><span className={styles.xIcon}>✕</span> Enforces repayment manually</li>
                                <li><span className={styles.xIcon}>✕</span> Weeks to months for approval</li>
                            </ul>
                        </div>
                        <div className={`${styles.problemCard} ${isVisible('problem') ? styles.visible : ''}`} style={{ transitionDelay: '0.2s' }}>
                            <h3 className={styles.problemCardTitle}>DeFi Today</h3>
                            <ul className={styles.problemList}>
                                <li><span className={styles.xIcon}>✕</span> Requires overcollateralization</li>
                                <li><span className={styles.xIcon}>✕</span> Ignores real-world productivity</li>
                                <li><span className={styles.xIcon}>✕</span> Cannot evaluate businesses</li>
                                <li><span className={styles.xIcon}>✕</span> No revenue-based underwriting</li>
                            </ul>
                        </div>
                        <div className={`${styles.problemCard} ${styles.solutionCard} ${isVisible('problem') ? styles.visible : ''}`} style={{ transitionDelay: '0.3s' }}>
                            <h3 className={styles.problemCardTitle}>TigerPay<span className={styles.orangeX}>X</span></h3>
                            <ul className={styles.problemList}>
                                <li><span className={styles.checkIcon}>✓</span> Lends against payment flow</li>
                                <li><span className={styles.checkIcon}>✓</span> Automated x402 repayment</li>
                                <li><span className={styles.checkIcon}>✓</span> Live credit scoring</li>
                                <li><span className={styles.checkIcon}>✓</span> Global, instant, on-chain</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── The Insight — x402 ── */}
            <section className={styles.insightSection} id="insight">
                <div className={styles.sectionContainer}>
                    <div className={`${styles.sectionHeader} ${isVisible('insight') ? styles.visible : ''}`}>
                        <span className={styles.sectionLabel}>The x402 Protocol</span>
                        <h2 className={styles.sectionTitle}>Revenue becomes lendable when it becomes <span className={styles.gradientInline}>enforceable</span></h2>
                        <p className={styles.sectionDesc}>
                            TigerPayX uses programmable billing and controlled settlement accounts to ensure
                            business income passes through the protocol before reaching the borrower.
                        </p>
                    </div>

                    <div className={`${styles.flowDiagram} ${isVisible('insight') ? styles.visible : ''}`}>
                        <div className={styles.flowStep}>
                            <div className={styles.flowIcon}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                </svg>
                            </div>
                            <span className={styles.flowLabel}>Customer Payment</span>
                        </div>
                        <div className={styles.flowArrow}>→</div>
                        <div className={styles.flowStep}>
                            <div className={`${styles.flowIcon} ${styles.flowIconHighlight}`}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                </svg>
                            </div>
                            <span className={styles.flowLabel}>x402 Settlement</span>
                            <span className={styles.flowSub}>Controlled account</span>
                        </div>
                        <div className={styles.flowArrow}>→</div>
                        <div className={styles.flowStep}>
                            <div className={styles.flowIcon}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
                                </svg>
                            </div>
                            <span className={styles.flowLabel}>Waterfall Split</span>
                            <span className={styles.flowSub}>On-chain enforcement</span>
                        </div>
                        <div className={styles.flowArrow}>→</div>
                        <div className={styles.flowStep}>
                            <div className={styles.flowIcon}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <rect x="2" y="4" width="20" height="16" rx="2" /><path d="M12 12h.01M8 12h.01M16 12h.01" />
                                </svg>
                            </div>
                            <span className={styles.flowLabel}>Merchant Net</span>
                            <span className={styles.flowSub}>After repayment</span>
                        </div>
                    </div>

                    <div className={`${styles.insightQuote} ${isVisible('insight') ? styles.visible : ''}`}>
                        <p>Credit risk becomes <span className={styles.gradientInline}>activity risk</span>. Instead of trusting borrowers to repay, the protocol routes repayment directly from incoming payments.</p>
                    </div>
                </div>
            </section>

            {/* ── How It Works — 5 Steps ── */}
            <section className={styles.howItWorks} id="how-it-works">
                <div className={styles.sectionContainer}>
                    <div className={`${styles.sectionHeader} ${isVisible('how-it-works') ? styles.visible : ''}`}>
                        <span className={styles.sectionLabel}>How It Works</span>
                        <h2 className={styles.sectionTitle}>Five steps to <span className={styles.gradientInline}>programmable credit</span></h2>
                    </div>

                    <div className={styles.stepsGrid}>
                        <div className={`${styles.step} ${isVisible('how-it-works') ? styles.visible : ''}`} style={{ transitionDelay: '0.1s' }}>
                            <div className={styles.stepIcon}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                                </svg>
                            </div>
                            <span className={styles.stepNumber}>01</span>
                            <h3>Payment Routing</h3>
                            <p>Businesses bill customers using TigerPayX x402 payment endpoints. Customers pay via local rails or stablecoins.</p>
                        </div>

                        <div className={`${styles.step} ${isVisible('how-it-works') ? styles.visible : ''}`} style={{ transitionDelay: '0.2s' }}>
                            <div className={styles.stepIcon}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                                </svg>
                            </div>
                            <span className={styles.stepNumber}>02</span>
                            <h3>Financial Identity</h3>
                            <p>Transaction behaviour builds a live credit profile — revenue consistency, volume, frequency, counterparty diversity.</p>
                        </div>

                        <div className={`${styles.step} ${isVisible('how-it-works') ? styles.visible : ''}`} style={{ transitionDelay: '0.3s' }}>
                            <div className={styles.stepIcon}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                                </svg>
                            </div>
                            <span className={styles.stepNumber}>03</span>
                            <h3>Capital Advance</h3>
                            <p>Businesses request working capital, invoice financing, or trade finance against receivables. ~2% monthly cost.</p>
                        </div>

                        <div className={`${styles.step} ${isVisible('how-it-works') ? styles.visible : ''}`} style={{ transitionDelay: '0.4s' }}>
                            <div className={styles.stepIcon}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <rect x="2" y="4" width="20" height="16" rx="2" /><path d="M12 12h.01M8 12h.01M16 12h.01" />
                                </svg>
                            </div>
                            <span className={styles.stepNumber}>04</span>
                            <h3>Liquidity Funding</h3>
                            <p>On-chain vaults fund loans via structured tranches — senior lenders, liquidity pools, and community investors.</p>
                        </div>

                        <div className={`${styles.step} ${isVisible('how-it-works') ? styles.visible : ''}`} style={{ transitionDelay: '0.5s' }}>
                            <div className={styles.stepIcon}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                </svg>
                            </div>
                            <span className={styles.stepNumber}>05</span>
                            <h3>Automated Repayment</h3>
                            <p>Incoming payments auto-split: lender repayment first, remaining merchant balance second. No manual installments.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Capital Structure / Waterfall ── */}
            <section className={styles.capitalSection} id="capital">
                <div className={styles.sectionContainer}>
                    <div className={`${styles.sectionHeader} ${isVisible('capital') ? styles.visible : ''}`}>
                        <span className={styles.sectionLabel}>Capital Structure</span>
                        <h2 className={styles.sectionTitle}>Structured liquidity with <span className={styles.gradientInline}>waterfall repayment</span></h2>
                        <p className={styles.sectionDesc}>
                            Each loan is funded through layered capital. Repayment flows top-down — senior first, merchant last.
                        </p>
                    </div>

                    <div className={`${styles.waterfallVisual} ${isVisible('capital') ? styles.visible : ''}`}>
                        <div className={styles.tranche}>
                            <div className={styles.trancheBar} style={{ width: '100%', background: 'rgba(255, 107, 53, 0.25)' }}>
                                <div className={styles.trancheInner} style={{ width: '80%', background: 'linear-gradient(90deg, #ff6b35, #ff8f6b)' }} />
                            </div>
                            <div className={styles.trancheInfo}>
                                <span className={styles.trancheName}>Senior Capital</span>
                                <span className={styles.trancheDesc}>Lending partners · Paid first · Lowest risk</span>
                            </div>
                        </div>
                        <div className={styles.tranche}>
                            <div className={styles.trancheBar} style={{ width: '100%', background: 'rgba(59, 130, 246, 0.2)' }}>
                                <div className={styles.trancheInner} style={{ width: '64%', background: 'linear-gradient(90deg, #3b82f6, #60a5fa)' }} />
                            </div>
                            <div className={styles.trancheInfo}>
                                <span className={styles.trancheName}>Liquidity Pools</span>
                                <span className={styles.trancheDesc}>TigerPay Alpha + co-owned partner pools</span>
                            </div>
                        </div>
                        <div className={styles.tranche}>
                            <div className={styles.trancheBar} style={{ width: '100%', background: 'rgba(52, 211, 153, 0.2)' }}>
                                <div className={styles.trancheInner} style={{ width: '45%', background: 'linear-gradient(90deg, #34d399, #6ee7b7)' }} />
                            </div>
                            <div className={styles.trancheInfo}>
                                <span className={styles.trancheName}>Community Investors</span>
                                <span className={styles.trancheDesc}>Vault investors · Higher yield · Higher risk</span>
                            </div>
                        </div>
                        <div className={styles.tranche}>
                            <div className={styles.trancheBar} style={{ width: '100%', background: 'rgba(255, 255, 255, 0.06)' }}>
                                <div className={styles.trancheInner} style={{ width: '30%', background: 'linear-gradient(90deg, rgba(255,255,255,0.3), rgba(255,255,255,0.5))' }} />
                            </div>
                            <div className={styles.trancheInfo}>
                                <span className={styles.trancheName}>Risk Buffer</span>
                                <span className={styles.trancheDesc}>Community staking · First-loss layer</span>
                            </div>
                        </div>
                    </div>

                    <div className={`${styles.capitalExample} ${isVisible('capital') ? styles.visible : ''}`}>
                        <h4 className={styles.exampleTitle}>Example: AED 500K Gym Loan</h4>
                        <div className={styles.exampleGrid}>
                            <div className={styles.exampleItem}>
                                <span className={styles.exampleValue}>400K</span>
                                <span className={styles.exampleLabel}>Senior (Jupiter)</span>
                            </div>
                            <div className={styles.exampleItem}>
                                <span className={styles.exampleValue}>80K</span>
                                <span className={styles.exampleLabel}>Liquidity Pools</span>
                            </div>
                            <div className={styles.exampleItem}>
                                <span className={styles.exampleValue}>20K</span>
                                <span className={styles.exampleLabel}>Community</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── For Investors ── */}
            <section className={styles.forUsers} id="for-users">
                <div className={styles.sectionContainer}>
                    <div className={styles.splitSection}>
                        <div className={`${styles.splitContent} ${isVisible('for-users') ? styles.visible : ''}`}>
                            <span className={styles.sectionLabel}>For Investors</span>
                            <h2 className={styles.splitTitle}>Earn yield from <span className={styles.gradientInline}>real revenue</span></h2>
                            <p className={styles.splitDesc}>
                                Fund merchant vaults and earn returns from actual business cash flow. Repayment is enforced by the protocol, not by borrower goodwill.
                            </p>
                            <ul className={styles.featureList}>
                                <li><span className={styles.checkIcon}>✓</span> Structured tranches — choose your risk/return</li>
                                <li><span className={styles.checkIcon}>✓</span> Waterfall protection — senior paid first</li>
                                <li><span className={styles.checkIcon}>✓</span> Continuous yield from x402 payment stream</li>
                                <li><span className={styles.checkIcon}>✓</span> Transparent on-chain tracking</li>
                            </ul>
                            <button className={styles.outlineBtn} onClick={() => navigate('/vaults')}>
                                Browse Vaults
                            </button>
                        </div>

                        <div className={`${styles.splitVisual} ${isVisible('for-users') ? styles.visible : ''}`}>
                            <div className={styles.visualCard}>
                                <div className={styles.visualCardHeader}>
                                    <span>Portfolio Overview</span>
                                    <span className={styles.visualBadge}>Live</span>
                                </div>
                                <div className={styles.visualStat}>
                                    <span className={styles.visualStatValue}>$24,500</span>
                                    <span className={styles.visualStatLabel}>Total Invested</span>
                                </div>
                                <div className={styles.visualRow}>
                                    <div>
                                        <span className={styles.visualSmallValue}>$2,847</span>
                                        <span className={styles.visualSmallLabel}>Returns</span>
                                    </div>
                                    <div>
                                        <span className={styles.visualSmallValue}>+11.6%</span>
                                        <span className={styles.visualSmallLabel}>APY</span>
                                    </div>
                                </div>
                                <div className={styles.visualBar}>
                                    <div className={styles.visualBarFill} style={{ width: '73%' }} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── For Merchants ── */}
            <section className={styles.forMerchants} id="for-merchants">
                <div className={styles.sectionContainer}>
                    <div className={`${styles.splitSection} ${styles.splitReverse}`}>
                        <div className={`${styles.splitContent} ${isVisible('for-merchants') ? styles.visible : ''}`}>
                            <span className={styles.sectionLabel}>For Merchants</span>
                            <h2 className={styles.splitTitle}>Stream capital as you <span className={styles.gradientInline}>perform</span></h2>
                            <p className={styles.splitDesc}>
                                Bill through TigerPayX endpoints. Your payment history becomes your credit score. Access working capital, invoice financing, or trade finance — up to 12 months.
                            </p>
                            <ul className={styles.featureList}>
                                <li><span className={styles.checkIcon}>✓</span> x402 payment endpoints — plug into your billing</li>
                                <li><span className={styles.checkIcon}>✓</span> No collateral — credit scored by revenue flow</li>
                                <li><span className={styles.checkIcon}>✓</span> Auto-repayment from incoming payments</li>
                                <li><span className={styles.checkIcon}>✓</span> Better rates as your credit score improves</li>
                            </ul>
                            <button className={styles.outlineBtn} onClick={() => navigate('/merchant')}>
                                Apply for Funding
                            </button>
                        </div>

                        <div className={`${styles.splitVisual} ${isVisible('for-merchants') ? styles.visible : ''}`}>
                            <div className={styles.visualCard}>
                                <div className={styles.visualCardHeader}>
                                    <span>Credit Score</span>
                                    <span className={styles.visualBadgeGreen}>Excellent</span>
                                </div>
                                <div className={styles.creditScore}>
                                    <span className={styles.creditValue}>785</span>
                                    <svg className={styles.creditRing} viewBox="0 0 100 100">
                                        <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
                                        <circle cx="50" cy="50" r="45" fill="none" stroke="#34d399" strokeWidth="8" strokeDasharray="220" strokeDashoffset="50" strokeLinecap="round" transform="rotate(-90 50 50)" />
                                    </svg>
                                </div>
                                <div className={styles.creditDetails}>
                                    <div><span>Revenue Consistency</span><span>98%</span></div>
                                    <div><span>x402 Payments</span><span>1,247</span></div>
                                    <div><span>Total Borrowed</span><span>$185,000</span></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── The Economic Flywheel ── */}
            <section className={styles.flywheelSection} id="flywheel">
                <div className={styles.sectionContainer}>
                    <div className={`${styles.sectionHeader} ${isVisible('flywheel') ? styles.visible : ''}`}>
                        <span className={styles.sectionLabel}>The Flywheel</span>
                        <h2 className={styles.sectionTitle}>Liquidity flows toward <span className={styles.gradientInline}>productivity</span></h2>
                    </div>

                    <div className={`${styles.flywheelRing} ${isVisible('flywheel') ? styles.visible : ''}`}>
                        <div className={styles.flywheelStep}>
                            <span className={styles.flywheelNum}>1</span>
                            <span className={styles.flywheelLabel}>Payments generate data</span>
                        </div>
                        <div className={styles.flywheelArrow}>→</div>
                        <div className={styles.flywheelStep}>
                            <span className={styles.flywheelNum}>2</span>
                            <span className={styles.flywheelLabel}>Data unlocks credit</span>
                        </div>
                        <div className={styles.flywheelArrow}>→</div>
                        <div className={styles.flywheelStep}>
                            <span className={styles.flywheelNum}>3</span>
                            <span className={styles.flywheelLabel}>Credit grows business</span>
                        </div>
                        <div className={styles.flywheelArrow}>→</div>
                        <div className={styles.flywheelStep}>
                            <span className={styles.flywheelNum}>4</span>
                            <span className={styles.flywheelLabel}>Growth generates more payments</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Why Blockchain ── */}
            <section className={styles.security} id="why-blockchain">
                <div className={styles.sectionContainer}>
                    <div className={`${styles.sectionHeader} ${isVisible('why-blockchain') ? styles.visible : ''}`}>
                        <span className={styles.sectionLabel}>Why Blockchain</span>
                        <h2 className={styles.sectionTitle}>What traditional infrastructure <span className={styles.gradientInline}>cannot do</span></h2>
                    </div>

                    <div className={styles.securityGrid}>
                        <div className={`${styles.securityCard} ${isVisible('why-blockchain') ? styles.visible : ''}`} style={{ transitionDelay: '0.1s' }}>
                            <div className={styles.securityIcon}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                                </svg>
                            </div>
                            <h3>Global Liquidity</h3>
                            <p>Anyone worldwide can provide capital to productive businesses — no geographic restrictions.</p>
                        </div>

                        <div className={`${styles.securityCard} ${isVisible('why-blockchain') ? styles.visible : ''}`} style={{ transitionDelay: '0.2s' }}>
                            <div className={styles.securityIcon}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
                                </svg>
                            </div>
                            <h3>Transparent Yield</h3>
                            <p>Every repayment, fee, and distribution is verifiable on-chain. No hidden charges or opaque intermediaries.</p>
                        </div>

                        <div className={`${styles.securityCard} ${isVisible('why-blockchain') ? styles.visible : ''}`} style={{ transitionDelay: '0.3s' }}>
                            <div className={styles.securityIcon}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                </svg>
                            </div>
                            <h3>Programmable Enforcement</h3>
                            <p>x402 settlement and waterfall splits are enforced by smart contracts — not by legal process or human action.</p>
                        </div>

                        <div className={`${styles.securityCard} ${isVisible('why-blockchain') ? styles.visible : ''}`} style={{ transitionDelay: '0.4s' }}>
                            <div className={styles.securityIcon}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                                </svg>
                            </div>
                            <h3>Continuous Underwriting</h3>
                            <p>Credit scores update in real-time from payment data — not from annual reviews or manual audits.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Ecosystem ── */}
            <section className={styles.integrations} id="integrations">
                <div className={styles.sectionContainer}>
                    <div className={`${styles.sectionHeader} ${isVisible('integrations') ? styles.visible : ''}`}>
                        <span className={styles.sectionLabel}>Ecosystem</span>
                        <h2 className={styles.sectionTitle}>Powered by <span className={styles.gradientInline}>Solana</span></h2>
                    </div>

                    <div className={`${styles.techStack} ${isVisible('integrations') ? styles.visible : ''}`}>
                        <div className={styles.techItem}>
                            <span className={styles.techName}>Solana</span>
                            <span className={styles.techDesc}>Layer 1</span>
                        </div>
                        <div className={styles.techDivider} />
                        <div className={styles.techItem}>
                            <span className={styles.techName}>x402</span>
                            <span className={styles.techDesc}>Payment Protocol</span>
                        </div>
                        <div className={styles.techDivider} />
                        <div className={styles.techItem}>
                            <span className={styles.techName}>USDC</span>
                            <span className={styles.techDesc}>Stablecoin</span>
                        </div>
                        <div className={styles.techDivider} />
                        <div className={styles.techItem}>
                            <span className={styles.techName}>FairScale</span>
                            <span className={styles.techDesc}>Credit Scoring</span>
                        </div>
                        <div className={styles.techDivider} />
                        <div className={styles.techItem}>
                            <span className={styles.techName}>Jupiter</span>
                            <span className={styles.techDesc}>Senior Tranche</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Vision CTA ── */}
            <section className={styles.finalCta} id="final-cta">
                <div className={styles.sectionContainer}>
                    <div className={`${styles.ctaContent} ${isVisible('final-cta') ? styles.visible : ''}`}>
                        <h2 className={styles.ctaTitle}>
                            The internet <span className={styles.gradientInline}>capital market</span>
                        </h2>
                        <p className={styles.ctaDesc}>
                            Companies no longer apply for loans. They stream capital as they perform.
                            Any productive business can raise funding based on activity — not location or collateral.
                        </p>
                        <div className={styles.ctaButtons}>
                            <button className={styles.primaryBtn} onClick={() => navigate('/vaults')}>
                                <span>Launch App</span>
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </button>
                            <button className={styles.secondaryBtn} onClick={() => navigate('/pools')}>
                                <span>Explore Pools</span>
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Footer ── */}
            <footer className={styles.footer}>
                <div className={styles.footerContent}>
                    <div className={styles.footerBrand}>
                        <span className={styles.footerLogo}>TigerPay<span className={styles.orangeX}>X</span></span>
                        <p>The Programmable Credit Network</p>
                    </div>
                    <div className={styles.footerLinks}>
                        <a href="#">Documentation</a>
                        <a href="#">GitHub</a>
                        <a href="#">Twitter</a>
                        <a href="#">Discord</a>
                    </div>
                </div>
                <div className={styles.footerBottom}>
                    <span>© 2026 TigerPayX. Making real-world revenue natively lendable on-chain.</span>
                </div>
            </footer>
        </div>
    )
}
