import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { platformApi } from '../api/client'
import { weiToNumber } from '../lib/format'
import { AnimatedNumber } from '../components/ui/AnimatedNumber'
import DecryptedText from '../components/ui/DecryptedText'
import CardSwap, { Card } from '../components/ui/CardSwap'
import NoiseBackground from '../components/ui/NoiseBackground'
import WaterfallFlow from '../components/ui/WaterfallFlow'
import { BankIcon, HourglassIcon, ShieldIcon } from '../components/ui/PixelIcons'
import TigerCanvas from '../components/ui/TigerCanvas'
import { useScrollAnimations } from '../hooks/useScrollAnimations'

import styles from './Home.module.css'

export default function Home() {
    const navigate = useNavigate()
    const [mounted, setMounted] = useState(false)
    const [liveStats, setLiveStats] = useState<{ tvl: string; poolLiquidity: string; activeVaults: number } | null>(null)
    const [hoveredFlywheel, setHoveredFlywheel] = useState<number | null>(null)
    const [activeProblem, setActiveProblem] = useState(0)

    useEffect(() => {
        platformApi.stats().then(({ data }) => setLiveStats(data)).catch(() => {})
    }, [])

    useEffect(() => {
        setMounted(true)
    }, [])

    // Auto-advance problem showcase
    useEffect(() => {
        const timer = setInterval(() => {
            setActiveProblem(prev => (prev + 1) % 3)
        }, 4000)
        return () => clearInterval(timer)
    }, [])

    // GSAP ScrollTrigger animations for all non-hero sections
    useScrollAnimations()

    const flywheelCards = [
        { num: '01', title: 'Payments generate data', desc: 'x402 transactions create verifiable payment history on-chain', color: '#2CFF05', hoverBg: '#0a2d05' },
        { num: '02', title: 'Data unlocks credit', desc: 'FairScale scores enable access to structured credit pools', color: '#00FFF0', hoverBg: '#052d2a' },
        { num: '03', title: 'Credit grows business', desc: 'Working capital fuels inventory, expansion, and new markets', color: '#E0115F', hoverBg: '#2d0515' },
        { num: '04', title: 'Growth fuels payments', desc: 'Larger businesses process more volume, restarting the cycle', color: '#FF5C00', hoverBg: '#2d1505' },
    ]

    const problemSlides = [
        {
            cardTitle: 'Traditional Finance',
            cardDetail: 'Requires collateral and local presence. Weeks to months for approval. 65% of global SMEs excluded.',
            icon: <BankIcon opacity={0.85} />,
            headline: 'Legacy credit',
            desc: 'Collateral-based systems exclude productive businesses from capital markets.',
        },
        {
            cardTitle: 'DeFi Today',
            cardDetail: 'Overcollateralized lending. No revenue data. Cannot evaluate real businesses.',
            icon: <HourglassIcon opacity={0.85} />,
            headline: 'Broken DeFi',
            desc: 'Current protocols ignore real-world productivity and cash flow entirely.',
        },
        {
            cardTitle: 'No Enforcement Layer',
            cardDetail: 'Capital exists but cannot verify borrower activity. Trust-based systems leak value. No repayment routing.',
            icon: <ShieldIcon opacity={0.85} />,
            headline: 'Missing layer',
            desc: 'Capital exists but cannot follow commerce — no mechanism routes repayment from revenue.',
        },
    ]

    return (
        <div id="home-scroller" className={styles.home}>

            {/* ── Hero ── */}
            <section className={styles.hero} id="hero">
                <TigerCanvas opacity={0.55} />
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
                        <NoiseBackground gradientColors={['#FF5C00', '#CC4A00', '#FF8533']}>
                            <button className={styles.primaryBtn} onClick={() => navigate('/vaults')}>
                                <span>Launch App</span>
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </button>
                        </NoiseBackground>
                        <button className={styles.secondaryBtn}>
                            <span>Read Litepaper</span>
                        </button>
                    </div>

                    <div className={`${styles.stats} ${mounted ? styles.visible : ''}`}>
                        <div className={styles.stat}>
                            {liveStats
                                ? <AnimatedNumber
                                    value={weiToNumber(liveStats.tvl)}
                                    format={(v) => v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(0)}K` : `$${v.toFixed(0)}`}
                                    className={styles.statValue}
                                />
                                : <span className={styles.statValue}>$—</span>
                            }
                            <span className={styles.statLabel}>TVL</span>
                        </div>
                        <div className={styles.statDivider} />
                        <div className={styles.stat}>
                            {liveStats
                                ? <AnimatedNumber
                                    value={weiToNumber(liveStats.poolLiquidity)}
                                    format={(v) => v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(0)}K` : `$${v.toFixed(0)}`}
                                    className={styles.statValue}
                                />
                                : <span className={styles.statValue}>$—</span>
                            }
                            <span className={styles.statLabel}>Pool Liquidity</span>
                        </div>
                        <div className={styles.statDivider} />
                        <div className={styles.stat}>
                            {liveStats
                                ? <AnimatedNumber value={liveStats.activeVaults} decimals={0} className={styles.statValue} />
                                : <span className={styles.statValue}>—</span>
                            }
                            <span className={styles.statLabel}>Active Vaults</span>
                        </div>
                        <div className={styles.statDivider} />
                        <div className={styles.stat}>
                            <AnimatedNumber value={100} suffix="%" decimals={0} className={styles.statValue} />
                            <span className={styles.statLabel}>On-Chain</span>
                        </div>
                    </div>
                </div>

                <div className={`${styles.scrollIndicator} ${mounted ? styles.visible : ''}`}>
                    <div className={styles.scrollLine} />
                </div>
            </section>

            {/* ── Cinematic Brand Break ── */}
            <section className={styles.cinematicSection} id="cinematic">
                <div className={styles.cinematicImageWrap}>
                    <picture>
                        <source srcSet="/images/mustang-hero.webp" type="image/webp" />
                        <img
                            src="/images/mustang-hero.jpg"
                            alt="Orange Shelby GT500 at speed"
                            className={styles.cinematicImage}
                            loading="lazy"
                        />
                    </picture>
                    <div className={styles.cinematicOverlay} />
                </div>
                <div data-anim="cinematic-content" className={styles.cinematicContent}>
                    <div className={styles.cinematicTextBlock}>
                        <span className={styles.cinematicLabel}>TCredit powers DeFi Credit</span>
                        <p className={styles.cinematicHeadline}>
                            From structured vaults to instant settlements — <span className={styles.cinematicAccent}>TCredit is building the future of on-chain credit.</span>
                        </p>
                    </div>
                    <div className={styles.cinematicStats}>
                        <div className={styles.cinematicStat}>
                            <span className={styles.cinematicStatValue}>
                                {liveStats
                                    ? <AnimatedNumber
                                        value={weiToNumber(liveStats.tvl)}
                                        format={(v) => v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M+` : v >= 1e3 ? `$${(v / 1e3).toFixed(0)}K+` : `$${v.toFixed(0)}`}
                                    />
                                    : '$0'
                                }
                            </span>
                            <span className={styles.cinematicStatLabel}>Total Value Locked</span>
                        </div>
                        <div className={styles.cinematicStat}>
                            <span className={styles.cinematicStatValue}>
                                {liveStats
                                    ? <AnimatedNumber value={liveStats.activeVaults} decimals={0} />
                                    : '0'
                                }
                            </span>
                            <span className={styles.cinematicStatLabel}>Active Vaults</span>
                        </div>
                        <div className={styles.cinematicStat}>
                            <span className={styles.cinematicStatValue}>100%</span>
                            <span className={styles.cinematicStatLabel}>On-Chain</span>
                        </div>
                        <div className={styles.cinematicStat}>
                            <span className={styles.cinematicStatValue}>x402</span>
                            <span className={styles.cinematicStatLabel}>Protocol Standard</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── The Problem — Square cards with pixel art ── */}
            <section className={styles.problemSection} id="problem">
                <div className={styles.sectionContainer}>
                    <div className={styles.sectionHeader}>
                        <span className={styles.sectionLabel}>The Problem</span>
                        <h2 className={styles.sectionTitle}>Why existing systems <span className={styles.gradientInline}>fail</span></h2>
                    </div>

                    {/* 3 square cards fly in from different directions */}
                    <div className={styles.problemShowcase}>
                        {problemSlides.map((slide, i) => (
                            <div
                                key={i}
                                data-anim="problem-card"
                                className={`${styles.showcaseCard} ${activeProblem === i ? styles.showcaseCardActive : ''}`}
                                onClick={() => setActiveProblem(i)}
                            >
                                <div className={styles.showcaseCardPixel}>
                                    {slide.icon}
                                </div>
                                <h3 className={styles.showcaseCardTitle}>{slide.cardTitle}</h3>
                                <p className={styles.showcaseCardDesc}>{slide.cardDetail}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── How It Works — 1inch-style Horizontal Card Carousel ── */}
            <section className={styles.hiwSection} id="how-it-works">
                <div className={styles.hiwInner}>
                    <div className={styles.hiwHeading}>
                        <span className={styles.sectionLabel}>How It Works</span>
                        <h2 className={styles.sectionTitle}>Five steps to <span className={styles.gradientInline}>programmable credit</span></h2>
                    </div>
                    <div data-anim="hiw-track" className={styles.hiwTrack}>
                        <div className={styles.hiwCard} style={{ background: '#2CFF05' }}>
                            <span className={styles.hiwBadge}>Payment Routing</span>
                            <h3 className={styles.hiwCardTitle}>Route payments through TCredit</h3>
                            <p className={styles.hiwCardDesc}>Businesses bill customers using TCredit x402 payment endpoints. Customers pay via local rails or stablecoins.</p>
                            <button className={styles.hiwCardBtn} onClick={() => navigate('/merchant')}>Learn More</button>
                        </div>
                        <div className={styles.hiwCard} style={{ background: '#00FFF0' }}>
                            <span className={styles.hiwBadge}>Financial Identity</span>
                            <h3 className={styles.hiwCardTitle}>Build a live credit profile</h3>
                            <p className={styles.hiwCardDesc}>Transaction behaviour builds a live credit profile — revenue consistency, volume, frequency, counterparty diversity.</p>
                            <button className={styles.hiwCardBtn} onClick={() => navigate('/merchant')}>Learn More</button>
                        </div>
                        <div className={styles.hiwCard} style={{ background: '#FFD700' }}>
                            <span className={styles.hiwBadge}>Capital Advance</span>
                            <h3 className={styles.hiwCardTitle}>Access working capital instantly</h3>
                            <p className={styles.hiwCardDesc}>Businesses request working capital, invoice financing, or trade finance against receivables. ~2% monthly cost.</p>
                            <button className={styles.hiwCardBtn} onClick={() => navigate('/vaults')}>Learn More</button>
                        </div>
                        <div className={styles.hiwCard} style={{ background: '#E0115F' }}>
                            <span className={`${styles.hiwBadge} ${styles.hiwBadgeLight}`}>Liquidity Funding</span>
                            <h3 className={`${styles.hiwCardTitle} ${styles.hiwCardTitleLight}`}>Fund through structured tranches</h3>
                            <p className={`${styles.hiwCardDesc} ${styles.hiwCardDescLight}`}>On-chain vaults fund loans via structured tranches — senior lenders, liquidity pools, and community investors.</p>
                            <button className={`${styles.hiwCardBtn} ${styles.hiwCardBtnLight}`} onClick={() => navigate('/pools')}>Learn More</button>
                        </div>
                        <div className={styles.hiwCard} style={{ background: '#FFFFFF' }}>
                            <span className={styles.hiwBadge}>Automated Repayment</span>
                            <h3 className={styles.hiwCardTitle}>Repayment happens automatically</h3>
                            <p className={styles.hiwCardDesc}>Incoming payments auto-split: lender repayment first, remaining merchant balance second. No manual installments.</p>
                            <button className={styles.hiwCardBtn} onClick={() => navigate('/vaults')}>Learn More</button>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Capital Structure / Waterfall ── */}
            <section className={`${styles.capitalSection} ${styles.dividerBottom} ${styles.dividerToGreen}`} id="capital">
                <div className={styles.sectionContainer}>
                    <div data-anim="capital-header" className={styles.sectionHeader}>
                        <span className={styles.sectionLabel}>Capital Structure</span>
                        <h2 className={styles.sectionTitle}>Structured liquidity with <span className={styles.gradientInline}>waterfall repayment</span></h2>
                        <p className={styles.sectionDesc}>
                            Each loan is funded through layered capital. Repayment flows top-down — senior first, merchant last.
                        </p>
                    </div>
                    <WaterfallFlow />
                </div>
            </section>

            {/* ── For Investors ── */}
            <section className={`${styles.forUsers} ${styles.dividerBottom} ${styles.dividerToPurple}`} id="for-users">
                <div className={styles.sectionContainer}>
                    <div className={styles.splitSection}>
                        <div data-anim="forusers-content" className={styles.splitContent}>
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

                        <div data-anim="forusers-visual" className={styles.splitVisual}>
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
            <section className={`${styles.forMerchants} ${styles.dividerBottom} ${styles.dividerToDark}`} id="for-merchants">
                <div className={styles.sectionContainer}>
                    <div className={`${styles.splitSection} ${styles.splitReverse}`}>
                        <div data-anim="formerchants-content" className={styles.splitContent}>
                            <span className={styles.sectionLabel}>For Merchants</span>
                            <h2 className={styles.splitTitle}>Stream capital as you <span className={styles.gradientInline}>perform</span></h2>
                            <p className={styles.splitDesc}>
                                Bill through TCredit endpoints. Your payment history becomes your credit score. Access working capital, invoice financing, or trade finance — up to 12 months.
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

                        <div data-anim="formerchants-visual" className={styles.splitVisual}>
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

            {/* ── The Economic Flywheel — pinned scatter cards ── */}
            <section
                className={`${styles.flywheelSection} ${styles.dividerBottom} ${styles.dividerToCyan}`}
                id="flywheel"
                style={{
                    backgroundColor: hoveredFlywheel !== null ? flywheelCards[hoveredFlywheel].hoverBg : undefined,
                    transition: 'background-color 0.8s cubic-bezier(.4, 0, .2, 1)',
                }}
            >
                <div className={styles.flywheelScatter}>
                    {flywheelCards.map((card, i) => (
                        <div
                            key={i}
                            data-anim="flywheel-card"
                            className={`${styles.scatterCard} ${styles[`scatterPos${i}` as keyof typeof styles]} ${hoveredFlywheel !== null && hoveredFlywheel !== i ? styles.scatterDimmed : ''}`}
                            onMouseEnter={() => setHoveredFlywheel(i)}
                            onMouseLeave={() => setHoveredFlywheel(null)}
                            style={{
                                borderColor: hoveredFlywheel === i ? card.color : undefined,
                                boxShadow: hoveredFlywheel === i ? `0 0 40px ${card.color}33, 0 8px 32px rgba(0,0,0,0.3)` : undefined,
                            } as React.CSSProperties}
                        >
                            <span className={styles.scatterCardNum}>{card.num}</span>
                            <h4 className={styles.scatterCardTitle}>{card.title}</h4>
                            <p className={styles.scatterCardDesc}>{card.desc}</p>
                        </div>
                    ))}

                    <div data-anim="flywheel-center" className={styles.flywheelCenterText}>
                        <span className={styles.sectionLabel}>The Flywheel</span>
                        <h2 className={styles.sectionTitle}>Liquidity flows toward <span className={styles.gradientInline}>productivity</span></h2>
                        <p className={styles.flywheelSubtext}>
                            Every payment through TCredit feeds the credit engine — creating a self-reinforcing cycle of access, growth, and liquidity.
                        </p>
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
                                delay={1750}
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
                                    <div className={`${styles.swapCard} ${styles.swapCardAlt}`}>
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
                                    <div className={`${styles.swapCard} ${styles.swapCardAlt}`}>
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
                        <div data-anim="why-text" className={styles.whyText}>
                            <span className={styles.sectionLabel}>Why Blockchain</span>
                            <h2 className={styles.sectionTitle}>
                                <DecryptedText text="What traditional infrastructure " speed={40} animateOn="view" />
                                <span className={styles.gradientInline}>
                                    <DecryptedText text="cannot do" speed={40} animateOn="view" />
                                </span>
                            </h2>
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

            {/* ── Footer ── */}
            <footer className={styles.footer}>
                <div className={styles.footerContent}>
                    <div className={styles.footerBrand}>
                        <span className={styles.footerLogo}>TCredit</span>
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
                    <span>© 2026 TCredit. Making real-world revenue natively lendable on-chain.</span>
                </div>
            </footer>
        </div>
    )
}
