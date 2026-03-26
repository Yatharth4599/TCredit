import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { motion } from 'motion/react'
import toast from 'react-hot-toast'
import SolanaLayout from '../components/layout/SolanaLayout'
import { GlassCard } from '../components/ui/GlassCard'
import Stepper, { Step } from '../components/ui/Stepper'
import { agentApi, kyaApi, faucetApi } from '../api/solanaClient'
import { useSolanaTx } from '../hooks/useSolanaTx'
import { txUrl } from '../config/solana'
import { containerVariants, cardVariants } from '../utils/motionVariants'
import s from './Onboard.module.css'

const AGENT_TYPES = [
  {
    id: 0,
    name: 'Trader Agent',
    badge: 'Type A',
    icon: '📈',
    iconBg: 'rgba(59, 130, 246, 0.15)',
    desc: 'DeFi bots, market makers, arbitrage engines',
    details: [
      'Whitelisted venues: Jupiter, Raydium, Orca, Pump.fun',
      'Key drivers: C1 Repayment (30%) + C2 Profitability (25%)',
      'Best path to L4: consistent profits + on-time repayment',
    ],
  },
  {
    id: 1,
    name: 'Service Agent',
    badge: 'Type B',
    icon: '🔌',
    iconBg: 'rgba(16, 185, 129, 0.15)',
    desc: 'API providers, data feeds, signal services',
    details: [
      'Revenue via x402 (HTTP 402 Payment Required)',
      'Key drivers: C1 Repayment (30%) + C3 Behavioral (20%)',
      'Best path to L4: steady revenue + behavioral health',
    ],
  },
  {
    id: 2,
    name: 'Hybrid Agent',
    badge: 'Type C',
    icon: '⚡',
    iconBg: 'rgba(245, 158, 11, 0.15)',
    desc: 'Combined trading + service (highest ceiling)',
    details: [
      'Benefits from all 5 score components simultaneously',
      'Highest credit ceiling potential',
      'Best path to L4: diversified activity across trading + revenue',
    ],
  },
]

export default function Onboard() {
  const navigate = useNavigate()
  const { publicKey, connected, signMessage } = useWallet()
  const { setVisible } = useWalletModal()
  const { execute: executeTx } = useSolanaTx()

  // Step state
  const [selectedType, setSelectedType] = useState<number | null>(null)
  const [agentPubkey, setAgentPubkey] = useState<string | null>(null)
  const [registerStatus, setRegisterStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [registerError, setRegisterError] = useState<string | null>(null)
  const [registerTx, setRegisterTx] = useState<string | null>(null)

  const [kyaStatus, setKyaStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [kyaError, setKyaError] = useState<string | null>(null)

  const [faucetAmount, setFaucetAmount] = useState(10)
  const [faucetStatus, setFaucetStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [faucetError, setFaucetError] = useState<string | null>(null)
  const [faucetTx, setFaucetTx] = useState<string | null>(null)

  const addr = publicKey?.toBase58() ?? ''
  const shortAddr = addr ? `${addr.slice(0, 4)}...${addr.slice(-4)}` : ''

  // ── Step 2: Register Agent ──
  const handleRegister = useCallback(async () => {
    if (!publicKey || selectedType === null) return
    setRegisterStatus('loading')
    setRegisterError(null)
    try {
      const res = await agentApi.createWallet(addr, selectedType)
      const data = res.data
      if (data.transaction) {
        const sig = await executeTx(data.transaction)
        setRegisterTx(sig)
        setAgentPubkey(data.agentPubkey ?? addr)
      } else {
        setAgentPubkey(data.agentPubkey ?? data.agent ?? addr)
      }
      setRegisterStatus('done')
      toast.success('Agent registered on Solana devnet!')
    } catch (err) {
      setRegisterStatus('error')
      const msg = err instanceof Error ? err.message : 'Registration failed'
      setRegisterError(msg)
      toast.error(msg)
    }
  }, [publicKey, selectedType, addr, executeTx])

  // ── Step 3: KYA Verification ──
  const handleKya = useCallback(async () => {
    if (!publicKey || !signMessage || !agentPubkey) return
    setKyaStatus('loading')
    setKyaError(null)
    try {
      const message = new TextEncoder().encode(`Krexa KYA Verification: ${agentPubkey}`)
      const signature = await signMessage(message)
      const sigBase64 = Buffer.from(signature).toString('base64')
      await kyaApi.basicVerify(agentPubkey, addr, sigBase64)
      setKyaStatus('done')
      toast.success('KYA Tier 1 verified!')
    } catch (err) {
      setKyaStatus('error')
      const msg = err instanceof Error ? err.message : 'KYA verification failed'
      setKyaError(msg)
      toast.error(msg)
    }
  }, [publicKey, signMessage, agentPubkey, addr])

  // ── Step 4: Faucet ──
  const handleFaucet = useCallback(async () => {
    if (!addr) return
    setFaucetStatus('loading')
    setFaucetError(null)
    try {
      const res = await faucetApi.mintUsdc(addr, faucetAmount)
      setFaucetTx(res.data.signature ?? null)
      setFaucetStatus('done')
      toast.success(`${faucetAmount} USDC minted!`)
    } catch (err) {
      setFaucetStatus('error')
      const msg = err instanceof Error ? err.message : 'Faucet failed'
      setFaucetError(msg)
      toast.error(msg)
    }
  }, [addr, faucetAmount])

  const agentTypeName = selectedType !== null ? AGENT_TYPES[selectedType].name : '—'

  return (
    <SolanaLayout
      title="Agent Onboarding"
      subtitle="Register your AI agent on Solana devnet in 4 easy steps."
      dataLoaded={connected}
    >
      <motion.div variants={containerVariants} initial="hidden" animate="visible">
        <motion.div variants={cardVariants}>
          <GlassCard>
            <Stepper
              initialStep={1}
              onFinalStepCompleted={() => navigate('/app/solana/credit')}
              nextButtonText="Next"
              backButtonText="Back"
            >
              {/* ── Step 1: Connect Wallet ── */}
              <Step>
                <h3 className={s.stepTitle}>Connect Wallet</h3>
                <p className={s.stepDesc}>
                  Connect your Solana wallet (Phantom or Solflare) to get started.
                  Make sure you're on <strong>Devnet</strong>.
                </p>

                {connected && publicKey ? (
                  <div className={s.connectedInfo}>
                    <div className={s.connectedDot} />
                    <div>
                      <div className={s.connectedAddr}>{shortAddr}</div>
                      <div className={s.connectedLabel}>Connected on Devnet</div>
                    </div>
                  </div>
                ) : (
                  <button className={s.actionBtn} onClick={() => setVisible(true)}>
                    Connect Wallet
                  </button>
                )}
              </Step>

              {/* ── Step 2: Register Agent ── */}
              <Step>
                <h3 className={s.stepTitle}>Register Agent</h3>
                <p className={s.stepDesc}>
                  Choose your agent type. This determines your score weights and credit path.
                </p>

                <div className={s.agentTypeGrid}>
                  {AGENT_TYPES.map((type) => (
                    <div
                      key={type.id}
                      className={`${s.agentTypeCard} ${selectedType === type.id ? s.selected : ''}`}
                      onClick={() => registerStatus !== 'done' && setSelectedType(type.id)}
                    >
                      <div className={s.agentTypeBadge}>{type.badge}</div>
                      <div className={s.agentTypeIcon} style={{ background: type.iconBg }}>
                        {type.icon}
                      </div>
                      <div className={s.agentTypeName}>{type.name}</div>
                      <div className={s.agentTypeDesc}>{type.desc}</div>
                      <div className={s.agentTypeDetails}>
                        {type.details.map((d, i) => (
                          <div key={i} className={s.agentTypeDetail}>
                            <span className={s.dot} />
                            {d}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {registerStatus === 'done' ? (
                  <div className={s.successMsg}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Agent registered successfully!
                    {registerTx && (
                      <a href={txUrl(registerTx)} target="_blank" rel="noopener noreferrer" className={s.txLink}>
                        View on Solscan
                      </a>
                    )}
                  </div>
                ) : (
                  <button
                    className={s.actionBtn}
                    disabled={selectedType === null || registerStatus === 'loading' || !connected}
                    onClick={handleRegister}
                  >
                    {registerStatus === 'loading' ? (
                      <><div className={s.spinner} /> Registering...</>
                    ) : (
                      'Register Agent'
                    )}
                  </button>
                )}
                {registerError && <p className={s.errorMsg}>{registerError}</p>}
              </Step>

              {/* ── Step 3: KYA Verification ── */}
              <Step>
                <h3 className={s.stepTitle}>KYA Verification</h3>
                <p className={s.stepDesc}>
                  Know Your Agent (KYA) — sign a message with your wallet to verify ownership.
                  This gives you Tier 1 access instantly.
                </p>

                <div className={s.kyaExplainer}>
                  <div className={s.kyaExplainerTitle}>What is KYA?</div>
                  <div className={s.kyaExplainerText}>
                    KYA (Know Your Agent) is Krexa's identity layer. Tier 1 requires a simple wallet signature.
                    Higher tiers unlock larger credit lines: Tier 2 adds KYC verification, Tier 3 is for institutional agents.
                  </div>
                </div>

                {kyaStatus === 'done' ? (
                  <div className={s.successMsg}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    KYA Tier 1 verified!
                  </div>
                ) : (
                  <button
                    className={s.actionBtn}
                    disabled={kyaStatus === 'loading' || !agentPubkey}
                    onClick={handleKya}
                  >
                    {kyaStatus === 'loading' ? (
                      <><div className={s.spinner} /> Verifying...</>
                    ) : (
                      'Sign & Verify'
                    )}
                  </button>
                )}
                {kyaError && <p className={s.errorMsg}>{kyaError}</p>}
                {!agentPubkey && <p className={s.statusMsg}>Complete Step 2 first to register your agent.</p>}
              </Step>

              {/* ── Step 4: Get Test USDC ── */}
              <Step>
                <h3 className={s.stepTitle}>Get Test USDC</h3>
                <p className={s.stepDesc}>
                  Mint devnet USDC from the faucet. You'll use this to interact with the credit protocol.
                </p>

                <div className={s.faucetRow}>
                  <div className={s.faucetAmount}>
                    <input
                      type="range"
                      min={1}
                      max={100}
                      value={faucetAmount}
                      onChange={(e) => setFaucetAmount(Number(e.target.value))}
                      className={s.faucetSlider}
                      disabled={faucetStatus === 'done'}
                    />
                  </div>
                  <div className={s.faucetValue}>${faucetAmount}</div>
                </div>

                {faucetStatus === 'done' ? (
                  <div className={s.successMsg}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {faucetAmount} USDC minted!
                    {faucetTx && (
                      <a href={txUrl(faucetTx)} target="_blank" rel="noopener noreferrer" className={s.txLink}>
                        View on Solscan
                      </a>
                    )}
                  </div>
                ) : (
                  <button
                    className={s.actionBtn}
                    disabled={faucetStatus === 'loading' || !connected}
                    onClick={handleFaucet}
                  >
                    {faucetStatus === 'loading' ? (
                      <><div className={s.spinner} /> Minting...</>
                    ) : (
                      `Mint ${faucetAmount} USDC`
                    )}
                  </button>
                )}
                {faucetError && <p className={s.errorMsg}>{faucetError}</p>}
              </Step>

              {/* ── Step 5: Complete ── */}
              <Step>
                <h3 className={s.stepTitle}>You're All Set!</h3>
                <p className={s.stepDesc}>
                  Your AI agent is registered on Solana devnet and ready to use the Krexa credit protocol.
                </p>

                <div className={s.summaryGrid}>
                  <div className={s.summaryItem}>
                    <div className={s.summaryLabel}>Wallet</div>
                    <div className={s.summaryValue}>{shortAddr}</div>
                  </div>
                  <div className={s.summaryItem}>
                    <div className={s.summaryLabel}>Agent Type</div>
                    <div className={s.summaryValue}>{agentTypeName}</div>
                  </div>
                  <div className={s.summaryItem}>
                    <div className={s.summaryLabel}>KYA Tier</div>
                    <div className={s.summaryValue}>{kyaStatus === 'done' ? 'Tier 1' : 'Pending'}</div>
                  </div>
                  <div className={s.summaryItem}>
                    <div className={s.summaryLabel}>Test USDC</div>
                    <div className={s.summaryValue}>{faucetStatus === 'done' ? `$${faucetAmount}` : '$0'}</div>
                  </div>
                </div>

                <button className={s.actionBtn} onClick={() => navigate('/app/solana/credit')}>
                  Go to Credit Dashboard
                </button>
              </Step>
            </Stepper>
          </GlassCard>
        </motion.div>
      </motion.div>
    </SolanaLayout>
  )
}
