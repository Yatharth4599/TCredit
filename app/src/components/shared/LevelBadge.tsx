import { cn } from '../../lib/utils'

const LEVEL_CONFIG = [
  { label: 'L0 \u00b7 KYA Only', color: 'text-white/40 border-white/10 bg-white/[0.02]' },
  { label: 'L1 \u00b7 Starter', color: 'text-blue-300 border-blue-400/30 bg-blue-400/5' },
  { label: 'L2 \u00b7 Established', color: 'text-cyan-300 border-cyan-400/30 bg-cyan-400/5' },
  { label: 'L3 \u00b7 Trusted', color: 'text-purple-300 border-purple-400/30 bg-purple-400/5' },
  { label: 'L4 \u00b7 Elite', color: 'text-amber-300 border-amber-400/30 bg-amber-400/5' },
]

interface LevelBadgeProps {
  level: number
  className?: string
}

export function LevelBadge({ level, className }: LevelBadgeProps) {
  const config = LEVEL_CONFIG[level] || LEVEL_CONFIG[0]
  return (
    <span className={cn(
      'inline-flex px-2.5 py-1 rounded-full text-xs font-medium border',
      config.color, className
    )}>
      {config.label}
    </span>
  )
}
