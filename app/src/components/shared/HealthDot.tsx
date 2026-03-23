import { cn } from '../../lib/utils'

interface HealthDotProps {
  healthBps: number
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

export function HealthDot({ healthBps, size = 'md', showLabel }: HealthDotProps) {
  const color = healthBps >= 15000 ? 'bg-emerald-400' :
                healthBps >= 13000 ? 'bg-yellow-400' :
                healthBps >= 12000 ? 'bg-orange-400' :
                healthBps >= 10500 ? 'bg-red-400' : 'bg-red-600'

  const label = healthBps >= 15000 ? 'Healthy' :
                healthBps >= 13000 ? 'Warning' :
                healthBps >= 12000 ? 'Danger' :
                healthBps >= 10500 ? 'Liquidating' : 'Critical'

  const sizeClass = size === 'sm' ? 'w-2 h-2' : size === 'md' ? 'w-3 h-3' : 'w-4 h-4'

  return (
    <div className="flex items-center gap-2">
      <div className={cn(sizeClass, 'rounded-full', color)} />
      {showLabel && <span className="text-xs text-white/50">{label}</span>}
    </div>
  )
}
