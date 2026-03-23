import { useAgentWallet } from '../../hooks'
import { StatCard, LoadingSpinner } from '../shared'
import { formatUsdc, timeAgo } from '../../lib/utils'

export function WalletCard({ agentPubkey }: { agentPubkey?: string }) {
  const { data: wallet, isLoading } = useAgentWallet(agentPubkey)

  if (isLoading) return <div className="flex justify-center py-8"><LoadingSpinner /></div>
  if (!wallet) return null

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
      <h3 className="text-sm font-medium text-white/60 mb-4">Agent Wallet</h3>
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Credit Limit" value={`$${formatUsdc(wallet.creditLimit)}`} />
        <StatCard label="Credit Drawn" value={`$${formatUsdc(wallet.creditDrawn)}`} />
        <StatCard label="Total Debt" value={`$${formatUsdc(wallet.totalDebt)}`} />
        <StatCard label="Daily Limit" value={`$${formatUsdc(wallet.dailySpendLimit)}`} />
        <StatCard label="Daily Spent" value={`$${formatUsdc(wallet.dailySpent)}`} />
        <StatCard label="Total Trades" value={wallet.totalTrades.toString()} />
      </div>
      <div className="mt-4 flex items-center gap-4 text-xs text-white/30">
        <span>Created {timeAgo(wallet.createdAt.toNumber())}</span>
        {wallet.isFrozen && <span className="text-red-400 font-medium">FROZEN</span>}
        {wallet.isLiquidating && <span className="text-orange-400 font-medium">LIQUIDATING</span>}
      </div>
    </div>
  )
}
