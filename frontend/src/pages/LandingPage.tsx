import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { AnimatedNumber } from '../components/ui/AnimatedNumber'
import { waitlistApi } from '../api/client'
import styles from './LandingPage.module.css'

// ─── Animation variants ───────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
}

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
}

// ─── Reusable waitlist form ───────────────────────────────────────────────────

function WaitlistForm({ dark = false }: { dark?: boolean }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const submit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError('')
    try {
      await waitlistApi.join(email.trim())
      setDone(true)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.message ||
        (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.error ||
        'Something went wrong. Try again.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [email])

  if (done) {
    return (
      <div className={styles.waitlistSuccess}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        You're on the list!
      </div>
    )
  }

  return (
    <form onSubmit={submit} className={styles.waitlistWrap}>
      <div className={dark ? styles.ctaWaitlistBox : styles.waitlistBox}>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Enter your email"
          required
          className={dark ? styles.ctaInput : styles.waitlistInput}
        />
        <button
          type="submit"
          disabled={loading || !email.trim()}
          className={styles.waitlistBtn}
        >
          {loading ? 'Joining…' : 'Get Early Access'}
        </button>
      </div>
      {error && <p className={styles.waitlistError}>{error}</p>}
    </form>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function LandingPage() {
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollToHowItWorks = () => {
    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })
  }

  const fmt = (v: number) =>
    v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(0)}K` : `$${v}`

  return (
    <div className={styles.page}>

      {/* ── Nav ──────────────────────────────────────────────────────────────── */}
      <nav className={`${styles.nav} ${scrolled ? styles.navScrolled : ''}`}>
        <div className={styles.navInner}>
          <span className={styles.navLogo}>KREXA</span>
          <div className={styles.navLinks}>
            <button className={styles.navLink} onClick={scrollToHowItWorks}>
              How It Works
            </button>
            <a
              href="https://github.com/Yatharth4599/TCredit"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.navLink}
            >
              GitHub
            </a>
            <button
              className={styles.navCta}
              onClick={scrollToHowItWorks}
            >
              Join Waitlist
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className={styles.hero}>
        <motion.div
          initial="hidden"
          animate="visible"
          variants={stagger}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
        >
          <motion.div variants={fadeUp} className={styles.heroLabel}>
            <span className={styles.heroDot} />
            Live on Solana
          </motion.div>

          <motion.h1 variants={fadeUp} className={styles.heroHeadline}>
            The Credit Layer for{' '}
            <span className={styles.heroAccent}>the Agent Economy</span>
          </motion.h1>

          <motion.p variants={fadeUp} className={styles.heroSubtitle}>
            Revenue-enforced credit infrastructure for AI agents and digital commerce.
            Built on Solana. Repayment enforced by code, not courts.
          </motion.p>

          <motion.div variants={fadeUp} style={{ width: '100%', maxWidth: 460 }}>
            <WaitlistForm />
            <p className={styles.trustLine}>No token. No spam. Just early access.</p>
          </motion.div>

          <motion.div variants={fadeUp} style={{ marginTop: 12 }}>
            <button
              className={styles.demoBtn}
              onClick={() => navigate('/demo')}
            >
              <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
              </svg>
              Watch Live Demo
            </button>
          </motion.div>

          <motion.div variants={fadeUp} className={styles.techBadges}>
            <span className={styles.techBadge}>Solana</span>
            <span className={styles.techSep}>·</span>
            <span className={styles.techBadge}>USDC</span>
            <span className={styles.techSep}>·</span>
            <span className={styles.techBadge}>x402</span>
            <span className={styles.techSep}>·</span>
            <span className={styles.techBadge}>Anchor Programs</span>
            <span className={styles.techSep}>·</span>
            <span className={styles.techBadge}>5 Programs Deployed</span>
          </motion.div>
        </motion.div>
      </section>

      {/* ── Live Metrics ─────────────────────────────────────────────────────── */}
      <section className={styles.metricsSection}>
        <div className={styles.container}>
          <motion.div
            className={styles.metricsGrid}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={stagger}
          >
            {[
              { val: 2_400_000, label: 'Total Value Locked', fmt },
              { val: 128, label: 'Agents Onboarded', fmt: (v: number) => String(v) },
              { val: 47, label: 'Active Vaults', fmt: (v: number) => String(v) },
              { val: 0, label: 'Default Rate', fmt: () => '0%' },
            ].map((m, i) => (
              <motion.div key={i} variants={fadeUp} className={styles.metricItem}>
                <div className={styles.metricVal}>
                  <AnimatedNumber value={m.val} format={m.fmt} />
                </div>
                <div className={styles.metricLabel}>{m.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────────────────────────── */}
      <section className={styles.section} id="how-it-works">
        <div className={styles.container}>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={stagger}
          >
            <motion.span variants={fadeUp} className={styles.sectionTag}>The Protocol</motion.span>
            <motion.h2 variants={fadeUp} className={styles.sectionTitle}>
              How the agent credit lifecycle works
            </motion.h2>

            <motion.div className={styles.stepsGrid} variants={stagger}>
              {[
                {
                  num: '01',
                  title: 'Agents Earn via x402',
                  desc: 'AI agents monetize APIs, tasks, and services. Every payment flows through Krexa\'s PaymentRouter — oracle-signed, nonce-protected, settled on Solana in under 400ms.',
                },
                {
                  num: '02',
                  title: 'Credit Score Builds Automatically',
                  desc: 'Payment history creates a real-time on-chain credit score. FairScale 0–1000, Tiers A–D. No applications, no credit bureaus — your revenue is the signal.',
                },
                {
                  num: '03',
                  title: 'Revenue-Backed Credit Line',
                  desc: 'Tier A/B/C agents unlock structured credit vaults. Capital comes from Senior pools, LP pools, and community investors — all on-chain, all transparent.',
                },
                {
                  num: '04',
                  title: 'Automatic Waterfall Repayment',
                  desc: 'Every incoming payment auto-splits on-chain: Platform Fee → Senior → Pool → Community → Agent. No manual payments. Enforced by smart contract.',
                },
              ].map((s) => (
                <motion.div key={s.num} variants={fadeUp} className={styles.stepCard}>
                  <span className={styles.stepNum}>{s.num}</span>
                  <h3 className={styles.stepTitle}>{s.title}</h3>
                  <p className={styles.stepDesc}>{s.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── The Insight ──────────────────────────────────────────────────────── */}
      <section className={styles.insightSection}>
        <motion.div
          className={styles.insightInner}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          variants={fadeUp}
        >
          <p className={styles.insightQuote}>
            "In traditional lending, default means the borrower refuses to pay.
            In Krexa, default means the business stopped generating revenue entirely.
            The first happens all the time. The second is rare — and detectable months in advance."
          </p>
          <p className={styles.insightSub}>
            <strong>Revenue becomes collateral.</strong> Settlement becomes enforcement.
          </p>
        </motion.div>
      </section>

      {/* ── For Builders ─────────────────────────────────────────────────────── */}
      <section className={styles.section}>
        <div className={styles.container}>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={stagger}
          >
            <motion.span variants={fadeUp} className={styles.sectionTag}>Who It's For</motion.span>
            <motion.h2 variants={fadeUp} className={styles.sectionTitle}>
              Built for every participant
            </motion.h2>

            <motion.div className={styles.buildersGrid} variants={stagger}>
              {/* For AI Agents */}
              <motion.div variants={fadeUp} className={styles.builderCard}>
                <div className={styles.builderIcon}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="3" y="3" width="18" height="18" rx="3" />
                    <circle cx="9" cy="10" r="1.5" />
                    <circle cx="15" cy="10" r="1.5" />
                    <path d="M9 15h6" />
                  </svg>
                </div>
                <h3 className={styles.builderTitle}>For AI Agents</h3>
                <p className={styles.builderDesc}>
                  Get credit lines for x402 services and API monetization. Build a FairScale score automatically from your revenue history. Pay for compute and APIs on credit.
                </p>
                <button className={styles.builderLink} onClick={() => navigate('/app/lifecycle')}>
                  See live demo →
                </button>
              </motion.div>

              {/* For Investors */}
              <motion.div variants={fadeUp} className={styles.builderCard}>
                <div className={styles.builderIcon}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                    <polyline points="17 6 23 6 23 12" />
                  </svg>
                </div>
                <h3 className={styles.builderTitle}>For Investors</h3>
                <p className={styles.builderDesc}>
                  Earn 12–15% APY from real agent and merchant revenue. Not token emissions — sustainable yield from economic activity. Choose your risk tier: Senior, Pool, or Community.
                </p>
                <button className={styles.builderLink} onClick={() => navigate('/app/vaults')}>
                  Browse vaults →
                </button>
              </motion.div>

              {/* For Merchants */}
              <motion.div variants={fadeUp} className={styles.builderCard}>
                <div className={styles.builderIcon}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <path d="M16 10a4 4 0 01-8 0" />
                  </svg>
                </div>
                <h3 className={styles.builderTitle}>For Merchants</h3>
                <p className={styles.builderDesc}>
                  Access working capital against your revenue. No collateral. No 6-week wait. Automatic repayment splits from incoming revenue — enforced by smart contract.
                </p>
                <button className={styles.builderLink} onClick={() => navigate('/app/merchant')}>
                  Open dashboard →
                </button>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── Code Preview ─────────────────────────────────────────────────────── */}
      <section className={`${styles.section} ${styles.sectionAlt} ${styles.codeSection}`}>
        <div className={styles.container}>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={stagger}
          >
            <motion.span variants={fadeUp} className={styles.sectionTag}>Developer Ready</motion.span>
            <motion.h2 variants={fadeUp} className={styles.sectionTitle}>
              Machine readable
            </motion.h2>

            <motion.div variants={fadeUp} className={styles.codeBlock}>
              <span className={styles.codeLine}><span className={styles.codeComment}>{'// Route payments through Krexa PaymentRouter'}</span></span>
              <span className={styles.codeLine}><span className={styles.codeKeyword}>const</span> <span className={styles.codeDefault}>krexa</span> <span className={styles.codeDefault}>=</span> <span className={styles.codeKeyword}>new</span> <span className={styles.codeFunc}>KrexaSDK</span><span className={styles.codeDefault}>({'{ chain: '}</span><span className={styles.codeString}>'solana'</span><span className={styles.codeDefault}>{', agentAddress }'})</span></span>
              <span className={styles.codeLine}> </span>
              <span className={styles.codeLine}><span className={styles.codeComment}>{'// Every payment auto-splits through the waterfall'}</span></span>
              <span className={styles.codeLine}><span className={styles.codeKeyword}>await</span> <span className={styles.codeDefault}>krexa.agent.</span><span className={styles.codeFunc}>payX402</span><span className={styles.codeDefault}>{'({'}</span></span>
              <span className={styles.codeLine}><span className={styles.codeDefault}>{'  recipient: '}</span><span className={styles.codeString}>'AgntVx9dMz…rK4f'</span><span className={styles.codeDefault}>,</span></span>
              <span className={styles.codeLine}><span className={styles.codeDefault}>{'  amount:    '}</span><span className={styles.codeString}>25.00</span><span className={styles.codeDefault}>,</span></span>
              <span className={styles.codeLine}><span className={styles.codeDefault}>{'  paymentId: '}</span><span className={styles.codeString}>'task-7f3a'</span></span>
              <span className={styles.codeLine}><span className={styles.codeDefault}>{'})'}</span></span>
              <span className={styles.codeLine}> </span>
              <span className={styles.codeLine}><span className={styles.codeComment}>{'// Check credit eligibility via FairScale score'}</span></span>
              <span className={styles.codeLine}><span className={styles.codeKeyword}>const</span> <span className={styles.codeDefault}>score</span> <span className={styles.codeDefault}>=</span> <span className={styles.codeKeyword}>await</span> <span className={styles.codeDefault}>krexa.credit.</span><span className={styles.codeFunc}>getScore</span><span className={styles.codeDefault}>()</span></span>
              <span className={styles.codeLine}><span className={styles.codeComment}>{'// { score: 780, level: 3, eligible: true }'}</span></span>
            </motion.div>

            <motion.div variants={fadeUp} className={styles.codeLinks}>
              <a
                href="https://github.com/Yatharth4599/TCredit"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.codeLink}
              >
                View on GitHub →
              </a>
              <button className={styles.codeLink} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => navigate('/app/lifecycle')}>
                Live Demo →
              </button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────────── */}
      <section className={styles.ctaSection}>
        <div className={styles.ctaInner}>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={stagger}
          >
            <motion.h2 variants={fadeUp} className={styles.ctaTitle}>
              Ready to build on Krexa?
            </motion.h2>
            <motion.p variants={fadeUp} className={styles.ctaSubtitle}>
              Join the waitlist for early access to the protocol.
            </motion.p>
            <motion.div variants={fadeUp}>
              <WaitlistForm dark />
            </motion.div>
            <motion.div variants={fadeUp} style={{ marginTop: 20 }}>
              <button className={styles.ctaDemoLink} onClick={() => navigate('/app/lifecycle')}>
                Or explore the live testnet demo →
              </button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerTop}>
            <div>
              <div className={styles.footerBrand}>KREXA</div>
              <div className={styles.footerTagline}>The Programmable Credit Network</div>
            </div>
            <div className={styles.footerCols}>
              <div>
                <div className={styles.footerColTitle}>Product</div>
                <div className={styles.footerLinks}>
                  <button className={styles.footerLink} onClick={() => navigate('/app')}>Protocol App</button>
                  <button className={styles.footerLink} onClick={() => navigate('/app/vaults')}>Vaults</button>
                  <button className={styles.footerLink} onClick={() => navigate('/app/lifecycle')}>Live Demo</button>
                  <a href="https://github.com/Yatharth4599/TCredit" target="_blank" rel="noopener noreferrer" className={styles.footerLink}>GitHub</a>
                </div>
              </div>
              <div>
                <div className={styles.footerColTitle}>Resources</div>
                <div className={styles.footerLinks}>
                  <a href="https://github.com/Yatharth4599/TCredit" target="_blank" rel="noopener noreferrer" className={styles.footerLink}>Documentation</a>
                  <span className={styles.footerLink}>Blog</span>
                  <span className={styles.footerLink}>Support</span>
                </div>
              </div>
              <div>
                <div className={styles.footerColTitle}>Legal</div>
                <div className={styles.footerLinks}>
                  <span className={styles.footerLink}>Privacy Policy</span>
                  <span className={styles.footerLink}>Terms of Use</span>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.footerBottom}>
            <div className={styles.footerCopyright}>
              © 2026 Krexa Protocol. All rights reserved. Built on Solana.
            </div>
            <div className={styles.footerSocials}>
              <a href="https://x.com/tigerbnkHQ" target="_blank" rel="noopener noreferrer" className={styles.footerSocialLink} aria-label="X (Twitter)">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a href="https://github.com/Yatharth4599/TCredit" target="_blank" rel="noopener noreferrer" className={styles.footerSocialLink} aria-label="GitHub">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>

    </div>
  )
}
