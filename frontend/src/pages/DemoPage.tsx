/**
 * DemoPage — /demo
 *
 * Live dashboard for the Krexa agent credit lifecycle demo.
 * Connects to run-demo.ts via WebSocket on ws://localhost:3002.
 * Light theme, white background, no wallet connect required.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import Logo from '../assets/svg/logo'

// ─── Types ─────────────────────────────────────────────────────────────────

interface StepInfo {
  num: number
  label: string
  description: string
}

type StepStatus = 'pending' | 'active' | 'done'

interface DemoState {
  steps: Record<number, StepStatus>
  txs: Record<number, string>
  wallet: {
    balance: number
    debt: number
    score: number
    level: number
    collateral: number
    creditUsed: number
  }
  checks: {
    pdaActive: boolean
    venueWhitelisted: boolean
    underTradeLimit: boolean
    healthOk: boolean
    dailyLimitOk: boolean
  }
  payments: {
    total: number
    lp: number
    fee: number
    agent: number
    callCount: number
    lastSplitFlash: boolean
  }
  scoreboard: {
    totalRevenue: number
    totalRepaid: number
    totalPlatform: number
    remainingDebt: number
    creditTaken: number
  } | null
  connected: boolean
}

type WsEvent =
  | { event: 'step_active'; data: { step: number } }
  | { event: 'step_complete'; data: { step: number; tx: string } }
  | { event: 'wallet_state'; data: { balance: number; debt: number; score: number; level: number; collateral: number; creditUsed: number } }
  | { event: 'safety_check'; data: { check: keyof DemoState['checks']; passed: boolean } }
  | { event: 'payment_split'; data: { total: number; lp: number; fee: number; agent: number; callCount: number } }
  | { event: 'demo_complete'; data: { scoreboard: DemoState['scoreboard'] } }
  | { event: 'demo_status'; data: { status: 'idle' | 'running' | 'done' | 'error'; lastRunAt?: string; error?: string } }

// ─── Env ────────────────────────────────────────────────────────────────────

const WS_URL  = import.meta.env.VITE_WS_URL  ?? 'ws://localhost:3002'
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3002'

// ─── Constants ─────────────────────────────────────────────────────────────

const STEPS: StepInfo[] = [
  { num: 1, label: 'Register Agent',    description: 'Create on-chain profile' },
  { num: 2, label: 'KYA Verification',  description: 'Tier 1 — automated checks' },
  { num: 3, label: 'Create Wallet',     description: 'Initialize PDA wallet' },
  { num: 4, label: 'Request Credit',    description: '$50 zero-collateral, Level 1' },
  { num: 5, label: 'Earn Revenue',      description: '10× x402 payments at $0.25' },
  { num: 6, label: 'Full Repayment',    description: 'Loan clears → score increases' },
]

const CREDIT_TOTAL = 50

const INITIAL_STATE: DemoState = {
  steps: { 1: 'pending', 2: 'pending', 3: 'pending', 4: 'pending', 5: 'pending', 6: 'pending' },
  txs: {},
  wallet: { balance: 0, debt: 0, score: 0, level: 0, collateral: 0, creditUsed: 0 },
  checks: { pdaActive: false, venueWhitelisted: false, underTradeLimit: false, healthOk: false, dailyLimitOk: false },
  payments: { total: 0, lp: 0, fee: 0, agent: 0, callCount: 0, lastSplitFlash: false },
  scoreboard: null,
  connected: false,
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtUsd(n: number, decimals = 2) {
  return `$${n.toFixed(decimals)}`
}

function solscanLink(sig: string) {
  return `https://solscan.io/tx/${sig}?cluster=devnet`
}

function shortSig(sig: string) {
  return `${sig.slice(0, 6)}…${sig.slice(-4)}`
}

// ─── Sub-components ─────────────────────────────────────────────────────────

// Step status icon
function StepIcon({ status }: { status: StepStatus }) {
  if (status === 'done') {
    return (
      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-emerald-50 border border-emerald-200">
        <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </span>
    )
  }
  if (status === 'active') {
    return (
      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-50 border border-blue-300 relative">
        <span className="absolute inset-0 rounded-full bg-blue-400 opacity-20 animate-ping" />
        <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
      </span>
    )
  }
  return (
    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-50 border border-slate-200">
      <span className="w-2 h-2 rounded-full bg-slate-300" />
    </span>
  )
}

// Step tracker panel
function StepTracker({ state, onStartDemo }: { state: DemoState; onStartDemo: () => void }) {
  const anyActive = Object.values(state.steps).includes('active')
  const anyDone = Object.values(state.steps).includes('done')
  const allDone = STEPS.every(s => state.steps[s.num] === 'done')

  return (
    <div className="flex flex-col gap-0">
      <div className="mb-5">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">
          Demo Steps
        </h2>
        <div className="flex flex-col gap-1">
          {STEPS.map((step, i) => {
            const status = state.steps[step.num]
            const tx = state.txs[step.num]
            const isLast = i === STEPS.length - 1

            return (
              <div key={step.num} className="relative">
                {/* Connector line */}
                {!isLast && (
                  <div
                    className="absolute left-3.5 top-7 w-px h-full -bottom-1"
                    style={{ background: status === 'done' ? '#10b981' : '#e2e8f0' }}
                  />
                )}
                <div className={`flex items-start gap-3 px-3 py-2.5 rounded-xl transition-colors duration-200 ${status === 'active' ? 'bg-blue-50' : status === 'done' ? 'bg-slate-50' : ''}`}>
                  <StepIcon status={status} />
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold ${status === 'done' ? 'text-slate-700' : status === 'active' ? 'text-blue-700' : 'text-slate-400'}`}>
                        {step.label}
                      </span>
                      {status === 'active' && (
                        <span className="text-[10px] font-medium text-blue-500 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">
                          LIVE
                        </span>
                      )}
                    </div>
                    <p className={`text-[11px] mt-0.5 ${status === 'active' ? 'text-blue-500' : 'text-slate-400'}`}>
                      {step.description}
                    </p>
                    {tx && (
                      <a
                        href={solscanLink(tx)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-1 text-[10px] text-blue-500 hover:text-blue-700 transition-colors"
                      >
                        <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{shortSig(tx)}</span>
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Start button */}
      {!anyActive && !anyDone && (
        <button
          onClick={onStartDemo}
          className="w-full py-2.5 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98] transition-all shadow-sm"
        >
          Start Demo
        </button>
      )}
      {allDone && (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
          <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs font-semibold text-emerald-700">Demo Complete</span>
        </div>
      )}

      {/* Connection status */}
      <div className="mt-4 flex items-center gap-2">
        <span className={`w-1.5 h-1.5 rounded-full ${state.connected ? 'bg-emerald-400' : 'bg-slate-300'}`} />
        <span className="text-[11px] text-slate-400">
          {state.connected ? 'Live — WebSocket connected' : 'Waiting for demo script…'}
        </span>
      </div>
    </div>
  )
}

// Wallet state panel
function WalletState({ wallet, checks }: { wallet: DemoState['wallet']; checks: DemoState['checks'] }) {
  const hasCredit = wallet.creditUsed > 0
  const healthFactor = hasCredit && wallet.collateral > 0
    ? (wallet.balance / wallet.debt)
    : null

  function healthColor(hf: number | null) {
    if (hf === null) return 'text-slate-400'
    if (hf > 1.5) return 'text-emerald-500'
    if (hf > 1.2) return 'text-amber-500'
    return 'text-red-500'
  }

  const checkItems = [
    { key: 'pdaActive' as const,         label: 'PDA wallet active' },
    { key: 'venueWhitelisted' as const,  label: 'Venue whitelisted' },
    { key: 'underTradeLimit' as const,   label: 'Under trade limit' },
    { key: 'healthOk' as const,          label: 'Health factor OK' },
    { key: 'dailyLimitOk' as const,      label: 'Daily limit OK' },
  ]

  return (
    <div className="flex flex-col gap-4">
      {/* Wallet metrics */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
          Wallet State
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Balance', value: fmtUsd(wallet.balance), color: 'text-slate-800' },
            { label: 'Debt',    value: fmtUsd(wallet.debt),    color: wallet.debt > 0 ? 'text-red-500' : 'text-slate-800' },
            {
              label: 'Health',
              value: healthFactor !== null ? healthFactor.toFixed(2) + '×' : '∞',
              color: healthColor(healthFactor),
            },
            { label: 'Score',   value: String(wallet.score),   color: 'text-blue-600' },
            { label: 'Level',   value: wallet.level > 0 ? `L${wallet.level}` : '—', color: 'text-slate-800' },
            { label: 'Collateral', value: fmtUsd(wallet.collateral), color: 'text-slate-800' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5">
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">{label}</p>
              <p className={`text-sm font-bold ${color}`} style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                {value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Safety checks */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
          Safety Checks
        </h2>
        <div className="flex flex-col gap-1.5">
          {checkItems.map(({ key, label }) => (
            <div key={key} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-colors duration-300 ${checks[key] ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
              <span className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center ${checks[key] ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                {checks[key] ? (
                  <svg className="w-2.5 h-2.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                )}
              </span>
              <span className={`text-xs font-medium ${checks[key] ? 'text-emerald-700' : 'text-slate-400'}`}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Revenue split panel — the star visual
function RevenueSplit({ payments, scoreboard }: { payments: DemoState['payments']; scoreboard: DemoState['scoreboard'] }) {
  const flashRef = useRef(false)
  const [flash, setFlash] = useState(false)

  // Flash the bar on new payment
  useEffect(() => {
    if (payments.lastSplitFlash && !flashRef.current) {
      flashRef.current = true
      setFlash(true)
      const t = setTimeout(() => { setFlash(false); flashRef.current = false }, 800)
      return () => clearTimeout(t)
    }
  }, [payments.lastSplitFlash])

  const { total, lp, fee, agent } = payments
  const hasPayment = total > 0

  const lpPct   = hasPayment ? (lp / total) * 100 : 30
  const feePct  = hasPayment ? (fee / total) * 100 : 10
  const agentPct = hasPayment ? (agent / total) * 100 : 60

  const repaidPct = scoreboard
    ? Math.min(100, (scoreboard.totalRepaid / scoreboard.creditTaken) * 100)
    : payments.callCount > 0
      ? Math.min(100, (payments.lp * payments.callCount / CREDIT_TOTAL) * 100)
      : 0

  const repaidAmt = scoreboard ? scoreboard.totalRepaid : payments.lp * payments.callCount
  const totalRev  = scoreboard ? scoreboard.totalRevenue : payments.agent * payments.callCount

  return (
    <div className="flex flex-col gap-5">
      {/* Latest payment split */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
          Latest Payment Split
        </h2>
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
          {/* Amount badge */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-slate-500 font-medium">Amount received</span>
            <span className="text-sm font-bold text-slate-800" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              {fmtUsd(hasPayment ? total : 0.25)} USDC
            </span>
          </div>

          {/* Animated split bar */}
          <div className="relative h-5 rounded-full overflow-hidden bg-slate-200 mb-3">
            <div className="absolute inset-0 flex rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-700 ease-out rounded-l-full"
                style={{ width: `${lpPct}%`, background: '#10b981' }}
              />
              <div
                className="h-full transition-all duration-700 ease-out"
                style={{ width: `${feePct}%`, background: '#3b82f6' }}
              />
              <div
                className="h-full transition-all duration-700 ease-out rounded-r-full"
                style={{ width: `${agentPct}%`, background: '#f1f5f9', border: '0' }}
              />
            </div>
            {/* Shimmer on flash */}
            {flash && (
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%)',
                  animation: 'shimmer 0.8s ease-out forwards',
                }}
              />
            )}
          </div>

          {/* Split rows */}
          <div className="flex flex-col gap-1.5">
            {[
              { color: '#10b981', label: 'LP repayment', pct: lpPct,   value: hasPayment ? lp   : 0.075, bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-700' },
              { color: '#3b82f6', label: 'Protocol fee', pct: feePct,  value: hasPayment ? fee  : 0.025, bg: 'bg-blue-50',    border: 'border-blue-100',    text: 'text-blue-700'   },
              { color: '#94a3b8', label: 'Agent revenue',pct: agentPct,value: hasPayment ? agent: 0.150, bg: 'bg-slate-50',   border: 'border-slate-200',   text: 'text-slate-700'  },
            ].map(({ color, label, pct, value, bg, border, text }) => (
              <div key={label} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg ${bg} border ${border}`}>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                <span className="text-xs text-slate-500 flex-1">{label}</span>
                <span className="text-xs font-semibold text-slate-400">{pct.toFixed(0)}%</span>
                <span className={`text-xs font-bold ${text}`} style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  {fmtUsd(value, 3)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Repayment progress */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Loan Repayment
          </h2>
          <span className="text-xs font-semibold text-blue-600">{repaidPct.toFixed(1)}%</span>
        </div>
        <div className="relative h-3 bg-slate-100 rounded-full overflow-hidden mb-1.5">
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${repaidPct}%`,
              background: repaidPct >= 100 ? '#10b981' : 'linear-gradient(90deg, #3b82f6, #60a5fa)',
            }}
          />
          {/* Running shimmer when payments active */}
          {payments.callCount > 0 && repaidPct < 100 && (
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
                backgroundSize: '200% 100%',
                animation: 'shimmerLoop 2s linear infinite',
              }}
            />
          )}
        </div>
        <div className="flex justify-between text-[11px] text-slate-400">
          <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{fmtUsd(repaidAmt)} repaid</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{fmtUsd(CREDIT_TOTAL)} total</span>
        </div>
      </div>

      {/* Revenue counter */}
      <div className="bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-2xl p-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Total Revenue</p>
            <p className="text-xl font-bold text-emerald-600" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              {fmtUsd(totalRev)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">API Calls</p>
            <p className="text-xl font-bold text-slate-800" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              {payments.callCount}
            </p>
          </div>
        </div>

        {/* Moat callout */}
        {payments.callCount > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <p className="text-[11px] text-slate-500 leading-relaxed">
              <span className="font-semibold text-blue-600">Credit bureau moat:</span>{' '}
              every on-time repayment is recorded on-chain.
              Competitors can fork the code — not this history.
            </p>
          </div>
        )}
      </div>

      {/* Final scoreboard — appears after all done */}
      {scoreboard && <Scoreboard s={scoreboard} />}
    </div>
  )
}

// Final scoreboard
function Scoreboard({ s }: { s: NonNullable<DemoState['scoreboard']> }) {
  const fullyRepaid = s.remainingDebt <= 0
  return (
    <div className={`rounded-2xl border p-4 transition-all duration-500 ${fullyRepaid ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
      <div className="flex items-center gap-2 mb-3">
        {fullyRepaid ? (
          <>
            <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-bold text-emerald-700">Loan Fully Repaid — Score Increases</span>
          </>
        ) : (
          <>
            <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-bold text-amber-700">Repayment In Progress</span>
          </>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Revenue earned',  value: fmtUsd(s.totalRevenue),  color: 'text-emerald-700' },
          { label: 'Credit taken',    value: fmtUsd(s.creditTaken),   color: 'text-slate-700'  },
          { label: 'Total repaid',    value: fmtUsd(s.totalRepaid),   color: 'text-blue-700'   },
          { label: 'Platform fees',   value: fmtUsd(s.totalPlatform), color: 'text-slate-600'  },
        ].map(({ label, value, color }) => (
          <div key={label}>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide mb-0.5">{label}</p>
            <p className={`text-sm font-bold ${color}`} style={{ fontFamily: 'JetBrains Mono, monospace' }}>{value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// Connection overlay
function ConnectionOverlay() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm rounded-2xl z-10">
      <div className="text-center px-4">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-blue-500 animate-spin mx-auto mb-3" />
        <p className="text-sm font-semibold text-slate-700 mb-1">Connecting to demo server…</p>
        <p className="text-xs text-slate-400">Click <span className="font-semibold text-blue-600">Start Demo</span> once connected to trigger a live run</p>
      </div>
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function DemoPage() {
  const [state, setState] = useState<DemoState>(INITIAL_STATE)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    try {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        setState(s => ({ ...s, connected: true }))
      }

      ws.onmessage = (ev: MessageEvent<string>) => {
        try {
          const msg = JSON.parse(ev.data) as WsEvent
          handleEvent(msg)
        } catch {
          // ignore malformed
        }
      }

      ws.onclose = () => {
        setState(s => ({ ...s, connected: false }))
        reconnectRef.current = setTimeout(connect, 2000)
      }

      ws.onerror = () => {
        ws.close()
      }
    } catch {
      reconnectRef.current = setTimeout(connect, 3000)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleEvent(msg: WsEvent) {
    switch (msg.event) {
      case 'step_active':
        setState(s => ({
          ...s,
          steps: { ...s.steps, [msg.data.step]: 'active' },
        }))
        break

      case 'step_complete':
        setState(s => ({
          ...s,
          steps: { ...s.steps, [msg.data.step]: 'done' },
          txs: { ...s.txs, [msg.data.step]: msg.data.tx },
          // Mark relevant safety checks as passed based on step
          checks: {
            ...s.checks,
            ...(msg.data.step >= 3 ? { pdaActive: true } : {}),
            ...(msg.data.step >= 3 ? { venueWhitelisted: true } : {}),
            ...(msg.data.step >= 3 ? { underTradeLimit: true } : {}),
            ...(msg.data.step >= 4 ? { healthOk: true } : {}),
            ...(msg.data.step >= 4 ? { dailyLimitOk: true } : {}),
          },
        }))
        break

      case 'wallet_state':
        setState(s => ({ ...s, wallet: msg.data }))
        break

      case 'safety_check':
        setState(s => ({
          ...s,
          checks: { ...s.checks, [msg.data.check]: msg.data.passed },
        }))
        break

      case 'payment_split': {
        const d = msg.data
        setState(s => ({
          ...s,
          payments: {
            total: d.total,
            lp: d.lp,
            fee: d.fee,
            agent: d.agent,
            callCount: d.callCount,
            lastSplitFlash: true,
          },
        }))
        // Clear flash after a tick
        setTimeout(() => {
          setState(s => ({ ...s, payments: { ...s.payments, lastSplitFlash: false } }))
        }, 100)
        break
      }

      case 'demo_complete':
        setState(s => ({ ...s, scoreboard: msg.data.scoreboard }))
        break

      case 'demo_status':
        // When a new run starts, reset all step/payment state
        if (msg.data.status === 'running') {
          setState(_s => ({ ...INITIAL_STATE, connected: true }))
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
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        console.error('Trigger failed:', body)
      }
    } catch (err) {
      console.error('Could not reach demo server:', err)
    }
  }

  const showOverlay = !state.connected && !Object.values(state.steps).includes('done')

  return (
    <>
      {/* Inline keyframes for shimmer effects */}
      <style>{`
        @keyframes shimmerLoop {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        @keyframes shimmer {
          0%   { transform: translateX(-100%); opacity: 1; }
          100% { transform: translateX(200%);  opacity: 0; }
        }
        .demo-page * { box-sizing: border-box; }
      `}</style>

      <div
        className="demo-page min-h-screen flex flex-col"
        style={{ background: '#ffffff', color: '#0f172a', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' }}
      >
        {/* ── Header ── */}
        <header
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: '#e2e8f0', background: '#ffffff' }}
        >
          <div className="flex items-center gap-3">
            <Logo width={28} height={28} className="[&_rect]:fill-black [&_path]:stroke-white [&_line]:stroke-white" />
            <span className="text-base font-bold text-slate-900 tracking-tight">KREXA</span>
            <span className="hidden sm:block text-slate-300 text-sm">|</span>
            <span className="hidden sm:block text-sm font-medium text-slate-500">
              Live Demo — Agent Credit Lifecycle
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-3 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
              Solana Devnet
            </span>
          </div>
        </header>

        {/* ── Main 3-col grid ── */}
        <main className="flex-1 p-4 md:p-6">
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 items-start">

            {/* Column 1 — Step tracker */}
            <div
              className="relative rounded-2xl border p-5"
              style={{ background: '#ffffff', borderColor: '#e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
            >
              <StepTracker state={state} onStartDemo={handleStartDemo} />
              {showOverlay && <ConnectionOverlay />}
            </div>

            {/* Column 2 — Wallet state + safety checks */}
            <div
              className="relative rounded-2xl border p-5"
              style={{ background: '#ffffff', borderColor: '#e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
            >
              <WalletState wallet={state.wallet} checks={state.checks} />
              {showOverlay && <ConnectionOverlay />}
            </div>

            {/* Column 3 — Revenue split */}
            <div
              className="relative rounded-2xl border p-5"
              style={{ background: '#ffffff', borderColor: '#e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
            >
              <RevenueSplit payments={state.payments} scoreboard={state.scoreboard} />
            </div>

          </div>

          {/* ── Sub-header / explainer strip ── */}
          <div className="max-w-6xl mx-auto mt-4">
            <div
              className="rounded-xl border px-5 py-3 flex flex-wrap items-center gap-x-6 gap-y-2"
              style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}
            >
              {[
                { icon: '①', text: 'Agent registers on-chain, gets KYA Tier 1' },
                { icon: '②', text: 'Zero-collateral $50 credit extended by vault' },
                { icon: '③', text: 'Deploys research API, charges $0.25 via x402' },
                { icon: '④', text: 'PaymentRouter auto-splits every call on-chain' },
              ].map(({ icon, text }) => (
                <div key={icon} className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-blue-500">{icon}</span>
                  <span className="text-xs text-slate-500">{text}</span>
                </div>
              ))}
            </div>
          </div>
        </main>

        {/* ── Footer ── */}
        <footer
          className="flex items-center justify-between px-6 py-3 border-t text-xs text-slate-400"
          style={{ borderColor: '#e2e8f0', background: '#f8fafc' }}
        >
          <span>Every transaction is real and verifiable on Solscan</span>
          <a
            href="https://krexa.xyz"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-blue-500 hover:text-blue-700 transition-colors"
          >
            krexa.xyz
          </a>
        </footer>
      </div>
    </>
  )
}
