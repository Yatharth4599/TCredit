import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import DecryptedText from '../components/ui/DecryptedText'
import Carousel, { type CarouselItem } from '../components/ui/Carousel'
import Stepper, { Step } from '../components/ui/Stepper'
import CardSwap, { Card } from '../components/ui/CardSwap'
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
                            <DecryptedText
                                text="Revenue-Backed"
                                parentClassName={styles.decryptedWord}
                                encryptedClassName={styles.encryptedChar}
                                animateOn="view"
                                speed={40}
                                maxIterations={40}
                                sequential={true}
                                revealDirection="start"
                            />
                        </span>
                        <span className={`${styles.line} ${styles.line2} ${mounted ? styles.visible : ''}`}>
                            <DecryptedText
                                text="Programmable Credit"
                                parentClassName={styles.decryptedGradient}
                                encryptedClassName={styles.encryptedChar}
                                animateOn="view"
                                speed={40}
                                maxIterations={40}
                                sequential={true}
                                revealDirection="start"
                            />
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
                    <div className={styles.problemSplit}>
                        {/* Left: Text content */}
                        <div className={`${styles.problemText} ${isVisible('problem') ? styles.visible : ''}`}>
                            <span className={styles.sectionLabel}>The Problem</span>
                            <h2 className={styles.sectionTitle}>Capital cannot <span className={styles.gradientInline}>follow commerce</span></h2>
                            <p className={styles.problemDesc}>
                                Productive companies remain underfunded despite predictable cash flows.
                                The missing layer is not liquidity — it is enforceability.
                            </p>
                            <ul className={styles.problemHighlights}>
                                <li><span className={styles.stepsListNum}>01</span> 65% of global SMEs lack access to credit</li>
                                <li><span className={styles.stepsListNum}>02</span> DeFi ignores real-world business revenue</li>
                                <li><span className={styles.stepsListNum}>03</span> TradFi requires collateral, not cash flow</li>
                            </ul>
                        </div>
                        {/* Right: Carousel */}
                        <div className={`${styles.carouselWrapper} ${isVisible('problem') ? styles.visible : ''}`}>
                            <Carousel
                                baseWidth={330}
                                autoplay
                                autoplayDelay={2500}
                                pauseOnHover={false}
                                loop
                                round={false}
                                items={[
                                    {
                                        id: 1,
                                        title: 'Traditional Finance',
                                        description: 'Requires local presence and collateral. Enforces repayment manually. Weeks to months for approval. Excludes 65% of global SMEs.',
                                        icon: (
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                                <path d="M3 21h18M3 7v14M21 7v14M6 7V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v3M9 21v-4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4" />
                                            </svg>
                                        ),
                                    },
                                    {
                                        id: 2,
                                        title: 'DeFi Today',
                                        description: 'Requires overcollateralization. Ignores real-world productivity. Cannot evaluate businesses. No revenue-based underwriting.',
                                        icon: (
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                                <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                                            </svg>
                                        ),
                                    },
                                    {
                                        id: 3,
                                        title: 'Liquidity Without Enforcement',
                                        description: 'Capital exists but cannot verify borrower activity. No mechanism to route repayment from revenue. Trust-based systems leak value.',
                                        icon: (
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                                            </svg>
                                        ),
                                    },
                                ] satisfies CarouselItem[]}
                            />
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

                    <div className={`${styles.stepperWrapper} ${isVisible('insight') ? styles.visible : ''}`}>
                        <Stepper
                            initialStep={1}
                            backButtonText="Back"
                            nextButtonText="Next"
                        >
                            <Step>
                                <h3 className={styles.stepperTitle}>Customer Payment</h3>
                                <p>A customer pays for goods or services. The payment is routed through a TigerPayX x402 endpoint — not directly to the merchant's wallet.</p>
                            </Step>
                            <Step>
                                <h3 className={styles.stepperTitle}>x402 Settlement</h3>
                                <p>Funds land in a controlled settlement account — a smart contract that the merchant cannot bypass. This is where enforcement happens on-chain.</p>
                            </Step>
                            <Step>
                                <h3 className={styles.stepperTitle}>Waterfall Split</h3>
                                <p>The protocol automatically splits the payment: senior lender repayment first, then liquidity pool share, then community investors, and finally the merchant's net balance.</p>
                            </Step>
                            <Step>
                                <h3 className={styles.stepperTitle}>Merchant Receives Net</h3>
                                <p>After all obligations are met, the remaining balance is released to the merchant instantly. No invoices, no manual payments — just automated settlement.</p>
                            </Step>
                        </Stepper>
                    </div>

                    <div className={`${styles.insightQuote} ${isVisible('insight') ? styles.visible : ''}`}>
                        <p>Credit risk becomes <span className={styles.gradientInline}>activity risk</span>. Instead of trusting borrowers to repay, the protocol routes repayment directly from incoming payments.</p>
                    </div>
                </div>
            </section>

            {/* ── How It Works — 5 Steps ── */}
            <section className={styles.howItWorks} id="how-it-works">
                <div className={styles.sectionContainer}>
                    <div className={styles.howItWorksSplit}>
                        {/* Left: Text content */}
                        <div className={`${styles.howItWorksText} ${isVisible('how-it-works') ? styles.visible : ''}`}>
                            <span className={styles.sectionLabel}>How It Works</span>
                            <h2 className={styles.sectionTitle}>Five steps to <span className={styles.gradientInline}>programmable credit</span></h2>
                            <p className={styles.howItWorksDesc}>
                                TigerPayX turns everyday business payments into a creditworthy financial identity — then funds working capital against it, with automated repayment built in.
                            </p>
                            <div className={styles.stepsList}>
                                <div className={styles.stepsListItem}>
                                    <span className={styles.stepsListNum}>01</span>
                                    <span>Payment Routing</span>
                                </div>
                                <div className={styles.stepsListItem}>
                                    <span className={styles.stepsListNum}>02</span>
                                    <span>Financial Identity</span>
                                </div>
                                <div className={styles.stepsListItem}>
                                    <span className={styles.stepsListNum}>03</span>
                                    <span>Capital Advance</span>
                                </div>
                                <div className={styles.stepsListItem}>
                                    <span className={styles.stepsListNum}>04</span>
                                    <span>Liquidity Funding</span>
                                </div>
                                <div className={styles.stepsListItem}>
                                    <span className={styles.stepsListNum}>05</span>
                                    <span>Automated Repayment</span>
                                </div>
                            </div>
                        </div>

                        {/* Right: CardSwap animation */}
                        <div className={styles.cardSwapWrapper}>
                            <CardSwap
                                width={420}
                                height={280}
                                cardDistance={35}
                                verticalDistance={30}
                                delay={4000}
                                pauseOnHover={true}
                                skewAmount={4}
                                easing="elastic"
                            >
                                <Card>
                                    <div className={styles.swapCard}>
                                        <div className={styles.swapCardHeader}>
                                            <span className={styles.swapCardNumber}>01</span>
                                            <div className={styles.swapCardIcon}>
                                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                                                </svg>
                                            </div>
                                        </div>
                                        <h3 className={styles.swapCardTitle}>Payment Routing</h3>
                                        <p className={styles.swapCardDesc}>Businesses bill customers using TigerPayX x402 payment endpoints. Customers pay via local rails or stablecoins.</p>
                                    </div>
                                </Card>
                                <Card>
                                    <div className={styles.swapCard}>
                                        <div className={styles.swapCardHeader}>
                                            <span className={styles.swapCardNumber}>02</span>
                                            <div className={styles.swapCardIcon}>
                                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                                                </svg>
                                            </div>
                                        </div>
                                        <h3 className={styles.swapCardTitle}>Financial Identity</h3>
                                        <p className={styles.swapCardDesc}>Transaction behaviour builds a live credit profile — revenue consistency, volume, frequency, counterparty diversity.</p>
                                    </div>
                                </Card>
                                <Card>
                                    <div className={styles.swapCard}>
                                        <div className={styles.swapCardHeader}>
                                            <span className={styles.swapCardNumber}>03</span>
                                            <div className={styles.swapCardIcon}>
                                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                                                </svg>
                                            </div>
                                        </div>
                                        <h3 className={styles.swapCardTitle}>Capital Advance</h3>
                                        <p className={styles.swapCardDesc}>Businesses request working capital, invoice financing, or trade finance against receivables. ~2% monthly cost.</p>
                                    </div>
                                </Card>
                                <Card>
                                    <div className={styles.swapCard}>
                                        <div className={styles.swapCardHeader}>
                                            <span className={styles.swapCardNumber}>04</span>
                                            <div className={styles.swapCardIcon}>
                                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                                    <rect x="2" y="4" width="20" height="16" rx="2" /><path d="M12 12h.01M8 12h.01M16 12h.01" />
                                                </svg>
                                            </div>
                                        </div>
                                        <h3 className={styles.swapCardTitle}>Liquidity Funding</h3>
                                        <p className={styles.swapCardDesc}>On-chain vaults fund loans via structured tranches — senior lenders, liquidity pools, and community investors.</p>
                                    </div>
                                </Card>
                                <Card>
                                    <div className={styles.swapCard}>
                                        <div className={styles.swapCardHeader}>
                                            <span className={styles.swapCardNumber}>05</span>
                                            <div className={styles.swapCardIcon}>
                                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                                </svg>
                                            </div>
                                        </div>
                                        <h3 className={styles.swapCardTitle}>Automated Repayment</h3>
                                        <p className={styles.swapCardDesc}>Incoming payments auto-split: lender repayment first, remaining merchant balance second. No manual installments.</p>
                                    </div>
                                </Card>
                            </CardSwap>
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

                    <div className={`${styles.flywheelDiagram} ${isVisible('flywheel') ? styles.visible : ''}`}>
                        <svg className={styles.flywheelSvg} viewBox="0 0 360 360" fill="none" xmlns="http://www.w3.org/2000/svg">
                            {/* Outer dashed ring */}
                            <circle cx="180" cy="180" r="138" stroke="rgba(255,107,53,0.15)" strokeWidth="1" strokeDasharray="6 6" className={styles.flywheelRingOuter} />
                            {/* Animated flow arc */}
                            <circle cx="180" cy="180" r="138" stroke="#FF6B35" strokeWidth="2" strokeDasharray="55 812" strokeLinecap="round" className={styles.flywheelArc} />
                            {/* Inner ring */}
                            <circle cx="180" cy="180" r="46" stroke="rgba(255,107,53,0.12)" strokeWidth="1" />
                            {/* Center */}
                            <circle cx="180" cy="180" r="38" fill="rgba(255,107,53,0.08)" stroke="rgba(255,107,53,0.25)" strokeWidth="1" />
                            <text x="180" y="176" textAnchor="middle" fill="#FF6B35" fontSize="8" fontWeight="700" letterSpacing="1">TIGER</text>
                            <text x="180" y="188" textAnchor="middle" fill="#FF6B35" fontSize="8" fontWeight="700" letterSpacing="1">PAYX</text>
                            {/* Spokes */}
                            <line x1="180" y1="42" x2="180" y2="62" stroke="rgba(255,107,53,0.2)" strokeWidth="1" strokeDasharray="3 3" />
                            <line x1="318" y1="180" x2="298" y2="180" stroke="rgba(255,107,53,0.2)" strokeWidth="1" strokeDasharray="3 3" />
                            <line x1="180" y1="318" x2="180" y2="298" stroke="rgba(255,107,53,0.2)" strokeWidth="1" strokeDasharray="3 3" />
                            <line x1="42" y1="180" x2="62" y2="180" stroke="rgba(255,107,53,0.2)" strokeWidth="1" strokeDasharray="3 3" />
                        </svg>

                        <div className={`${styles.flywheelNode} ${styles.flywheelNodeTop}`}>
                            <div className={styles.flywheelNodeNum}>1</div>
                            <span className={styles.flywheelNodeLabel}>Payments generate data</span>
                        </div>
                        <div className={`${styles.flywheelNode} ${styles.flywheelNodeRight}`}>
                            <div className={styles.flywheelNodeNum}>2</div>
                            <span className={styles.flywheelNodeLabel}>Data unlocks credit</span>
                        </div>
                        <div className={`${styles.flywheelNode} ${styles.flywheelNodeBottom}`}>
                            <div className={styles.flywheelNodeNum}>3</div>
                            <span className={styles.flywheelNodeLabel}>Credit grows business</span>
                        </div>
                        <div className={`${styles.flywheelNode} ${styles.flywheelNodeLeft}`}>
                            <div className={styles.flywheelNodeNum}>4</div>
                            <span className={styles.flywheelNodeLabel}>Growth fuels more payments</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Why Blockchain ── */}
            <section className={styles.security} id="why-blockchain">
                <div className={styles.sectionContainer}>
                    <div className={styles.whySplit}>
                        {/* Left: CardSwap */}
                        <div className={styles.cardSwapWrapper}>
                            <CardSwap
                                width={420}
                                height={280}
                                cardDistance={-35}
                                verticalDistance={30}
                                delay={4000}
                                pauseOnHover={true}
                                skewAmount={-4}
                                easing="elastic"
                            >
                                <Card>
                                    <div className={styles.swapCard}>
                                        <div className={styles.swapCardHeader}>
                                            <span className={styles.swapCardNumber}>01</span>
                                            <div className={styles.swapCardIcon}>
                                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                                    <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                                                </svg>
                                            </div>
                                        </div>
                                        <h3 className={styles.swapCardTitle}>Global Liquidity</h3>
                                        <p className={styles.swapCardDesc}>Anyone worldwide can provide capital to productive businesses — no geographic restrictions or intermediaries.</p>
                                    </div>
                                </Card>
                                <Card>
                                    <div className={styles.swapCard}>
                                        <div className={styles.swapCardHeader}>
                                            <span className={styles.swapCardNumber}>02</span>
                                            <div className={styles.swapCardIcon}>
                                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
                                                </svg>
                                            </div>
                                        </div>
                                        <h3 className={styles.swapCardTitle}>Transparent Yield</h3>
                                        <p className={styles.swapCardDesc}>Every repayment, fee, and distribution is verifiable on-chain. No hidden charges or opaque intermediaries.</p>
                                    </div>
                                </Card>
                                <Card>
                                    <div className={styles.swapCard}>
                                        <div className={styles.swapCardHeader}>
                                            <span className={styles.swapCardNumber}>03</span>
                                            <div className={styles.swapCardIcon}>
                                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                                </svg>
                                            </div>
                                        </div>
                                        <h3 className={styles.swapCardTitle}>Programmable Enforcement</h3>
                                        <p className={styles.swapCardDesc}>x402 settlement and waterfall splits enforced by smart contracts — not by legal process or human action.</p>
                                    </div>
                                </Card>
                                <Card>
                                    <div className={styles.swapCard}>
                                        <div className={styles.swapCardHeader}>
                                            <span className={styles.swapCardNumber}>04</span>
                                            <div className={styles.swapCardIcon}>
                                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                                    <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                                                </svg>
                                            </div>
                                        </div>
                                        <h3 className={styles.swapCardTitle}>Continuous Underwriting</h3>
                                        <p className={styles.swapCardDesc}>Credit scores update in real-time from payment data — not from annual reviews or manual audits.</p>
                                    </div>
                                </Card>
                            </CardSwap>
                        </div>

                        {/* Right: Text */}
                        <div className={`${styles.whyText} ${isVisible('why-blockchain') ? styles.visible : ''}`}>
                            <span className={styles.sectionLabel}>Why Blockchain</span>
                            <h2 className={styles.sectionTitle}>What traditional infrastructure <span className={styles.gradientInline}>cannot do</span></h2>
                            <p className={styles.whyDesc}>
                                Blockchain removes every point of failure that makes traditional credit inaccessible — geographic limits, opaque intermediaries, manual enforcement, and slow data.
                            </p>
                            <ul className={styles.stepsList}>
                                <li className={styles.stepsListItem}><span className={styles.stepsListNum}>01</span><span>Open to any lender, anywhere in the world</span></li>
                                <li className={styles.stepsListItem}><span className={styles.stepsListNum}>02</span><span>Every transaction fully auditable on-chain</span></li>
                                <li className={styles.stepsListItem}><span className={styles.stepsListNum}>03</span><span>Repayment enforced by code, not courts</span></li>
                                <li className={styles.stepsListItem}><span className={styles.stepsListNum}>04</span><span>Credit profile built from live payment data</span></li>
                            </ul>
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
