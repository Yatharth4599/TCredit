import { cn } from '../../lib/utils'

interface ScoreBadgeProps {
  score: number
  className?: string
}

export function ScoreBadge({ score, className }: ScoreBadgeProps) {
  const color = score >= 750 ? 'text-emerald-400 border-emerald-400/30 bg-emerald-400/5' :
                score >= 650 ? 'text-blue-400 border-blue-400/30 bg-blue-400/5' :
                score >= 500 ? 'text-yellow-400 border-yellow-400/30 bg-yellow-400/5' :
                score >= 350 ? 'text-orange-400 border-orange-400/30 bg-orange-400/5' :
                               'text-red-400 border-red-400/30 bg-red-400/5'

  const label = score >= 750 ? 'Excellent' :
                score >= 650 ? 'Good' :
                score >= 500 ? 'Fair' :
                score >= 350 ? 'Low' : 'Poor'

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
      color, className
    )}>
      {score} <span className="text-white/40">&middot;</span> {label}
    </span>
  )
}
