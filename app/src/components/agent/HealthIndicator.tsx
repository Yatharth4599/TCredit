import { useAgentHealth } from '../../hooks'
import { HealthDot, LoadingSpinner } from '../shared'
import { formatUsdc } from '../../lib/utils'

export function HealthIndicator({ agentPubkey }: { agentPubkey?: string }) {
  const { data: health, isLoading } = useAgentHealth(agentPubkey)

  if (isLoading) return <div className="flex justify-center py-8"><LoadingSpinner /></div>
  if (!health) return null

  const hf = (health.healthFactorBps / 10000).toFixed(2)

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-white/60">Health Factor</h3>
        <HealthDot healthBps={health.healthFactorBps} showLabel />
      </div>

      {/* Gauge */}
      <div className="flex items-center gap-4 mb-6">
        <span className="text-4xl font-bold text-white tracking-tight">{hf}x</span>
        <div className="flex-1">
          <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, (health.healthFactorBps / 20000) * 100)}%`,
                background: health.healthFactorBps >= 15000 ? '#34d399' :
                            health.healthFactorBps >= 13000 ? '#fbbf24' :
                            health.healthFactorBps >= 12000 ? '#fb923c' : '#f87171'
              }}
            />
          </div>
          <div className="flex justify-between mt-1 text-[10px] text-white/20">
            <span>1.05x</span>
            <span>1.20x</span>
            <span>1.30x</span>
            <span>1.50x+</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <span className="text-white/30 text-xs">Wallet Balance</span>
          <p className="text-white font-medium">${formatUsdc(health.walletBalance)}</p>
        </div>
        <div>
          <span className="text-white/30 text-xs">Total Debt</span>
          <p className="text-white font-medium">${formatUsdc(health.totalDebt)}</p>
        </div>
        <div>
          <span className="text-white/30 text-xs">Credit Drawn</span>
          <p className="text-white font-medium">${formatUsdc(health.creditDrawn)}</p>
        </div>
      </div>
    </div>
  )
}
