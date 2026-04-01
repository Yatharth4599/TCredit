import { cn } from '../../lib/utils'

interface StatCardProps {
  label: string
  value: string
  subtitle?: string
  icon?: React.ReactNode
  trend?: 'up' | 'down' | 'neutral'
  className?: string
}

export function StatCard({ label, value, subtitle, icon, trend, className }: StatCardProps) {
  return (
    <div className={cn(
      'rounded-xl border border-white/[0.06] bg-white/[0.02] p-5',
      className
    )}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-white/40 uppercase tracking-wider">{label}</span>
        {icon && <span className="text-white/30">{icon}</span>}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-white tracking-tight">{value}</span>
        {trend && (
          <span className={cn(
            'text-xs font-medium',
            trend === 'up' && 'text-emerald-400',
            trend === 'down' && 'text-red-400',
            trend === 'neutral' && 'text-white/40',
          )}>
            {trend === 'up' ? '\u2191' : trend === 'down' ? '\u2193' : '\u2014'}
          </span>
        )}
      </div>
      {subtitle && <p className="text-xs text-white/30 mt-1">{subtitle}</p>}
    </div>
  )
}
