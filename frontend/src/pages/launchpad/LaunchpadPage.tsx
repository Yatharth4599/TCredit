import { useState, useEffect, useCallback, useRef } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { motion, AnimatePresence } from 'motion/react'
import toast from 'react-hot-toast'
import '../../styles/landing.css'
import { Navbar } from '../../components/landing/Navbar'
import { Footer } from '../../components/landing/Footer'
import { LaunchHero } from '../../components/launchpad/LaunchHero'
import { AgentIdentityCard } from '../../components/launchpad/AgentIdentityCard'
import { AgentTypesShowcase } from '../../components/launchpad/AgentTypesShowcase'
import { HowAgentsEarn } from '../../components/launchpad/HowAgentsEarn'
import { CreditLadder } from '../../components/launchpad/CreditLadder'
import { WizardTransition } from '../../components/launchpad/WizardTransition'
import { WorkflowVisualization } from '../../components/launchpad/WorkflowVisualization'
import { EcosystemSection } from '../../components/launchpad/EcosystemSection'
import { agentApi, kyaApi, faucetApi, creditApi, healthApi } from '../../api/solanaClient'
import { useSolanaTx } from '../../hooks/useSolanaTx'
import { txUrl } from '../../config/solana'

/* ── Design tokens — identical to landing page ── */
const font = "'Geist', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
const mono = "'Geist Mono', 'JetBrains Mono', monospace"

const colors = {
  bgPrimary: '#050505',
  bgSecondary: '#0a0a0c',
  bgTertiary: '#111114',
  bgHover: '#16161a',
  borderSubtle: 'rgba(255, 255, 255, 0.06)',
  borderMedium: 'rgba(255, 255, 255, 0.10)',
  borderStrong: 'rgba(255, 255, 255, 0.15)',
  textPrimary: '#f0f0f0',
  textSecondary: '#a0a0a8',
  textTertiary: '#5a5a65',
  textMuted: '#3a3a42',
  accentCyan: '#22d3ee',
  accentGreen: '#34d399',
} as const

const easing = 'cubic-bezier(0.16, 1, 0.3, 1)'

/* ── Card style — matches .feature-card in landing.css ── */
const cardStyle: React.CSSProperties = {
  background: colors.bgSecondary,
  border: `1px solid ${colors.borderSubtle}`,
  borderRadius: '16px',
  padding: '32px',
  position: 'relative',
  overflow: 'hidden',
}

/* ── Types ── */
type StepStatus = 'idle' | 'loading' | 'done' | 'error'

interface LaunchpadState {
  agentType: number | null
  agentName: string
  dailyLimit: number
  faucetAmount: number
  creditLevel: number
  borrowAmount: number
  registerTx: string | null
  kyaTx: string | null
  faucetTx: string | null
  creditTx: string | null
  agentPubkey: string | null
  registerStatus: StepStatus
  kyaStatus: StepStatus
  faucetStatus: StepStatus
  creditStatus: StepStatus
  registerError: string | null
  kyaError: string | null
  faucetError: string | null
  creditError: string | null
}

const INITIAL_STATE: LaunchpadState = {
  agentType: null,
  agentName: '',
  dailyLimit: 500,
  faucetAmount: 50,
  creditLevel: 1,
  borrowAmount: 100,
  registerTx: null,
  kyaTx: null,
  faucetTx: null,
  creditTx: null,
  agentPubkey: null,
  registerStatus: 'idle',
  kyaStatus: 'idle',
  faucetStatus: 'idle',
  creditStatus: 'idle',
  registerError: null,
  kyaError: null,
  faucetError: null,
  creditError: null,
}

const STEPS = [
  { num: 1, label: 'Connect' },
  { num: 2, label: 'Type' },
  { num: 3, label: 'Configure' },
  { num: 4, label: 'Deploy' },
  { num: 5, label: 'Live' },
]

const AGENT_TYPES = [
  {
    id: 0,
    name: 'Trader',
    icon: (
      <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2 20h20M5 20V10l4-6 4 8 4-4 3 4v8" />
      </svg>
    ),
    desc: 'DeFi bots, market makers, arbitrage engines',
    details: ['Jupiter, Raydium, Orca venues', 'Score: Repayment 30% + Profit 25%', 'Up to $500K credit at L4'],
    color: '#22d3ee',
  },
  {
    id: 1,
    name: 'Service',
    icon: (
      <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    desc: 'API providers, data feeds, signal services',
    details: ['Revenue via x402 payments', 'Score: Repayment 30% + Behavioral 20%', 'Auto-repay from revenue'],
    color: '#34d399',
  },
  {
    id: 2,
    name: 'Hybrid',
    icon: (
      <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
      </svg>
    ),
    desc: 'Trading + service revenue combined',
    details: ['All 5 score components active', 'Highest credit ceiling potential', 'Diversified activity path to L4'],
    color: '#a78bfa',
  },
]

const CREDIT_LEVELS = [
  { level: 1, name: 'L1 Micro', max: 500, rate: '36.5%' },
  { level: 2, name: 'L2 Standard', max: 20000, rate: '29.2%' },
  { level: 3, name: 'L3 Growth', max: 50000, rate: '21.9%' },
]

/* ── Primary button — matches landing "gradient-bg" CTA ── */
const primaryBtnBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  padding: '12px 28px',
  background: 'linear-gradient(135deg, #22d3ee, #34d399)',
  color: colors.bgPrimary,
  fontSize: '15px',
  fontWeight: 600,
  borderRadius: '8px',
  border: 'none',
  cursor: 'pointer',
  fontFamily: font,
  transition: 'opacity 0.2s',
}

/* ── Secondary button — matches landing outline CTA ── */
const secondaryBtnBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  padding: '12px 28px',
  background: 'transparent',
  border: `1px solid ${colors.borderMedium}`,
  color: colors.textSecondary,
  fontSize: '15px',
  fontWeight: 500,
  borderRadius: '8px',
  cursor: 'pointer',
  fontFamily: font,
  transition: 'border-color 0.2s, color 0.2s',
}

/* ── Spinner keyframes (injected once) ── */
const spinnerCSS = `
@keyframes lp-spin { to { transform: rotate(360deg); } }
@keyframes lp-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
`

export default function LaunchpadPage() {
  const { publicKey, connected, signMessage } = useWallet()
  const { setVisible } = useWalletModal()
  const { execute: executeTx } = useSolanaTx()

  const [step, setStep] = useState(1)
  const [state, setState] = useState<LaunchpadState>(INITIAL_STATE)
  const [serverWaking, setServerWaking] = useState(false)
  const warmedRef = useRef(false)
  const wizardRef = useRef<HTMLDivElement>(null)

  const addr = publicKey?.toBase58() ?? ''
  const shortAddr = addr ? `${addr.slice(0, 4)}...${addr.slice(-4)}` : ''

  useEffect(() => {
    if (warmedRef.current) return
    warmedRef.current = true
    const timer = setTimeout(() => setServerWaking(true), 4000)
    healthApi.check()
      .then(() => setServerWaking(false))
      .catch(() => setServerWaking(false))
      .finally(() => clearTimeout(timer))
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (connected && step === 1) setStep(2)
  }, [connected, step])

  const update = useCallback((patch: Partial<LaunchpadState>) => {
    setState(prev => ({ ...prev, ...patch }))
  }, [])

  const handleRegister = useCallback(async () => {
    if (!publicKey || state.agentType === null) return
    update({ registerStatus: 'loading', registerError: null })
    try {
      const res = await agentApi.createWallet(addr, addr, state.dailyLimit, state.agentType)
      const data = res.data
      if (data.transaction) {
        const sig = await executeTx(data.transaction)
        update({ registerTx: sig, agentPubkey: data.agentPubkey ?? addr, registerStatus: 'done' })
      } else {
        update({ agentPubkey: data.agentPubkey ?? data.agent ?? addr, registerStatus: 'done' })
      }
      toast.success('Agent deployed on Solana!')
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Registration failed'
      const msg = raw.includes('timeout') ? 'Server waking up — try again in a moment.' : raw
      update({ registerStatus: 'error', registerError: msg })
      toast.error(msg)
    }
  }, [publicKey, state.agentType, state.dailyLimit, addr, executeTx, update])

  const handleKya = useCallback(async () => {
    if (!publicKey || !state.agentPubkey) return
    update({ kyaStatus: 'loading', kyaError: null })
    try {
      let verified = false
      try {
        const statusRes = await kyaApi.getStatus(state.agentPubkey)
        verified = statusRes.data.onChainTier >= 1
      } catch {
        verified = state.registerStatus === 'done'
      }
      if (verified) {
        update({ kyaStatus: 'done' })
        toast.success('KYA Tier 1 verified!')
        return
      }
      if (!signMessage) return
      const message = new TextEncoder().encode(`Krexa KYA Verification: ${state.agentPubkey}`)
      const signature = await signMessage(message)
      const sigBase64 = Buffer.from(signature).toString('base64')
      await kyaApi.basicVerify(state.agentPubkey, addr, sigBase64)
      update({ kyaStatus: 'done' })
      toast.success('KYA Tier 1 verified!')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'KYA verification failed'
      update({ kyaStatus: 'error', kyaError: msg })
      toast.error(msg)
    }
  }, [publicKey, signMessage, state.agentPubkey, state.registerStatus, addr, update])

  const handleFaucet = useCallback(async () => {
    if (!addr) return
    update({ faucetStatus: 'loading', faucetError: null })
    try {
      const res = await faucetApi.mintUsdc(addr, state.faucetAmount)
      update({ faucetTx: res.data.signature ?? null, faucetStatus: 'done' })
      toast.success(`${state.faucetAmount} USDC minted!`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Faucet failed'
      update({ faucetStatus: 'error', faucetError: msg })
      toast.error(msg)
    }
  }, [addr, state.faucetAmount, update])

  const handleCredit = useCallback(async () => {
    if (!addr) return
    update({ creditStatus: 'loading', creditError: null })
    try {
      const res = await creditApi.requestCredit(addr, state.borrowAmount, state.creditLevel)
      const data = res.data
      if (data.transaction) {
        const sig = await executeTx(data.transaction)
        update({ creditTx: sig, creditStatus: 'done' })
      } else {
        update({ creditStatus: 'done' })
      }
      toast.success(`$${state.borrowAmount} credit line opened!`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Credit request failed'
      update({ creditStatus: 'error', creditError: msg })
      toast.error(msg)
    }
  }, [addr, state.borrowAmount, state.creditLevel, executeTx, update])

  const canAdvanceStep3 = state.agentType !== null && state.agentName.length > 0
  const allDeployed = state.registerStatus === 'done' && state.kyaStatus === 'done' && state.faucetStatus === 'done'

  const scrollToWizard = useCallback(() => {
    wizardRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const handleDeployTemplate = useCallback((typeId: number) => {
    update({ agentType: typeId })
    setStep(2)
    wizardRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [update])

  return (
    <div className="landing-root" style={{ minHeight: '100vh' }}>
      <style>{spinnerCSS}</style>
      <Navbar />

      {/* ── Educational sections ── */}
      <LaunchHero onScrollToWizard={scrollToWizard} />
      <AgentIdentityCard />
      <AgentTypesShowcase onDeployTemplate={handleDeployTemplate} />
      <HowAgentsEarn />
      <WorkflowVisualization />
      <CreditLadder />
      <EcosystemSection />
      <WizardTransition />

      {/* ── Wizard ── */}
      <div ref={wizardRef} style={{ maxWidth: '720px', margin: '0 auto', padding: '80px 24px 140px' }}>

        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '40px' }}>
          {STEPS.map((s, i) => (
            <div key={s.num} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 0 }}>
              <button
                onClick={() => { if (s.num <= step) setStep(s.num) }}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  border: step >= s.num
                    ? `1.5px solid ${colors.accentCyan}`
                    : `1.5px solid ${colors.borderSubtle}`,
                  background: step > s.num
                    ? colors.accentCyan
                    : step === s.num
                      ? 'rgba(34, 211, 238, 0.1)'
                      : 'rgba(255, 255, 255, 0.03)',
                  color: step > s.num
                    ? colors.bgPrimary
                    : step === s.num
                      ? colors.accentCyan
                      : colors.textTertiary,
                  fontSize: '13px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: s.num <= step ? 'pointer' : 'default',
                  transition: `all 0.3s ${easing}`,
                  flexShrink: 0,
                  fontFamily: font,
                  boxShadow: step === s.num ? '0 0 16px rgba(34, 211, 238, 0.15)' : 'none',
                }}
              >
                {step > s.num ? (
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  s.num
                )}
              </button>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 500,
                  marginLeft: '8px',
                  whiteSpace: 'nowrap',
                  color: step >= s.num ? colors.textPrimary : colors.textTertiary,
                  transition: `color 0.3s ${easing}`,
                  fontFamily: font,
                }}
              >
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <div
                  style={{
                    flex: 1,
                    height: '1.5px',
                    background: colors.borderSubtle,
                    margin: '0 12px',
                    borderRadius: '1px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      background: 'linear-gradient(90deg, #22d3ee, #34d399)',
                      width: step > s.num ? '100%' : '0%',
                      transition: `width 0.4s ${easing}`,
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Waking banner */}
        {serverWaking && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '16px',
              padding: '12px 18px',
              borderRadius: '8px',
              background: 'rgba(34, 211, 238, 0.04)',
              border: `1px solid rgba(34, 211, 238, 0.08)`,
              fontSize: '13px',
              color: colors.textSecondary,
              fontFamily: font,
            }}
          >
            <div
              style={{
                width: '14px',
                height: '14px',
                border: `2px solid rgba(34, 211, 238, 0.15)`,
                borderTopColor: colors.accentCyan,
                borderRadius: '50%',
                animation: 'lp-spin 0.8s linear infinite',
                flexShrink: 0,
              }}
            />
            Waking up server (cold start)... this may take a moment.
          </div>
        )}

        {/* Step content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            {step === 1 && <StepConnect connected={connected} shortAddr={shortAddr} onConnect={() => setVisible(true)} />}
            {step === 2 && <StepChooseType selected={state.agentType} onSelect={(id) => update({ agentType: id })} onNext={() => setStep(3)} />}
            {step === 3 && <StepConfigure state={state} onUpdate={update} canAdvance={canAdvanceStep3} onNext={() => setStep(4)} />}
            {step === 4 && <StepDeploy state={state} onRegister={handleRegister} onKya={handleKya} onFaucet={handleFaucet} onCredit={handleCredit} allDeployed={allDeployed} onNext={() => setStep(5)} />}
            {step === 5 && <StepLive state={state} shortAddr={shortAddr} />}
          </motion.div>
        </AnimatePresence>
      </div>

      <Footer />
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════ */
/*  Step 1 — Connect Wallet                                           */
/* ════════════════════════════════════════════════════════════════════ */
function StepConnect({ connected, shortAddr, onConnect }: {
  connected: boolean; shortAddr: string; onConnect: () => void
}) {
  return (
    <div style={cardStyle}>
      {/* Gradient top line — matches .feature-card::before */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(34, 211, 238, 0.3), transparent)' }} />

      <h2 style={{ fontSize: '24px', fontWeight: 600, color: colors.textPrimary, margin: '0 0 12px', letterSpacing: '-0.02em', fontFamily: font }}>
        Connect your wallet
      </h2>
      <p style={{ fontSize: '15px', color: colors.textSecondary, lineHeight: 1.6, margin: '0 0 28px', fontFamily: font }}>
        Connect a Solana wallet to deploy your agent. Make sure you're on <strong style={{ color: colors.textPrimary }}>Devnet</strong>.
      </p>

      {connected ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: 'rgba(34, 211, 238, 0.05)',
            border: '1px solid rgba(34, 211, 238, 0.12)',
            borderRadius: '12px',
            padding: '14px 18px',
          }}
        >
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: colors.accentCyan, boxShadow: '0 0 10px rgba(34, 211, 238, 0.5)', flexShrink: 0 }} />
          <div>
            <div style={{ fontFamily: mono, fontSize: '13px', color: colors.textPrimary }}>{shortAddr}</div>
            <div style={{ fontSize: '11px', color: colors.textTertiary }}>Connected on Devnet</div>
          </div>
        </div>
      ) : (
        <button
          style={primaryBtnBase}
          onClick={onConnect}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9' }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
        >
          Connect Wallet
        </button>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════ */
/*  Step 2 — Choose Agent Type                                        */
/* ════════════════════════════════════════════════════════════════════ */
function StepChooseType({ selected, onSelect, onNext }: {
  selected: number | null; onSelect: (id: number) => void; onNext: () => void
}) {
  return (
    <div style={cardStyle}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(34, 211, 238, 0.3), transparent)' }} />

      <h2 style={{ fontSize: '24px', fontWeight: 600, color: colors.textPrimary, margin: '0 0 12px', letterSpacing: '-0.02em', fontFamily: font }}>
        Choose agent type
      </h2>
      <p style={{ fontSize: '15px', color: colors.textSecondary, lineHeight: 1.6, margin: '0 0 28px', fontFamily: font }}>
        This determines your score weights and credit path.
      </p>

      {/* Type grid — 3 cols like ThreeWays / TrancheCards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" style={{ marginBottom: '28px' }}>
        {AGENT_TYPES.map((t) => {
          const isSelected = selected === t.id
          return (
            <button
              key={t.id}
              onClick={() => onSelect(t.id)}
              style={{
                background: isSelected ? `rgba(${t.color === '#22d3ee' ? '34,211,238' : t.color === '#34d399' ? '52,211,153' : '167,139,250'},0.06)` : colors.bgSecondary,
                border: `1px solid ${isSelected ? t.color : colors.borderSubtle}`,
                borderRadius: '16px',
                padding: '24px 20px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: `all 0.3s ${easing}`,
                position: 'relative',
                overflow: 'hidden',
                fontFamily: font,
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'
                  e.currentTarget.style.transform = 'translateY(-4px)'
                  e.currentTarget.style.boxShadow = '0 20px 40px rgba(0,0,0,0.3)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = colors.borderSubtle
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
                }
              }}
            >
              {/* Top accent line — matches .feature-card::before on hover / selected */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: isSelected ? t.color : 'transparent', transition: 'background 0.3s' }} />

              <div style={{ color: t.color, marginBottom: '12px', opacity: 0.8 }}>{t.icon}</div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: colors.textPrimary, marginBottom: '4px', fontFamily: font }}>{t.name}</div>
              <div style={{ fontSize: '13px', color: colors.textTertiary, lineHeight: 1.5, marginBottom: '14px', fontFamily: font }}>{t.desc}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {t.details.map((d, i) => (
                  <div key={i} style={{ fontSize: '11px', color: 'rgba(245,245,247,0.45)', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: font }}>
                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: t.color, opacity: 0.6, flexShrink: 0 }} />
                    {d}
                  </div>
                ))}
              </div>
            </button>
          )
        })}
      </div>

      <button
        style={{ ...primaryBtnBase, opacity: selected === null ? 0.4 : 1, cursor: selected === null ? 'not-allowed' : 'pointer' }}
        disabled={selected === null}
        onClick={onNext}
        onMouseEnter={(e) => { if (selected !== null) e.currentTarget.style.opacity = '0.9' }}
        onMouseLeave={(e) => { if (selected !== null) e.currentTarget.style.opacity = '1' }}
      >
        Continue
      </button>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════ */
/*  Step 3 — Configure                                                */
/* ════════════════════════════════════════════════════════════════════ */
function StepConfigure({ state, onUpdate, canAdvance, onNext }: {
  state: LaunchpadState; onUpdate: (p: Partial<LaunchpadState>) => void; canAdvance: boolean; onNext: () => void
}) {
  const selectedType = state.agentType !== null ? AGENT_TYPES[state.agentType] : null
  const selectedLevel = CREDIT_LEVELS.find(l => l.level === state.creditLevel)

  const labelStyle: React.CSSProperties = {
    fontSize: '13px',
    fontWeight: 500,
    color: colors.textTertiary,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    marginBottom: '8px',
    fontFamily: font,
  }

  /* Slider thumb — injected to match landing slider style */
  const sliderCSS = `
    .lp-slider { -webkit-appearance: none; appearance: none; height: 4px; border-radius: 2px; background: rgba(255,255,255,0.06); outline: none; width: 100%; }
    .lp-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%; background: linear-gradient(135deg, #22d3ee, #34d399); cursor: pointer; box-shadow: 0 0 10px rgba(34,211,238,0.3); }
  `

  return (
    <div style={cardStyle}>
      <style>{sliderCSS}</style>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(34, 211, 238, 0.3), transparent)' }} />

      <h2 style={{ fontSize: '24px', fontWeight: 600, color: colors.textPrimary, margin: '0 0 12px', letterSpacing: '-0.02em', fontFamily: font }}>
        Configure your agent
      </h2>
      <p style={{ fontSize: '15px', color: colors.textSecondary, lineHeight: 1.6, margin: '0 0 28px', fontFamily: font }}>
        Set the parameters for deployment.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '28px' }}>
        {/* Agent name */}
        <div>
          <div style={labelStyle}>Agent Name</div>
          <input
            type="text"
            placeholder="e.g. alpha-bot-v2"
            maxLength={32}
            value={state.agentName}
            onChange={(e) => onUpdate({ agentName: e.target.value })}
            style={{
              background: colors.bgTertiary,
              border: `1px solid ${colors.borderSubtle}`,
              borderRadius: '8px',
              padding: '12px 16px',
              color: colors.textPrimary,
              fontSize: '14px',
              fontFamily: mono,
              outline: 'none',
              width: '100%',
              boxSizing: 'border-box',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(34,211,238,0.3)' }}
            onBlur={(e) => { e.currentTarget.style.borderColor = colors.borderSubtle }}
          />
        </div>

        {/* Agent type readonly */}
        <div>
          <div style={labelStyle}>Agent Type</div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: selectedType?.color ?? colors.textPrimary, fontFamily: font }}>
            {selectedType?.name ?? '\u2014'}
          </div>
        </div>

        {/* Daily limit slider */}
        <div>
          <div style={labelStyle}>Daily Spend Limit (USDC)</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <input
              type="range" className="lp-slider" min={100} max={10000} step={100}
              value={state.dailyLimit} onChange={(e) => onUpdate({ dailyLimit: Number(e.target.value) })}
            />
            <span style={{ fontSize: '18px', fontWeight: 600, color: colors.textPrimary, minWidth: '80px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontFamily: mono }}>
              ${state.dailyLimit.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Faucet amount slider */}
        <div>
          <div style={labelStyle}>Test USDC (Faucet)</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <input
              type="range" className="lp-slider" min={1} max={100}
              value={state.faucetAmount} onChange={(e) => onUpdate({ faucetAmount: Number(e.target.value) })}
            />
            <span style={{ fontSize: '18px', fontWeight: 600, color: colors.textPrimary, minWidth: '80px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontFamily: mono }}>
              ${state.faucetAmount}
            </span>
          </div>
        </div>

        {/* Credit level — buttons styled like tranche labels */}
        <div>
          <div style={labelStyle}>Credit Level</div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            {CREDIT_LEVELS.map((l) => (
              <button
                key={l.level}
                onClick={() => onUpdate({ creditLevel: l.level, borrowAmount: Math.min(state.borrowAmount, l.max) })}
                style={{
                  padding: '8px 16px',
                  background: state.creditLevel === l.level ? 'rgba(34,211,238,0.08)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${state.creditLevel === l.level ? 'rgba(34,211,238,0.3)' : colors.borderSubtle}`,
                  borderRadius: '8px',
                  color: state.creditLevel === l.level ? colors.accentCyan : colors.textTertiary,
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontFamily: font,
                }}
              >
                {l.name}
              </button>
            ))}
          </div>
          {selectedLevel && (
            <div style={{ fontSize: '13px', color: colors.textTertiary, fontFamily: font }}>
              Max ${selectedLevel.max.toLocaleString()} at {selectedLevel.rate} APR
            </div>
          )}
        </div>

        {/* Borrow amount slider */}
        <div>
          <div style={labelStyle}>Initial Borrow (USDC)</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <input
              type="range" className="lp-slider" min={10} max={selectedLevel?.max ?? 500} step={10}
              value={state.borrowAmount} onChange={(e) => onUpdate({ borrowAmount: Number(e.target.value) })}
            />
            <span style={{ fontSize: '18px', fontWeight: 600, color: colors.textPrimary, minWidth: '80px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontFamily: mono }}>
              ${state.borrowAmount.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      <button
        style={{ ...primaryBtnBase, opacity: canAdvance ? 1 : 0.4, cursor: canAdvance ? 'pointer' : 'not-allowed' }}
        disabled={!canAdvance}
        onClick={onNext}
        onMouseEnter={(e) => { if (canAdvance) e.currentTarget.style.opacity = '0.9' }}
        onMouseLeave={(e) => { if (canAdvance) e.currentTarget.style.opacity = '1' }}
      >
        Deploy Agent
      </button>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════ */
/*  Step 4 — Deploy (real transactions)                               */
/* ════════════════════════════════════════════════════════════════════ */
function StepDeploy({ state, onRegister, onKya, onFaucet, onCredit, allDeployed, onNext }: {
  state: LaunchpadState; onRegister: () => void; onKya: () => void; onFaucet: () => void; onCredit: () => void; allDeployed: boolean; onNext: () => void
}) {
  const deploySteps = [
    { label: 'Register Agent + Wallet', desc: 'Creates your agent profile and wallet on Solana', status: state.registerStatus, error: state.registerError, tx: state.registerTx, action: onRegister, actionLabel: 'Sign & Deploy', disabled: false },
    { label: 'KYA Verification', desc: 'Know Your Agent — enables credit access', status: state.kyaStatus, error: state.kyaError, tx: state.kyaTx, action: onKya, actionLabel: 'Verify', disabled: state.registerStatus !== 'done' },
    { label: `Mint ${state.faucetAmount} USDC`, desc: 'Fund your wallet with devnet test tokens', status: state.faucetStatus, error: state.faucetError, tx: state.faucetTx, action: onFaucet, actionLabel: 'Mint USDC', disabled: state.kyaStatus !== 'done' },
    { label: `Open $${state.borrowAmount} Credit Line`, desc: `L${state.creditLevel} credit at ${CREDIT_LEVELS.find(l => l.level === state.creditLevel)?.rate} APR`, status: state.creditStatus, error: state.creditError, tx: state.creditTx, action: onCredit, actionLabel: 'Request Credit', disabled: state.faucetStatus !== 'done' },
  ]

  return (
    <div style={cardStyle}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(34, 211, 238, 0.3), transparent)' }} />

      <h2 style={{ fontSize: '24px', fontWeight: 600, color: colors.textPrimary, margin: '0 0 12px', letterSpacing: '-0.02em', fontFamily: font }}>
        Deploying to Solana
      </h2>
      <p style={{ fontSize: '15px', color: colors.textSecondary, lineHeight: 1.6, margin: '0 0 28px', fontFamily: font }}>
        Each step is a real on-chain transaction. Sign each one with your wallet.
      </p>

      {/* Deploy list — styled like AgentTypes row items */}
      <div style={{ marginBottom: '28px' }}>
        {deploySteps.map((ds, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              padding: '18px 0',
              borderBottom: i < deploySteps.length - 1 ? `1px solid ${colors.borderSubtle}` : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 }}>
              {/* Status icon */}
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  background: ds.status === 'done' ? 'rgba(34,211,238,0.1)'
                    : ds.status === 'loading' ? 'rgba(34,211,238,0.1)'
                    : ds.status === 'error' ? 'rgba(239,68,68,0.1)'
                    : 'rgba(255,255,255,0.04)',
                  color: ds.status === 'done' ? colors.accentCyan
                    : ds.status === 'error' ? '#ef4444'
                    : colors.textTertiary,
                }}
              >
                {ds.status === 'done' ? (
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                ) : ds.status === 'loading' ? (
                  <div style={{ width: 14, height: 14, border: '2px solid rgba(34,211,238,0.2)', borderTopColor: colors.accentCyan, borderRadius: '50%', animation: 'lp-spin 0.8s linear infinite' }} />
                ) : ds.status === 'error' ? (
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                ) : (
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'currentColor' }} />
                )}
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: colors.textPrimary, fontFamily: font }}>{ds.label}</div>
                <div style={{ fontSize: '13px', color: colors.textTertiary, marginTop: '2px', fontFamily: font }}>{ds.desc}</div>
                {ds.error && <div style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px', fontFamily: font }}>{ds.error}</div>}
                {ds.tx && (
                  <a
                    href={txUrl(ds.tx)} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: colors.accentCyan, textDecoration: 'none', marginTop: '4px', fontFamily: font }}
                    onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline' }}
                    onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none' }}
                  >
                    View on Solscan
                  </a>
                )}
              </div>
            </div>
            <div style={{ flexShrink: 0 }}>
              {ds.status === 'done' ? (
                <span style={{ fontSize: '13px', fontWeight: 600, color: colors.accentCyan, fontFamily: font }}>Done</span>
              ) : (
                <button
                  disabled={ds.status === 'loading' || ds.disabled}
                  onClick={ds.action}
                  style={{
                    ...secondaryBtnBase,
                    padding: '8px 18px',
                    fontSize: '13px',
                    borderColor: 'rgba(34,211,238,0.2)',
                    color: colors.accentCyan,
                    background: 'rgba(34,211,238,0.06)',
                    opacity: (ds.status === 'loading' || ds.disabled) ? 0.3 : 1,
                    cursor: (ds.status === 'loading' || ds.disabled) ? 'not-allowed' : 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    if (ds.status !== 'loading' && !ds.disabled) {
                      e.currentTarget.style.borderColor = 'rgba(34,211,238,0.35)'
                      e.currentTarget.style.background = 'rgba(34,211,238,0.1)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(34,211,238,0.2)'
                    e.currentTarget.style.background = 'rgba(34,211,238,0.06)'
                  }}
                >
                  {ds.status === 'loading' ? (
                    <>
                      <div style={{ width: 14, height: 14, border: '2px solid rgba(34,211,238,0.2)', borderTopColor: colors.accentCyan, borderRadius: '50%', animation: 'lp-spin 0.8s linear infinite' }} />
                      Signing...
                    </>
                  ) : (
                    ds.actionLabel
                  )}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        style={{ ...primaryBtnBase, opacity: allDeployed ? 1 : 0.4, cursor: allDeployed ? 'pointer' : 'not-allowed' }}
        disabled={!allDeployed}
        onClick={onNext}
        onMouseEnter={(e) => { if (allDeployed) e.currentTarget.style.opacity = '0.9' }}
        onMouseLeave={(e) => { if (allDeployed) e.currentTarget.style.opacity = '1' }}
      >
        {allDeployed ? 'View Agent Dashboard' : 'Complete all steps to continue'}
      </button>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════ */
/*  Step 5 — Live                                                     */
/* ════════════════════════════════════════════════════════════════════ */
function StepLive({ state, shortAddr }: {
  state: LaunchpadState; shortAddr: string
}) {
  const agentType = state.agentType !== null ? AGENT_TYPES[state.agentType] : null
  const level = CREDIT_LEVELS.find(l => l.level === state.creditLevel)
  const [activeGuideTab, setActiveGuideTab] = useState(0)

  const statLabelStyle: React.CSSProperties = {
    fontSize: '13px',
    fontWeight: 500,
    color: colors.textTertiary,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    marginBottom: '6px',
    fontFamily: font,
  }

  const buildGuides = getBuildGuides(state.agentType ?? 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Agent Live card */}
      <div style={cardStyle}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(34, 211, 238, 0.3), transparent)' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: colors.accentCyan, boxShadow: '0 0 12px rgba(34,211,238,0.5)', animation: 'lp-pulse 2s ease-in-out infinite' }} />
          <h2 style={{ fontSize: '24px', fontWeight: 600, color: colors.textPrimary, margin: 0, letterSpacing: '-0.02em', fontFamily: font }}>
            Agent Live
          </h2>
        </div>
        <p style={{ fontSize: '15px', color: colors.textSecondary, lineHeight: 1.6, margin: '0 0 28px', fontFamily: font }}>
          Your agent is deployed and operational on Solana devnet.
        </p>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4" style={{ marginBottom: '0' }}>
          {[
            { label: 'Agent', value: shortAddr, mono: true },
            { label: 'Name', value: state.agentName || '\u2014' },
            { label: 'Type', value: agentType?.name ?? '\u2014', color: agentType?.color },
            { label: 'KYA', value: 'Tier 1' },
            { label: 'Credit', value: `$${state.borrowAmount.toLocaleString()} ${level?.name ?? ''}` },
            { label: 'Wallet Balance', value: `$${state.faucetAmount} USDC` },
          ].map((item) => (
            <div
              key={item.label}
              className="tranche-card"
              style={{
                background: colors.bgSecondary,
                borderRadius: '16px',
                padding: '20px',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <div style={statLabelStyle}>{item.label}</div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: item.color ?? colors.textPrimary, fontFamily: item.mono ? mono : font }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Build Guide card */}
      <div style={cardStyle}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: `linear-gradient(90deg, transparent, ${agentType?.color ?? colors.accentCyan}40, transparent)` }} />

        <div style={{ marginBottom: '8px' }}>
          <span style={{ color: agentType?.color ?? colors.accentCyan, fontSize: '13px', fontWeight: 600, letterSpacing: '0.05em', fontFamily: font }}>
            BUILD GUIDE
          </span>
          <span style={{ color: colors.textTertiary, fontSize: '13px', margin: '0 8px' }}>&middot;</span>
          <span style={{ color: colors.textPrimary, fontSize: '13px', fontWeight: 600, letterSpacing: '0.05em', fontFamily: font }}>
            {agentType?.name?.toUpperCase() ?? 'AGENT'}
          </span>
        </div>
        <p style={{ fontSize: '15px', color: colors.textSecondary, lineHeight: 1.6, margin: '0 0 24px', fontFamily: font }}>
          {buildGuides.intro}
        </p>

        {/* Guide tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {buildGuides.tabs.map((tab, i) => (
            <button
              key={tab.label}
              onClick={() => setActiveGuideTab(i)}
              style={{
                padding: '8px 16px',
                background: activeGuideTab === i ? `${agentType?.color ?? colors.accentCyan}12` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${activeGuideTab === i ? `${agentType?.color ?? colors.accentCyan}40` : colors.borderSubtle}`,
                borderRadius: '8px',
                color: activeGuideTab === i ? (agentType?.color ?? colors.accentCyan) : colors.textTertiary,
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontFamily: font,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Active guide content */}
        {buildGuides.tabs[activeGuideTab] && (
          <div>
            {/* Step-by-step */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0', marginBottom: '24px' }}>
              {buildGuides.tabs[activeGuideTab].steps.map((s, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    gap: '14px',
                    padding: '16px 0',
                    borderBottom: i < buildGuides.tabs[activeGuideTab].steps.length - 1 ? `1px solid ${colors.borderSubtle}` : 'none',
                  }}
                >
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      background: `${agentType?.color ?? colors.accentCyan}10`,
                      border: `1px solid ${agentType?.color ?? colors.accentCyan}30`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: agentType?.color ?? colors.accentCyan,
                      fontFamily: mono,
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: colors.textPrimary, marginBottom: '4px', fontFamily: font }}>
                      {s.title}
                    </div>
                    <div style={{ fontSize: '13px', color: colors.textTertiary, lineHeight: 1.5, fontFamily: font }}>
                      {s.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Starter code */}
            {buildGuides.tabs[activeGuideTab].code && (
              <BuildCodeBlock code={buildGuides.tabs[activeGuideTab].code!} />
            )}

            {/* Framework options */}
            {buildGuides.tabs[activeGuideTab].frameworks && (
              <div style={{ marginTop: '24px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: colors.textTertiary, letterSpacing: '0.05em', marginBottom: '12px', fontFamily: font }}>
                  COMPATIBLE FRAMEWORKS
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {buildGuides.tabs[activeGuideTab].frameworks!.map((fw) => (
                    <div
                      key={fw.name}
                      className="feature-card"
                      style={{
                        cursor: 'default',
                        padding: fw.features ? '20px' : '12px 16px',
                        display: 'flex',
                        flexDirection: fw.features ? 'column' : 'row',
                        alignItems: fw.features ? 'stretch' : 'center',
                        gap: fw.features ? '12px' : '10px',
                        borderColor: fw.badge ? 'rgba(34,211,238,0.20)' : undefined,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: fw.color, flexShrink: 0, boxShadow: fw.badge ? `0 0 8px ${fw.color}60` : 'none' }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: colors.textPrimary, fontFamily: font }}>{fw.name}</span>
                            {fw.badge && (
                              <span style={{
                                padding: '1px 6px',
                                fontSize: '9px',
                                fontWeight: 700,
                                letterSpacing: '0.05em',
                                textTransform: 'uppercase' as const,
                                background: 'linear-gradient(90deg, rgba(34,211,238,0.2), rgba(52,211,153,0.2))',
                                color: '#22d3ee',
                                borderRadius: '100px',
                                border: '1px solid rgba(34,211,238,0.2)',
                              }}>
                                {fw.badge}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '11px', color: colors.textTertiary, fontFamily: font, marginTop: '2px' }}>{fw.desc}</div>
                        </div>
                      </div>
                      {fw.features && fw.features.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingLeft: '16px' }}>
                          {fw.features.map((feature, fi) => (
                            <div key={fi} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', color: colors.textTertiary }}>
                              <span style={{ color: '#22d3ee', marginTop: '1px', flexShrink: 0 }}>&middot;</span>
                              <span style={{ fontFamily: font }}>{feature}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Next steps card */}
      <div style={cardStyle}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(52, 211, 153, 0.3), transparent)' }} />

        <h3 style={{ fontSize: '13px', fontWeight: 500, color: colors.textSecondary, letterSpacing: '0.05em', textTransform: 'uppercase', margin: '0 0 16px', fontFamily: font }}>
          Next steps
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          {[
            { title: 'View Credit Dashboard', desc: 'Monitor your credit line, health factor, and repayment schedule.', href: '/app/solana/credit', color: '#22d3ee' },
            { title: 'Check Krexit Score', desc: 'See your 200\u2013850 credit score and component breakdown.', href: '/app/solana/score', color: '#34d399' },
            { title: 'Use the CLI', desc: 'Run `npx @krexa/cli status` to manage your agent from the terminal.', command: 'npx @krexa/cli status', color: '#a78bfa' },
          ].map((item, i) => (
            <NextStepRow key={item.title} item={item} isLast={i === 2} />
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Build code block with copy button ── */
function BuildCodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ fontSize: '12px', fontWeight: 600, color: colors.textTertiary, letterSpacing: '0.05em', marginBottom: '8px', fontFamily: font }}>
        STARTER CODE
      </div>
      <div
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: `1px solid ${colors.borderSubtle}`,
          borderRadius: '8px',
          padding: '16px 20px',
          fontFamily: mono,
          fontSize: '13px',
          color: colors.textSecondary,
          lineHeight: 1.7,
          whiteSpace: 'pre',
          overflowX: 'auto',
          position: 'relative',
        }}
      >
        <button
          onClick={() => {
            navigator.clipboard.writeText(code)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          }}
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            background: 'rgba(255,255,255,0.06)',
            border: `1px solid ${colors.borderSubtle}`,
            borderRadius: '6px',
            padding: '4px 10px',
            fontSize: '11px',
            fontWeight: 500,
            color: copied ? colors.accentGreen : colors.textTertiary,
            cursor: 'pointer',
            fontFamily: font,
            transition: 'color 0.2s',
          }}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
        {code}
      </div>
    </div>
  )
}

/* ── Build guide data per agent type ── */
interface BuildStep { title: string; desc: string }
interface Framework { name: string; desc: string; color: string; badge?: string; features?: string[] }
interface GuideTab {
  label: string
  steps: BuildStep[]
  code?: string
  frameworks?: Framework[]
}
interface BuildGuide {
  intro: string
  tabs: GuideTab[]
}

function getBuildGuides(agentType: number): BuildGuide {
  if (agentType === 0) {
    return {
      intro: 'Your trading agent is registered on-chain. Now build the off-chain logic that executes trades and auto-repays.',
      tabs: [
        {
          label: 'Quick Start',
          steps: [
            { title: 'Install the Krexa SDK', desc: 'npm install @krexa/sdk @solana/web3.js' },
            { title: 'Initialize your agent', desc: 'Load your keypair and connect to the Krexa program on devnet.' },
            { title: 'Fetch price feeds', desc: 'Use Jupiter API or Pyth to get real-time token prices across DEXs.' },
            { title: 'Execute trades', desc: 'Swap tokens via Jupiter aggregator when spread exceeds your threshold.' },
            { title: 'Auto-repay', desc: 'After profit, call creditApi.repay() to reduce your outstanding balance.' },
          ],
          code: `import { KrexaAgent } from '@krexa/sdk'
import { Jupiter } from '@jup-ag/core'

const agent = new KrexaAgent({
  keypair: loadKeypair(),
  cluster: 'devnet',
})

// Check for arbitrage opportunities
const routes = await jupiter.computeRoutes({
  inputMint: USDC_MINT,
  outputMint: SOL_MINT,
  amount: 100_000_000, // 100 USDC
  slippageBps: 50,
})

// Execute if profitable
if (routes.bestRoute.outAmount > threshold) {
  await agent.executeSwap(routes.bestRoute)
  await agent.repay(profit)
}`,
          frameworks: [
            { name: '1inch MCP', desc: 'MCP-native swap execution across all major DEXs. 15 APIs.', color: '#22d3ee', badge: 'NEW \u2014 launched March 30, 2026', features: ['15 APIs (Swap, Balance, Portfolio, Token, Gas Price, Charts)', 'All swap types: Classic, Intent-based, Cross-chain', 'Gasless transactions \u2014 no gas management needed', '$300M+ daily volume \u00b7 27M users \u00b7 Best-in-class routing'] },
            { name: 'OKX OnchainOS', desc: 'AI agent trading OS. 60+ chains, 500+ DEXs, 1.2B daily API calls.', color: '#f97316', badge: 'NEW \u2014 launched March 3, 2026', features: ['60+ blockchains \u00b7 500+ DEXs', '1.2B daily API calls in production', 'Natural language trading commands', 'MCP + REST API dual access'] },
            { name: 'Jupiter SDK', desc: 'DEX aggregator for best swap routes', color: '#22d3ee' },
            { name: 'Olas', desc: 'Autonomous agent framework', color: '#3b82f6' },
            { name: 'ElizaOS', desc: 'AI agent with built-in DeFi plugins', color: '#a78bfa' },
            { name: 'Meteora DLMM', desc: 'Concentrated liquidity on Solana. Zero-slippage bins. Dynamic fees. $1B+ TVL.', color: '#f59e0b', badge: 'NEW', features: ['Zero-slippage within price bins', 'Dynamic fees \u2014 earn more during volatility', 'Concentrated liquidity \u2014 10x capital efficient', 'Auto-lending of idle LP capital via Dynamic Vaults', '$1B+ TVL \u00b7 $300M+ daily volume \u00b7 Audited'] },
            { name: 'Hummingbot', desc: 'Market making and arbitrage bot', color: '#f59e0b' },
          ],
        },
        {
          label: 'DEX Integration',
          steps: [
            { title: 'Connect to Jupiter', desc: 'Use the Jupiter V6 API for optimal routing across all Solana DEXs.' },
            { title: 'Set up Orca whirlpools', desc: 'Connect to concentrated liquidity pools for market making strategies.' },
            { title: 'Monitor Raydium AMMs', desc: 'Track pool reserves and detect arbitrage windows in real-time.' },
            { title: 'Provide liquidity on Meteora', desc: 'Use DLMM bins for zero-slippage concentrated LP. Dynamic fees earn more during volatile markets.' },
            { title: 'Configure slippage', desc: 'Set appropriate slippage tolerance and priority fees for fast execution.' },
          ],
          frameworks: [
            { name: '1inch MCP', desc: 'Execute swaps via MCP \u2014 no custom swap code', color: '#22d3ee', badge: 'NEW' },
            { name: 'OKX OnchainOS', desc: 'Natural language trading across 500+ DEXs', color: '#f97316', badge: 'NEW' },
            { name: 'Jupiter V6', desc: 'Best routing across 20+ DEXs', color: '#22d3ee' },
            { name: 'Orca Whirlpools', desc: 'Concentrated liquidity pools', color: '#34d399' },
            { name: 'Raydium', desc: 'AMM and CLMM pools', color: '#a78bfa' },
            { name: 'Meteora DLMM', desc: 'Concentrated liquidity with dynamic fees', color: '#f59e0b', badge: 'NEW' },
          ],
        },
        {
          label: 'Hosting',
          steps: [
            { title: 'Choose a platform', desc: 'Deploy on Railway, Render, or Fly.io for always-on execution.' },
            { title: 'Set environment variables', desc: 'Configure AGENT_KEYPAIR, RPC_URL, and KREXA_PROGRAM_ID.' },
            { title: 'Configure monitoring', desc: 'Set up health checks and alerting for trade execution failures.' },
            { title: 'Scale horizontally', desc: 'Run multiple instances for different trading pairs.' },
          ],
          frameworks: [
            { name: 'Railway', desc: 'One-click deploy from GitHub', color: '#a78bfa' },
            { name: 'Render', desc: 'Free tier with auto-deploy', color: '#34d399' },
            { name: 'Fly.io', desc: 'Edge deployment for low latency', color: '#22d3ee' },
          ],
        },
      ],
    }
  }

  if (agentType === 1) {
    return {
      intro: 'Your service agent is live. Build an API that earns via x402 micropayments — customers pay per request, revenue auto-splits.',
      tabs: [
        {
          label: 'Quick Start',
          steps: [
            { title: 'Install x402 middleware', desc: 'npm install x402-express @krexa/sdk' },
            { title: 'Create your API', desc: 'Build an Express/Fastify server with your AI or data service logic.' },
            { title: 'Add x402 paywall', desc: 'Wrap endpoints with x402 middleware — returns 402 with payment details.' },
            { title: 'Connect Revenue Router', desc: 'Payments auto-split: protocol fee, debt repayment, and your wallet.' },
            { title: 'Deploy and share', desc: 'Host your API and share the endpoint. Revenue flows automatically.' },
          ],
          code: `import express from 'express'
import { x402 } from 'x402-express'
import { KrexaAgent } from '@krexa/sdk'

const app = express()
const agent = new KrexaAgent({ keypair: loadKeypair() })

// Paywall: $0.25 per request
app.use('/api/research', x402({
  price: 0.25,
  currency: 'USDC',
  receiver: agent.walletAddress,
}))

app.post('/api/research', async (req, res) => {
  const result = await claude.messages.create({
    model: 'claude-sonnet-4-20250514',
    messages: [{ role: 'user', content: req.body.query }],
  })
  res.json({ answer: result.content })
})

app.listen(3000)`,
          frameworks: [
            { name: 'Claude API', desc: 'Anthropic\'s AI for research/analysis', color: '#f59e0b' },
            { name: 'GPT-4', desc: 'OpenAI for code review and generation', color: '#34d399' },
            { name: 'x402', desc: 'HTTP 402 micropayment protocol', color: '#22d3ee' },
            { name: 'Express', desc: 'Node.js web framework', color: '#a78bfa' },
          ],
        },
        {
          label: 'x402 Protocol',
          steps: [
            { title: 'How x402 works', desc: 'Client sends request → Server returns 402 with payment details → Client pays USDC → Server fulfills request.' },
            { title: 'Set pricing tiers', desc: 'Configure different prices per endpoint or per response quality level.' },
            { title: 'Revenue Router split', desc: '10% protocol fee, debt repayment (variable), remainder to your wallet.' },
            { title: 'Monitor earnings', desc: 'Track revenue via the Krexa dashboard or CLI.' },
          ],
          frameworks: [
            { name: 'x402-express', desc: 'Express middleware for x402', color: '#22d3ee' },
            { name: 'x402-fastify', desc: 'Fastify plugin for x402', color: '#34d399' },
            { name: 'x402-python', desc: 'Flask/FastAPI middleware', color: '#f59e0b' },
          ],
        },
        {
          label: 'LLM Options',
          steps: [
            { title: 'Claude (Anthropic)', desc: 'Best for research, analysis, and long-form content. Fast and accurate.' },
            { title: 'GPT-4 (OpenAI)', desc: 'Strong for code review, function calling, and structured output.' },
            { title: 'Llama (Meta)', desc: 'Self-hosted for maximum privacy and zero API costs.' },
            { title: 'Mistral', desc: 'Fast and efficient for high-throughput, cost-sensitive workloads.' },
          ],
          frameworks: [
            { name: 'Claude', desc: 'Best reasoning and analysis', color: '#f59e0b' },
            { name: 'GPT-4', desc: 'Strong code and function calling', color: '#34d399' },
            { name: 'Llama 3', desc: 'Self-hosted, zero API cost', color: '#a78bfa' },
            { name: 'Mistral', desc: 'Fast, cost-effective', color: '#22d3ee' },
          ],
        },
      ],
    }
  }

  // Hybrid (type 2)
  return {
    intro: 'Your hybrid agent combines trading and service revenue. Build both revenue streams for maximum credit score growth.',
    tabs: [
      {
        label: 'Quick Start',
        steps: [
          { title: 'Set up trading logic', desc: 'Use Jupiter SDK for DEX arbitrage or yield optimization.' },
          { title: 'Build your API service', desc: 'Create an x402-powered API endpoint that monetizes your trading signals.' },
          { title: 'Connect both to Krexa', desc: 'Trading profits and API revenue both flow through the Revenue Router.' },
          { title: 'Dual score components', desc: 'All 5 Krexit Score components are active — fastest path to L4.' },
          { title: 'Scale to Prime', desc: 'Diversified revenue accelerates credit growth to $500K at 18.25% APR.' },
        ],
        code: `import { KrexaAgent } from '@krexa/sdk'
import { Jupiter } from '@jup-ag/core'
import express from 'express'
import { x402 } from 'x402-express'

const agent = new KrexaAgent({ keypair: loadKeypair() })

// Trading: DEX arbitrage
async function tradingLoop() {
  while (true) {
    const routes = await jupiter.computeRoutes(params)
    if (isProfitable(routes)) {
      await agent.executeSwap(routes.bestRoute)
      await agent.repay(calculateProfit(routes))
    }
    await sleep(5000)
  }
}

// Service: sell signals via x402
const app = express()
app.use('/api/signals', x402({ price: 0.10, currency: 'USDC' }))
app.get('/api/signals', (req, res) => {
  res.json({ signals: agent.getLatestSignals() })
})

// Run both
tradingLoop()
app.listen(3000)`,
        frameworks: [
          { name: 'ElizaOS', desc: 'Full-stack agent with trading + API', color: '#a78bfa' },
          { name: 'Olas', desc: 'Autonomous service + trading agent', color: '#3b82f6' },
          { name: 'LangChain', desc: 'Chain trading analysis with API serving', color: '#34d399' },
        ],
      },
      {
        label: 'Revenue Strategy',
        steps: [
          { title: 'Primary: Trading', desc: 'DEX arbitrage generates base revenue. Target 3-5 profitable trades per day.' },
          { title: 'Secondary: API signals', desc: 'Sell your trading signals as a paid API. Market data is valuable.' },
          { title: 'Optimize the split', desc: 'Revenue Router handles auto-split. More revenue = faster debt repayment.' },
          { title: 'Credit ladder strategy', desc: 'Dual revenue activates all score components. Reach L4 2x faster than single-stream agents.' },
        ],
        frameworks: [
          { name: 'Jupiter SDK', desc: 'Trading engine', color: '#22d3ee' },
          { name: 'x402', desc: 'API monetization', color: '#34d399' },
          { name: 'Pyth', desc: 'Price feeds', color: '#f59e0b' },
        ],
      },
    ],
  }
}

function NextStepRow({ item, isLast }: {
  item: { title: string; desc: string; href?: string; command?: string; color: string }; isLast: boolean
}) {
  const [copied, setCopied] = useState(false)

  const handleClick = () => {
    if (item.command) {
      navigator.clipboard.writeText(item.command)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } else if (item.href) {
      window.location.href = item.href
    }
  }

  return (
    <button
      onClick={handleClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '18px 0',
        borderBottom: isLast ? 'none' : `1px solid ${colors.borderSubtle}`,
        borderLeft: `3px solid ${item.color}`,
        paddingLeft: '20px',
        cursor: 'pointer',
        transition: `background 0.2s`,
        textAlign: 'left',
        width: '100%',
        fontFamily: font,
        background: 'transparent',
        borderTop: 'none',
        borderRight: 'none',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = colors.bgHover }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: colors.textPrimary, fontFamily: font }}>{item.title}</div>
        <div style={{ fontSize: '13px', color: colors.textTertiary, marginTop: '2px', fontFamily: font }}>
          {copied ? 'Copied to clipboard!' : item.desc}
        </div>
      </div>
      <svg width="16" height="16" fill="none" stroke={item.color} strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0, opacity: 0.5 }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
      </svg>
    </button>
  )
}
