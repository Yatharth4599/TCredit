import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  TrendingUp,
  Award,
  Layers,
  BarChart3,
  Zap,
  Shield,
  ArrowRight,
} from 'lucide-react'
import { useVaultStats } from '../hooks'

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5 },
  }),
}

const FEATURES = [
  {
    icon: TrendingUp,
    title: 'Credit Lines',
    desc: 'Collateral-backed credit from $500 to $500K with 4 tier levels.',
  },
  {
    icon: Award,
    title: 'Krexit Score',
    desc: '200-850 composite score from 5 weighted components.',
  },
  {
    icon: Layers,
    title: 'Tranched Vault',
    desc: 'Senior, Mezzanine, Junior tranches with differentiated yields.',
  },
  {
    icon: BarChart3,
    title: 'LP Yields',
    desc: 'Earn 10-20% APR by providing liquidity to agent credit lines.',
  },
  {
    icon: Zap,
    title: 'x402 Payments',
    desc: 'Revenue validation with 3-layer wash-trade detection.',
  },
  {
    icon: Shield,
    title: 'Agent Wallets',
    desc: 'PDA wallets with 8 safety checks on every transaction.',
  },
]

const STEPS = [
  { num: '1', label: 'Register Agent' },
  { num: '2', label: 'Get Scored' },
  { num: '3', label: 'Receive Credit' },
  { num: '4', label: 'Trade & Repay' },
]

function useLiveStats() {
  const { data: vault } = useVaultStats()
  const tvl = vault ? (Number(vault.totalDeposits.toString()) / 1e6).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }) : '$—'
  const util = vault ? `${(vault.utilizationBps / 100).toFixed(1)}%` : '—'
  return [
    { value: '7', label: 'Programs Deployed' },
    { value: tvl, label: 'Total Value Locked' },
    { value: util, label: 'Utilization' },
    { value: 'Devnet', label: 'Live' },
  ]
}

function ScoreGauge() {
  const score = 720
  const min = 200
  const max = 850
  const pct = ((score - min) / (max - min)) * 100
  const rotation = -135 + (pct / 100) * 270

  return (
    <div className="relative w-56 h-56 mx-auto">
      <svg viewBox="0 0 200 200" className="w-full h-full">
        {/* Background arc */}
        <circle
          cx="100"
          cy="100"
          r="80"
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray="340 509"
          transform="rotate(-225 100 100)"
        />
        {/* Foreground arc */}
        <circle
          cx="100"
          cy="100"
          r="80"
          fill="none"
          stroke="url(#scoreGrad)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * 340} 509`}
          transform="rotate(-225 100 100)"
        />
        {/* Needle */}
        <line
          x1="100"
          y1="100"
          x2="100"
          y2="40"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          transform={`rotate(${rotation} 100 100)`}
        />
        <circle cx="100" cy="100" r="4" fill="white" />
        <defs>
          <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#60A5FA" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold text-white">{score}</span>
        <span className="text-xs text-white/30 mt-1">Krexit Score</span>
      </div>
    </div>
  )
}

function LiveStatsBar() {
  const stats = useLiveStats()
  return (
    <section className="border-y border-white/[0.06] bg-white/[0.01]">
      <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-4 gap-6 text-center">
        {stats.map(stat => (
          <div key={stat.label}>
            <p className="text-2xl font-bold text-white">{stat.value}</p>
            <p className="text-xs text-white/30 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function LandingPage() {
  return (
    <div className="overflow-hidden">
      {/* Hero */}
      <section className="relative max-w-7xl mx-auto px-6 pt-24 pb-16 md:pt-32 md:pb-24">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={0}
          >
            <h1 className="text-5xl font-bold leading-tight tracking-tight">
              On-chain credit infrastructure for AI&nbsp;agents
            </h1>
            <p className="mt-6 text-lg text-white/50 leading-relaxed max-w-lg">
              Krexa provides autonomous agents with credit scoring, collateral-backed lending, and 8-layer safety controls — all on Solana.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                to="/score"
                className="inline-flex items-center px-5 py-2.5 text-sm font-medium rounded-lg border border-white/[0.12] text-white hover:bg-white/[0.04] transition-colors"
              >
                Lookup Score
              </Link>
              <Link
                to="/dashboard"
                className="inline-flex items-center px-5 py-2.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors"
              >
                Launch App
              </Link>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <ScoreGauge />
          </motion.div>
        </div>
      </section>

      {/* Stats bar */}
      <LiveStatsBar />

      {/* Features grid */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <motion.h2
          className="text-3xl font-bold text-center mb-12"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          Protocol Features
        </motion.h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={i}
            >
              <f.icon size={24} className="text-blue-400 mb-4" />
              <h3 className="text-base font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-white/40 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <motion.h2
          className="text-3xl font-bold text-center mb-12"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          How It Works
        </motion.h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.num}
              className="text-center"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={i}
            >
              <div className="mx-auto w-12 h-12 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400 font-bold text-lg mb-3">
                {step.num}
              </div>
              <p className="text-sm font-medium text-white/70">{step.label}</p>
              {i < STEPS.length - 1 && (
                <ArrowRight className="hidden md:block mx-auto mt-3 text-white/10" size={20} />
              )}
            </motion.div>
          ))}
        </div>
      </section>

      {/* Developer CTA */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <motion.div
          className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-10 text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl font-bold mb-4">Build on Krexa</h2>
          <p className="text-white/40 max-w-xl mx-auto mb-8">
            Integrate credit scoring, lending, and payment validation into your AI agent with the Krexa SDK and REST API.
          </p>
          <Link
            to="/docs"
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors"
          >
            Read the Docs
            <ArrowRight size={16} />
          </Link>
        </motion.div>
      </section>
    </div>
  )
}
