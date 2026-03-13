import { useNavigate } from 'react-router-dom'
import { useEffect, useState, useRef } from 'react'
import { vaultsApi, waitlistApi } from '../api/client'
import { formatUSDCCompact } from '../lib/format'
import { AnimatedNumber } from '../components/ui/AnimatedNumber'
import DecryptedText from '../components/ui/DecryptedText'
import NoiseBackground from '../components/ui/NoiseBackground'
import RevenueRoutingNode from '../components/ui/RevenueRoutingNode'
import type { ApiVault } from '../api/types'

import styles from './Home.module.css'

// ── Vault state badge helpers ─────────────────────────────────────────────────
const STATE_COLOR: Record<string, string> = {
    fundraising: '#f59e0b',
    active:      '#22c55e',
    repaying:    '#3b82f6',
    completed:   '#6b7280',
    defaulted:   '#ef4444',
    cancelled:   '#6b7280',
}

function VaultMiniCard({ vault }: { vault: ApiVault }) {
    const navigate = useNavigate()
    const pct = Math.min(vault.percentFunded, 100)
    const color = STATE_COLOR[vault.state] ?? '#6b7280'
    const shortAddr = `${vault.address.slice(0, 6)}…${vault.address.slice(-4)}`
    return (
        <button className={styles.vaultCard} onClick={() => navigate(`/app/vaults/${vault.address}`)}>
            <div className={styles.vaultCardHeader}>
                <span className={styles.vaultAddr}>{shortAddr}</span>
                <span className={styles.vaultBadge} style={{ color, borderColor: `${color}44`, background: `${color}11` }}>
                    {vault.state}
                </span>
            </div>
            <div className={styles.vaultTarget}>{formatUSDCCompact(vault.targetAmount)}</div>
            <div className={styles.vaultMeta}>
                {vault.interestRate.toFixed(1)}% APY &middot; {vault.numTranches} tranches &middot; {vault.durationMonths}mo
            </div>
            <div className={styles.vaultBarWrap}>
                <div className={styles.vaultBarFill} style={{ width: `${pct}%`, background: color }} />
            </div>
            <div className={styles.vaultPct}>{pct.toFixed(0)}% funded</div>
        </button>
    )
}

export default function Home() {
    const navigate = useNavigate()
    const [mounted, setMounted] = useState(false)
    const [vaults, setVaults] = useState<ApiVault[]>([])
    const [showWaitlist, setShowWaitlist] = useState(false)
    const [waitlistEmail, setWaitlistEmail] = useState('')
    const [waitlistLoading, setWaitlistLoading] = useState(false)
    const [waitlistDone, setWaitlistDone] = useState(false)
    const [waitlistError, setWaitlistError] = useState('')

    // Ticker offset for the stats bar
    const tickerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        setMounted(true)
        vaultsApi.list().then(({ data }) => setVaults(data.vaults.slice(0, 6))).catch(() => {})
    }, [])

    // Mocked aspirational hero stats (live stats used for vault cards below)
    const heroStats = { tvl: 2_400_000, liquidity: 1_800_000, vaults: 47, agents: 128 }
    const fmt     = (v: number) => v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(0)}K` : `$${v.toFixed(0)}`

    return (
        <div className={styles.home}>

            {/* ══════════════════════════════════════════════════════════
                SECTION 1 — HERO  +  REVENUE ROUTING NODE
                ══════════════════════════════════════════════════════════ */}
            <section className={styles.hero} id="hero">
                {/* subtle radial glow */}
                <div className={styles.heroBg} />

                <div className={`${styles.heroInner} ${mounted ? styles.heroReady : ''}`}>
                    {/* ── Left: text ── */}
                    <div className={styles.heroText}>
                        <span className={styles.overline}>The Programmable Credit Network</span>

                        <h1 className={styles.headline}>
                            <span className={styles.headlineLine}>
                                <DecryptedText
                                    text="Turn Agent Revenue"
                                    parentClassName={styles.decryptedWord}
                                    encryptedClassName={styles.encryptedChar}
                                    animateOn="view"
                                    speed={40}
                                    maxIterations={40}
                                    sequential
                                    revealDirection="start"
                                />
                            </span>
                            <span className={`${styles.headlineLine} ${styles.headlineGradient}`}>
                                <DecryptedText
                                    text="Into On-Chain Credit"
                                    parentClassName={styles.decryptedGradient}
                                    encryptedClassName={styles.encryptedChar}
                                    animateOn="view"
                                    speed={40}
                                    maxIterations={40}
                                    sequential
                                    revealDirection="start"
                                />
                            </span>
                        </h1>

                        <p className={styles.subtitle}>
                            AI agents earn revenue. Krexa routes, splits, and lends against that revenue — automatically, on-chain.{' '}
                            <span className={styles.subtitleAccent}>
                                When revenue is programmable, credit becomes inevitable.
                            </span>
                        </p>

                        <div className={styles.heroCta}>
                            <NoiseBackground gradientColors={['#2563EB', '#1D4ED8', '#3B82F6']}>
                                <button className={styles.primaryBtn} onClick={() => navigate('/app/vaults')}>
                                    Launch App
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                        <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </button>
                            </NoiseBackground>
                            <button className={styles.secondaryBtn} onClick={() => setShowWaitlist(true)}>
                                Join Waitlist
                            </button>
                        </div>

                        {/* Hero mini-stats */}
                        <div className={styles.heroStats}>
                            <div className={styles.heroStat}>
                                <AnimatedNumber value={heroStats.tvl} format={fmt} className={styles.heroStatVal} />
                                <span className={styles.heroStatLabel}>TVL</span>
                            </div>
                            <div className={styles.heroStatDiv} />
                            <div className={styles.heroStat}>
                                <AnimatedNumber value={heroStats.liquidity} format={fmt} className={styles.heroStatVal} />
                                <span className={styles.heroStatLabel}>Pool Liquidity</span>
                            </div>
                            <div className={styles.heroStatDiv} />
                            <div className={styles.heroStat}>
                                <AnimatedNumber value={heroStats.vaults} decimals={0} className={styles.heroStatVal} />
                                <span className={styles.heroStatLabel}>Active Vaults</span>
                            </div>
                            <div className={styles.heroStatDiv} />
                            <div className={styles.heroStat}>
                                <AnimatedNumber value={heroStats.agents} decimals={0} className={styles.heroStatVal} />
                                <span className={styles.heroStatLabel}>Agents Onboarded</span>
                            </div>
                        </div>
                    </div>

                    {/* ── Right: animated node ── */}
                    <div className={styles.heroNode}>
                        <RevenueRoutingNode className={styles.nodesvg} />
                        <p className={styles.nodeCaption}>The autonomous credit lifecycle</p>
                    </div>
                </div>

                {/* Scroll indicator */}
                <div className={`${styles.scrollIndicator} ${mounted ? styles.scrollVisible : ''}`}>
                    <div className={styles.scrollLine} />
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════════
                SECTION 2 — LIVE STATS TICKER BAR
                ══════════════════════════════════════════════════════════ */}
            <div className={styles.statsBar}>
                <div className={styles.statsBarInner} ref={tickerRef}>
                    {[
                        { label: 'TVL',            val: heroStats.tvl,       fmt },
                        { label: 'Agents',         val: heroStats.agents,    fmt: (v: number) => v.toFixed(0) },
                        { label: 'Active Vaults',  val: heroStats.vaults,    fmt: (v: number) => v.toFixed(0) },
                        { label: 'Protocol',       val: 0, fmt: () => 'x402'        },
                        { label: 'Network',        val: 0, fmt: () => 'Solana'      },
                        { label: 'Avg APY',        val: 12.5, fmt: (v: number) => `${v.toFixed(1)}%` },
                    ].map((item, i) => (
                        <span key={i} className={styles.statsBarItem}>
                            <span className={styles.statsBarLabel}>{item.label}</span>
                            <span className={styles.statsBarVal}>{item.fmt(item.val)}</span>
                            <span className={styles.statsBarSep}>·</span>
                        </span>
                    ))}
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════
                SECTION 3 — HOW IT WORKS (4 steps)
                ══════════════════════════════════════════════════════════ */}
            <section className={styles.hiwSection} id="how-it-works">
                <div className={styles.sectionContainer}>
                    <div className={styles.sectionHeader}>
                        <span className={styles.sectionLabel}>How It Works</span>
                        <h2 className={styles.sectionTitle}>How the <span className={styles.gradientInline}>agent credit lifecycle</span> works</h2>
                    </div>

                    <div className={styles.stepsGrid}>
                        {[
                            {
                                step: '01',
                                title: 'Agents earn via x402',
                                desc:  'AI agents monetize APIs, tasks, and services. Every payment flows through Krexa\'s PaymentRouter — oracle-signed, nonce-protected, settled on Solana in under 1 second.',
                                color: '#3B82F6',
                                icon: (
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                        <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
                                    </svg>
                                ),
                            },
                            {
                                step: '02',
                                title: 'Credit score builds automatically',
                                desc:  'Payment history creates a real-time on-chain credit score. FairScale 0–1000, Tiers A–D. No applications, no credit bureaus — your revenue consistency is the underwriting signal.',
                                color: '#06B6D4',
                                icon: (
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                        <path d="M3 20h18" /><path d="M5 20V10" /><path d="M9 20V4" /><path d="M13 20V14" /><path d="M17 20V8" />
                                    </svg>
                                ),
                            },
                            {
                                step: '03',
                                title: 'Revenue-backed credit line',
                                desc:  'Tier A/B/C agents unlock structured credit vaults. Capital comes from Senior pools, LP pools, and community investors — all on-chain, all transparent.',
                                color: '#8B5CF6',
                                icon: (
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                        <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                    </svg>
                                ),
                            },
                            {
                                step: '04',
                                title: 'Automatic waterfall repayment',
                                desc:  'Every incoming payment auto-splits on-chain: Platform Fee → Senior → Pool → Community → Agent. No manual payments. No collections. Enforced by smart contract.',
                                color: '#10B981',
                                icon: (
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                        <path d="M4 4v5h5M20 20v-5h-5" /><path d="M20.49 9A9 9 0 0 0 5.64 5.64L4 4m16 16l-1.64-1.64A9 9 0 0 1 3.51 15" />
                                    </svg>
                                ),
                            },
                        ].map((s, i) => (
                            <div key={i} className={styles.stepCard} style={{ '--step-color': s.color } as React.CSSProperties}>
                                <div className={styles.stepIconWrap} style={{ color: s.color }}>
                                    {s.icon}
                                </div>
                                <span className={styles.stepNum}>{s.step}</span>
                                <h3 className={styles.stepTitle}>{s.title}</h3>
                                <p className={styles.stepDesc}>{s.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════════
                SECTION 4 — LIVE VAULTS PREVIEW
                ══════════════════════════════════════════════════════════ */}
            <section className={styles.vaultsSection} id="vaults">
                <div className={styles.sectionContainer}>
                    <div className={styles.vaultsSectionHeader}>
                        <div>
                            <span className={styles.sectionLabel}>Live Vaults</span>
                            <h2 className={styles.sectionTitle}>On-chain credit in <span className={styles.gradientInline}>real time</span></h2>
                        </div>
                        <button className={styles.viewAllBtn} onClick={() => navigate('/app/vaults')}>
                            View All Vaults →
                        </button>
                    </div>

                    {vaults.length === 0 ? (
                        <div className={styles.vaultsEmpty}>Loading vaults…</div>
                    ) : (
                        <div className={styles.vaultsGrid}>
                            {vaults.map(v => <VaultMiniCard key={v.address} vault={v} />)}
                        </div>
                    )}
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════════
                SECTION 5 — WHY KREXA COMPARISON TABLE
                ══════════════════════════════════════════════════════════ */}
            <section className={styles.compareSection} id="why-krexa">
                <div className={styles.sectionContainer}>
                    <div className={styles.sectionHeader}>
                        <span className={styles.sectionLabel}>Why Krexa</span>
                        <h2 className={styles.sectionTitle}>Why AI agents need a <span className={styles.gradientInline}>new credit layer</span></h2>
                    </div>

                    <div className={styles.compareTable}>
                        {/* Header row */}
                        <div className={styles.compareRow + ' ' + styles.compareHeader}>
                            <span />
                            <span className={styles.compareColLabel}>Traditional Banks</span>
                            <span className={styles.compareColLabel}>DeFi (Aave, etc.)</span>
                            <span className={`${styles.compareColLabel} ${styles.compareColKrexa}`}>Krexa</span>
                        </div>

                        {[
                            { feature: 'Agent-compatible',        bank: 'No (requires KYC)',        defi: 'Partial (collateral only)', krexa: 'Yes — x402-native' },
                            { feature: 'Collateral required',     bank: 'Physical assets',          defi: '150%+ overcollat.',         krexa: 'Revenue history only' },
                            { feature: 'Credit assessment',       bank: 'Annual review, paperwork', defi: 'None (purely collateral)',   krexa: 'Real-time FairScale score' },
                            { feature: 'Repayment enforcement',   bank: 'Legal process',            defi: 'Liquidation',               krexa: 'Smart contract auto-split' },
                            { feature: 'Settlement speed',        bank: '4–6 weeks',                defi: 'Instant, but risky',        krexa: 'Instant, enforceable' },
                            { feature: 'Transparency',            bank: 'Opaque',                   defi: 'On-chain',                  krexa: 'Fully on-chain + verifiable' },
                        ].map((row, i) => (
                            <div key={i} className={styles.compareRow}>
                                <span className={styles.compareFeature}>{row.feature}</span>
                                <span className={styles.compareCell + ' ' + styles.compareNeg}>{row.bank}</span>
                                <span className={styles.compareCell + ' ' + styles.compareMid}>{row.defi}</span>
                                <span className={styles.compareCell + ' ' + styles.comparePos}>{row.krexa}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════════
                SECTION 6 — CTA FOOTER BAND
                ══════════════════════════════════════════════════════════ */}
            <section className={styles.ctaBand}>
                <div className={styles.ctaBandInner}>
                    <h2 className={styles.ctaTitle}>The credit layer for the agent economy</h2>
                    <p className={styles.ctaSubtitle}>
                        Whether you're building AI agents that need capital or seeking yield from real agent revenue —
                        Krexa is the protocol where repayment is enforced by code, not courts.
                    </p>
                    <div className={styles.ctaActions}>
                        <NoiseBackground gradientColors={['#2563EB', '#1D4ED8', '#3B82F6']}>
                            <button className={styles.primaryBtn} onClick={() => navigate('/app/vaults')}>
                                Launch App
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </button>
                        </NoiseBackground>
                        <button className={styles.secondaryBtn} onClick={() => setShowWaitlist(true)}>
                            Join Waitlist
                        </button>
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════════
                FOOTER
                ══════════════════════════════════════════════════════════ */}
            <footer className={styles.footer}>
                <div className={styles.footerTop}>
                    <div className={styles.footerBrand}>
                        <img src="/images/logo.png" alt="Krexa" className={styles.footerLogoImg} />
                        <span className={styles.footerLogo}>Krexa</span>
                    </div>
                    <div className={styles.footerColumns}>
                        <div className={styles.footerCol}>
                            <h4>Products</h4>
                            <a href="/app/vaults">Vaults</a>
                            <a href="/app/pools">Liquidity Pools</a>
                            <a href="/app/portfolio">Portfolio</a>
                            <a href="/app/merchant">Merchant Dashboard</a>
                            <a href="/app/x402">x402 Payments</a>
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
                            <a href="https://solscan.io/?cluster=devnet" target="_blank" rel="noopener noreferrer">Solana Devnet</a>
                            <a href="https://solscan.io" target="_blank" rel="noopener noreferrer">Solscan</a>
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
                        <span className={styles.footerBuilt}>Built on Solana</span>
                    </div>
                </div>
            </footer>

            {/* ══════════════════════════════════════════════════════════
                WAITLIST MODAL
                ══════════════════════════════════════════════════════════ */}
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
        </div>
    )
}
