import { formatUsdc, timeAgo } from '../../lib/utils'
import type { LPPosition } from '@krexa/solana-sdk'

const TRANCHE_NAMES = ['Senior', 'Mezzanine', 'Junior'] as const
const TRANCHE_COLORS = ['bg-blue-400', 'bg-purple-400', 'bg-amber-400'] as const

export function PositionCard({ position }: { position: LPPosition }) {
  const trancheName = TRANCHE_NAMES[position.tranche] || 'Unknown'
  const trancheColor = TRANCHE_COLORS[position.tranche] || 'bg-white/20'

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${trancheColor}`} />
          <h4 className="text-sm font-medium text-white">{trancheName} Position</h4>
        </div>
        {position.estimatedYield.toNumber() > 0 && (
          <span className="text-xs text-emerald-400 font-medium">
            +${formatUsdc(position.estimatedYield)} earned
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <span className="text-white/30 text-xs">Deposited</span>
          <p className="text-white font-medium">${formatUsdc(position.depositAmount)}</p>
        </div>
        <div>
          <span className="text-white/30 text-xs">Est. Value</span>
          <p className="text-white font-medium">${formatUsdc(position.estimatedValue)}</p>
        </div>
        <div>
          <span className="text-white/30 text-xs">Deposited</span>
          <p className="text-white font-medium">{timeAgo(position.depositedAt.toNumber())}</p>
        </div>
      </div>
    </div>
  )
}
