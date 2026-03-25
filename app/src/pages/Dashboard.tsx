import { useState } from 'react'
import { motion } from 'framer-motion'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { PageHeader } from '../components/layout'
import { StatCard, EmptyState } from '../components/shared'
import { RegisterAgentModal } from '../components/agent/RegisterAgentModal'
import { CreateWalletStep } from '../components/agent/CreateWalletStep'
import { useAgentProfile, useAgentHealth, useCreditLine, useAgentWallet, useFaucet } from '../hooks'
import { Wallet, Bot, Shield, CreditCard, Activity, Plus, Loader2, Droplets } from 'lucide-react'
import { decodeName } from '../sdk/utils'

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
    const agentKey = sessionStorage.getItem(`krexa_agent_${pubkey}`)
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
