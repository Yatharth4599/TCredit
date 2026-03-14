/**
 * DemoPage — /demo
 *
 * Story-driven live demo. Matches LandingPage design system.
 * CSS Modules for proper alignment + responsive layout.
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

const WS_URL  = import.meta.env.VITE_DEMO_WS_URL  ?? 'ws://localhost:3002'
const API_URL = import.meta.env.VITE_DEMO_API_URL ?? 'http://localhost:3002'

const STEPS: StepInfo[] = [
  { num: 1, label: 'Register',  plain: 'On-chain identity' },
  { num: 2, label: 'KYA',       plain: 'Trust verification' },
  { num: 3, label: 'Wallet',    plain: 'Smart wallet + limits' },
  { num: 4, label: 'Credit',    plain: '$50 zero-collateral' },
  { num: 5, label: 'Earn',      plain: '10 paid API calls' },
  { num: 6, label: 'Repay',     plain: 'Loan clears, score up' },
]

const STEP_LOG: Record<number, { active: string; done: string; sub: string }> = {
  1: { active: 'Registering agent on-chain…',      done: 'Agent identity created on Solana',          sub: 'krexa-agent-registry' },
  2: { active: 'Running KYA verification…',         done: 'KYA Tier 1 passed — agent is trusted',      sub: 'Automated compliance check' },
  3: { active: 'Initializing smart wallet…',        done: 'PDA wallet live with spending controls',    sub: 'Per-trade and daily limits' },
  4: { active: 'Requesting $50 credit line…',       done: '$50 zero-collateral credit extended',       sub: 'Underwritten by vault' },
  5: { active: 'Agent making paid API calls…',      done: '10 × $0.25 API calls completed',            sub: 'PaymentRouter auto-splits' },
  6: { active: 'Repaying loan from earnings…',      done: 'Loan fully repaid — score increased',       sub: 'On-chain credit history' },
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
const sig = (s: string) => `${s.slice(0, 6)}…${s.slice(-4)}`
const scan = (s: string) => `https://solscan.io/tx/${s}?cluster=devnet`

// ─── External link icon (shared) ───────────────────────────────────────────

function ExtIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  )
}

// ─── Step Timeline ─────────────────────────────────────────────────────────

function Timeline({ steps, txs }: { steps: DemoState['steps']; txs: DemoState['txs'] }) {
  return (
    <div className={s.timeline}>
      <div className={s.timelineInner}>
        {STEPS.map((step) => {
          const st = steps[step.num]
          const tx = txs[step.num]
          return (
            <div key={step.num} className={`${s.timelineStep} ${st === 'done' ? s.done : ''}`}>
              <div className={`${s.stepCircle} ${s[st]}`}>
                {st === 'done' ? (
                  <svg className={s.stepCheck} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : st === 'active' ? (
                  <span className={s.activeDot} />
                ) : (
                  <span className={s.stepNum}>{step.num}</span>
                )}
              </div>
              <span className={`${s.stepLabel} ${st === 'active' ? s.activeLabel : st === 'done' ? s.doneLabel : ''}`}>
                {step.label}
              </span>
              <span className={s.stepPlain}>{step.plain}</span>
              {tx && (
                <a href={scan(tx)} target="_blank" rel="noopener noreferrer" className={s.stepTx}>
                  {sig(tx)} <ExtIcon className={s.stepTxIcon} />
                </a>
              )}
            </div>
          )
        })}
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
        <p className={s.feedEmptyTitle}>Events will appear here</p>
        <p className={s.feedEmptySub}>
          {runState === 'idle' ? 'Press Start Demo to begin' : 'Waiting for events…'}
        </p>
      </div>
    )
  }

  const icons: Record<string, string> = { info: '⏳', success: '✓', payment: '$', complete: '✦' }

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
          <p className={s.metricValue}>{wallet.creditUsed > 0 ? usd(wallet.creditUsed) : '—'}</p>
          <p className={s.metricSub}>zero-collateral</p>
        </div>
        <div className={`${s.metricCard} ${s.revenue}`}>
          <p className={s.metricLabel}>Revenue</p>
          <p className={s.metricValue}>{earned > 0 ? usd(earned) : '—'}</p>
          <p className={s.metricSub}>{payments.callCount} API calls</p>
        </div>
        <div className={`${s.metricCard} ${s.score}`}>
          <p className={s.metricLabel}>Score</p>
          <p className={s.metricValue}>{wallet.score > 0 ? wallet.score : '—'}</p>
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
        addLog(mkLog(`Payment #${d.callCount}: ${usd(d.total)} received`, 'payment', `LP: ${usd(d.lp, 3)} · Fee: ${usd(d.fee, 3)} · Agent: ${usd(d.agent, 3)}`))
        break
      }
      case 'demo_complete':
        setSt(p => ({ ...p, scoreboard: msg.data.scoreboard, runState: 'done' }))
        addLog(mkLog('Demo complete — loan fully repaid, credit score increased', 'complete', 'Every step is a real on-chain Solana transaction'))
        break
      case 'demo_status':
        if (msg.data.status === 'running') { _id = 0; setSt({ ...INITIAL, connected: true, runState: 'running' }) }
        break
    }
  }

  useEffect(() => { connect(); return () => { if (rcRef.current) clearTimeout(rcRef.current); wsRef.current?.close() } }, [connect])

  async function start() {
    try { const r = await fetch(`${API_URL}/trigger`, { method: 'POST' }); if (!r.ok) console.error('Trigger failed') }
    catch (e) { console.error('Could not reach demo server:', e) }
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
          <span className={s.navTitle}>Live Agent Credit Demo</span>
        </div>
        <div className={s.navRight}>
          <span className={s.statusDot}>
            <span className={`${s.dot} ${st.connected ? s.dotOn : s.dotOff}`} />
            <span>{st.connected ? 'Connected' : 'Connecting…'}</span>
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
            Live on Solana — every transaction is real
          </div>
          <h1 className={s.heroTitle}>
            An AI agent <span className={s.heroAccent}>borrows $50</span>,{' '}
            earns revenue, and repays it.
          </h1>
          <p className={s.heroSub}>
            Watch the full Krexa credit lifecycle happen live on Solana devnet — from on-chain
            identity to zero-collateral credit to automatic loan repayment.
          </p>

          {!running && !finished && (
            <button className={s.heroBtn} disabled={!st.connected} onClick={start}>
              <svg className={s.heroBtnIcon} fill="currentColor" viewBox="0 0 20 20">
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
              </svg>
              {st.connected ? 'Start Demo' : 'Connecting…'}
            </button>
          )}
          {running && (
            <div className={s.heroRunning}>
              <span className={s.heroSpinner} />
              Running live on Solana devnet…
            </div>
          )}
          {finished && (
            <button className={s.heroDoneBtn} onClick={start}>
              ↻ Run Again
            </button>
          )}

          <p className={s.heroProgress}>{done} / 6 steps complete</p>
        </div>
      </section>

      {/* Timeline */}
      <Timeline steps={st.steps} txs={st.txs} />

      {/* Main — feed + metrics */}
      <div className={s.main}>
        <div className={s.feedSection}>
          <h3>
            What's happening
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

      {/* How it works */}
      <div className={s.howItWorks}>
        <p className={s.howTitle}>How it works</p>
        <div className={s.howGrid}>
          {[
            { n: '01', t: 'On-chain identity',      d: 'Agent registers with KYA verification — fully automated, no human review' },
            { n: '02', t: 'Zero-collateral credit',  d: 'Credit vault extends $50 based on KYA score alone — no locked assets' },
            { n: '03', t: 'Revenue via x402',         d: 'Agent deploys a paid research API and earns $0.25 per call' },
            { n: '04', t: 'Automatic repayment',      d: 'PaymentRouter splits every call — LP repayment happens in real time' },
          ].map(({ n, t, d }) => (
            <div key={n} className={s.howCard}>
              <div className={s.howNum}>{n}</div>
              <p className={s.howCardTitle}>{t}</p>
              <p className={s.howCardText}>{d}</p>
            </div>
          ))}
        </div>
      </div>

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
