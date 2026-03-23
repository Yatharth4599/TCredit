import { cn, formatUsdc, bpsToPercent } from '../../lib/utils'

interface TrancheCardProps {
  name: string
  deposits: number
  shares: number
  aprBps: number
  shareBps: number
  color: string
}

export function TrancheCard({ name, deposits, shares, aprBps, shareBps, color }: TrancheCardProps) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className={cn('w-3 h-3 rounded-full', color)} />
        <h4 className="text-sm font-medium text-white">{name}</h4>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-white/40">Deposits</span>
          <span className="text-white font-medium">${formatUsdc(deposits)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-white/40">APR</span>
          <span className="text-emerald-400 font-medium">{bpsToPercent(aprBps)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-white/40">Pool Share</span>
          <span className="text-white/60">{bpsToPercent(shareBps)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-white/40">Shares</span>
          <span className="text-white/60">{shares.toLocaleString()}</span>
        </div>
      </div>
    </div>
  )
}
