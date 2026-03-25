/**
 * DemoPage — /demo
 *
 * Story-driven live demo with narrative UI.
 * Tells the Krexa hackathon story step by step.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
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
  { num: 4, label: 'Credit',    plain: '$50 zero-collateral' },
  { num: 5, label: 'Earn',      plain: '10 paid API calls' },
  { num: 6, label: 'Repay',     plain: 'Loan clears, score up' },
]

const STEP_LOG: Record<number, { active: string; done: string; sub: string }> = {
  1: { active: 'Registering agent on-chain\u2026',      done: 'Agent identity created on Solana',          sub: 'krexa-agent-registry' },
  2: { active: 'Running KYA verification\u2026',         done: 'KYA Tier 1 passed \u2014 agent is trusted',      sub: 'Automated compliance check' },
  3: { active: 'Initializing smart wallet\u2026',        done: 'PDA wallet live with spending controls',    sub: 'Per-trade and daily limits' },
  4: { active: 'Requesting $50 credit line\u2026',       done: '$50 zero-collateral credit extended',       sub: 'Underwritten by vault' },
  5: { active: 'Agent making paid API calls\u2026',      done: '10 \u00d7 $0.25 API calls completed',            sub: 'PaymentRouter auto-splits' },
  6: { active: 'Repaying loan from earnings\u2026',      done: 'Loan fully repaid \u2014 score increased',       sub: 'On-chain credit history' },
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
    body: 'Before anyone lends money to an AI, its capabilities and safety need to be verified. Krexa runs an automated Know-Your-Agent (KYA) check \u2014 the AI equivalent of a bank\'s KYC process.',
    what: 'The oracle verifies the agent\'s code, behavior patterns, and safety guarantees. It passes KYA Tier 1, unlocking access to credit.',
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
    title: 'Zero-Collateral Credit',
    headline: 'The agent borrows $50 \u2014 with nothing locked up.',
    body: 'This is the breakthrough. Traditional DeFi requires 150% collateral to borrow. Krexa extends credit based purely on the agent\'s KYA trust score \u2014 no collateral, no locked assets. The Credit Vault underwrites the loan from LP deposits.',
    what: 'The Credit Vault program extends a $50 USDC credit line. The agent can now spend up to $50 without depositing anything first.',
    program: 'krexa-credit-vault',
  },
  {
    num: 5,
    icon: '\u26A1',
    title: 'Earning Revenue',
    headline: 'The agent goes to work and earns money.',
    body: 'With credit in hand, the agent deploys a paid research API. Every time someone calls the API, the Payment Router automatically splits the $0.25 fee: part goes to repay the loan, part is a protocol fee, and the rest is the agent\'s profit.',
    what: 'The Payment Router processes 10 API calls at $0.25 each. Each payment is split on-chain in real time \u2014 LP repayment happens automatically.',
    program: 'krexa-payment-router',
  },
  {
    num: 6,
    icon: '\u2728',
    title: 'Full Repayment',
    headline: 'Loan repaid. Credit score goes up. Cycle complete.',
    body: 'After earning enough revenue, the agent\'s loan is fully repaid through automatic splits. Its on-chain credit score increases, unlocking higher credit limits for future operations. The full lifecycle \u2014 from zero to credit to revenue to repayment \u2014 happened entirely on-chain.',
    what: 'The Credit Vault records full repayment, and the agent\'s credit score increases. Next time, it can borrow more.',
    program: 'krexa-credit-vault',
  },
]

// ─── External link icon ─────────────────────────────────────────────────────

function ExtIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
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

const PROGRAMS = [
  { name: 'krexa-agent-registry',  desc: 'Agent identity & KYA tiers',         addr: 'ChJjAXy7sE4d4jst9VViG7ScanVKqH9Q1cFxtdcH78cG', icon: '\uD83C\uDD94', cls: 'registry' },
  { name: 'krexa-credit-vault',    desc: 'Zero-collateral credit underwriting', addr: '26SQx3rAyujWCupxvPAMf9N3ok4cw1awyTWAVWDQfr9N', icon: '\uD83C\uDFE6', cls: 'vault'    },
  { name: 'krexa-agent-wallet',    desc: 'Smart wallets with spend controls',   addr: '35t8yWLsUZNTLT71ej7DF59P81HrtZTx2uZeMhwuhhf6', icon: '\uD83D\uDC5B', cls: 'wallet'   },
  { name: 'krexa-venue-whitelist', desc: 'Approved venue registry',             addr: 'HyWQrHG14Sw6KpKYSMiBDmVj5u7PXfLWvim6FHbBLmua', icon: '\u2705', cls: 'venue'    },
  { name: 'krexa-payment-router',  desc: 'Automatic revenue split per call',    addr: '2Zy3d7C28Z9dfazdysKVBQUXnvvWNshxtDEFKftG83u8', icon: '\uD83D\uDD00', cls: 'router'   },
]

const TX_LABELS: Record<number, string> = {
  1: 'Register Agent',
  2: 'KYA Verification',
  3: 'Create Wallet',
  4: 'Extend Credit',
  5: 'API Payments',
  6: 'Full Repayment',
}

function progScan(addr: string) { return `https://solscan.io/account/${addr}${CLUSTER !== 'mainnet-beta' ? `?cluster=${CLUSTER}` : ''}` }

function OnChainProof({ txs }: { txs: DemoState['txs'] }) {
  const txEntries = Object.entries(txs).map(([k, v]) => ({ step: Number(k), tx: v }))

  return (
    <div className={s.proofSection}>
      <div className={s.proofHeader}>
        <p className={s.proofTitle}>On-chain proof</p>
        <span className={s.proofBadge}>
          <span className={s.proofBadgeDot} />
          5 programs deployed
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
          {PROGRAMS.map((p) => (
            <div key={p.addr} className={s.proofRow}>
              <div className={`${s.proofIcon} ${s[p.cls]}`}>{p.icon}</div>
              <div className={s.proofInfo}>
                <p className={s.proofName}>{p.name}</p>
                <p className={s.proofDesc}>{p.desc}</p>
              </div>
              <a href={progScan(p.addr)} target="_blank" rel="noopener noreferrer" className={s.proofAddr}>
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
        addLog(mkLog('Demo complete \u2014 loan fully repaid, credit score increased', 'complete', 'Every step is a real on-chain Solana transaction'))
        break
      case 'demo_status':
        if (msg.data.status === 'running') { _id = 0; setSt({ ...INITIAL, connected: true, runState: 'running' }) }
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
          <span className={s.navTitle}>Live Demo</span>
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
            Live on Solana \u2014 every transaction is real
          </div>
          <h1 className={s.heroTitle}>
            The Story of an AI Agent<br />
            That <span className={s.heroAccent}>Borrowed $50</span> and Paid It Back
          </h1>
          <p className={s.heroSub}>
            Follow along as a brand-new AI agent gets an on-chain identity, receives
            zero-collateral credit, earns revenue, and fully repays its loan \u2014 all
            live on Solana devnet.
          </p>

          {!running && !finished && (
            <button className={s.heroBtn} disabled={!st.connected} onClick={start}>
              <svg className={s.heroBtnIcon} fill="currentColor" viewBox="0 0 20 20">
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
              </svg>
              {st.connected ? 'Start the Story' : 'Connecting\u2026'}
            </button>
          )}
          {running && (
            <div className={s.heroRunning}>
              <span className={s.heroSpinner} />
              Chapter {Math.max(1, ...Object.entries(st.steps).filter(([, v]) => v !== 'pending').map(([k]) => Number(k)))} of 6 \u2014 Running live\u2026
            </div>
          )}
          {finished && (
            <div className={s.heroDoneWrap}>
              <div className={s.heroCompleteMsg}>Story complete \u2014 the agent repaid everything</div>
              <button className={s.heroDoneBtn} onClick={start}>
                \u21BB Watch Again
              </button>
            </div>
          )}

          <p className={s.heroProgress}>{done} / 6 chapters complete</p>
        </div>
      </section>

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
