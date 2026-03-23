import { useCreditLine } from '../../hooks'
import { LoadingSpinner, LevelBadge } from '../shared'
import { formatUsdc, bpsToPercent, timeAgo } from '../../lib/utils'

export function CreditLineCard({ agentPubkey }: { agentPubkey?: string }) {
  const { data: credit, isLoading } = useCreditLine(agentPubkey)

  if (isLoading) return <div className="flex justify-center py-8"><LoadingSpinner /></div>
  if (!credit) return null

  const utilization = credit.creditLimit.toNumber() > 0
    ? Math.round((credit.creditDrawn.toNumber() / credit.creditLimit.toNumber()) * 10000)
    : 0

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-white/60">Credit Line</h3>
        <LevelBadge level={credit.creditLevel} />
      </div>

      {/* Utilization bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-white/40 mb-1">
          <span>Drawn: ${formatUsdc(credit.creditDrawn)}</span>
          <span>Limit: ${formatUsdc(credit.creditLimit)}</span>
        </div>
        <div className="h-3 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-500 transition-all"
            style={{ width: `${Math.min(100, utilization / 100)}%` }}
          />
        </div>
        <div className="text-right text-xs text-white/30 mt-1">{bpsToPercent(utilization)} utilized</div>
      </div>

      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <span className="text-white/30 text-xs">Interest Rate</span>
          <p className="text-white font-medium">{bpsToPercent(credit.interestRateBps)} APR</p>
        </div>
        <div>
          <span className="text-white/30 text-xs">Accrued Interest</span>
          <p className="text-white font-medium">${formatUsdc(credit.accruedInterest)}</p>
        </div>
        <div>
          <span className="text-white/30 text-xs">Originated</span>
          <p className="text-white font-medium">{timeAgo(credit.originatedAt.toNumber())}</p>
        </div>
      </div>
    </div>
  )
}
