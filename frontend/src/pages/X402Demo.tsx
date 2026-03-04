import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import LivePaymentFeed from '../components/x402/LivePaymentFeed'
import WaterfallBreakdown from '../components/x402/WaterfallBreakdown'
import {
  BotIcon, VaultIcon, CoinsIcon, SendIcon, BoltIcon, WaveIcon, CheckCircleIcon,
  ShieldIcon, LayersIcon, BankIcon, TranslateIcon, SearchIcon,
} from '../components/x402/Icons'
import {
  TRANSLATE_BOT,
  VAULT_CONFIG,
  SENIOR_TRANCHE,
  MEZZANINE_TRANCHE,
  JUNIOR_TRANCHE,
  ALL_INVESTORS,
  CREDIT_ASSESSMENT,
  type WaterfallState,
  computeWaterfallState,
  fmtUSD,
} from '../lib/x402MockData'
import s from './X402Demo.module.css'

const STEPS = [
  { id: 'register', label: 'Register', icon: <BotIcon size={18} /> },
  { id: 'assess', label: 'AI Credit', icon: <SearchIcon size={18} /> },
  { id: 'vault', label: 'Create Vault', icon: <VaultIcon size={18} /> },
  { id: 'fund', label: 'Fund', icon: <CoinsIcon size={18} /> },
  { id: 'disburse', label: 'Disburse', icon: <SendIcon size={18} /> },
  { id: 'payments', label: 'Payments', icon: <BoltIcon size={18} /> },
  { id: 'waterfall', label: 'Waterfall', icon: <WaveIcon size={18} /> },
  { id: 'complete', label: 'Complete', icon: <CheckCircleIcon size={18} /> },
]

const ASSESS_ITEMS = [
  { label: 'Payment History', value: `${CREDIT_ASSESSMENT.paymentHistory} months tracked` },
  { label: 'Transaction Volume', value: `${CREDIT_ASSESSMENT.totalTransactions.toLocaleString()} verified txns` },
  { label: 'Monthly Revenue', value: `${fmtUSD(CREDIT_ASSESSMENT.averageMonthlyRevenue)}/mo avg` },
  { label: 'Active Subscriptions', value: `${CREDIT_ASSESSMENT.activeSubscriptions} recurring clients` },
  { label: 'On-time Rate', value: `${CREDIT_ASSESSMENT.onTimePaymentRate}%` },
]

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const },
}

export default function X402Demo() {
  const [step, setStep] = useState(0)
  const [waterfallState, setWaterfallState] = useState<WaterfallState>(
    computeWaterfallState(0),
  )
  const [fundingPct, setFundingPct] = useState(0)
  const [vaultStatus, setVaultStatus] = useState<string>('—')
  const [assessChecked, setAssessChecked] = useState(0)
  const [assessApproved, setAssessApproved] = useState(false)
  const [disbursed, setDisbursed] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  // Animate AI assessment checklist on step 1
  useEffect(() => {
    if (step === 1) {
      setAssessChecked(0)
      setAssessApproved(false)
      const timers = ASSESS_ITEMS.map((_, i) =>
        setTimeout(() => setAssessChecked(i + 1), (i + 1) * 600),
      )
      const approveTimer = setTimeout(() => setAssessApproved(true), (ASSESS_ITEMS.length + 1) * 600)
      return () => { timers.forEach(clearTimeout); clearTimeout(approveTimer) }
    }
  }, [step])

  // Animate funding bar when step 3 activates
  useEffect(() => {
    if (step === 3) {
      setVaultStatus('Fundraising')
      const t1 = setTimeout(() => setFundingPct(80), 400)
      const t2 = setTimeout(() => {
        setFundingPct(100)
        setVaultStatus('Active')
      }, 1800)
      return () => { clearTimeout(t1); clearTimeout(t2) }
    }
  }, [step])

  // Animate single disbursement on step 4
  useEffect(() => {
    if (step === 4) {
      setDisbursed(false)
      const t = setTimeout(() => setDisbursed(true), 800)
      return () => clearTimeout(t)
    }
  }, [step])

  // Update waterfall as payments flow
  const handlePayments = useCallback((totalRepaid: number) => {
    setWaterfallState(computeWaterfallState(totalRepaid))
  }, [])

  const canPrev = step > 0
  const canNext = step < STEPS.length - 1

  return (
    <div className={s.page}>
      <div className={s.ambientGlow} />

      {/* Header */}
      <header className={`${s.header} ${mounted ? s.visible : ''}`}>
        <span className={s.overline}>Kora x402 Demo · Powered by Base</span>
        <h1 className={s.title}>
          Programmable Credit in Action
        </h1>
        <p className={s.subtitle}>
          Watch TranslateBot get a {fmtUSD(VAULT_CONFIG.target)} credit line — AI-assessed, funded by 3 pools, 
          repaid automatically from revenue. No trust required.
        </p>
      </header>

      {/* Step Indicators */}
      <div className={s.stepBar}>
        {STEPS.map((st, i) => (
          <button
            key={st.id}
            className={`${s.stepItem} ${i === step ? s.active : ''} ${i < step ? s.done : ''}`}
            onClick={() => setStep(i)}
          >
            <span className={s.stepIcon}>{st.icon}</span>
            <span className={s.stepLabel}>{st.label}</span>
          </button>
        ))}
      </div>

      {/* Step Content */}
      <div className={s.content}>
        <AnimatePresence mode="wait">
          {/* ── Step 0: Register ── */}
          {step === 0 && (
            <motion.div key="register" className={s.stepContent} {...fadeIn}>
              <div className={s.card}>
                <div className={s.cardHeader}>
                  <span className={s.cardIcon}><BotIcon size={28} color="#FF6B35" /></span>
                  <div>
                    <h2 className={s.cardTitle}>Agent Registration</h2>
                    <p className={s.cardDesc}>TranslateBot registers on-chain to build a verifiable payment identity on Base</p>
                  </div>
                </div>

                {/* Animated registration flow */}
                <div className={s.animFlow}>
                  <motion.div
                    className={s.animNode}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2, duration: 0.4 }}
                  >
                    <span className={s.animNodeIcon}><TranslateIcon size={24} color="#FF6B35" /></span>
                    <span className={s.animNodeLabel}>TranslateBot</span>
                  </motion.div>

                  <motion.div
                    className={s.animArrow}
                    initial={{ opacity: 0, scaleX: 0 }}
                    animate={{ opacity: 1, scaleX: 1 }}
                    transition={{ delay: 0.6, duration: 0.3 }}
                  >
                    <svg width="60" height="20" viewBox="0 0 60 20"><path d="M0 10h50M44 4l6 6-6 6" stroke="#FF6B35" strokeWidth="1.5" fill="none" /></svg>
                  </motion.div>

                  <motion.div
                    className={s.animNode}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.9, duration: 0.4 }}
                  >
                    <span className={s.animNodeIcon}><VaultIcon size={24} color="#3b82f6" /></span>
                    <span className={s.animNodeLabel}>AgentRegistry</span>
                  </motion.div>
                </div>

                <motion.div
                  className={s.agentCard}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.3, duration: 0.4 }}
                >
                  <span className={s.agentEmoji}><TranslateIcon size={32} color="#FF6B35" /></span>
                  <div className={s.agentInfo}>
                    <span className={s.agentName}>{TRANSLATE_BOT.name}</span>
                    <span className={s.agentType}>{TRANSLATE_BOT.type}</span>
                    <span className={s.agentAddr}>{TRANSLATE_BOT.address}</span>
                  </div>
                  <span className={s.registeredBadge}><CheckCircleIcon size={14} color="#34d399" /> Registered</span>
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* ── Step 1: AI Credit Assessment ── */}
          {step === 1 && (
            <motion.div key="assess" className={s.stepContent} {...fadeIn}>
              <div className={s.card}>
                <div className={s.cardHeader}>
                  <span className={s.cardIcon}><SearchIcon size={28} color="#FF6B35" /></span>
                  <div>
                    <h2 className={s.cardTitle}>AI Credit Assessment</h2>
                    <p className={s.cardDesc}>Kora AI analyzes TranslateBot's on-chain payment history, revenue patterns, and subscriber base</p>
                  </div>
                </div>

                <div className={s.assessGrid}>
                  {ASSESS_ITEMS.map((item, i) => (
                    <motion.div
                      key={item.label}
                      className={`${s.assessRow} ${i < assessChecked ? s.assessChecked : ''}`}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 + i * 0.15, duration: 0.3 }}
                    >
                      <span className={s.assessLabel}>{item.label}</span>
                      <span className={s.assessValue}>{item.value}</span>
                      <span className={s.assessCheck}>
                        {i < assessChecked ? <CheckCircleIcon size={16} color="#34d399" /> : <span className={s.assessSpinner} />}
                      </span>
                    </motion.div>
                  ))}
                </div>

                {assessApproved && (
                  <motion.div
                    className={s.assessResult}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4 }}
                  >
                    <div className={s.assessScore}>
                      <span className={s.scoreGrade}>Grade {CREDIT_ASSESSMENT.riskScore}</span>
                      <span className={s.scoreDivider} />
                      <span className={s.scoreLimit}>Credit Limit: {fmtUSD(CREDIT_ASSESSMENT.creditLimit)}</span>
                    </div>
                    <span className={s.approvedBadge}>
                      <CheckCircleIcon size={18} color="#34d399" /> APPROVED
                    </span>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── Step 2: Create Vault ── */}
          {step === 2 && (
            <motion.div key="vault" className={s.stepContent} {...fadeIn}>
              <div className={s.card}>
                <div className={s.cardHeader}>
                  <span className={s.cardIcon}><VaultIcon size={28} color="#FF6B35" /></span>
                  <div>
                    <h2 className={s.cardTitle}>Vault Creation</h2>
                    <p className={s.cardDesc}>VaultFactory deploys a MerchantVault via deterministic CREATE2 for TranslateBot</p>
                  </div>
                </div>

                {/* Animated deployment flow */}
                <div className={s.animFlow}>
                  <motion.div
                    className={s.animNode}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2, duration: 0.4 }}
                  >
                    <span className={s.animNodeIcon}><TranslateIcon size={24} color="#FF6B35" /></span>
                    <span className={s.animNodeLabel}>TranslateBot</span>
                  </motion.div>

                  <motion.div
                    className={s.animArrow}
                    initial={{ opacity: 0, scaleX: 0 }}
                    animate={{ opacity: 1, scaleX: 1 }}
                    transition={{ delay: 0.6, duration: 0.3 }}
                  >
                    <svg width="60" height="20" viewBox="0 0 60 20"><path d="M0 10h50M44 4l6 6-6 6" stroke="#FF6B35" strokeWidth="1.5" fill="none" /></svg>
                  </motion.div>

                  <motion.div
                    className={s.animNode}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.9, duration: 0.4 }}
                  >
                    <span className={s.animNodeIcon}><CoinsIcon size={24} color="#3b82f6" /></span>
                    <span className={s.animNodeLabel}>VaultFactory</span>
                  </motion.div>

                  <motion.div
                    className={s.animArrow}
                    initial={{ opacity: 0, scaleX: 0 }}
                    animate={{ opacity: 1, scaleX: 1 }}
                    transition={{ delay: 1.2, duration: 0.3 }}
                  >
                    <svg width="60" height="20" viewBox="0 0 60 20"><path d="M0 10h50M44 4l6 6-6 6" stroke="#34d399" strokeWidth="1.5" fill="none" /></svg>
                  </motion.div>

                  <motion.div
                    className={`${s.animNode} ${s.animNodeHighlight}`}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 1.5, duration: 0.5 }}
                  >
                    <span className={s.animNodeIcon}><VaultIcon size={24} color="#34d399" /></span>
                    <span className={s.animNodeLabel}>MerchantVault</span>
                  </motion.div>
                </div>

                <motion.div
                  className={s.vaultParams}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.8, duration: 0.4 }}
                >
                  {[
                    { label: 'Target', value: fmtUSD(VAULT_CONFIG.target) },
                    { label: 'Blended Rate', value: `${VAULT_CONFIG.blendedRate}%/mo` },
                    { label: 'Duration', value: `${VAULT_CONFIG.durationDays} days` },
                    { label: 'Disbursement', value: 'Single tranche' },
                    { label: 'Auto-Split', value: `${VAULT_CONFIG.repaymentRate}% to vault` },
                    { label: 'Monthly Cost', value: fmtUSD(VAULT_CONFIG.monthlyInterest) },
                  ].map((p) => (
                    <div key={p.label} className={s.paramItem}>
                      <span className={s.paramLabel}>{p.label}</span>
                      <span className={s.paramValue}>{p.value}</span>
                    </div>
                  ))}
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* ── Step 3: Fund (3 Pools) ── */}
          {step === 3 && (
            <motion.div key="fund" className={s.stepContent} {...fadeIn}>
              <div className={s.card}>
                <div className={s.cardHeader}>
                  <span className={s.cardIcon}><CoinsIcon size={28} color="#FF6B35" /></span>
                  <div>
                    <h2 className={s.cardTitle}>Three-Pool Capital Structure</h2>
                    <p className={s.cardDesc}>Three investor tiers fill the vault — different risk, different yield</p>
                  </div>
                </div>
                <div className={s.investorGrid3}>
                  {ALL_INVESTORS.map((inv) => (
                    <div key={inv.name} className={`${s.investorCard} ${s[inv.type]}`}>
                      <span className={s.investorBadge}>
                        {inv.type === 'senior' && <><ShieldIcon size={14} /> Senior (NBFC)</>}
                        {inv.type === 'mezzanine' && <><LayersIcon size={14} /> Mezzanine (LP)</>}
                        {inv.type === 'junior' && <><BankIcon size={14} /> Junior (Treasury)</>}
                      </span>
                      <span className={s.investorName}>{inv.name}</span>
                      <span className={s.investorAmount}>{fmtUSD(inv.amount)}</span>
                      <div className={s.investorYield}>
                        <span>{inv.yieldRate}%/mo yield</span>
                        <span>→ {fmtUSD(inv.monthlyYield)}/mo</span>
                      </div>
                      <span className={s.investorProfit}>
                        6-month return: {fmtUSD(inv.totalReturn)} (+{fmtUSD(inv.profit)})
                      </span>
                    </div>
                  ))}
                </div>
                <div className={s.fundingProgress}>
                  <div className={s.fundingBar}>
                    <div
                      className={s.fundingFill}
                      style={{ width: `${fundingPct}%` }}
                    />
                  </div>
                  <div className={s.fundingMeta}>
                    <span>{fundingPct}% funded</span>
                    <span className={s.vaultStatusBadge} data-status={vaultStatus.toLowerCase()}>
                      {vaultStatus}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Step 4: Disburse (Single Release) ── */}
          {step === 4 && (
            <motion.div key="disburse" className={s.stepContent} {...fadeIn}>
              <div className={s.card}>
                <div className={s.cardHeader}>
                  <span className={s.cardIcon}><SendIcon size={28} color="#FF6B35" /></span>
                  <div>
                    <h2 className={s.cardTitle}>Single Disbursement</h2>
                    <p className={s.cardDesc}>Full {fmtUSD(VAULT_CONFIG.target)} credit line released to TranslateBot in one tranche</p>
                  </div>
                </div>

                <div className={s.disburseFlow}>
                  <motion.div
                    className={s.disburseFrom}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2, duration: 0.4 }}
                  >
                    <VaultIcon size={28} color="#3b82f6" />
                    <span>MerchantVault</span>
                    <span className={s.disburseAmount}>{fmtUSD(VAULT_CONFIG.target)}</span>
                  </motion.div>

                  <motion.div
                    className={s.disburseArrow}
                    initial={{ opacity: 0, scaleX: 0 }}
                    animate={{ opacity: disbursed ? 1 : 0.3, scaleX: disbursed ? 1 : 0.3 }}
                    transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] as const }}
                  >
                    <svg width="100" height="24" viewBox="0 0 100 24">
                      <path d="M0 12h88M82 6l6 6-6 6" stroke={disbursed ? '#34d399' : '#555'} strokeWidth="2" fill="none" />
                    </svg>
                  </motion.div>

                  <motion.div
                    className={`${s.disburseTo} ${disbursed ? s.disburseComplete : ''}`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4, duration: 0.4 }}
                  >
                    <TranslateIcon size={28} color="#FF6B35" />
                    <span>TranslateBot</span>
                    {disbursed && <span className={s.disburseStatus}>✓ Received</span>}
                  </motion.div>
                </div>

                {disbursed && (
                  <motion.div
                    className={s.disburseNote}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.3 }}
                  >
                    PaymentRouter configured: {VAULT_CONFIG.repaymentRate}% of all incoming revenue auto-routes to vault repayment
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── Step 5: Live Payments ── */}
          {step === 5 && (
            <motion.div key="payments" className={s.stepContent} {...fadeIn}>
              <div className={s.card}>
                <div className={s.cardHeader}>
                  <span className={s.cardIcon}><BoltIcon size={28} color="#FF6B35" /></span>
                  <div>
                    <h2 className={s.cardTitle}>Automated Repayment</h2>
                    <p className={s.cardDesc}>
                      Every payment to TranslateBot is oracle-verified and auto-split: {VAULT_CONFIG.repaymentRate}% to vault, {100 - VAULT_CONFIG.repaymentRate}% to agent
                    </p>
                  </div>
                </div>
                <LivePaymentFeed onPaymentAdded={handlePayments} speed={2200} />
              </div>
            </motion.div>
          )}

          {/* ── Step 6: Waterfall ── */}
          {step === 6 && (
            <motion.div key="waterfall" className={s.stepContent} {...fadeIn}>
              <div className={s.cardWide}>
                <div className={s.cardHeader}>
                  <span className={s.cardIcon}><WaveIcon size={28} color="#FF6B35" /></span>
                  <div>
                    <h2 className={s.cardTitle}>Waterfall Distribution</h2>
                    <p className={s.cardDesc}>
                      Vault repayments distribute in priority order — Senior (NBFC) first, then Mezzanine (LP), then Junior (Treasury)
                    </p>
                  </div>
                </div>
                <div className={s.waterfallGrid}>
                  <div className={s.waterfallFeed}>
                    <LivePaymentFeed onPaymentAdded={handlePayments} speed={2000} maxVisible={5} />
                  </div>
                  <div className={s.waterfallPanel}>
                    <WaterfallBreakdown state={waterfallState} />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Step 7: Completion ── */}
          {step === 7 && (
            <motion.div key="complete" className={s.stepContent} {...fadeIn}>
              <div className={s.card}>
                <div className={s.cardHeader}>
                  <span className={s.cardIcon}><CheckCircleIcon size={28} color="#34d399" /></span>
                  <div>
                    <h2 className={s.cardTitle}>Loan Completed</h2>
                    <p className={s.cardDesc}>Total repaid hits target — vault marks as Completed. Everyone wins.</p>
                  </div>
                </div>
                <div className={s.outcomeGrid}>
                  <div className={`${s.outcomeCard} ${s.outcomeSenior}`}>
                    <span className={s.outcomeIcon}><ShieldIcon size={28} color="#3b82f6" /></span>
                    <span className={s.outcomeLabel}>{SENIOR_TRANCHE.name}</span>
                    <span className={s.outcomeInvested}>Invested {fmtUSD(SENIOR_TRANCHE.amount)}</span>
                    <span className={s.outcomeReturn}>{fmtUSD(SENIOR_TRANCHE.totalReturn)}</span>
                    <span className={s.outcomeProfit}>+{fmtUSD(SENIOR_TRANCHE.profit)} ({SENIOR_TRANCHE.yieldRate}%/mo)</span>
                  </div>
                  <div className={`${s.outcomeCard} ${s.outcomeMezzanine}`}>
                    <span className={s.outcomeIcon}><LayersIcon size={28} color="#a855f7" /></span>
                    <span className={s.outcomeLabel}>{MEZZANINE_TRANCHE.name}</span>
                    <span className={s.outcomeInvested}>Invested {fmtUSD(MEZZANINE_TRANCHE.amount)}</span>
                    <span className={s.outcomeReturn}>{fmtUSD(MEZZANINE_TRANCHE.totalReturn)}</span>
                    <span className={s.outcomeProfit}>+{fmtUSD(MEZZANINE_TRANCHE.profit)} ({MEZZANINE_TRANCHE.yieldRate}%/mo)</span>
                  </div>
                  <div className={`${s.outcomeCard} ${s.outcomeJunior}`}>
                    <span className={s.outcomeIcon}><BankIcon size={28} color="#FF6B35" /></span>
                    <span className={s.outcomeLabel}>{JUNIOR_TRANCHE.name}</span>
                    <span className={s.outcomeInvested}>Invested {fmtUSD(JUNIOR_TRANCHE.amount)}</span>
                    <span className={s.outcomeReturn}>{fmtUSD(JUNIOR_TRANCHE.totalReturn)}</span>
                    <span className={s.outcomeProfit}>+{fmtUSD(JUNIOR_TRANCHE.profit)} ({JUNIOR_TRANCHE.yieldRate}%/mo) · First-loss</span>
                  </div>
                  <div className={`${s.outcomeCard} ${s.outcomeAgent}`}>
                    <span className={s.outcomeIcon}><TranslateIcon size={28} color="#FF6B35" /></span>
                    <span className={s.outcomeLabel}>{TRANSLATE_BOT.name}</span>
                    <span className={s.outcomeInvested}>Received {fmtUSD(VAULT_CONFIG.target)} credit</span>
                    <span className={s.outcomeReturn}>Kept 85% of revenue</span>
                    <span className={s.outcomeProfit}>Auto-repaid · Zero default</span>
                  </div>
                </div>
                <div className={s.punchline}>
                  <p>
                    AI assessed creditworthiness. Three pools funded the vault. The oracle verified every payment, 
                    the smart contract enforced the split, and the waterfall guaranteed repayment order.
                  </p>
                  <p className={s.punchlineHighlight}>Credit risk = Activity risk.</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className={s.nav}>
        <button
          className={s.navBtn}
          onClick={() => setStep(step - 1)}
          disabled={!canPrev}
        >
          ← Previous
        </button>
        <span className={s.navStep}>
          {step + 1} / {STEPS.length}
        </span>
        <button
          className={`${s.navBtn} ${s.navBtnPrimary}`}
          onClick={() => setStep(step + 1)}
          disabled={!canNext}
        >
          Next →
        </button>
      </div>
    </div>
  )
}
