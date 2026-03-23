import { cn } from '../../lib/utils'

export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div className={cn('w-5 h-5 border-2 border-white/10 border-t-white/50 rounded-full animate-spin', className)} />
  )
}
