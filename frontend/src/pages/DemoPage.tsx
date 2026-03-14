/**
 * DemoPage — /demo
 *
 * Story-driven live demo page. Plain English, clear narrative.
 * Visitors watch an AI agent borrow, earn, and repay — all on-chain.
 */
import { useEffect, useRef, useState, useCallback } from 'react'

// ─── Types ─────────────────────────────────────────────────────────────────

interface StepInfo {
  num: number
  label: string
  plain: string
}

type StepStatus = 'pending' | 'active' | 'done'

interface LogEntry {
  id: number
  text: string
  sub?: string
  tx?: string
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
  | { event: 'step_active';    data: { step: number } }
  | { event: 'step_complete';  data: { step: number; tx: string } }
  | { event: 'wallet_state';   data: { balance: number; debt: number; score: number; level: number; collateral: number; creditUsed: number } }
  | { event: 'safety_check';   data: { check: string; passed: boolean } }
  | { event: 'payment_split';  data: { total: number; lp: number; fee: number; agent: number; callCount: number } }
  | { event: 'demo_complete';  data: { scoreboard: DemoState['scoreboard'] } }
  | { event: 'demo_status';    data: { status: 'idle' | 'running' | 'done' | 'error'; error?: string } }

// ─── Config ─────────────────────────────────────────────────────────────────

const WS_URL  = import.meta.env.VITE_DEMO_WS_URL  ?? 'ws://localhost:3002'
const API_URL = import.meta.env.VITE_DEMO_API_URL ?? 'http://localhost:3002'

const STEPS: StepInfo[] = [
  { num: 1, label: 'Register',  plain: 'Agent creates on-chain identity'     },
  { num: 2, label: 'KYA',       plain: 'Automated trust verification passes' },
  { num: 3, label: 'Wallet',    plain: 'Smart wallet with spend limits opens' },
  { num: 4, label: 'Credit',    plain: '$50 credit line — no collateral'     },
  { num: 5, label: 'Earn',      plain: '10 API calls earn $2.50 in revenue'  },
  { num: 6, label: 'Repay',     plain: 'Loan repaid, credit score rises'     },
]

const STEP_LOG: Record<number, { active: string; done: string; sub: string }> = {
  1: { active: 'Registering agent on-chain…',          done: 'Agent identity created on Solana',          sub: 'Program: krexa-agent-registry' },
  2: { active: 'Running KYA verification checks…',     done: 'KYA Tier 1 passed — agent is trusted',      sub: 'Automated on-chain compliance' },
  3: { active: 'Initialising smart wallet…',           done: 'PDA wallet live with spending controls',    sub: 'Per-trade and daily limits enforced' },
  4: { active: 'Requesting $50 credit line…',          done: '$50 zero-collateral credit extended',       sub: 'Vault underwrites based on KYA score' },
  5: { active: 'Agent making paid API calls…',         done: '10 × $0.25 API calls completed',            sub: 'PaymentRouter splits every call on-chain' },
  6: { active: 'Repaying loan from earnings…',         done: 'Loan fully repaid — credit score increased',sub: 'On-chain credit history recorded forever' },
}

const INITIAL_STATE: DemoState = {
  runState: 'idle',
  steps: { 1: 'pending', 2: 'pending', 3: 'pending', 4: 'pending', 5: 'pending', 6: 'pending' },
  txs: {},
  wallet: { balance: 0, debt: 0, score: 0, level: 0, creditUsed: 0 },
  payments: { total: 0, lp: 0, fee: 0, agent: 0, callCount: 0 },
  scoreboard: null,
  log: [],
  connected: false,
}

let _logId = 0
function mkLog(text: string, type: LogEntry['type'], sub?: string, tx?: string): LogEntry {
  return { id: ++_logId, text, sub, tx, type }
}

function fmtUsd(n: number, d = 2) { return `$${n.toFixed(d)}` }
function shortSig(s: string) { return `${s.slice(0, 6)}…${s.slice(-4)}` }
function solscan(sig: string) { return `https://solscan.io/tx/${sig}?cluster=devnet` }

// ─── Step timeline ────────────────────────────────────────────────────────

function StepTimeline({ steps, txs }: { steps: DemoState['steps']; txs: DemoState['txs'] }) {
  return (
    <div className="flex items-start gap-0 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
      {STEPS.map((step, i) => {
        const status = steps[step.num]
        const tx = txs[step.num]
        const isLast = i === STEPS.length - 1

        return (
          <div key={step.num} className="flex items-center flex-shrink-0" style={{ minWidth: 0 }}>
            {/* Step node */}
            <div className="flex flex-col items-center" style={{ width: 100 }}>
              {/* Circle */}
              <div className={`relative flex items-center justify-center rounded-full transition-all duration-500 ${
                status === 'done'   ? 'w-9 h-9 bg-emerald-500 shadow-lg shadow-emerald-200' :
                status === 'active' ? 'w-9 h-9 bg-blue-500 shadow-lg shadow-blue-200' :
                                     'w-8 h-8 bg-white border-2 border-slate-200'
              }`}>
                {status === 'active' && (
                  <span className="absolute inset-0 rounded-full bg-blue-400 opacity-40 animate-ping" />
                )}
                {status === 'done' ? (
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : status === 'active' ? (
                  <span className="w-2 h-2 rounded-full bg-white" />
                ) : (
                  <span className="text-xs font-bold text-slate-400">{step.num}</span>
                )}
              </div>

              {/* Label */}
              <div className="mt-2 text-center px-1">
                <p className={`text-xs font-bold ${
                  status === 'done' ? 'text-emerald-600' :
                  status === 'active' ? 'text-blue-600' : 'text-slate-400'
                }`}>{step.label}</p>
                <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{step.plain}</p>
                {tx && (
                  <a
                    href={solscan(tx)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 mt-1 text-[10px] font-mono text-blue-400 hover:text-blue-600 transition-colors"
                  >
                    {shortSig(tx)}
                    <svg className="w-2 h-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}
              </div>
            </div>

            {/* Connector */}
            {!isLast && (
              <div
                className="h-0.5 flex-1 mx-1 transition-colors duration-700 mt-[-28px]"
                style={{
                  minWidth: 16,
                  background: status === 'done' ? '#10b981' : '#e2e8f0',
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Activity feed ────────────────────────────────────────────────────────

function ActivityFeed({ log, runState }: { log: LogEntry[]; runState: DemoState['runState'] }) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [log.length])

  if (log.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12 text-center px-6">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
          <svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-slate-500">Events will appear here</p>
        <p className="text-xs text-slate-400 mt-1">
          {runState === 'idle' ? 'Click Start Demo to begin' : 'Waiting for first event…'}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 py-2">
      {log.map((entry) => (
        <div
          key={entry.id}
          className={`flex items-start gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
            entry.type === 'complete' ? 'bg-emerald-50 border border-emerald-100' :
            entry.type === 'payment'  ? 'bg-blue-50 border border-blue-100' :
            entry.type === 'success'  ? 'bg-slate-50 border border-slate-100' :
                                       'bg-white border border-slate-100'
          }`}
        >
          {/* Icon */}
          <span className="flex-shrink-0 mt-0.5 text-base">
            {entry.type === 'complete' ? '🎉' :
             entry.type === 'payment'  ? '💰' :
             entry.type === 'success'  ? '✅' : '⏳'}
          </span>

          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold leading-snug ${
              entry.type === 'complete' ? 'text-emerald-700' :
              entry.type === 'payment'  ? 'text-blue-700' :
              entry.type === 'success'  ? 'text-slate-700' : 'text-slate-600'
            }`}>{entry.text}</p>

            {entry.sub && (
              <p className="text-xs text-slate-400 mt-0.5">{entry.sub}</p>
            )}

            {entry.tx && (
              <a
                href={solscan(entry.tx)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-1 text-[11px] font-mono text-blue-500 hover:text-blue-700 transition-colors"
              >
                View on Solscan: {shortSig(entry.tx)}
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}

// ─── Live metrics ─────────────────────────────────────────────────────────

function LiveMetrics({ wallet, payments, scoreboard }: {
  wallet: DemoState['wallet']
  payments: DemoState['payments']
  scoreboard: DemoState['scoreboard']
}) {
  const earned = payments.agent * payments.callCount
  const repaid = payments.lp * payments.callCount
  const creditTotal = 50
  const repaidPct = Math.min(100, scoreboard
    ? (scoreboard.totalRepaid / creditTotal) * 100
    : (repaid / creditTotal) * 100
  )

  const metrics = [
    {
      label: 'Credit Line',
      value: wallet.creditUsed > 0 ? fmtUsd(wallet.creditUsed) : '—',
      sub: 'zero-collateral',
      color: '#3b82f6',
      bg: '#eff6ff',
    },
    {
      label: 'API Revenue',
      value: earned > 0 ? fmtUsd(earned) : '—',
      sub: `${payments.callCount} API calls`,
      color: '#10b981',
      bg: '#f0fdf4',
    },
    {
      label: 'Credit Score',
      value: wallet.score > 0 ? String(wallet.score) : '—',
      sub: wallet.level > 0 ? `Level ${wallet.level}` : 'unrated',
      color: '#8b5cf6',
      bg: '#faf5ff',
    },
    {
      label: 'Debt',
      value: wallet.debt > 0 ? fmtUsd(wallet.debt) : fmtUsd(0),
      sub: wallet.debt <= 0 && repaid > 0 ? '✓ fully repaid' : 'outstanding',
      color: wallet.debt <= 0 && repaid > 0 ? '#10b981' : wallet.debt > 0 ? '#ef4444' : '#94a3b8',
      bg: wallet.debt <= 0 && repaid > 0 ? '#f0fdf4' : '#fff',
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-3">
        {metrics.map(({ label, value, sub, color, bg }) => (
          <div
            key={label}
            className="rounded-2xl border p-4 transition-all duration-500"
            style={{ background: bg, borderColor: `${color}20` }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: `${color}99` }}>
              {label}
            </p>
            <p className="text-xl font-bold font-mono leading-none" style={{ color }}>
              {value}
            </p>
            <p className="text-[11px] mt-1" style={{ color: `${color}80` }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* Repayment progress bar */}
      {(payments.callCount > 0 || scoreboard) && (
        <div className="rounded-2xl border border-slate-100 bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-600">Loan Repayment Progress</p>
            <p className={`text-xs font-bold ${repaidPct >= 100 ? 'text-emerald-600' : 'text-blue-600'}`}>
              {repaidPct.toFixed(0)}%
            </p>
          </div>
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${repaidPct}%`,
                background: repaidPct >= 100
                  ? 'linear-gradient(90deg, #10b981, #34d399)'
                  : 'linear-gradient(90deg, #3b82f6, #60a5fa)',
              }}
            />
          </div>
          <div className="flex justify-between mt-1.5 text-[11px] font-mono text-slate-400">
            <span>{fmtUsd(repaid)} repaid</span>
            <span>{fmtUsd(creditTotal)} total</span>
          </div>
        </div>
      )}

      {/* How the split works */}
      {payments.callCount > 0 && (
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-semibold text-slate-500 mb-2.5">Per-call split (${payments.total.toFixed(2)} USDC)</p>
          {[
            { label: 'LP repayment', value: payments.lp,    color: '#10b981', pct: (payments.lp / payments.total) * 100 },
            { label: 'Protocol fee', value: payments.fee,   color: '#3b82f6', pct: (payments.fee / payments.total) * 100 },
            { label: 'Agent keeps',  value: payments.agent, color: '#8b5cf6', pct: (payments.agent / payments.total) * 100 },
          ].map(({ label, value, color, pct }) => (
            <div key={label} className="flex items-center gap-2 mb-1.5 last:mb-0">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
              <p className="text-xs text-slate-500 flex-1">{label}</p>
              <p className="text-xs font-mono font-semibold" style={{ color }}>{fmtUsd(value, 3)}</p>
              <p className="text-[10px] text-slate-400 w-8 text-right">{pct.toFixed(0)}%</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────

export default function DemoPage() {
  const [state, setState] = useState<DemoState>(INITIAL_STATE)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return
    try {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws
      ws.onopen  = () => setState(s => ({ ...s, connected: true }))
      ws.onclose = () => {
        setState(s => ({ ...s, connected: false }))
        reconnectRef.current = setTimeout(connect, 3000)
      }
      ws.onerror = () => ws.close()
      ws.onmessage = (ev: MessageEvent<string>) => {
        try { handleEvent(JSON.parse(ev.data) as WsEvent) } catch { /* ignore */ }
      }
    } catch {
      reconnectRef.current = setTimeout(connect, 3000)
    }
  }, []) // eslint-disable-line

  function addLog(entry: LogEntry) {
    setState(s => ({ ...s, log: [...s.log, entry] }))
  }

  function handleEvent(msg: WsEvent) {
    switch (msg.event) {
      case 'step_active': {
        const info = STEP_LOG[msg.data.step]
        setState(s => ({ ...s, steps: { ...s.steps, [msg.data.step]: 'active' } }))
        addLog(mkLog(info.active, 'info', info.sub))
        break
      }
      case 'step_complete': {
        const info = STEP_LOG[msg.data.step]
        setState(s => ({
          ...s,
          steps: { ...s.steps, [msg.data.step]: 'done' },
          txs: { ...s.txs, [msg.data.step]: msg.data.tx },
        }))
        addLog(mkLog(info.done, 'success', info.sub, msg.data.tx))
        break
      }
      case 'wallet_state':
        setState(s => ({ ...s, wallet: { ...msg.data } }))
        break
      case 'payment_split': {
        const d = msg.data
        setState(s => ({ ...s, payments: { total: d.total, lp: d.lp, fee: d.fee, agent: d.agent, callCount: d.callCount } }))
        addLog(mkLog(
          `Payment #${d.callCount}: ${fmtUsd(d.total)} received`,
          'payment',
          `LP: ${fmtUsd(d.lp, 3)} | Fee: ${fmtUsd(d.fee, 3)} | Agent keeps: ${fmtUsd(d.agent, 3)}`,
        ))
        break
      }
      case 'demo_complete':
        setState(s => ({ ...s, scoreboard: msg.data.scoreboard, runState: 'done' }))
        addLog(mkLog(
          '🎉 Demo complete — loan fully repaid, credit score increased',
          'complete',
          'Every step above is a real on-chain transaction on Solana devnet',
        ))
        break
      case 'demo_status':
        if (msg.data.status === 'running') {
          _logId = 0
          setState({ ...INITIAL_STATE, connected: true, runState: 'running' })
        }
        break
    }
  }

  useEffect(() => {
    connect()
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  async function handleStartDemo() {
    try {
      const res = await fetch(`${API_URL}/trigger`, { method: 'POST' })
      if (!res.ok) console.error('Trigger failed:', await res.json().catch(() => ({})))
    } catch (err) {
      console.error('Could not reach demo server:', err)
    }
  }

  const doneCount = STEPS.filter(s => state.steps[s.num] === 'done').length
  const isRunning = state.runState === 'running'
  const isDone    = state.runState === 'done'

  return (
    <>
      <style>{`
        .demo-page * { box-sizing: border-box; }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .log-enter { animation: fadeSlideUp 0.3s ease-out both; }
      `}</style>

      <div
        className="demo-page min-h-screen flex flex-col"
        style={{
          background: '#f8fafc',
          color: '#0f172a',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
        }}
      >
        {/* ── Header ── */}
        <header
          className="flex items-center justify-between px-5 py-3.5 border-b bg-white"
          style={{ borderColor: '#e2e8f0' }}
        >
          <div className="flex items-center gap-2.5">
            <span className="text-lg font-black tracking-tight text-slate-900">KREXA</span>
            <span className="text-slate-200 hidden sm:block">|</span>
            <span className="hidden sm:block text-sm text-slate-400 font-medium">Live Agent Credit Demo</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full transition-colors ${state.connected ? 'bg-emerald-400' : 'bg-slate-300'}`} />
              <span className="text-xs text-slate-400 hidden sm:block">
                {state.connected ? 'Connected' : 'Connecting…'}
              </span>
            </div>
            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-3 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
              Solana Devnet
            </span>
          </div>
        </header>

        {/* ── Hero ── */}
        <div className="bg-white border-b" style={{ borderColor: '#e2e8f0' }}>
          <div className="max-w-5xl mx-auto px-5 py-8 md:py-10">
            <div className="flex flex-col md:flex-row md:items-center gap-6 md:gap-10">
              <div className="flex-1">
                <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-100 rounded-full px-3 py-1 mb-4">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  Every transaction is real — verifiable on Solscan
                </div>
                <h1 className="text-2xl md:text-3xl font-black text-slate-900 leading-tight mb-2">
                  An AI agent borrows $50,<br className="hidden sm:block" /> earns revenue, and repays it.
                </h1>
                <p className="text-base text-slate-500 leading-relaxed max-w-lg">
                  Watch Krexa's full credit lifecycle happen live on Solana devnet — from on-chain identity to zero-collateral credit to automatic loan repayment.
                </p>
              </div>

              {/* CTA */}
              <div className="flex flex-col items-start md:items-center gap-3 flex-shrink-0">
                {!isRunning && !isDone && (
                  <button
                    onClick={handleStartDemo}
                    disabled={!state.connected}
                    className="flex items-center gap-2.5 px-7 py-3.5 rounded-2xl text-base font-bold text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
                    style={{
                      background: state.connected
                        ? 'linear-gradient(135deg, #2563eb, #7c3aed)'
                        : '#94a3b8',
                      boxShadow: state.connected ? '0 4px 24px rgba(37,99,235,0.35)' : 'none',
                    }}
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                    </svg>
                    {state.connected ? 'Start Demo' : 'Connecting…'}
                  </button>
                )}
                {isRunning && (
                  <div className="flex items-center gap-2.5 px-7 py-3.5 rounded-2xl bg-blue-50 border border-blue-200">
                    <div className="w-4 h-4 rounded-full border-2 border-blue-300 border-t-blue-600 animate-spin" />
                    <span className="text-sm font-bold text-blue-700">Demo running live…</span>
                  </div>
                )}
                {isDone && (
                  <button
                    onClick={handleStartDemo}
                    className="flex items-center gap-2 px-7 py-3.5 rounded-2xl text-sm font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Run Again
                  </button>
                )}
                <p className="text-xs text-slate-400 text-center">
                  {doneCount} / 6 steps complete
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Step Timeline ── */}
        <div className="bg-white border-b" style={{ borderColor: '#e2e8f0' }}>
          <div className="max-w-5xl mx-auto px-5 py-5">
            <StepTimeline steps={state.steps} txs={state.txs} />
          </div>
        </div>

        {/* ── Main content — Activity + Metrics ── */}
        <main className="flex-1 max-w-5xl mx-auto w-full px-4 md:px-5 py-5">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">

            {/* Activity feed — left, wider */}
            <div className="md:col-span-3 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">What's happening</h2>
                {isRunning && (
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                    LIVE
                  </span>
                )}
              </div>
              <div
                className="rounded-2xl border bg-white overflow-y-auto flex-1"
                style={{ borderColor: '#e2e8f0', minHeight: 320, maxHeight: 480 }}
              >
                <ActivityFeed log={state.log} runState={state.runState} />
              </div>
            </div>

            {/* Metrics — right */}
            <div className="md:col-span-2 flex flex-col">
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Live Metrics</h2>
              <LiveMetrics wallet={state.wallet} payments={state.payments} scoreboard={state.scoreboard} />
            </div>

          </div>

          {/* ── How it works strip ── */}
          <div
            className="mt-4 rounded-2xl border px-5 py-4 bg-white"
            style={{ borderColor: '#e2e8f0' }}
          >
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">How it works</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { n: '①', title: 'On-chain identity',      text: 'Agent registers with KYA verification — fully automated, no human review' },
                { n: '②', title: 'Zero-collateral credit', text: 'Credit vault extends $50 based on KYA score alone — no locked assets' },
                { n: '③', title: 'Revenue via x402',       text: 'Agent deploys a paid research API and earns $0.25 per call' },
                { n: '④', title: 'Automatic repayment',    text: 'PaymentRouter splits every call — LP repayment happens on-chain in real time' },
              ].map(({ n, title, text }) => (
                <div key={n} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50">
                  <span className="text-sm font-bold text-blue-500 flex-shrink-0 mt-0.5">{n}</span>
                  <div>
                    <p className="text-xs font-bold text-slate-700">{title}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>

        {/* ── Footer ── */}
        <footer
          className="flex items-center justify-between px-5 py-3 border-t text-xs text-slate-400 bg-white"
          style={{ borderColor: '#e2e8f0' }}
        >
          <span>All transactions verifiable on Solscan (devnet)</span>
          <a href="https://krexa.xyz" target="_blank" rel="noopener noreferrer"
            className="font-semibold text-blue-500 hover:text-blue-700 transition-colors">
            krexa.xyz
          </a>
        </footer>
      </div>
    </>
  )
}
