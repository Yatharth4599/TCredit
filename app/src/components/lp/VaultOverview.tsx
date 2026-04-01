import { useVaultStats } from '../../hooks'
import { StatCard, LoadingSpinner } from '../shared'
import { TrancheCard } from './TrancheCard'
import { formatUsdc, bpsToPercent } from '../../lib/utils'
import { PROTOCOL_CONSTANTS } from '@krexa/solana-sdk'

export function VaultOverview() {
  const { data: stats, isLoading } = useVaultStats()

  if (isLoading) return <div className="flex justify-center py-8"><LoadingSpinner /></div>
  if (!stats) return null

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Deposits" value={`$${formatUsdc(stats.totalDeposits)}`} />
        <StatCard label="Total Borrowed" value={`$${formatUsdc(stats.totalBorrowed)}`} />
        <StatCard label="Available" value={`$${formatUsdc(stats.availableLiquidity)}`} />
        <StatCard
          label="Utilization"
          value={stats.utilizationPct}
          subtitle={`Cap: ${bpsToPercent(PROTOCOL_CONSTANTS.UTILIZATION_CAP_BPS)}`}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <TrancheCard
          name="Senior"
          deposits={stats.tranches.senior.deposits.toNumber()}
          shares={stats.tranches.senior.shares.toNumber()}
          aprBps={stats.tranches.senior.aprBps}
          shareBps={PROTOCOL_CONSTANTS.SENIOR_SHARE_BPS}
          color="bg-blue-400"
        />
        <TrancheCard
          name="Mezzanine"
          deposits={stats.tranches.mezzanine.deposits.toNumber()}
          shares={stats.tranches.mezzanine.shares.toNumber()}
          aprBps={stats.tranches.mezzanine.aprBps}
          shareBps={PROTOCOL_CONSTANTS.MEZZANINE_SHARE_BPS}
          color="bg-purple-400"
        />
        <TrancheCard
          name="Junior"
          deposits={stats.tranches.junior.deposits.toNumber()}
          shares={stats.tranches.junior.shares.toNumber()}
          aprBps={stats.tranches.junior.aprBps}
          shareBps={PROTOCOL_CONSTANTS.JUNIOR_SHARE_BPS}
          color="bg-amber-400"
        />
      </div>
    </div>
  )
}
