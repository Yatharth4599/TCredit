import { useState } from 'react'
import { motion } from 'framer-motion'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { PageHeader } from '../components/layout'
import { StatCard, EmptyState } from '../components/shared'
import { RegisterAgentModal } from '../components/agent/RegisterAgentModal'
import { CreateWalletStep } from '../components/agent/CreateWalletStep'
import { KYAStep } from '../components/agent/KYAStep'
import { useAgentProfile, useAgentHealth, useCreditLine, useAgentWallet, useFaucet, useScoreLookup } from '../hooks'
import { Wallet, Bot, Shield, CreditCard, Activity, Plus, Loader2, Droplets, AlertTriangle, ArrowUpCircle, BarChart3, Wifi, WifiOff } from 'lucide-react'
import { decodeName } from '../sdk/utils'
import { config } from '../config'

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
}

const stagger = {
  animate: { transition: { staggerChildren: 0.08 } },
}

function formatUsdc(raw: { toString(): string } | number | string): string {
  const val = Number(raw.toString()) / 1e6
  return val.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

const CREDIT_LEVELS: Record<number, string> = {
  0: 'KYA Only', 1: 'Starter', 2: 'Established', 3: 'Trusted', 4: 'Elite',
}
const AGENT_TYPES: Record<number, string> = {
  0: 'Trader', 1: 'Service', 2: 'Hybrid',
}

const LEVEL_THRESHOLDS: Record<number, { score: number; name: string; maxCredit: string }> = {
  1: { score: 400, name: 'Starter', maxCredit: '$500' },
  2: { score: 500, name: 'Established', maxCredit: '$20,000' },
  3: { score: 650, name: 'Trusted', maxCredit: '$50,000' },
  4: { score: 750, name: 'Elite', maxCredit: '$500,000' },
}

function getHealthZone(factor: number): { label: string; color: string; bg: string } {
  if (factor >= 15000) return { label: 'Healthy', color: 'text-green-400', bg: 'bg-green-500' }
  if (factor >= 13000) return { label: 'Warning', color: 'text-yellow-400', bg: 'bg-yellow-500' }
  if (factor >= 12000) return { label: 'Danger', color: 'text-orange-400', bg: 'bg-orange-500' }
  return { label: 'Liquidation', color: 'text-red-400', bg: 'bg-red-500' }
}

export default function Dashboard() {
  const { connected, publicKey } = useWallet()

  if (!connected) {
    return (
      <EmptyState
        icon={<Wallet size={48} />}
        title="Connect your wallet"
        description="Connect a Solana wallet to view your agent dashboard."
        action={
          <div className="[&_button]:!rounded-lg [&_button]:!bg-blue-600 [&_button]:!border-0">
            <WalletMultiButton />
          </div>
        }
      />
    )
  }

  const pubkey = publicKey?.toBase58() || ''

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agent Dashboard"
        subtitle={`Connected: ${pubkey}`}
      />
      <DashboardContent pubkey={pubkey} />
    </div>
  )
}

function DashboardContent({ pubkey }: { pubkey: string }) {
  const [showRegister, setShowRegister] = useState(false)
  const { data: profile, isLoading: profileLoading } = useAgentProfile()
  const { data: health } = useAgentHealth()
  const { data: creditLine } = useCreditLine()
  const { data: wallet } = useAgentWallet()

  // Loading state
  if (profileLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="text-blue-400 animate-spin" />
      </div>
    )
  }

  // No profile — show registration CTA
  if (!profile) {
    return (
      <>
        <NoProfileState onRegister={() => setShowRegister(true)} pubkey={pubkey} />
        <RegisterAgentModal
          isOpen={showRegister}
          onClose={() => setShowRegister(false)}
        />
      </>
    )
  }

  // Profile exists but no wallet — show wallet creation
  if (!wallet) {
    const agentPubkey = profile.agent.toBase58()
    return (
      <div className="space-y-6">
        <LiveProfileCard profile={profile} />
        <CreateWalletStep agentPubkey={agentPubkey} />
      </div>
    )
  }

  // Full dashboard with live data
  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-6">
      <LiveProfileCard profile={profile} />

      {/* Network Mismatch Warning */}
      {config.cluster === 'devnet' && (
        <motion.div variants={fadeIn} className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-3 flex items-center gap-3">
          <WifiOff size={16} className="text-yellow-400 shrink-0" />
          <p className="text-xs text-yellow-400">
            Connected to <span className="font-medium">devnet</span> — transactions use test tokens only.
          </p>
        </motion.div>
      )}

      {/* Score Summary */}
      <ScoreSummaryCard pubkey={pubkey} />

      {/* KYA prompt when tier is 0 */}
      {profile.kyaTier === 0 && (
        <KYAStep agentPubkey={profile.agent.toBase58()} currentTier={0} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Health Factor */}
        <motion.div variants={fadeIn} className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={16} className="text-emerald-400" />
            <h3 className="text-sm font-medium text-gray-400">Health Factor</h3>
          </div>
          {health ? (() => {
            const factor = health.healthFactorBps
            const zone = getHealthZone(factor)
            return (
              <div className="space-y-4">
                <p className={`text-4xl font-bold ${zone.color}`}>{(factor / 10000).toFixed(2)}x</p>
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${zone.bg}/20 ${zone.color}`}>
                  {zone.label}
                </span>
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <p className="text-xs text-gray-400">Collateral</p>
                    <p className="text-lg font-bold text-gray-100">{formatUsdc(health.collateralValue)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Total Debt</p>
                    <p className="text-lg font-bold text-gray-100">{formatUsdc(health.totalDebt)}</p>
                  </div>
                </div>
              </div>
            )
          })() : (
            <p className="text-gray-500 text-sm">No health data available.</p>
          )}
        </motion.div>

        {/* Credit Line */}
        <motion.div variants={fadeIn} className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard size={16} className="text-blue-400" />
            <h3 className="text-sm font-medium text-gray-400">Credit Line</h3>
          </div>
          {creditLine ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-400">Credit Limit</p>
                  <p className="text-lg font-bold text-gray-100">{formatUsdc(creditLine.creditLimit)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Amount Drawn</p>
                  <p className="text-lg font-bold text-gray-100">{formatUsdc(creditLine.creditDrawn)}</p>
                </div>
              </div>
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                creditLine.isActive ? 'bg-green-500/20 text-green-400' : 'bg-gray-600/20 text-gray-400'
              }`}>
                {creditLine.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          ) : (
            <div>
              <p className="text-4xl font-bold text-white/20">$0</p>
              <p className="text-xs text-gray-500 mt-2">No active credit line. Request one from the Credit page.</p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Liquidation Warning */}
      {health && health.healthFactorBps > 0 && health.healthFactorBps < 13000 && (
        <motion.div variants={fadeIn} className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle size={20} className="text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-400">
              {health.healthFactorBps < 12000
                ? 'Liquidation risk — your health factor is critically low'
                : 'Warning — your health factor is approaching the danger zone'}
            </p>
            <p className="text-xs text-red-400/70 mt-1">
              Repay some debt to restore your health factor above 1.50x.
              Current: {(health.healthFactorBps / 10000).toFixed(2)}x
            </p>
          </div>
        </motion.div>
      )}

      {/* Level Upgrade Path */}
      {profile && (() => {
        const currentLevel = profile.creditLevel
        const nextLevel = currentLevel + 1
        const next = LEVEL_THRESHOLDS[nextLevel]
        if (!next || currentLevel >= 4) return null
        const score = profile.creditScore
        const progress = Math.min(((score - (LEVEL_THRESHOLDS[currentLevel]?.score ?? 0)) / (next.score - (LEVEL_THRESHOLDS[currentLevel]?.score ?? 0))) * 100, 100)
        const pointsNeeded = Math.max(0, next.score - score)
        return (
          <motion.div variants={fadeIn} className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <ArrowUpCircle size={16} className="text-blue-400" />
              <h3 className="text-sm font-medium text-gray-400">Level Upgrade Path</h3>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
              <span>L{currentLevel} {CREDIT_LEVELS[currentLevel]}</span>
              <span>L{nextLevel} {next.name} (up to {next.maxCredit})</span>
            </div>
            <div className="h-2 bg-gray-900 rounded-full overflow-hidden mb-2">
              <div className="h-full bg-blue-500 rounded-full transition-all duration-700" style={{ width: `${Math.max(progress, 2)}%` }} />
            </div>
            <p className="text-xs text-gray-500">
              {pointsNeeded > 0
                ? `${pointsNeeded} more score points needed (current: ${score}, target: ${next.score})`
                : 'Score requirement met — complete KYA to upgrade'}
            </p>
          </motion.div>
        )
      })()}

      {/* Wallet Stats */}
      <motion.div variants={fadeIn} className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-purple-400" />
            <h3 className="text-sm font-medium text-gray-400">Agent Wallet</h3>
          </div>
          <FaucetButton />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-400">Credit Limit</p>
            <p className="text-xl font-bold text-gray-100">{formatUsdc(wallet.creditLimit)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Credit Drawn</p>
            <p className="text-xl font-bold text-gray-100">{formatUsdc(wallet.creditDrawn)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Daily Limit</p>
            <p className="text-xl font-bold text-gray-100">{formatUsdc(wallet.dailySpendLimit)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Total Volume</p>
            <p className="text-xl font-bold text-gray-100">{formatUsdc(wallet.totalVolume)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Total Repaid</p>
            <p className="text-xl font-bold text-gray-100">{formatUsdc(wallet.totalRepaid)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Health Factor</p>
            <p className="text-xl font-bold text-gray-100">{(wallet.healthFactorBps / 10000).toFixed(2)}x</p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

const COMPONENT_DETAILS: Record<string, { weight: string; description: string; tips: string[] }> = {
  Repayment: {
    weight: '30%',
    description: 'Measures on-time repayment history and credit utilization patterns.',
    tips: ['Repay credit on time', 'Avoid missed payments', 'Keep utilization below 50%'],
  },
  Profitability: {
    weight: '25%',
    description: 'Evaluates trading profitability and SOL/USDC balance health.',
    tips: ['Maintain positive trading P&L', 'Keep sufficient wallet balance', 'Avoid large unrealized losses'],
  },
  Behavioral: {
    weight: '20%',
    description: 'Tracks behavioral patterns — transaction regularity, risk exposure, and anomalies.',
    tips: ['Transact regularly', 'Avoid sudden large withdrawals', 'Maintain consistent trading patterns'],
  },
  Usage: {
    weight: '15%',
    description: 'Measures DeFi venue diversity and protocol engagement breadth.',
    tips: ['Trade on multiple venues', 'Use different DeFi protocols', 'Diversify trading pairs'],
  },
  Maturity: {
    weight: '10%',
    description: 'Account age, total transaction count, and token account diversity.',
    tips: ['Keep your account active over time', 'Transaction count grows naturally', 'This component improves with age'],
  },
}

function ScoreSummaryCard({ pubkey }: { pubkey: string }) {
  const [expandedComponent, setExpandedComponent] = useState<string | null>(null)
  const { data, isLoading } = useScoreLookup(pubkey)

  if (isLoading) {
    return (
      <motion.div variants={fadeIn} className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 size={16} className="text-indigo-400" />
          <h3 className="text-sm font-medium text-gray-400">Krexit Score</h3>
        </div>
        <div className="flex items-center justify-center py-4">
          <Loader2 size={20} className="text-blue-400 animate-spin" />
        </div>
      </motion.div>
    )
  }

  if (!data) return null

  const score = data.score?.score ?? data.preview?.score ?? 0
  const components = data.score
    ? {
        c1Repayment: data.score.c1Repayment,
        c2Profitability: data.score.c2Profitability,
        c3Behavioral: data.score.c3Behavioral,
        c4Usage: data.score.c4Usage,
        c5Maturity: data.score.c5Maturity,
      }
    : data.preview?.components ?? null
  const source = data.source === 'on-chain' ? 'On-chain' : 'Preview'
  const maxScore = 850
  const pct = Math.round((score / maxScore) * 100)

  const componentLabels: [string, string, number][] = components
    ? [
        ['Repayment', 'bg-green-500', components.c1Repayment],
        ['Profitability', 'bg-blue-500', components.c2Profitability],
        ['Behavioral', 'bg-purple-500', components.c3Behavioral],
        ['Usage', 'bg-cyan-500', components.c4Usage],
        ['Maturity', 'bg-orange-500', components.c5Maturity],
      ]
    : []

  return (
    <motion.div variants={fadeIn} className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 size={16} className="text-indigo-400" />
          <h3 className="text-sm font-medium text-gray-400">Krexit Score</h3>
          <span className="text-[10px] text-gray-600 px-1.5 py-0.5 bg-gray-800 rounded">{source}</span>
        </div>
        <a href="/score" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
          View details →
        </a>
      </div>
      <div className="flex items-center gap-6">
        {/* Score gauge */}
        <div className="text-center shrink-0">
          <p className="text-4xl font-bold text-gray-100">{score}</p>
          <p className="text-[10px] text-gray-500 mt-1">/ {maxScore}</p>
        </div>
        {/* Component bars (clickable for drill-down) */}
        {componentLabels.length > 0 && (
          <div className="flex-1 space-y-1">
            {componentLabels.map(([label, color, val]) => {
              const details = COMPONENT_DETAILS[label]
              const isExpanded = expandedComponent === label
              return (
                <div key={label}>
                  <button
                    onClick={() => setExpandedComponent(isExpanded ? null : label)}
                    className="flex items-center gap-2 w-full hover:bg-gray-700/20 rounded px-1 py-0.5 transition-colors"
                  >
                    <span className="text-[10px] text-gray-500 w-20 text-right">{label}</span>
                    <div className="flex-1 h-1.5 bg-gray-900 rounded-full overflow-hidden">
                      <div className={`h-full ${color} rounded-full`} style={{ width: `${Math.round(val / 100)}%` }} />
                    </div>
                    <span className="text-[10px] text-gray-500 w-8">{(val / 100).toFixed(0)}%</span>
                  </button>
                  {isExpanded && details && (
                    <div className="ml-[88px] mr-2 mt-1 mb-2 p-2.5 bg-gray-900/60 rounded-lg border border-gray-700/30">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`w-2 h-2 rounded-full ${color}`} />
                        <span className="text-[11px] font-medium text-gray-300">{label}</span>
                        <span className="text-[10px] text-gray-600">Weight: {details.weight}</span>
                      </div>
                      <p className="text-[10px] text-gray-400 mb-2">{details.description}</p>
                      <div className="space-y-0.5">
                        {details.tips.map((tip, i) => (
                          <p key={i} className="text-[10px] text-gray-500 flex items-center gap-1">
                            <span className="text-blue-400">+</span> {tip}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
      {/* Improvement suggestions */}
      {components && (() => {
        const suggestions: string[] = []
        if (components.c1Repayment < 7000) suggestions.push('Repay on-time to boost your Repayment score')
        if (components.c2Profitability < 5000) suggestions.push('Increase SOL balance or trade profitably')
        if (components.c4Usage < 5000) suggestions.push('Use more DeFi venues to improve Usage diversity')
        if (components.c5Maturity < 5000) suggestions.push('Keep transacting — account maturity grows over time')
        if (suggestions.length === 0) return null
        return (
          <div className="mt-3 pt-3 border-t border-gray-700/30">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">Improve your score</p>
            {suggestions.slice(0, 2).map((s, i) => (
              <p key={i} className="text-[11px] text-gray-400 flex items-center gap-1.5">
                <span className="text-blue-400">+</span> {s}
              </p>
            ))}
          </div>
        )
      })()}
    </motion.div>
  )
}

function FaucetButton() {
  const faucet = useFaucet()
  const [lastTx, setLastTx] = useState<string | null>(null)

  async function handleDrip() {
    try {
      const result = await faucet.mutateAsync(10)
      setLastTx(result.explorerUrl)
    } catch {
      // error displayed below
    }
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <button
        onClick={handleDrip}
        disabled={faucet.isPending}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 border border-cyan-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {faucet.isPending ? <Loader2 size={14} className="animate-spin" /> : <Droplets size={14} />}
        Get 10 Test USDC
      </button>
      {faucet.isSuccess && lastTx && (
        <a href={lastTx} target="_blank" rel="noreferrer" className="text-xs text-green-400 underline underline-offset-2">
          ✓ Minted — view tx
        </a>
      )}
      {faucet.isError && (
        <span className="text-xs text-red-400">{(faucet.error as Error)?.message}</span>
      )}
    </div>
  )
}

function NoProfileState({ onRegister, pubkey }: { onRegister: () => void; pubkey: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
          <Bot size={32} className="text-blue-400" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">No Agent Registered</h3>
        <p className="text-sm text-gray-400 mb-6 max-w-md mx-auto">
          Register an AI agent to start building credit on the Krexa protocol. Your agent gets its own on-chain identity, wallet, and credit score.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <button
            onClick={onRegister}
            className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-6 py-3 rounded-xl transition-colors inline-flex items-center gap-2"
          >
            <Plus size={16} />
            Register Agent
          </button>
          <FaucetButton />
        </div>
        <p className="text-xs text-gray-500 font-mono mt-4">{pubkey}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center mb-3">
            <Bot size={16} className="text-blue-400" />
          </div>
          <h4 className="text-sm font-medium text-white mb-1">1. Register</h4>
          <p className="text-xs text-gray-500">Create an agent with a name and type (Trader, Service, or Hybrid).</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center mb-3">
            <Shield size={16} className="text-purple-400" />
          </div>
          <h4 className="text-sm font-medium text-white mb-1">2. Create Wallet</h4>
          <p className="text-xs text-gray-500">Set up a credit wallet with a daily spending limit.</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center mb-3">
            <CreditCard size={16} className="text-green-400" />
          </div>
          <h4 className="text-sm font-medium text-white mb-1">3. Get Credit</h4>
          <p className="text-xs text-gray-500">Request a credit line based on your agent's score and history.</p>
        </div>
      </div>
    </motion.div>
  )
}

function LiveProfileCard({ profile }: { profile: any }) {
  const name = decodeName(profile.name)

  return (
    <motion.div variants={fadeIn} className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-600/30 flex items-center justify-center text-blue-400 font-bold text-lg">
            {name.charAt(0).toUpperCase() || 'A'}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{name || 'Agent'}</h3>
            <p className="text-xs text-gray-500 font-mono">{profile.agent.toBase58()}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400">
            L{profile.creditLevel} {CREDIT_LEVELS[profile.creditLevel] ?? ''}
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-cyan-500/20 text-cyan-400">
            {AGENT_TYPES[profile.agentType] ?? 'Unknown'}
          </span>
          {profile.isActive && (
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
              Active
            </span>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-xs text-gray-400">Credit Score</p>
          <p className="text-2xl font-bold text-gray-100">{profile.creditScore}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Total Volume</p>
          <p className="text-2xl font-bold text-gray-100">{formatUsdc(profile.totalVolume)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Total Trades</p>
          <p className="text-2xl font-bold text-gray-100">{profile.totalTrades.toString()}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Total Borrowed</p>
          <p className="text-2xl font-bold text-gray-100">{formatUsdc(profile.totalBorrowed)}</p>
        </div>
      </div>
    </motion.div>
  )
}
