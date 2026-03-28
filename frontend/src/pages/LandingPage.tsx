import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import TerminalAnimation from '../components/TerminalAnimation'

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
}

const stagger = {
  visible: { transition: { staggerChildren: 0.12 } },
}

export default function LandingPage() {
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const copyCmd = useCallback(() => {
    navigator.clipboard.writeText('npx krexa init')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [])

  return (
    <div className="bg-[#0a0a0b] text-[#f5f5f7] min-h-screen" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>

      {/* Nav */}
      <nav className={`fixed top-0 left-0 right-0 z-50 h-16 backdrop-blur-xl border-b transition-all ${scrolled ? 'bg-[#0a0a0b]/90 border-[#1e1e21] shadow-lg shadow-black/20' : 'bg-transparent border-transparent'}`}>
        <div className="max-w-[1100px] mx-auto px-6 h-full flex items-center justify-between">
          <span className="font-mono text-[17px] font-bold tracking-wider">KREXA</span>
          <div className="flex items-center gap-7">
            <a href="https://krexa.xyz/docs" className="text-sm text-[#94a3b8] hover:text-white transition-colors hidden sm:block">Docs</a>
            <a href="https://github.com/Yatharth4599/TCredit" target="_blank" rel="noopener noreferrer" className="text-sm text-[#94a3b8] hover:text-white transition-colors hidden sm:block">GitHub</a>
            <button onClick={() => navigate('/app')} className="text-sm text-[#94a3b8] hover:text-white transition-colors hidden sm:block">Dashboard</button>
            <button onClick={copyCmd} className="px-5 py-2 rounded-full text-sm font-medium bg-gradient-to-r from-[#22d3ee] to-[#4ade80] text-[#0a0a0b] hover:opacity-90 transition-opacity">
              {copied ? 'Copied!' : 'Get Started'}
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="min-h-screen flex items-center pt-24 pb-16 px-6">
        <div className="max-w-[1100px] mx-auto w-full grid lg:grid-cols-2 gap-16 items-center">
          <motion.div initial="hidden" animate="visible" variants={stagger}>
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 text-xs font-mono font-semibold tracking-widest uppercase text-[#4ade80] mb-6">
              <span className="w-[7px] h-[7px] rounded-full bg-[#4ade80] animate-pulse" />
              LIVE ON SOLANA DEVNET
            </motion.div>

            <motion.h1 variants={fadeUp} className="text-[clamp(36px,5.5vw,56px)] font-bold leading-[1.05] tracking-tight mb-5">
              One balance.<br />
              <span className="bg-gradient-to-r from-[#22d3ee] to-[#4ade80] bg-clip-text text-transparent">Unlimited credit.</span>
            </motion.h1>

            <motion.p variants={fadeUp} className="text-lg text-[#94a3b8] leading-relaxed max-w-[480px] mb-8">
              Credit infrastructure for AI agents on Solana. Borrow USDC, operate your agent, repay automatically through the Revenue Router.
            </motion.p>

            <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-3 mb-6">
              <button
                onClick={copyCmd}
                className="px-7 py-3 rounded-full text-[15px] font-medium bg-gradient-to-r from-[#22d3ee] to-[#4ade80] text-[#0a0a0b] hover:opacity-90 transition-opacity"
              >
                npx krexa init
              </button>
              <a
                href="https://krexa.xyz/docs"
                className="px-7 py-3 rounded-full text-[15px] font-medium text-[#94a3b8] border border-[#1e1e21] hover:border-[#22d3ee] hover:text-white transition-all"
              >
                Read the Docs
              </a>
            </motion.div>

            <motion.div variants={fadeUp} className="flex items-center gap-3 font-mono text-[13px] text-[#64748b] bg-[#111113] border border-[#1e1e21] rounded-lg px-4 py-2.5 w-fit">
              <code className="text-[#94a3b8]">npx krexa init</code>
              <button onClick={copyCmd} className="text-[#475569] hover:text-[#94a3b8] transition-colors">
                {copied ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
                )}
              </button>
            </motion.div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, delay: 0.3 }}>
            <TerminalAnimation />
          </motion.div>
        </div>
      </section>

      {/* Three Ways to Use */}
      <section className="py-24 px-6 border-t border-[#1e1e21]">
        <div className="max-w-[1100px] mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }} variants={stagger}>
            <motion.p variants={fadeUp} className="text-xs font-mono font-semibold tracking-widest uppercase text-[#22d3ee] text-center mb-3">Three ways to use</motion.p>
            <motion.h2 variants={fadeUp} className="text-[clamp(26px,3vw,36px)] font-semibold text-center tracking-tight mb-14">
              CLI. Skill. MCP.
            </motion.h2>
            <motion.div variants={stagger} className="grid md:grid-cols-3 gap-5">
              {[
                { title: 'CLI', subtitle: 'One command to start', code: 'npx krexa init', desc: 'Register, borrow, repay — all from your terminal. Works with npx, no install needed.' },
                { title: 'Skill', subtitle: 'Paste into any agent', code: 'krexa.xyz/skill.md', desc: 'Drop the skill file into your agent prompt. Instant access to credit operations.' },
                { title: 'MCP', subtitle: 'Tool-based access', code: 'claude mcp add krexa', desc: 'Works with Claude Code, Cursor, and any MCP-compatible client. 7 tools built in.' },
              ].map((item) => (
                <motion.div key={item.title} variants={fadeUp} className="bg-[#111113] border border-[#1e1e21] rounded-2xl p-7 hover:border-[#22d3ee]/30 transition-colors">
                  <h3 className="text-lg font-semibold mb-1">{item.title}</h3>
                  <p className="text-sm text-[#64748b] mb-4">{item.subtitle}</p>
                  <code className="block font-mono text-[12px] text-[#22d3ee] bg-[#0a0a0b] border border-[#1e1e21] rounded px-3 py-2 mb-4">{item.code}</code>
                  <p className="text-sm text-[#94a3b8] leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 px-6">
        <div className="max-w-[1100px] mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }} variants={stagger}>
            <motion.p variants={fadeUp} className="text-xs font-mono font-semibold tracking-widest uppercase text-[#22d3ee] text-center mb-3">How it works</motion.p>
            <motion.h2 variants={fadeUp} className="text-[clamp(26px,3vw,36px)] font-semibold text-center tracking-tight mb-14">
              Three steps. Zero collateral.
            </motion.h2>
            <motion.div variants={stagger} className="space-y-10 max-w-2xl mx-auto">
              {[
                {
                  num: '1',
                  title: 'Register your agent',
                  code: 'npx krexa init --type service --name "ResearchBot"',
                  desc: 'Creates your keypair, registers on Solana, sets up PDA wallet, and fetches initial Krexit Score.',
                },
                {
                  num: '2',
                  title: 'Borrow working capital',
                  code: 'npx krexa borrow 500',
                  desc: '$500 USDC deposited into your PDA wallet. Ready to operate.',
                },
                {
                  num: '3',
                  title: 'Revenue auto-repays',
                  code: '',
                  desc: 'Every x402 payment flows through the Revenue Router. We take what\'s owed. You get the rest. Your score improves with each repayment.',
                },
              ].map((step) => (
                <motion.div key={step.num} variants={fadeUp} className="flex gap-5">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-[#22d3ee]/20 to-[#4ade80]/20 flex items-center justify-center font-mono font-bold text-[#22d3ee]">
                    {step.num}
                  </div>
                  <div>
                    <h3 className="text-[17px] font-semibold mb-2">{step.title}</h3>
                    {step.code && (
                      <code className="block font-mono text-[12px] text-[#4ade80] bg-[#111113] border border-[#1e1e21] rounded px-3 py-2 mb-3">{step.code}</code>
                    )}
                    <p className="text-sm text-[#94a3b8] leading-relaxed">{step.desc}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Credit Levels */}
      <section className="py-24 px-6 border-t border-[#1e1e21]">
        <div className="max-w-[1100px] mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }} variants={stagger}>
            <motion.p variants={fadeUp} className="text-xs font-mono font-semibold tracking-widest uppercase text-[#22d3ee] text-center mb-3">Credit Levels</motion.p>
            <motion.h2 variants={fadeUp} className="text-[clamp(26px,3vw,36px)] font-semibold text-center tracking-tight mb-4">
              Better behavior = better terms.
            </motion.h2>
            <motion.p variants={fadeUp} className="text-[#64748b] text-center mb-14 text-sm">Krexit Score 200–850, like FICO but for agents.</motion.p>
            <motion.div variants={fadeUp} className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#1e1e21]">
                    <th className="pb-4 text-xs font-mono font-semibold text-[#64748b] uppercase tracking-wider">Level</th>
                    <th className="pb-4 text-xs font-mono font-semibold text-[#64748b] uppercase tracking-wider">Max Credit</th>
                    <th className="pb-4 text-xs font-mono font-semibold text-[#64748b] uppercase tracking-wider">APR</th>
                    <th className="pb-4 text-xs font-mono font-semibold text-[#64748b] uppercase tracking-wider">Requirement</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-sm">
                  {[
                    { level: 'L1 Micro', credit: '$500', apr: '36.50%', req: 'New agents' },
                    { level: 'L2 Standard', credit: '$20,000', apr: '29.20%', req: 'Score ≥ 500' },
                    { level: 'L3 Growth', credit: '$50,000', apr: '21.90%', req: 'Score ≥ 650' },
                    { level: 'L4 Prime', credit: '$500,000', apr: '18.25%', req: 'Score ≥ 750' },
                  ].map((row, i) => (
                    <tr key={i} className="border-b border-[#1e1e21]/50">
                      <td className="py-4 text-white font-semibold">{row.level}</td>
                      <td className="py-4 text-[#4ade80]">{row.credit}</td>
                      <td className="py-4 text-[#22d3ee]">{row.apr}</td>
                      <td className="py-4 text-[#94a3b8]">{row.req}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* For LPs */}
      <section className="py-24 px-6">
        <div className="max-w-[1100px] mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }} variants={stagger}>
            <motion.p variants={fadeUp} className="text-xs font-mono font-semibold tracking-widest uppercase text-[#22d3ee] text-center mb-3">For LPs</motion.p>
            <motion.h2 variants={fadeUp} className="text-[clamp(26px,3vw,36px)] font-semibold text-center tracking-tight mb-4">
              Supply capital. Earn yield. Choose your risk.
            </motion.h2>
            <motion.p variants={fadeUp} className="text-[#64748b] text-center mb-14 text-sm">Real yield from agent revenue — not token emissions.</motion.p>
            <motion.div variants={stagger} className="grid md:grid-cols-3 gap-5">
              {[
                { name: 'Senior', apr: '10% APR', desc: 'First to be paid, last to lose. Lowest risk, stable returns.', color: '#4ade80' },
                { name: 'Mezzanine', apr: '12% APR', desc: 'Balanced risk-reward. Absorbs loss after junior tranche.', color: '#22d3ee' },
                { name: 'Junior', apr: '20% APR', desc: 'Highest yield, first loss. For risk-tolerant capital.', color: '#f59e0b' },
              ].map((t) => (
                <motion.div key={t.name} variants={fadeUp} className="bg-[#111113] border border-[#1e1e21] rounded-2xl p-7">
                  <h3 className="text-lg font-semibold mb-1">{t.name}</h3>
                  <p className="font-mono text-sm mb-3" style={{ color: t.color }}>{t.apr}</p>
                  <p className="text-sm text-[#94a3b8] leading-relaxed">{t.desc}</p>
                </motion.div>
              ))}
            </motion.div>
            <motion.div variants={fadeUp} className="text-center mt-10">
              <button onClick={() => navigate('/app/solana/lp')} className="px-7 py-3 rounded-full text-[15px] font-medium text-[#94a3b8] border border-[#1e1e21] hover:border-[#22d3ee] hover:text-white transition-all">
                Open LP Dashboard
              </button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Live on Solana */}
      <section className="py-24 px-6 border-t border-[#1e1e21]">
        <div className="max-w-[1100px] mx-auto text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }} variants={stagger}>
            <motion.p variants={fadeUp} className="text-xs font-mono font-semibold tracking-widest uppercase text-[#4ade80] mb-3">Live on Solana Devnet</motion.p>
            <motion.h2 variants={fadeUp} className="text-[clamp(26px,3vw,36px)] font-semibold tracking-tight mb-4">
              7 programs. Krexit Score. Revenue Router.
            </motion.h2>
            <motion.p variants={fadeUp} className="text-[#64748b] mb-10 text-sm">
              Oracle co-signing · PDA wallets · x402 native · Structured tranches
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-wrap items-center justify-center gap-4">
              <a href="https://explorer.solana.com/?cluster=devnet" target="_blank" rel="noopener noreferrer" className="px-5 py-2.5 rounded-full text-sm font-medium text-[#94a3b8] border border-[#1e1e21] hover:border-[#22d3ee] hover:text-white transition-all">
                Explorer ↗
              </a>
              <a href="https://github.com/Yatharth4599/TCredit" target="_blank" rel="noopener noreferrer" className="px-5 py-2.5 rounded-full text-sm font-medium text-[#94a3b8] border border-[#1e1e21] hover:border-[#22d3ee] hover:text-white transition-all">
                GitHub ↗
              </a>
              <a href="https://krexa.xyz/docs" className="px-5 py-2.5 rounded-full text-sm font-medium text-[#94a3b8] border border-[#1e1e21] hover:border-[#22d3ee] hover:text-white transition-all">
                Docs ↗
              </a>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-6 border-t border-[#1e1e21]">
        <div className="max-w-[600px] mx-auto text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }} variants={stagger}>
            <motion.h2 variants={fadeUp} className="text-[clamp(28px,3.5vw,40px)] font-bold tracking-tight mb-4">
              Start building on Krexa
            </motion.h2>
            <motion.p variants={fadeUp} className="text-[#94a3b8] mb-8">
              One command. Zero config. Credit in seconds.
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-wrap items-center justify-center gap-3 mb-8">
              <button onClick={copyCmd} className="px-7 py-3 rounded-full text-[15px] font-medium bg-gradient-to-r from-[#22d3ee] to-[#4ade80] text-[#0a0a0b] hover:opacity-90 transition-opacity">
                npx krexa init
              </button>
              <a href="https://krexa.xyz/docs" className="px-7 py-3 rounded-full text-[15px] font-medium text-[#94a3b8] border border-[#1e1e21] hover:border-[#22d3ee] hover:text-white transition-all">
                Read the Docs
              </a>
            </motion.div>
            <motion.div variants={fadeUp} className="flex items-center justify-center gap-5">
              <a href="https://github.com/Yatharth4599/TCredit" target="_blank" rel="noopener noreferrer" className="text-[#475569] hover:text-[#94a3b8] transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" /></svg>
              </a>
              <a href="https://x.com/krexa_xyz" target="_blank" rel="noopener noreferrer" className="text-[#475569] hover:text-[#94a3b8] transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
              </a>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1e1e21] py-12 px-6">
        <div className="max-w-[1100px] mx-auto">
          <div className="grid sm:grid-cols-[1fr_auto] gap-10 mb-10">
            <div>
              <div className="font-mono text-[16px] font-bold tracking-wider mb-2">KREXA</div>
              <div className="text-[13px] text-[#475569]">Credit infrastructure for AI agents on Solana</div>
            </div>
            <div className="grid grid-cols-3 gap-10">
              <div>
                <div className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-3">Protocol</div>
                <div className="flex flex-col gap-2">
                  <button onClick={() => navigate('/app')} className="text-[13px] text-[#475569] hover:text-[#94a3b8] transition-colors text-left">Launch App</button>
                  <button onClick={() => navigate('/app/solana/lp')} className="text-[13px] text-[#475569] hover:text-[#94a3b8] transition-colors text-left">Vaults</button>
                  <button onClick={() => navigate('/app/solana/score')} className="text-[13px] text-[#475569] hover:text-[#94a3b8] transition-colors text-left">Score</button>
                </div>
              </div>
              <div>
                <div className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-3">Developers</div>
                <div className="flex flex-col gap-2">
                  <a href="https://krexa.xyz/docs" className="text-[13px] text-[#475569] hover:text-[#94a3b8] transition-colors">Docs</a>
                  <a href="https://github.com/Yatharth4599/TCredit" target="_blank" rel="noopener noreferrer" className="text-[13px] text-[#475569] hover:text-[#94a3b8] transition-colors">GitHub</a>
                  <a href="https://krexa.xyz/skill.md" className="text-[13px] text-[#475569] hover:text-[#94a3b8] transition-colors">Skill</a>
                </div>
              </div>
              <div>
                <div className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-3">Community</div>
                <div className="flex flex-col gap-2">
                  <a href="https://x.com/krexa_xyz" target="_blank" rel="noopener noreferrer" className="text-[13px] text-[#475569] hover:text-[#94a3b8] transition-colors">X (Twitter)</a>
                  <a href="https://t.me/krexa_xyz" target="_blank" rel="noopener noreferrer" className="text-[13px] text-[#475569] hover:text-[#94a3b8] transition-colors">Telegram</a>
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-[#1e1e21] pt-6 flex items-center justify-between text-[12px] text-[#475569]">
            <span>&copy; 2026 Krexa Protocol</span>
            <span className="font-mono">krexa.xyz</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
