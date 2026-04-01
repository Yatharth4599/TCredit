import { useVaultStats } from '../../hooks'
import { StatCard, LoadingSpinner } from '../shared'
import { formatUsdc } from '../../lib/utils'

export function ProtocolStats() {
  const { data: stats, isLoading } = useVaultStats()

  if (isLoading) return <div className="flex justify-center py-8"><LoadingSpinner /></div>
  if (!stats) return null

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-white/60">Protocol Overview</h3>
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="TVL" value={`$${formatUsdc(stats.totalDeposits)}`} />
        <StatCard label="Outstanding Loans" value={`$${formatUsdc(stats.totalBorrowed)}`} />
        <StatCard label="Insurance Fund" value={`$${formatUsdc(stats.insuranceBalance)}`} />
        <StatCard
          label="Utilization"
          value={stats.utilizationPct}
          trend={stats.utilizationBps > 7000 ? 'down' : 'neutral'}
        />
      </div>
    </div>
  )
}
