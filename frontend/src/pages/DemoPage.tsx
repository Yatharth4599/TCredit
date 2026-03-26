/**
 * DemoPage — /demo
 *
 * Full protocol showcase + story-driven live demo.
 * Educates visitors on the Krexa credit system, then runs it live on Solana devnet.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { TRANCHE_CONFIG } from '../utils/dashboardHelpers'
import { PROGRAM_IDS, accountUrl } from '../config/solana'
import s from './DemoPage.module.css'

// ─── Types ─────────────────────────────────────────────────────────────────

interface StepInfo { num: number; label: string; plain: string }
type StepStatus = 'pending' | 'active' | 'done'

interface LogEntry {
  id: number; text: string; sub?: string; tx?: string
  type: 'info' | 'success' | 'payment' | 'complete'
}

interface DemoState {
  runState: 'idle' | 'running' | 'done' | 'error'
  steps: Record<number, StepStatus>
  txs: Record<number, string>
  wallet: { balance: number; debt: number; score: number; level: number; creditUsed: number }
  payments: { total: number; lp: number; fee: number; agent: number; callCount: number }
  scoreboard: {
    totalRevenue: number; totalRepaid: number; totalPlatform: number
    remainingDebt: number; creditTaken: number
  } | null
  log: LogEntry[]
  connected: boolean
}

type WsEvent =
  | { event: 'step_active';   data: { step: number } }
  | { event: 'step_complete'; data: { step: number; tx: string } }
  | { event: 'step_error';    data: { step: number; error: string } }
  | { event: 'wallet_state';  data: { balance: number; debt: number; score: number; level: number; collateral: number; creditUsed: number } }
  | { event: 'safety_check';  data: { check: string; passed: boolean } }
  | { event: 'payment_split'; data: { total: number; lp: number; fee: number; agent: number; callCount: number } }
  | { event: 'demo_complete'; data: { scoreboard: DemoState['scoreboard'] } }
  | { event: 'demo_status';   data: { status: string; error?: string } }

// ─── Config ────────────────────────────────────────────────────────────────

const WS_URL  = import.meta.env.VITE_DEMO_WS_URL  || 'wss://krexa-demo-server.onrender.com'
const API_URL = import.meta.env.VITE_DEMO_API_URL || 'https://krexa-demo-server.onrender.com'

const STEPS: StepInfo[] = [
  { num: 1, label: 'Register',  plain: 'On-chain identity' },
  { num: 2, label: 'KYA',       plain: 'Trust verification' },
  { num: 3, label: 'Wallet',    plain: 'Smart wallet + limits' },
  { num: 4, label: 'Credit',    plain: 'Zero-collateral credit' },
  { num: 5, label: 'Earn',      plain: '10 paid API calls' },
  { num: 6, label: 'Repay',     plain: 'Loan clears, score up' },
]

const STEP_LOG: Record<number, { active: string; done: string; sub: string }> = {
  1: { active: 'Registering agent on-chain\u2026',      done: 'Agent identity created on Solana',          sub: 'krexa-agent-registry' },
  2: { active: 'Running KYA verification\u2026',         done: 'KYA Tier 1 passed \u2014 agent is trusted',      sub: 'Automated compliance check' },
  3: { active: 'Initializing smart wallet\u2026',        done: 'PDA wallet live with spending controls',    sub: 'Per-trade and daily limits' },
  4: { active: 'Requesting L1 Starter credit\u2026',     done: '$50 L1 Starter credit extended',            sub: 'Underwritten by vault tranches' },
  5: { active: 'Agent making paid API calls\u2026',      done: '10 \u00d7 $0.25 API calls completed',            sub: 'PaymentRouter auto-splits via waterfall' },
  6: { active: 'Repaying loan from earnings\u2026',      done: 'Loan fully repaid \u2014 Krexit Score increased', sub: 'On-chain credit history updated' },
}

const INITIAL: DemoState = {
  runState: 'idle',
  steps: { 1: 'pending', 2: 'pending', 3: 'pending', 4: 'pending', 5: 'pending', 6: 'pending' },
  txs: {},
  wallet: { balance: 0, debt: 0, score: 0, level: 0, creditUsed: 0 },
  payments: { total: 0, lp: 0, fee: 0, agent: 0, callCount: 0 },
  scoreboard: null, log: [], connected: false,
}

let _id = 0
const mkLog = (text: string, type: LogEntry['type'], sub?: string, tx?: string): LogEntry =>
  ({ id: ++_id, text, sub, tx, type })

const usd = (n: number, d = 2) => `$${n.toFixed(d)}`
const sig = (s: string) => `${s.slice(0, 6)}\u2026${s.slice(-4)}`
const CLUSTER = import.meta.env.VITE_SOLANA_CLUSTER || 'devnet'
const scan = (s: string) => `https://solscan.io/tx/${s}${CLUSTER !== 'mainnet-beta' ? `?cluster=${CLUSTER}` : ''}`

// ─── Protocol Data ──────────────────────────────────────────────────────────

const PROTOCOL_FLOW = [
  { num: 1, title: 'Earn Revenue', desc: 'Agents earn via x402 payments, DeFi trading, or API services', icon: '\u26A1' },
  { num: 2, title: 'Build Score', desc: 'On-chain history creates a Krexit Score (200\u2013850)', icon: '\uD83D\uDCCA' },
  { num: 3, title: 'Get Credit', desc: 'Score + KYA tier unlocks zero-collateral credit lines', icon: '\uD83C\uDFE6' },
  { num: 4, title: 'Auto-Repay', desc: 'Every payment auto-splits via waterfall to repay lenders', icon: '\uD83D\uDD04' },
]

const AGENT_TYPE_DETAILS = [
  { type: 'Trader', badge: 'Type A', icon: '\uD83D\uDCC8', desc: 'DeFi bots that execute swaps, arbitrage, and LP strategies across whitelisted venues.', venues: 'Jupiter, Raydium, Orca, Pump.fun', drivers: 'C1 Repayment (30%) + C2 Profitability (25%)' },
  { type: 'Service', badge: 'Type B', icon: '\uD83D\uDD0C', desc: 'API-serving agents that earn via x402 HTTP Payment Required protocol. Pay-per-call monetization.', venues: 'Any HTTP endpoint', drivers: 'C1 Repayment (30%) + C3 Behavioral (20%)' },
  { type: 'Hybrid', badge: 'Type C', icon: '\u26A1', desc: 'Agents that both trade on DeFi venues and serve paid APIs. Dual revenue streams, highest credit ceiling.', venues: 'All venues + HTTP', drivers: 'All 5 components balanced' },
]

const SCORE_COMPONENTS = [
  { name: 'Repayment',     code: 'C1', weight: 30, desc: 'On-time loan repayments vs late/missed', color: '#3B82F6' },
  { name: 'Profitability', code: 'C2', weight: 25, desc: 'Revenue consistency and margin health',  color: '#22C55E' },
  { name: 'Behavioral',    code: 'C3', weight: 20, desc: 'Spending patterns, venue diversity',     color: '#8B5CF6' },
  { name: 'Usage',         code: 'C4', weight: 15, desc: 'Credit utilization and trade frequency', color: '#F59E0B' },
  { name: 'Maturity',      code: 'C5', weight: 10, desc: 'Account age and completed credit cycles', color: '#06B6D4' },
]

const HEALTH_ZONES = [
  { label: 'Healthy',     threshold: '\u2265 1.50x', color: '#10B981', desc: 'Full operations, score increases' },
  { label: 'Warning',     threshold: '\u2265 1.30x', color: '#F59E0B', desc: 'Reduced limits, monitoring active' },
  { label: 'Danger',      threshold: '\u2265 1.20x', color: '#F97316', desc: 'Credit frozen, repayment priority' },
  { label: 'Liquidation', threshold: '< 1.05x', color: '#EF4444', desc: 'Automatic wind-down triggered' },
]

const CREDIT_LEVEL_DETAILS = [
  { level: 1, name: 'Starter',      limit: '$500',     apr: '36.5%', daily: '0.10%', minScore: 400, minKya: 'Tier 1', color: '#F97316' },
  { level: 2, name: 'Established',  limit: '$20,000',  apr: '29.2%', daily: '0.08%', minScore: 500, minKya: 'Tier 2', color: '#F59E0B' },
  { level: 3, name: 'Trusted',      limit: '$50,000',  apr: '21.9%', daily: '0.06%', minScore: 650, minKya: 'Tier 2', color: '#10B981' },
  { level: 4, name: 'Elite',        limit: '$500,000', apr: '18.25%', daily: '0.05%', minScore: 750, minKya: 'Tier 3', color: '#3B82F6' },
]

const TRANCHE_DETAILS = [
  { name: 'Senior',    apr: '10%',  risk: 'Low',    priority: '1st repaid', color: TRANCHE_CONFIG.senior.color,    riskBg: '#EFF6FF', riskColor: '#2563EB', desc: 'Institutional capital. First to be repaid, lowest yield. Protected by junior and mezzanine buffers.' },
  { name: 'Mezzanine', apr: '12%', risk: 'Medium', priority: '2nd repaid', color: TRANCHE_CONFIG.mezzanine.color, riskBg: '#FAF5FF', riskColor: '#7C3AED', desc: 'LP deposits. Middle priority in the waterfall. Moderate yield with partial loss protection.' },
  { name: 'Junior',    apr: '20%', risk: 'High',   priority: 'Last repaid', color: TRANCHE_CONFIG.junior.color,   riskBg: '#FFF7ED', riskColor: '#EA580C', desc: 'Protocol treasury. Absorbs first losses, highest yield. Protocol-managed capital only.' },
]

const KYA_TIER_DETAILS = [
  { tier: 0, name: 'None',          verification: 'No verification',                 access: 'Read-only, no credit' },
  { tier: 1, name: 'Basic',         verification: 'Wallet signature + agent metadata', access: 'L1 credit (up to $500)' },
  { tier: 2, name: 'Enhanced',      verification: 'KYC provider (Sumsub)',            access: 'L2\u2013L3 credit (up to $50K)' },
  { tier: 3, name: 'Institutional', verification: 'Full institutional due diligence',  access: 'L4 credit (up to $500K)' },
]

const PROGRAMS_FULL = [
  { name: 'krexa-agent-registry',  desc: 'Agent identity & KYA tiers',              addr: PROGRAM_IDS.agentRegistry,  icon: '\uD83C\uDD94', cls: 'registry' },
  { name: 'krexa-credit-vault',    desc: 'Zero-collateral credit underwriting',      addr: PROGRAM_IDS.creditVault,    icon: '\uD83C\uDFE6', cls: 'vault'    },
  { name: 'krexa-agent-wallet',    desc: 'Smart wallets with spend controls',        addr: PROGRAM_IDS.agentWallet,    icon: '\uD83D\uDC5B', cls: 'wallet'   },
  { name: 'krexa-venue-whitelist', desc: 'Approved venue registry',                  addr: PROGRAM_IDS.venueWhitelist, icon: '\u2705', cls: 'venue'    },
  { name: 'krexa-payment-router',  desc: 'Automatic revenue split per call',         addr: PROGRAM_IDS.paymentRouter,  icon: '\uD83D\uDD00', cls: 'router'   },
  { name: 'krexa-service-plan',    desc: 'x402 service subscription management',     addr: PROGRAM_IDS.servicePlan,    icon: '\uD83D\uDCCB', cls: 'service'  },
  { name: 'krexa-krexit-score',    desc: 'On-chain credit scoring (200\u2013850)',   addr: PROGRAM_IDS.score,          icon: '\uD83D\uDCCA', cls: 'scoreProg' },
]

// ─── Story Data ─────────────────────────────────────────────────────────────

const STORY_CHAPTERS = [
  {
    num: 1,
    icon: '\uD83E\uDD16',
    title: 'Meet the Agent',
    headline: 'An AI agent needs to work, but has no money.',
    body: 'A newly created AI agent wants to offer a paid research API. But to operate on-chain, it first needs an identity \u2014 a verifiable on-chain registration that proves it exists and can be trusted.',
    what: 'The agent registers on the Krexa Agent Registry \u2014 a Solana program that creates a unique on-chain identity with metadata, owner keys, and a trust tier.',
    program: 'krexa-agent-registry',
  },
  {
    num: 2,
    icon: '\uD83D\uDD0D',
    title: 'Trust Verification',
    headline: 'Can this agent be trusted with money?',
    body: 'Before anyone lends money to an AI, its capabilities and safety need to be verified. Krexa runs an automated Know-Your-Agent (KYA) check \u2014 the AI equivalent of a bank\'s KYC process. This gives the agent KYA Tier 1, unlocking L1 Starter credit.',
    what: 'The oracle verifies the agent\'s code, behavior patterns, and safety guarantees. It passes KYA Tier 1 \u2014 the minimum requirement for L1 credit ($500 max).',
    program: 'krexa-agent-registry',
  },
  {
    num: 3,
    icon: '\uD83D\uDC5B',
    title: 'Smart Wallet',
    headline: 'The agent gets a bank account \u2014 with guardrails.',
    body: 'A PDA-based smart wallet is created for the agent. Unlike a regular wallet, this one has built-in spending controls: per-transaction limits, daily caps, and only approved venues can receive payments.',
    what: 'The Krexa Agent Wallet program creates a Program Derived Address (PDA) wallet with configurable spend limits and venue whitelisting.',
    program: 'krexa-agent-wallet',
  },
  {
    num: 4,
    icon: '\uD83D\uDCB0',
    title: 'L1 Starter Credit',
    headline: 'The agent borrows $50 \u2014 with nothing locked up.',
    body: 'This is the breakthrough. Traditional DeFi requires 150% collateral to borrow. Krexa extends L1 Starter credit (up to $500, 36.5% APR) based purely on the agent\'s KYA trust tier \u2014 no collateral, no locked assets. The Credit Vault underwrites the loan from LP deposits across Senior, Mezzanine, and Junior tranches.',
    what: 'The Credit Vault program extends a $50 USDC credit line at L1 rates. Interest accrues daily at 0.10%. The waterfall ensures lenders get repaid in priority order.',
    program: 'krexa-credit-vault',
  },
  {
    num: 5,
    icon: '\u26A1',
    title: 'Earning Revenue',
    headline: 'The agent goes to work and earns money.',
    body: 'With credit in hand, the agent deploys a paid research API. Every time someone calls the API, the Payment Router automatically splits the $0.25 fee through the waterfall: Senior tranche first, then Mezzanine, then Junior, with the remainder going to the agent.',
    what: 'The Payment Router processes 10 API calls at $0.25 each. Each payment is split on-chain in real time \u2014 tranche-priority repayment happens automatically.',
    program: 'krexa-payment-router',
  },
  {
    num: 6,
    icon: '\u2728',
    title: 'Full Repayment',
    headline: 'Loan repaid. Krexit Score goes up. Cycle complete.',
    body: 'After earning enough revenue, the agent\'s loan is fully repaid through automatic waterfall splits. Its on-chain Krexit Score increases based on all 5 components \u2014 repayment (30%), profitability (25%), behavioral (20%), usage (15%), and maturity (10%) \u2014 unlocking higher credit limits for future operations.',
    what: 'The Credit Vault records full repayment. The Krexit Score program recalculates: score = 200 + 650 \u00d7 weighted_average. Next time, the agent can reach L2 Established ($20K) with a higher score.',
    program: 'krexa-credit-vault',
  },
]

const TX_LABELS: Record<number, string> = {
  1: 'Register Agent',
  2: 'KYA Verification',
  3: 'Create Wallet',
  4: 'Extend Credit',
  5: 'API Payments',
  6: 'Full Repayment',
}

// ─── Shared Components ──────────────────────────────────────────────────────

function ExtIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  )
}

// ─── Educational Sections ───────────────────────────────────────────────────

function ProtocolOverview() {
  return (
    <section className={s.eduSection}>
      <div className={s.eduInner}>
        <div className={s.eduLabel}>How It Works</div>
        <h2 className={s.eduTitle}>The Credit Lifecycle</h2>
        <p className={s.eduSub}>
          Krexa turns future revenue into present-day credit. The entire lifecycle is automated, on-chain, and enforced by code.
        </p>
        <div className={s.flowGrid}>
          {PROTOCOL_FLOW.map((step, i) => (
            <div key={step.num} style={{ display: 'contents' }}>
              <div className={s.flowStep}>
                <div className={s.flowStepNum}>{step.icon}</div>
                <div className={s.flowStepTitle}>{step.title}</div>
                <div className={s.flowStepDesc}>{step.desc}</div>
              </div>
              {i < PROTOCOL_FLOW.length - 1 && <span className={s.flowArrow}>{'\u2192'}</span>}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function AgentTypesSection() {
  return (
    <section className={s.eduSection}>
      <div className={s.eduInner}>
        <div className={s.eduLabel}>Agent Types</div>
        <h2 className={s.eduTitle}>Three Paths to Credit</h2>
        <p className={s.eduSub}>
          Each agent type has unique score drivers and revenue patterns. Choose the type that matches your agent's business model.
        </p>
        <div className={s.eduGrid3}>
          {AGENT_TYPE_DETAILS.map((a) => (
            <div key={a.type} className={s.eduCard}>
              <div className={s.eduCardIcon}>{a.icon}</div>
              <div className={s.eduCardBadge}>{a.badge}</div>
              <div className={s.eduCardTitle}>{a.type} Agent</div>
              <div className={s.eduCardBody}>{a.desc}</div>
              <div className={s.eduCardMeta}>
                <strong>Venues:</strong> {a.venues}<br />
                <strong>Key drivers:</strong> {a.drivers}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function KrexitScoreSection() {
  return (
    <section className={s.eduSection}>
      <div className={s.eduInner}>
        <div className={s.eduLabel}>Credit Scoring</div>
        <h2 className={s.eduTitle}>The Krexit Score (200{'\u2013'}850)</h2>
        <p className={s.eduSub}>
          A FICO-like on-chain credit score calculated daily from 5 behavioral components. Higher scores unlock larger credit lines at lower rates.
        </p>

        <div className={s.formulaBox}>
          <div className={s.formulaLabel}>Score Formula</div>
          <span className={s.formulaHighlight}>score</span> = 200 + 650 {'\u00d7'} (0.30{'\u00d7'}C1 + 0.25{'\u00d7'}C2 + 0.20{'\u00d7'}C3 + 0.15{'\u00d7'}C4 + 0.10{'\u00d7'}C5)
        </div>

        <div className={s.weightBar}>
          {SCORE_COMPONENTS.map((c) => (
            <div key={c.code} className={s.weightSegment} style={{ width: `${c.weight}%`, background: c.color }} title={`${c.name} ${c.weight}%`} />
          ))}
        </div>

        <div className={s.eduGrid2}>
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {SCORE_COMPONENTS.map((c) => (
                <div key={c.code} className={s.componentRow}>
                  <div className={s.componentDot} style={{ background: c.color }} />
                  <div className={s.componentWeight}>{c.weight}%</div>
                  <div className={s.componentName}>{c.code} {c.name}</div>
                  <div className={s.componentDesc}>{c.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className={s.eduLabel} style={{ marginBottom: 14 }}>Health Factor Zones</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {HEALTH_ZONES.map((z) => (
                <div key={z.label} className={s.zoneCard}>
                  <div className={s.zoneDot} style={{ background: z.color }} />
                  <div>
                    <div className={s.zoneLabel}>{z.label}</div>
                    <div className={s.zoneThreshold}>{z.threshold}</div>
                  </div>
                  <div className={s.zoneDesc} style={{ marginLeft: 'auto' }}>{z.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function CreditLevelsSection() {
  return (
    <section className={s.eduSection}>
      <div className={s.eduInner}>
        <div className={s.eduLabel}>Credit Levels</div>
        <h2 className={s.eduTitle}>Four Tiers of Credit Access</h2>
        <p className={s.eduSub}>
          Credit limits and interest rates are determined by your Krexit Score and KYA verification tier. Higher scores mean more credit at lower rates.
        </p>
        <div className={s.eduTableWrap}>
          <table className={s.eduTable}>
            <thead>
              <tr>
                <th className={s.eduTh}>Level</th>
                <th className={s.eduTh}>Name</th>
                <th className={s.eduTh}>Max Credit</th>
                <th className={s.eduTh}>APR</th>
                <th className={s.eduTh}>Daily Rate</th>
                <th className={s.eduTh}>Min Score</th>
                <th className={s.eduTh}>Min KYA</th>
              </tr>
            </thead>
            <tbody>
              {CREDIT_LEVEL_DETAILS.map((l) => (
                <tr key={l.level}>
                  <td className={s.eduTd}>
                    <span className={s.levelBadge} style={{ background: l.color }}>L{l.level}</span>
                  </td>
                  <td className={`${s.eduTd} ${s.eduTdBold}`}>{l.name}</td>
                  <td className={`${s.eduTd} ${s.eduTdMono}`}>{l.limit}</td>
                  <td className={`${s.eduTd} ${s.eduTdMono}`}>{l.apr}</td>
                  <td className={`${s.eduTd} ${s.eduTdMono}`}>{l.daily}</td>
                  <td className={`${s.eduTd} ${s.eduTdMono}`}>{l.minScore}</td>
                  <td className={s.eduTd}>{l.minKya}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

function TrancheSection() {
  return (
    <section className={s.eduSection}>
      <div className={s.eduInner}>
        <div className={s.eduLabel}>Vault Structure</div>
        <h2 className={s.eduTitle}>Three Tranches, One Waterfall</h2>
        <p className={s.eduSub}>
          The credit vault uses a structured tranche system. Senior capital is protected by junior buffers. Every payment flows through the waterfall in priority order.
        </p>
        <div className={s.eduGrid3}>
          {TRANCHE_DETAILS.map((t) => (
            <div key={t.name} className={s.trancheCard} style={{ borderTopColor: t.color }}>
              <div className={s.trancheHeader}>
                <div className={s.trancheName}>{t.name}</div>
                <div className={s.trancheApr} style={{ color: t.color }}>{t.apr}</div>
              </div>
              <div className={s.trancheRisk} style={{ background: t.riskBg, color: t.riskColor }}>
                {t.risk} Risk
              </div>
              <div className={s.trancheDesc}>{t.desc}</div>
              <div className={s.tranchePriority}>{t.priority}</div>
            </div>
          ))}
        </div>

        <div className={s.waterfallWrap}>
          <div className={s.waterfallTitle}>Payment Waterfall</div>
          <div className={s.waterfallFlow}>
            {[
              { label: 'Payment In', bg: '#F1F5F9', color: '#334155' },
              { label: 'Platform Fee', bg: '#FEF3C7', color: '#92400E' },
              { label: 'Senior', bg: '#DBEAFE', color: '#1E40AF' },
              { label: 'Mezzanine', bg: '#EDE9FE', color: '#5B21B6' },
              { label: 'Junior', bg: '#FFEDD5', color: '#9A3412' },
              { label: 'Agent', bg: '#D1FAE5', color: '#065F46' },
            ].map((step, i, arr) => (
              <div key={step.label} style={{ display: 'contents' }}>
                <span className={s.waterfallStep} style={{ background: step.bg, color: step.color }}>{step.label}</span>
                {i < arr.length - 1 && <span className={s.waterfallArrow}>{'\u2192'}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function KyaTiersSection() {
  return (
    <section className={s.eduSection}>
      <div className={s.eduInner}>
        <div className={s.eduLabel}>Identity</div>
        <h2 className={s.eduTitle}>Know Your Agent (KYA)</h2>
        <p className={s.eduSub}>
          KYA is Krexa's identity layer. Both score and KYA tier must meet minimum requirements for each credit level.
        </p>
        <div className={s.eduTableWrap}>
          <table className={s.eduTable}>
            <thead>
              <tr>
                <th className={s.eduTh}>Tier</th>
                <th className={s.eduTh}>Name</th>
                <th className={s.eduTh}>Verification Method</th>
                <th className={s.eduTh}>Credit Access</th>
              </tr>
            </thead>
            <tbody>
              {KYA_TIER_DETAILS.map((k) => (
                <tr key={k.tier}>
                  <td className={`${s.eduTd} ${s.eduTdMono}`}>{k.tier}</td>
                  <td className={`${s.eduTd} ${s.eduTdBold}`}>{k.name}</td>
                  <td className={s.eduTd}>{k.verification}</td>
                  <td className={s.eduTd}>{k.access}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

function InterestSection() {
  return (
    <section className={s.eduSection}>
      <div className={s.eduInner}>
        <div className={s.eduLabel}>Interest Mechanics</div>
        <h2 className={s.eduTitle}>How Interest Works</h2>
        <p className={s.eduSub}>
          Interest accrues daily on outstanding credit. Lower credit levels have higher rates to compensate for risk. Health factor determines account status.
        </p>
        <div className={s.interestGrid}>
          <div className={s.interestCard}>
            <div className={s.interestLabel}>Daily Accrual</div>
            <div className={s.interestFormula}>daily = principal {'\u00d7'} APR / 365</div>
            <div className={s.interestExample}>
              <strong>L1 Example:</strong> $500 at 36.5% APR<br />
              = $500 {'\u00d7'} 0.365 / 365 = <strong>$0.50/day</strong>
            </div>
          </div>
          <div className={s.interestCard}>
            <div className={s.interestLabel}>Health Factor</div>
            <div className={s.interestFormula}>health = value / debt</div>
            <div className={s.interestExample}>
              If health drops below <strong>1.05x</strong>, the account is automatically frozen. No new draws allowed until debt is repaid.
            </div>
          </div>
          <div className={s.interestCard}>
            <div className={s.interestLabel}>Waterfall Repayment</div>
            <div className={s.interestFormula}>auto-split on every payment</div>
            <div className={s.interestExample}>
              Every incoming payment is split by smart contract: platform fee first, then Senior {'\u2192'} Mezzanine {'\u2192'} Junior {'\u2192'} Agent keeps the rest.
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Story Chapter Card ─────────────────────────────────────────────────────

function StoryChapter({ chapter, status, tx }: {
  chapter: typeof STORY_CHAPTERS[0]
  status: StepStatus
  tx?: string
}) {
  return (
    <div className={`${s.chapter} ${s[`chapter${status}`]}`}>
      <div className={s.chapterGutter}>
        <div className={`${s.chapterNum} ${s[`num${status}`]}`}>
          {status === 'done' ? (
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : status === 'active' ? (
            <span className={s.chapterPulse} />
          ) : (
            <span>{chapter.num}</span>
          )}
        </div>
        {chapter.num < 6 && <div className={`${s.chapterLine} ${status === 'done' ? s.lineDone : ''}`} />}
      </div>

      <div className={s.chapterContent}>
        <div className={s.chapterHead}>
          <span className={s.chapterIcon}>{chapter.icon}</span>
          <span className={s.chapterLabel}>Chapter {chapter.num}</span>
          {status === 'active' && <span className={s.chapterLive}><span className={s.chapterLiveDot} /> LIVE</span>}
          {status === 'done' && tx && (
            <a href={scan(tx)} target="_blank" rel="noopener noreferrer" className={s.chapterTx}>
              tx: {sig(tx)} <ExtIcon className={s.chapterTxIcon} />
            </a>
          )}
        </div>
        <h3 className={s.chapterTitle}>{chapter.title}</h3>
        <p className={s.chapterHeadline}>{chapter.headline}</p>
        <p className={s.chapterBody}>{chapter.body}</p>
        <div className={s.chapterWhat}>
          <span className={s.chapterWhatLabel}>What happens on-chain</span>
          <p className={s.chapterWhatText}>{chapter.what}</p>
          <span className={s.chapterProgram}>
            <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M4 1h8a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V2a1 1 0 011-1zm1 3v2h6V4H5zm0 4v2h4V8H5z"/></svg>
            {chapter.program}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Activity Feed ─────────────────────────────────────────────────────────

function Feed({ log, runState }: { log: LogEntry[]; runState: string }) {
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [log.length])

  if (!log.length) {
    return (
      <div className={s.feedEmpty}>
        <div className={s.feedEmptyIcon}>
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
          </svg>
        </div>
        <p className={s.feedEmptyTitle}>Transaction log</p>
        <p className={s.feedEmptySub}>
          {runState === 'idle' ? 'Press Start Demo to begin the story' : 'Waiting for events\u2026'}
        </p>
      </div>
    )
  }

  const icons: Record<string, string> = { info: '\u23F3', success: '\u2713', payment: '$', complete: '\u2726' }

  return (
    <div className={s.feedList}>
      {log.map((e) => (
        <div key={e.id} className={`${s.feedItem} ${s[e.type]}`}>
          <div className={`${s.feedIcon} ${s[e.type]}`}>{icons[e.type]}</div>
          <div>
            <p className={s.feedText}>{e.text}</p>
            {e.sub && <p className={s.feedSub}>{e.sub}</p>}
            {e.tx && (
              <a href={scan(e.tx)} target="_blank" rel="noopener noreferrer" className={s.feedTx}>
                {sig(e.tx)} <ExtIcon className={s.feedTxIcon} />
              </a>
            )}
          </div>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  )
}

// ─── Metrics Panel ─────────────────────────────────────────────────────────

function Metrics({ wallet, payments, scoreboard }: {
  wallet: DemoState['wallet']; payments: DemoState['payments']; scoreboard: DemoState['scoreboard']
}) {
  const earned = payments.agent * payments.callCount
  const repaid = payments.lp * payments.callCount
  const total = 50
  const pct = Math.min(100, scoreboard ? (scoreboard.totalRepaid / total) * 100 : (repaid / total) * 100)
  const hasPayments = payments.callCount > 0

  return (
    <div>
      <div className={s.metricsGrid}>
        <div className={`${s.metricCard} ${s.credit}`}>
          <p className={s.metricLabel}>Credit</p>
          <p className={s.metricValue}>{wallet.creditUsed > 0 ? usd(wallet.creditUsed) : '\u2014'}</p>
          <p className={s.metricSub}>zero-collateral</p>
        </div>
        <div className={`${s.metricCard} ${s.revenue}`}>
          <p className={s.metricLabel}>Revenue</p>
          <p className={s.metricValue}>{earned > 0 ? usd(earned) : '\u2014'}</p>
          <p className={s.metricSub}>{payments.callCount} API calls</p>
        </div>
        <div className={`${s.metricCard} ${s.score}`}>
          <p className={s.metricLabel}>Score</p>
          <p className={s.metricValue}>{wallet.score > 0 ? wallet.score : '\u2014'}</p>
          <p className={s.metricSub}>{wallet.level > 0 ? `Level ${wallet.level}` : 'unrated'}</p>
        </div>
        <div className={`${s.metricCard} ${wallet.debt > 0 ? s.debtActive : repaid > 0 ? s.debtPaid : s.debt}`}>
          <p className={s.metricLabel}>Debt</p>
          <p className={s.metricValue}>{wallet.debt > 0 ? usd(wallet.debt) : usd(0)}</p>
          <p className={s.metricSub}>{wallet.debt <= 0 && repaid > 0 ? 'fully repaid' : 'outstanding'}</p>
        </div>
      </div>

      {(hasPayments || scoreboard) && (
        <div className={s.progressCard}>
          <div className={s.progressHeader}>
            <span className={s.progressLabel}>Loan Repayment</span>
            <span className={`${s.progressPct} ${pct >= 100 ? s.done : ''}`}>{pct.toFixed(0)}%</span>
          </div>
          <div className={s.progressTrack}>
            <div className={`${s.progressFill} ${pct >= 100 ? s.complete : ''}`} style={{ width: `${pct}%` }} />
          </div>
          <div className={s.progressRange}>
            <span>{usd(repaid)} repaid</span>
            <span>{usd(total)} total</span>
          </div>
        </div>
      )}

      {hasPayments && (
        <div className={s.splitCard}>
          <p className={s.splitTitle}>Per-call split ({usd(payments.total)} USDC)</p>
          {[
            { label: 'LP repayment', val: payments.lp,    color: '#10B981', pct: (payments.lp / payments.total) * 100 },
            { label: 'Protocol fee', val: payments.fee,   color: '#2563EB', pct: (payments.fee / payments.total) * 100 },
            { label: 'Agent keeps',  val: payments.agent, color: '#7C3AED', pct: (payments.agent / payments.total) * 100 },
          ].map(({ label, val, color, pct: p }) => (
            <div key={label} className={s.splitRow}>
              <span className={s.splitDot} style={{ background: color }} />
              <span className={s.splitLabel}>{label}</span>
              <span className={s.splitValue}>{usd(val, 3)}</span>
              <span className={s.splitPct}>{p.toFixed(0)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── On-Chain Proof ────────────────────────────────────────────────────────

function OnChainProof({ txs }: { txs: DemoState['txs'] }) {
  const txEntries = Object.entries(txs).map(([k, v]) => ({ step: Number(k), tx: v }))

  return (
    <div className={s.proofSection}>
      <div className={s.proofHeader}>
        <p className={s.proofTitle}>On-chain proof</p>
        <span className={s.proofBadge}>
          <span className={s.proofBadgeDot} />
          7 programs deployed
        </span>
      </div>

      <div className={s.proofCard}>
        <div className={s.proofCardHeader}>
          <div>
            <p className={s.proofCardTitle}>Deployed Solana Programs</p>
            <p className={s.proofCardSub}>Click any address to verify on Solscan</p>
          </div>
        </div>

        <div className={s.proofPrograms}>
          {PROGRAMS_FULL.map((p) => (
            <div key={p.addr} className={s.proofRow}>
              <div className={`${s.proofIcon} ${s[p.cls]}`}>{p.icon}</div>
              <div className={s.proofInfo}>
                <p className={s.proofName}>{p.name}</p>
                <p className={s.proofDesc}>{p.desc}</p>
              </div>
              <a href={accountUrl(p.addr)} target="_blank" rel="noopener noreferrer" className={s.proofAddr}>
                {sig(p.addr)} <ExtIcon className={s.proofAddrIcon} />
              </a>
            </div>
          ))}
        </div>

        <div className={s.proofTxSection}>
          <p className={s.proofTxTitle}>Demo Transactions</p>
          {txEntries.length > 0 ? (
            <div className={s.proofTxGrid}>
              {txEntries.map(({ step, tx }) => (
                <a key={step} href={scan(tx)} target="_blank" rel="noopener noreferrer" className={s.proofTxItem}>
                  <span className={s.proofTxStep}>{TX_LABELS[step]}</span>
                  <span className={s.proofTxHash}>{sig(tx)}</span>
                  <ExtIcon className={s.proofTxIcon} />
                </a>
              ))}
            </div>
          ) : (
            <p className={s.proofTxEmpty}>Run the demo to generate transaction signatures</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────

export default function DemoPage() {
  const [st, setSt] = useState<DemoState>(INITIAL)
  const wsRef = useRef<WebSocket | null>(null)
  const rcRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return
    try {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws
      ws.onopen  = () => setSt(p => ({ ...p, connected: true }))
      ws.onclose = () => { setSt(p => ({ ...p, connected: false })); rcRef.current = setTimeout(connect, 3000) }
      ws.onerror = () => ws.close()
      ws.onmessage = (e: MessageEvent<string>) => { try { handle(JSON.parse(e.data)) } catch { /* skip */ } }
    } catch { rcRef.current = setTimeout(connect, 3000) }
  }, []) // eslint-disable-line

  function addLog(e: LogEntry) { setSt(p => ({ ...p, log: [...p.log, e] })) }

  function handle(msg: WsEvent) {
    switch (msg.event) {
      case 'step_active': {
        const info = STEP_LOG[msg.data.step]
        setSt(p => ({ ...p, steps: { ...p.steps, [msg.data.step]: 'active' } }))
        addLog(mkLog(info.active, 'info', info.sub))
        break
      }
      case 'step_complete': {
        const info = STEP_LOG[msg.data.step]
        setSt(p => ({ ...p, steps: { ...p.steps, [msg.data.step]: 'done' }, txs: { ...p.txs, [msg.data.step]: msg.data.tx } }))
        addLog(mkLog(info.done, 'success', info.sub, msg.data.tx))
        break
      }
      case 'wallet_state':
        setSt(p => ({ ...p, wallet: { ...msg.data } }))
        break
      case 'payment_split': {
        const d = msg.data
        setSt(p => ({ ...p, payments: { total: d.total, lp: d.lp, fee: d.fee, agent: d.agent, callCount: d.callCount } }))
        addLog(mkLog(`Payment #${d.callCount}: ${usd(d.total)} received`, 'payment', `LP: ${usd(d.lp, 3)} \u00b7 Fee: ${usd(d.fee, 3)} \u00b7 Agent: ${usd(d.agent, 3)}`))
        break
      }
      case 'demo_complete':
        setSt(p => ({ ...p, scoreboard: msg.data.scoreboard, runState: 'done' }))
        addLog(mkLog('Demo complete \u2014 loan fully repaid, Krexit Score increased', 'complete', 'Every step is a real on-chain Solana transaction'))
        break
      case 'step_error': {
        setSt(p => ({ ...p, runState: 'error' }))
        addLog(mkLog(`Step ${msg.data.step} failed: ${msg.data.error}`, 'info'))
        break
      }
      case 'demo_status':
        if (msg.data.status === 'running') { _id = 0; setSt({ ...INITIAL, connected: true, runState: 'running' }) }
        if (msg.data.status === 'error') { setSt(p => ({ ...p, runState: 'error' })); addLog(mkLog(`Demo error: ${msg.data.error ?? 'unknown'}`, 'info')) }
        break
    }
  }

  useEffect(() => { connect(); return () => { if (rcRef.current) clearTimeout(rcRef.current); wsRef.current?.close() } }, [connect])

  async function start() {
    try {
      const r = await fetch(`${API_URL}/trigger`, { method: 'POST' })
      if (!r.ok) console.error('Trigger failed')
    } catch (e) { console.error('Could not reach demo server:', e) }
  }

  const done = STEPS.filter(x => st.steps[x.num] === 'done').length
  const running = st.runState === 'running'
  const finished = st.runState === 'done'

  return (
    <div className={s.page}>
      {/* Nav */}
      <nav className={s.nav}>
        <div className={s.navLeft}>
          <span className={s.navLogo}>KREXA</span>
          <span className={s.navSep} />
          <span className={s.navTitle}>Protocol Demo</span>
        </div>
        <div className={s.navRight}>
          <span className={s.statusDot}>
            <span className={`${s.dot} ${st.connected ? s.dotOn : s.dotOff}`} />
            <span>{st.connected ? 'Connected' : 'Connecting\u2026'}</span>
          </span>
          <span className={s.networkBadge}>
            <span className={s.networkDot} />
            Solana Devnet
          </span>
        </div>
      </nav>

      {/* Hero */}
      <section className={s.hero}>
        <div className={s.heroInner}>
          <div className={s.heroBadge}>
            <span className={s.heroBadgeDot} />
            Live on Solana {'\u2014'} every transaction is real
          </div>
          <h1 className={s.heroTitle}>
            The Complete <span className={s.heroAccent}>Credit Lifecycle</span><br />
            for AI Agents
          </h1>
          <p className={s.heroSub}>
            3 agent types. 5-component credit scoring. 4 credit levels. 3-tranche waterfall.
            See how an AI agent goes from zero to credit to revenue to full repayment {'\u2014'} entirely on-chain.
          </p>

          {!running && !finished && (
            <>
              {st.runState === 'error' && (
                <div style={{ marginBottom: 12, padding: '10px 16px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171', fontSize: 13 }}>
                  Demo hit an error (devnet can be flaky). Tap below to retry.
                </div>
              )}
              <button className={s.heroBtn} disabled={!st.connected} onClick={start}>
                <svg className={s.heroBtnIcon} fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                </svg>
                {st.runState === 'error' ? 'Retry Demo' : st.connected ? 'Start the Live Demo' : 'Connecting\u2026'}
              </button>
            </>
          )}
          {running && (
            <div className={s.heroRunning}>
              <span className={s.heroSpinner} />
              Chapter {Math.max(1, ...Object.entries(st.steps).filter(([, v]) => v !== 'pending').map(([k]) => Number(k)))} of 6 {'\u2014'} Running live{'\u2026'}
            </div>
          )}
          {finished && (
            <div className={s.heroDoneWrap}>
              <div className={s.heroCompleteMsg}>Story complete {'\u2014'} the agent repaid everything</div>
              <button className={s.heroDoneBtn} onClick={start}>
                {'\u21BB'} Watch Again
              </button>
            </div>
          )}

          <p className={s.heroProgress}>{done} / 6 chapters complete</p>
        </div>
      </section>

      {/* ── Educational Sections ── */}
      <ProtocolOverview />
      <AgentTypesSection />
      <KrexitScoreSection />
      <CreditLevelsSection />
      <TrancheSection />
      <KyaTiersSection />
      <InterestSection />

      {/* ── Live Demo Section Header ── */}
      <div className={s.liveDemoHeader}>
        <div className={s.eduLabel}>Live Demo</div>
        <h2 className={s.liveDemoHeaderTitle}>See It In Action</h2>
        <p className={s.liveDemoHeaderSub}>
          Every step below is a real Solana devnet transaction. Watch an AI agent go through the full credit lifecycle {'\u2014'} register, verify, borrow, earn, and repay.
        </p>
      </div>

      {/* Story + Live Panel Layout */}
      <div className={s.storyLayout}>
        {/* Left: Story chapters */}
        <div className={s.storyColumn}>
          <div className={s.storySectionLabel}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            The Krexa Story
          </div>
          {STORY_CHAPTERS.map((ch) => (
            <StoryChapter
              key={ch.num}
              chapter={ch}
              status={st.steps[ch.num]}
              tx={st.txs[ch.num]}
            />
          ))}
        </div>

        {/* Right: Live feed + metrics (sticky) */}
        <div className={s.liveColumn}>
          <div className={s.liveSticky}>
            <div className={s.feedSection}>
              <h3>
                Transaction Log
                {running && <span className={s.liveBadge}><span className={s.livePulse} /> LIVE</span>}
              </h3>
              <div className={s.feedBox}>
                <Feed log={st.log} runState={st.runState} />
              </div>
            </div>

            <div className={s.metricsSection}>
              <h3>Live Metrics</h3>
              <Metrics wallet={st.wallet} payments={st.payments} scoreboard={st.scoreboard} />
            </div>
          </div>
        </div>
      </div>

      {/* On-chain proof */}
      <OnChainProof txs={st.txs} />

      {/* Footer */}
      <footer className={s.footer}>
        <span className={s.footerText}>All transactions verifiable on Solscan (devnet)</span>
        <a href="https://krexa.xyz" target="_blank" rel="noopener noreferrer" className={s.footerLink}>
          krexa.xyz
        </a>
      </footer>
    </div>
  )
}
