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
            {/* Ambient glow effects */}
            <div className={styles.ambientGlow} />
            <div className={styles.ambientGlow2} />

            {/* Hero Section */}
            <section className={styles.hero} id="hero">
                <div className={styles.heroContent}>
                    <span className={`${styles.overline} ${mounted ? styles.visible : ''}`}>
                        Powered by Solana
                    </span>

                    <h1 className={styles.headline}>
                        <span className={`${styles.line} ${mounted ? styles.visible : ''}`}>
                            <span className={styles.word}>Uncollateralized</span>
                        </span>
                        <span className={`${styles.line} ${styles.line2} ${mounted ? styles.visible : ''}`}>
                            <span className={styles.gradientText}>Lending Protocol</span>
                        </span>
                    </h1>

                    <p className={`${styles.subtitle} ${mounted ? styles.visible : ''}`}>
                        Credit-based loans without collateral.
                        <br />
                        <span className={styles.subtitleHighlight}>Fast. Transparent. Decentralized.</span>
                    </p>

                    <div className={`${styles.cta} ${mounted ? styles.visible : ''}`}>
                        <button className={styles.primaryBtn} onClick={() => navigate('/vaults')}>
                            <span>Launch App</span>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>
                        <button className={styles.secondaryBtn}>
                            <span>Read Docs</span>
                        </button>
                    </div>

                    <div className={`${styles.stats} ${mounted ? styles.visible : ''}`}>
                        <div className={styles.stat}>
                            <span className={styles.statValue}>$2.4M+</span>
                            <span className={styles.statLabel}>Total Volume</span>
                        </div>
                        <div className={styles.statDivider} />
                        <div className={styles.stat}>
                            <span className={styles.statValue}>400ms</span>
                            <span className={styles.statLabel}>Finality</span>
                        </div>
                        <div className={styles.statDivider} />
                        <div className={styles.stat}>
                            <span className={styles.statValue}>1,200+</span>
                            <span className={styles.statLabel}>Users</span>
                        </div>
                        <div className={styles.statDivider} />
                        <div className={styles.stat}>
                            <span className={styles.statValue}>99.9%</span>
                            <span className={styles.statLabel}>Uptime</span>
                        </div>
                    </div>
                </div>

                <div className={`${styles.scrollIndicator} ${mounted ? styles.visible : ''}`}>
                    <div className={styles.scrollLine} />
                </div>
            </section>

            {/* How It Works Section */}
            <section className={styles.howItWorks} id="how-it-works">
                <div className={styles.sectionContainer}>
                    <div className={`${styles.sectionHeader} ${isVisible('how-it-works') ? styles.visible : ''}`}>
                        <span className={styles.sectionLabel}>How It Works</span>
                        <h2 className={styles.sectionTitle}>Three steps to <span className={styles.gradientInline}>financial freedom</span></h2>
                    </div>

                    <div className={styles.stepsGrid}>
                        <div className={`${styles.step} ${isVisible('how-it-works') ? styles.visible : ''}`} style={{ transitionDelay: '0.1s' }}>
                            <div className={styles.stepIcon}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                    <circle cx="12" cy="7" r="4" />
                                </svg>
                            </div>
                            <span className={styles.stepNumber}>01</span>
                            <h3>Connect Wallet</h3>
                            <p>Link your Solana wallet to get started. We support Phantom, Solflare, and more.</p>
                        </div>

                        <div className={`${styles.step} ${isVisible('how-it-works') ? styles.visible : ''}`} style={{ transitionDelay: '0.2s' }}>
                            <div className={styles.stepIcon}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                                </svg>
                            </div>
                            <span className={styles.stepNumber}>02</span>
                            <h3>Build Credit Score</h3>
                            <p>Our FairScale algorithm analyzes your on-chain history to generate a credit score.</p>
                        </div>

                        <div className={`${styles.step} ${isVisible('how-it-works') ? styles.visible : ''}`} style={{ transitionDelay: '0.3s' }}>
                            <div className={styles.stepIcon}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <rect x="2" y="4" width="20" height="16" rx="2" />
                                    <path d="M12 12h.01M8 12h.01M16 12h.01" />
                                </svg>
                            </div>
                            <span className={styles.stepNumber}>03</span>
                            <h3>Borrow or Lend</h3>
                            <p>Access instant loans or earn yield by funding merchant vaults. No collateral needed.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* For Users Section */}
            <section className={styles.forUsers} id="for-users">
                <div className={styles.sectionContainer}>
                    <div className={styles.splitSection}>
                        <div className={`${styles.splitContent} ${isVisible('for-users') ? styles.visible : ''}`}>
                            <span className={styles.sectionLabel}>For Investors</span>
                            <h2 className={styles.splitTitle}>Earn yield on your <span className={styles.gradientInline}>USDC</span></h2>
                            <p className={styles.splitDesc}>
                                Fund merchant vaults and earn competitive APY. All loans are credit-scored and transparently tracked on-chain.
                            </p>
                            <ul className={styles.featureList}>
                                <li>
                                    <span className={styles.checkIcon}>✓</span>
                                    Up to 15% APY on stable investments
                                </li>
                                <li>
                                    <span className={styles.checkIcon}>✓</span>
                                    Real-time tracking of all positions
                                </li>
                                <li>
                                    <span className={styles.checkIcon}>✓</span>
                                    Instant withdrawals when vaults mature
                                </li>
                                <li>
                                    <span className={styles.checkIcon}>✓</span>
                                    Risk scores on every vault
                                </li>
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

            {/* For Merchants Section */}
            <section className={styles.forMerchants} id="for-merchants">
                <div className={styles.sectionContainer}>
                    <div className={`${styles.splitSection} ${styles.splitReverse}`}>
                        <div className={`${styles.splitContent} ${isVisible('for-merchants') ? styles.visible : ''}`}>
                            <span className={styles.sectionLabel}>For Merchants</span>
                            <h2 className={styles.splitTitle}>Access capital <span className={styles.gradientInline}>without collateral</span></h2>
                            <p className={styles.splitDesc}>
                                Get the funding you need to grow your business. Build your on-chain credit history and unlock better rates over time.
                            </p>
                            <ul className={styles.featureList}>
                                <li>
                                    <span className={styles.checkIcon}>✓</span>
                                    No collateral requirements
                                </li>
                                <li>
                                    <span className={styles.checkIcon}>✓</span>
                                    Flexible repayment terms
                                </li>
                                <li>
                                    <span className={styles.checkIcon}>✓</span>
                                    Build credit for better future rates
                                </li>
                                <li>
                                    <span className={styles.checkIcon}>✓</span>
                                    Funds in minutes, not weeks
                                </li>
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
                                    <div><span>Payment History</span><span>100%</span></div>
                                    <div><span>Account Age</span><span>8 months</span></div>
                                    <div><span>Total Borrowed</span><span>$45,000</span></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Security Section */}
            <section className={styles.security} id="security">
                <div className={styles.sectionContainer}>
                    <div className={`${styles.sectionHeader} ${isVisible('security') ? styles.visible : ''}`}>
                        <span className={styles.sectionLabel}>Security First</span>
                        <h2 className={styles.sectionTitle}>Built on <span className={styles.gradientInline}>trust</span></h2>
                        <p className={styles.sectionDesc}>Enterprise-grade security with full transparency</p>
                    </div>

                    <div className={styles.securityGrid}>
                        <div className={`${styles.securityCard} ${isVisible('security') ? styles.visible : ''}`} style={{ transitionDelay: '0.1s' }}>
                            <div className={styles.securityIcon}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                </svg>
                            </div>
                            <h3>Audited Contracts</h3>
                            <p>Smart contracts audited by leading security firms with zero critical vulnerabilities found.</p>
                        </div>

                        <div className={`${styles.securityCard} ${isVisible('security') ? styles.visible : ''}`} style={{ transitionDelay: '0.2s' }}>
                            <div className={styles.securityIcon}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                            </div>
                            <h3>Non-Custodial</h3>
                            <p>Your funds remain in your control. We never hold or have access to your private keys.</p>
                        </div>

                        <div className={`${styles.securityCard} ${isVisible('security') ? styles.visible : ''}`} style={{ transitionDelay: '0.3s' }}>
                            <div className={styles.securityIcon}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <polyline points="14 2 14 8 20 8" />
                                    <line x1="16" y1="13" x2="8" y2="13" />
                                    <line x1="16" y1="17" x2="8" y2="17" />
                                </svg>
                            </div>
                            <h3>On-Chain Proof</h3>
                            <p>Every transaction, score update, and repayment is verifiable on the Solana blockchain.</p>
                        </div>

                        <div className={`${styles.securityCard} ${isVisible('security') ? styles.visible : ''}`} style={{ transitionDelay: '0.4s' }}>
                            <div className={styles.securityIcon}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <circle cx="12" cy="12" r="10" />
                                    <path d="M12 6v6l4 2" />
                                </svg>
                            </div>
                            <h3>Real-Time Monitoring</h3>
                            <p>24/7 automated monitoring and alerts for any unusual activity or potential risks.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Integrations Section */}
            <section className={styles.integrations} id="integrations">
                <div className={styles.sectionContainer}>
                    <div className={`${styles.sectionHeader} ${isVisible('integrations') ? styles.visible : ''}`}>
                        <span className={styles.sectionLabel}>Ecosystem</span>
                        <h2 className={styles.sectionTitle}>Built on <span className={styles.gradientInline}>Solana</span></h2>
                    </div>

                    <div className={`${styles.techStack} ${isVisible('integrations') ? styles.visible : ''}`}>
                        <div className={styles.techItem}>
                            <span className={styles.techName}>Solana</span>
                            <span className={styles.techDesc}>Layer 1</span>
                        </div>
                        <div className={styles.techDivider} />
                        <div className={styles.techItem}>
                            <span className={styles.techName}>USDC</span>
                            <span className={styles.techDesc}>Stablecoin</span>
                        </div>
                        <div className={styles.techDivider} />
                        <div className={styles.techItem}>
                            <span className={styles.techName}>Phantom</span>
                            <span className={styles.techDesc}>Wallet</span>
                        </div>
                        <div className={styles.techDivider} />
                        <div className={styles.techItem}>
                            <span className={styles.techName}>FairScale</span>
                            <span className={styles.techDesc}>Credit</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* Final CTA Section */}
            <section className={styles.finalCta} id="final-cta">
                <div className={styles.sectionContainer}>
                    <div className={`${styles.ctaContent} ${isVisible('final-cta') ? styles.visible : ''}`}>
                        <h2 className={styles.ctaTitle}>
                            Ready to get <span className={styles.gradientInline}>started</span>?
                        </h2>
                        <p className={styles.ctaDesc}>
                            Join thousands of users already earning yield and accessing credit on TigerPay.
                        </p>
                        <div className={styles.ctaButtons}>
                            <button className={styles.primaryBtn} onClick={() => navigate('/vaults')}>
                                <span>Launch App</span>
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </button>
                            <button className={styles.secondaryBtn}>
                                <span>View Documentation</span>
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className={styles.footer}>
                <div className={styles.footerContent}>
                    <div className={styles.footerBrand}>
                        <span className={styles.footerLogo}>TigerPay</span>
                        <p>Decentralized lending on Solana</p>
                    </div>
                    <div className={styles.footerLinks}>
                        <a href="#">Documentation</a>
                        <a href="#">GitHub</a>
                        <a href="#">Twitter</a>
                        <a href="#">Discord</a>
                    </div>
                </div>
                <div className={styles.footerBottom}>
                    <span>© 2026 TigerPay. All rights reserved.</span>
                </div>
            </footer>
        </div>
    )
}
