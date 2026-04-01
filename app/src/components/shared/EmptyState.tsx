interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description: string
  action?: React.ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <div className="text-white/20 mb-4">{icon}</div>}
      <h3 className="text-lg font-medium text-white/70 mb-1">{title}</h3>
      <p className="text-sm text-white/30 max-w-sm mb-6">{description}</p>
      {action}
    </div>
  )
}
