import { useNavigate } from 'react-router-dom'
import { useEffect, useState, useRef } from 'react'
import { platformApi, waitlistApi } from '../api/client'
import { weiToNumber } from '../lib/format'
import { AnimatedNumber } from '../components/ui/AnimatedNumber'
import DecryptedText from '../components/ui/DecryptedText'
import CardSwap, { Card } from '../components/ui/CardSwap'
import NoiseBackground from '../components/ui/NoiseBackground'
import WaterfallFlow from '../components/ui/WaterfallFlow'
import { AnimatedCoinStackIcon, AnimatedVaultIcon, AnimatedLockIcon } from '../components/ui/AnimatedPixelIcons'
import ProblemBackground from '../components/ui/ProblemBackground'
import MerchantBackground from '../components/ui/MerchantBackground'
import InvestorBackground from '../components/ui/InvestorBackground'
import TigerCanvas from '../components/ui/TigerCanvas'
import { useScrollAnimations } from '../hooks/useScrollAnimations'

import styles from './Home.module.css'

function InvestorCounter({ visible, end, prefix = '', suffix = '', decimals = 0, duration = 1500 }: {
    visible: boolean; end: number; prefix?: string; suffix?: string; decimals?: number; duration?: number
}) {
    const [value, setValue] = useState(0)
    const rafRef = useRef<number>(0)

    useEffect(() => {
        if (!visible) { setValue(0); return }
        const start = performance.now()
        const tick = (now: number) => {
            const elapsed = now - start
            const progress = Math.min(elapsed / duration, 1)
            const eased = 1 - Math.pow(1 - progress, 3)
            setValue(eased * end)
            if (progress < 1) rafRef.current = requestAnimationFrame(tick)
        }
        rafRef.current = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(rafRef.current)
    }, [visible, end, duration])

    const formatted = decimals > 0
        ? value.toFixed(decimals)
        : Math.round(value).toLocaleString()

    return <>{prefix}{formatted}{suffix}</>
}

export default function Home() {
    const navigate = useNavigate()
    const [mounted, setMounted] = useState(false)
    const [liveStats, setLiveStats] = useState<{ tvl: string; poolLiquidity: string; activeVaults: number } | null>({
        tvl: '20000000000000',          // $20M USDC (20_000_000 × 1e6)
        poolLiquidity: '15000000000000', // $15M USDC
        activeVaults: 25,
    })
    const [hoveredFlywheel, setHoveredFlywheel] = useState<number | null>(null)
    const [showWaitlist, setShowWaitlist] = useState(false)
    const [waitlistEmail, setWaitlistEmail] = useState('')
    const [waitlistLoading, setWaitlistLoading] = useState(false)
    const [waitlistDone, setWaitlistDone] = useState(false)
    const [waitlistError, setWaitlistError] = useState('')
    const [activeProblem, setActiveProblem] = useState(0)
    const [investorCardVisible, setInvestorCardVisible] = useState(false)
    const investorCardRef = useRef<HTMLDivElement>(null)
    const [merchantCardVisible, setMerchantCardVisible] = useState(false)
    const [merchantScore, setMerchantScore] = useState(0)
    const merchantCardRef = useRef<HTMLDivElement>(null)

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

    useEffect(() => {
        const node = investorCardRef.current
        if (!node) return
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setInvestorCardVisible(true)
                    observer.disconnect()
                }
            },
            { threshold: 0.3 }
        )
        observer.observe(node)
        return () => observer.disconnect()
    }, [])

    useEffect(() => {
        const node = merchantCardRef.current
        if (!node) return
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setMerchantCardVisible(true)
                    observer.disconnect()
                }
            },
            { threshold: 0.3 }
        )
        observer.observe(node)
        return () => observer.disconnect()
    }, [])

    useEffect(() => {
        if (!merchantCardVisible) return
        const target = 785
        const duration = 1200
        const startTime = performance.now()
        let rafId: number
        const animate = (now: number) => {
            const elapsed = now - startTime
            const progress = Math.min(elapsed / duration, 1)
            const eased = 1 - Math.pow(1 - progress, 3)
            setMerchantScore(Math.round(eased * target))
            if (progress < 1) {
                rafId = requestAnimationFrame(animate)
            }
        }
        rafId = requestAnimationFrame(animate)
        return () => cancelAnimationFrame(rafId)
    }, [merchantCardVisible])

    // GSAP ScrollTrigger animations for all non-hero sections
    useScrollAnimations()

    const flywheelCards = [
        { num: '01', title: 'Payments generate data', desc: 'Every x402 transaction creates verifiable, on-chain payment history that no bank or credit bureau can replicate.', color: '#2CFF05', hoverBg: '#0a2d05' },
        { num: '02', title: 'Data unlocks credit', desc: 'FairScale scores — built from live revenue data — enable access to structured credit pools without collateral.', color: '#00FFF0', hoverBg: '#052d2a' },
        { num: '03', title: 'Credit grows business', desc: 'Working capital funds inventory, expansion, and new markets. Businesses grow faster with programmatic access to capital.', color: '#FF2A55', hoverBg: '#2d0515' },
        { num: '04', title: 'Growth fuels payments', desc: 'Larger businesses process more volume through Krexa, feeding the credit engine and restarting the cycle.', color: '#FF5C00', hoverBg: '#2d1505' },
    ]

    const problemSlides = [
        {
            cardTitle: 'Traditional Finance',
            cardDetail: '65% of global SMEs cannot access formal credit. Banks demand collateral, physical presence, and 4–6 week review cycles. Productive businesses are locked out.',
            icon: <AnimatedCoinStackIcon size={120} />,
            headline: 'Legacy credit',
            desc: 'Collateral-based systems exclude productive businesses from capital markets.',
        },
        {
            cardTitle: 'DeFi Lending Today',
            cardDetail: 'Overcollateralized protocols cannot evaluate real businesses. 150% collateral requirements make DeFi credit pointless for working capital.',
            icon: <AnimatedVaultIcon size={120} />,
            headline: 'Broken DeFi',
            desc: 'Current protocols ignore real-world productivity and cash flow entirely.',
        },
        {
            cardTitle: 'No Enforcement Layer',
            cardDetail: 'Capital pools exist. Borrowers exist. But there is no mechanism to verify revenue, route repayment from cash flow, or enforce terms without courts.',
            icon: <AnimatedLockIcon size={120} />,
            headline: 'Missing infrastructure',
            desc: 'Capital cannot follow commerce — no protocol routes repayment from revenue.',
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
                            <button className={styles.primaryBtn} onClick={() => navigate('/app/vaults')}>
                                <span>Launch App</span>
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </button>
                        </NoiseBackground>
                        <button className={styles.secondaryBtn} onClick={() => setShowWaitlist(true)}>
                            <span>Join Waitlist</span>
                        </button>
                    </div>

                    {/* ── Waitlist Modal ── */}
                    {showWaitlist && (
                        <div className={styles.waitlistBackdrop} onClick={() => { if (!waitlistLoading) setShowWaitlist(false) }}>
                            <div className={styles.waitlistModal} onClick={e => e.stopPropagation()}>
                                <button className={styles.waitlistClose} onClick={() => setShowWaitlist(false)} aria-label="Close">✕</button>
                                {waitlistDone ? (
                                    <div className={styles.waitlistSuccess}>
                                        <div className={styles.waitlistSuccessIcon}>✓</div>
                                        <h3>You're on the list!</h3>
                                        <p>We'll reach out when early access opens.</p>
                                        <button className={styles.waitlistDoneBtn} onClick={() => setShowWaitlist(false)}>Close</button>
                                    </div>
                                ) : (
                                    <>
                                        <h3 className={styles.waitlistTitle}>Get Early Access</h3>
                                        <p className={styles.waitlistSubtitle}>Be first when Krexa launches. No spam, ever.</p>
                                        {waitlistError && <p className={styles.waitlistError}>{waitlistError}</p>}
                                        <form className={styles.waitlistForm} onSubmit={async (e) => {
                                            e.preventDefault()
                                            if (!waitlistEmail.trim()) return
                                            setWaitlistLoading(true)
                                            setWaitlistError('')
                                            try {
                                                await waitlistApi.join(waitlistEmail.trim())
                                                setWaitlistDone(true)
                                            } catch (err: unknown) {
                                                const msg = (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.message
                                                    || (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.error
                                                    || 'Something went wrong. Try again.'
                                                setWaitlistError(msg)
                                            } finally {
                                                setWaitlistLoading(false)
                                            }
                                        }}>
                                            <input
                                                type="email"
                                                className={styles.waitlistInput}
                                                placeholder="your@email.com"
                                                value={waitlistEmail}
                                                onChange={e => setWaitlistEmail(e.target.value)}
                                                required
                                                autoFocus
                                            />
                                            <button
                                                type="submit"
                                                className={styles.waitlistSubmit}
                                                disabled={waitlistLoading || !waitlistEmail.trim()}
                                            >
                                                {waitlistLoading ? 'Joining...' : 'Join Waitlist'}
                                            </button>
                                        </form>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

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
                        <span className={styles.cinematicLabel}>Krexa powers DeFi Credit</span>
                        <p className={styles.cinematicHeadline}>
                            From structured vaults to instant settlements — <span className={styles.cinematicAccent}>Krexa is building the future of on-chain credit.</span>
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
                        <p className={styles.problemDesc}>
                            $65 trillion in global SME credit demand goes unmet every year. Legacy banks require
                            collateral. DeFi ignores revenue. Neither can underwrite a real business.
                        </p>
                    </div>

                    <div className={styles.problemShowcase}>
                        <ProblemBackground activeProblem={activeProblem} className={styles.problemBg} />
                        <div className={styles.showcaseStage}>
                            {problemSlides.map((slide, i) => (
                                <div
                                    key={i}
                                    className={`${styles.showcaseCard} ${
                                        activeProblem === i ? styles.showcaseCardActive :
                                        activeProblem === (i + 1) % problemSlides.length ? styles.showcaseCardPrev :
                                        styles.showcaseCardNext
                                    }`}
                                >
                                    <div className={styles.showcaseCardPixel}>
                                        {slide.icon}
                                    </div>
                                    <h3 className={styles.showcaseCardTitle}>{slide.cardTitle}</h3>
                                    <p className={styles.showcaseCardDesc}>{slide.cardDetail}</p>
                                </div>
                            ))}
                        </div>
                        <div className={styles.showcaseDots}>
                            {problemSlides.map((_, i) => (
                                <button
                                    key={i}
                                    className={`${styles.showcaseDot} ${activeProblem === i ? styles.showcaseDotActive : ''}`}
                                    onClick={() => setActiveProblem(i)}
                                />
                            ))}
                        </div>
                    </div>
                    <p className={styles.problemCallout}>
                        Krexa solves this with a single primitive: <strong>revenue-backed, programmable credit.</strong>
                    </p>
                </div>
            </section>

            {/* ── How It Works — 1inch-style Horizontal Card Carousel ── */}
            <section className={styles.hiwSection} id="how-it-works">
                <div className={styles.hiwInner}>
                    <div className={styles.hiwHeading}>
                        <span className={styles.sectionLabel}>How It Works</span>
                        <h2 className={styles.sectionTitle}>Five primitives. <span className={styles.gradientInline}>One protocol.</span></h2>
                        <p className={styles.hiwSubtitle}>Route. Score. Borrow. Fund. Repay. Everything on-chain.</p>
                    </div>
                    <div data-anim="hiw-track" className={styles.hiwTrack}>
                        <div className={styles.hiwCard} style={{ background: '#2CFF05' }}>
                            <span className={styles.hiwStep}>01</span>
                            <span className={styles.hiwBadge}>Payment Routing</span>
                            <h3 className={styles.hiwCardTitle}>Route payments through Krexa</h3>
                            <p className={styles.hiwCardDesc}>Businesses bill customers using Krexa x402 payment endpoints. Customers pay via local rails or stablecoins. Every transaction is recorded on-chain as verifiable payment history.</p>
                            <div className={styles.hiwCardDetail}><span>Supports USDC, local bank rails, and card payments via on-ramp partners.</span></div>
                            <button className={styles.hiwCardBtn} onClick={() => navigate('/merchant')}>Learn More</button>
                        </div>
                        <div className={styles.hiwCard} style={{ background: '#00FFF0' }}>
                            <span className={styles.hiwStep}>02</span>
                            <span className={styles.hiwBadge}>Financial Identity</span>
                            <h3 className={styles.hiwCardTitle}>Build a live credit profile</h3>
                            <p className={styles.hiwCardDesc}>Transaction behaviour builds a live credit profile — revenue consistency, volume, frequency, counterparty diversity. Your FairScale score updates with every payment, not once a year.</p>
                            <div className={styles.hiwCardDetail}><span>FairScale scores range 0–1000 across four credit tiers: A, B, C, D.</span></div>
                            <button className={styles.hiwCardBtn} onClick={() => navigate('/merchant')}>Learn More</button>
                        </div>
                        <div className={styles.hiwCard} style={{ background: '#FFD700' }}>
                            <span className={styles.hiwStep}>03</span>
                            <span className={styles.hiwBadge}>Capital Advance</span>
                            <h3 className={styles.hiwCardTitle}>Access working capital instantly</h3>
                            <p className={styles.hiwCardDesc}>Request working capital, invoice financing, or trade finance against your receivables. Typical cost: ~2% monthly. No collateral needed — your revenue history is the collateral.</p>
                            <div className={styles.hiwCardDetail}><span>Loan terms from 3–12 months. Structured vault with milestone-gated tranches.</span></div>
                            <button className={styles.hiwCardBtn} onClick={() => navigate('/vaults')}>Learn More</button>
                        </div>
                        <div className={styles.hiwCard} style={{ background: '#FF2A55' }}>
                            <span className={`${styles.hiwStep} ${styles.hiwStepLight}`}>04</span>
                            <span className={`${styles.hiwBadge} ${styles.hiwBadgeLight}`}>Liquidity Funding</span>
                            <h3 className={`${styles.hiwCardTitle} ${styles.hiwCardTitleLight}`}>Fund through structured tranches</h3>
                            <p className={`${styles.hiwCardDesc} ${styles.hiwCardDescLight}`}>On-chain vaults fund loans via structured tranches — senior lenders get priority repayment, liquidity pools provide stable backing, and community investors earn higher yield at higher risk.</p>
                            <div className={`${styles.hiwCardDetail} ${styles.hiwCardDetailLight}`}><span>Waterfall distribution: Senior &rarr; Pool &rarr; Community &rarr; Merchant.</span></div>
                            <button className={styles.hiwCardBtn} onClick={() => navigate('/pools')}>Learn More</button>
                        </div>
                        <div className={styles.hiwCard} style={{ background: '#FFFFFF' }}>
                            <span className={styles.hiwStep}>05</span>
                            <span className={styles.hiwBadge}>Automated Repayment</span>
                            <h3 className={styles.hiwCardTitle}>Repayment happens automatically</h3>
                            <p className={styles.hiwCardDesc}>Incoming payments auto-split: lender repayment first, remaining balance to the merchant. No manual installments, no missed payments. Late fees are calculated and enforced on-chain.</p>
                            <div className={styles.hiwCardDetail}><span>x402 settlement splits enforce repayment at the protocol layer.</span></div>
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
                            Each vault is funded through three layers of capital. When revenue flows in,
                            repayment cascades top-down — senior lenders are paid first, then liquidity pools,
                            then community investors. The merchant receives surplus only after all obligations are met.
                        </p>
                    </div>
                    <WaterfallFlow />
                </div>
            </section>

            {/* ── For Investors ── */}
            <section className={`${styles.forUsers} ${styles.dividerBottom} ${styles.dividerToPurple}`} id="for-users">
                <InvestorBackground className={styles.investorBg} />
                <div className={styles.sectionContainer}>
                    <div className={styles.splitSection}>
                        <div data-anim="forusers-content" className={styles.splitContent}>
                            <span className={styles.sectionLabel}>For Investors</span>
                            <h2 className={styles.splitTitle}>Earn yield from <span className={styles.gradientInline}>real revenue</span></h2>
                            <p className={styles.splitDesc}>
                                Fund merchant vaults and earn returns backed by actual business cash flow.
                                Repayment is enforced by the protocol at the smart-contract level — not by
                                borrower goodwill, not by legal process.
                            </p>
                            <ul className={styles.featureList}>
                                <li><span className={styles.checkIcon}>✓</span> Structured tranches — choose your risk/return profile</li>
                                <li><span className={styles.checkIcon}>✓</span> Waterfall protection — senior tranche is always paid first</li>
                                <li><span className={styles.checkIcon}>✓</span> Continuous yield from x402 payment stream, not periodic coupons</li>
                                <li><span className={styles.checkIcon}>✓</span> Full transparency — every repayment auditable on BaseScan</li>
                            </ul>
                            <button className={styles.outlineBtn} onClick={() => navigate('/app/vaults')}>
                                Browse Vaults
                            </button>
                        </div>

                        <div data-anim="forusers-visual" className={styles.splitVisual}>
                            <div ref={investorCardRef} className={`${styles.visualCard} ${investorCardVisible ? styles.visualCardAnimated : ''}`}>
                                <div className={styles.shimmerOverlay} />
                                <div className={styles.visualCardHeader}>
                                    <span>Portfolio Overview</span>
                                    <span className={styles.visualBadge}>
                                        <span className={styles.liveDot} />
                                        Live
                                    </span>
                                </div>
                                <div className={styles.visualStat}>
                                    <span className={styles.visualStatValue}>
                                        <InvestorCounter visible={investorCardVisible} end={24500} prefix="$" duration={1800} />
                                    </span>
                                    <span className={styles.visualStatLabel}>Total Invested</span>
                                </div>
                                <div className={styles.visualRow}>
                                    <div>
                                        <span className={styles.visualSmallValue}>
                                            <InvestorCounter visible={investorCardVisible} end={2847} prefix="$" duration={1600} />
                                        </span>
                                        <span className={styles.visualSmallLabel}>Returns Earned</span>
                                    </div>
                                    <div>
                                        <span className={styles.visualSmallValue}>
                                            <InvestorCounter visible={investorCardVisible} end={11.6} prefix="+" suffix="%" decimals={1} duration={1400} />
                                        </span>
                                        <span className={styles.visualSmallLabel}>Blended APY</span>
                                    </div>
                                </div>
                                <div className={styles.visualBar}>
                                    <div className={styles.visualBarFill} style={{ width: investorCardVisible ? '73%' : '0%' }} />
                                </div>
                                <div className={styles.visualDivider} />
                                <div className={styles.visualRow}>
                                    <div>
                                        <span className={styles.visualSmallValue}>
                                            <InvestorCounter visible={investorCardVisible} end={3} duration={800} />
                                        </span>
                                        <span className={styles.visualSmallLabel}>Active Vaults</span>
                                    </div>
                                    <div>
                                        <span className={styles.visualSmallValue}>Senior</span>
                                        <span className={styles.visualSmallLabel}>Primary Tranche</span>
                                    </div>
                                </div>
                                <div className={styles.visualRow}>
                                    <div>
                                        <span className={styles.visualSmallValue}>
                                            <InvestorCounter visible={investorCardVisible} end={18200} prefix="$" duration={1600} />
                                        </span>
                                        <span className={styles.visualSmallLabel}>Principal Remaining</span>
                                    </div>
                                    <div>
                                        <span className={styles.visualSmallValue}>
                                            <InvestorCounter visible={investorCardVisible} end={42} suffix=" days" duration={1200} />
                                        </span>
                                        <span className={styles.visualSmallLabel}>Avg. Maturity</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── For Merchants ── */}
            <section className={`${styles.forMerchants} ${styles.dividerBottom} ${styles.dividerToDark}`} id="for-merchants">
                <MerchantBackground className={styles.merchantBg} />
                <div className={styles.sectionContainer}>
                    <div className={`${styles.splitSection} ${styles.splitReverse}`}>
                        <div data-anim="formerchants-content" className={styles.splitContent}>
                            <span className={styles.sectionLabel}>For Merchants</span>
                            <h2 className={styles.splitTitle}>Stream capital as you <span className={styles.gradientInline}>perform</span></h2>
                            <p className={styles.splitDesc}>
                                Bill through Krexa x402 endpoints. Your payment history becomes your credit score
                                in real-time. Access working capital, invoice financing, or trade finance — up to 12 months,
                                with rates that improve as your FairScale score grows.
                            </p>
                            <ul className={styles.featureList}>
                                <li><span className={styles.checkIcon}>✓</span> x402 payment endpoints — plug into any billing system via API</li>
                                <li><span className={styles.checkIcon}>✓</span> No collateral required — credit scored purely by revenue flow</li>
                                <li><span className={styles.checkIcon}>✓</span> Auto-repayment from incoming payments — no manual installments</li>
                                <li><span className={styles.checkIcon}>✓</span> Better rates as your FairScale score improves over time</li>
                            </ul>
                            <button className={styles.outlineBtn} onClick={() => navigate('/app/merchant')}>
                                Apply for Funding
                            </button>
                        </div>

                        <div data-anim="formerchants-visual" className={styles.splitVisual}>
                            <div ref={merchantCardRef} className={`${styles.visualCard} ${merchantCardVisible ? styles.merchantCardAnimated : ''}`}>
                                <div className={styles.merchantCardScanline} />
                                <div className={styles.visualCardHeader}>
                                    <span>Merchant Profile</span>
                                    <span className={`${styles.visualBadgeGreen} ${merchantCardVisible ? styles.badgePopIn : ''}`}>Excellent</span>
                                </div>
                                <div className={styles.creditScore}>
                                    <div className={`${styles.creditRingGlow} ${merchantCardVisible ? styles.creditRingGlowActive : ''}`} />
                                    <span className={styles.creditValue}>{merchantScore}</span>
                                    <svg className={styles.creditRing} viewBox="0 0 100 100">
                                        <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
                                        <circle cx="50" cy="50" r="45" fill="none" stroke="#FFFFFF" strokeWidth="8" strokeDasharray="220" strokeDashoffset={merchantCardVisible ? 50 : 220} strokeLinecap="round" transform="rotate(-90 50 50)" className={styles.creditRingProgress} />
                                    </svg>
                                </div>
                                <div className={styles.creditDetails}>
                                    {[
                                        { label: 'FairScale Score', value: 'Tier A' },
                                        { label: 'Revenue Consistency', value: '98%' },
                                        { label: 'x402 Payments Processed', value: '1,247' },
                                        { label: 'Total Capital Accessed', value: '$185,000' },
                                        { label: 'Current Repayment Rate', value: '100%' },
                                        { label: 'Active Vault', value: '1 of 2' },
                                    ].map((row, i) => (
                                        <div
                                            key={i}
                                            className={`${styles.creditDetailRow} ${merchantCardVisible ? styles.creditDetailRowVisible : ''}`}
                                            style={{ transitionDelay: merchantCardVisible ? `${0.6 + i * 0.1}s` : '0s' }}
                                        >
                                            <span>{row.label}</span><span>{row.value}</span>
                                        </div>
                                    ))}
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
                        <h2 className={styles.sectionTitle}>Every payment builds the next loan.</h2>
                        <p className={styles.flywheelSubtext}>
                            Payments generate data. Data unlocks credit. Credit grows revenue. Revenue drives more payments. The loop never stops.
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
                                easing="linear"
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
                                Blockchain removes every failure point that makes traditional credit inaccessible —
                                geographic restrictions, opaque intermediaries, manual enforcement, and stale data.
                                Krexa turns these into protocol-level guarantees.
                            </p>
                            <ul className={styles.stepsList}>
                                <li className={styles.stepsListItem}>
                                    <span className={styles.stepsListNum}>01</span>
                                    <div>
                                        <strong>Global liquidity access</strong>
                                        <span className={styles.stepsListSub}>Any lender, anywhere in the world, can fund productive businesses.</span>
                                    </div>
                                </li>
                                <li className={styles.stepsListItem}>
                                    <span className={styles.stepsListNum}>02</span>
                                    <div>
                                        <strong>Full auditability</strong>
                                        <span className={styles.stepsListSub}>Every transaction, repayment, and distribution is verifiable on-chain.</span>
                                    </div>
                                </li>
                                <li className={styles.stepsListItem}>
                                    <span className={styles.stepsListNum}>03</span>
                                    <div>
                                        <strong>Programmatic enforcement</strong>
                                        <span className={styles.stepsListSub}>Repayment is enforced by smart contracts, not courts or legal process.</span>
                                    </div>
                                </li>
                                <li className={styles.stepsListItem}>
                                    <span className={styles.stepsListNum}>04</span>
                                    <div>
                                        <strong>Real-time underwriting</strong>
                                        <span className={styles.stepsListSub}>Credit profiles update from live payment data — not annual reviews.</span>
                                    </div>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Footer — 1inch-style ── */}
            <footer className={styles.footer}>
                <div className={styles.footerTop}>
                    <div className={styles.footerBrand}>
                        <img src="/images/logo.png" alt="Krexa" className={styles.footerLogoImg} />
                        <span className={styles.footerLogo}>Krexa</span>
                    </div>
                    <div className={styles.footerColumns}>
                        <div className={styles.footerCol}>
                            <h4>Products</h4>
                            <a href="/vaults">Vaults</a>
                            <a href="/pools">Liquidity Pools</a>
                            <a href="/portfolio">Portfolio</a>
                            <a href="/merchant">Merchant Dashboard</a>
                            <a href="/x402">x402 Payments</a>
                        </div>
                        <div className={styles.footerCol}>
                            <h4>Company</h4>
                            <a href="#">About</a>
                            <a href="#">Blog</a>
                            <a href="#">Careers</a>
                            <a href="#">Security</a>
                        </div>
                        <div className={styles.footerCol}>
                            <h4>Resources</h4>
                            <a href="#">Documentation</a>
                            <a href="#">Litepaper</a>
                            <a href="#">Help Center</a>
                            <a href="#">Suggest a Feature</a>
                        </div>
                        <div className={styles.footerCol}>
                            <h4>Network</h4>
                            <a href="#">Base Sepolia</a>
                            <a href="#">BaseScan</a>
                            <a href="#">Governance</a>
                        </div>
                    </div>
                </div>
                <div className={styles.footerDivider} />
                <div className={styles.footerBottomRow}>
                    <div className={styles.footerSocials}>
                        <a href="https://github.com/Yatharth4599/TCredit" target="_blank" rel="noopener" aria-label="GitHub">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                        </a>
                        <a href="https://x.com/tigerbnkHQ" target="_blank" rel="noopener" aria-label="Twitter">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                        </a>
                        <a href="#" aria-label="Discord">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/></svg>
                        </a>
                        <a href="https://t.me/tigerpayx" target="_blank" rel="noopener" aria-label="Telegram">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                        </a>
                    </div>
                    <div className={styles.footerLegal}>
                        <a href="#">Terms of Use</a>
                        <a href="#">Privacy Policy</a>
                        <span className={styles.footerBuilt}>Built on Base</span>
                    </div>
                </div>
            </footer>
        </div>
    )
}
