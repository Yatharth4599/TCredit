export const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  fundraising: { label: 'Fundraising', color: 'var(--color-orange)' },
  active:       { label: 'Active',       color: 'var(--color-success)' },
  repaying:     { label: 'Repaying',     color: 'var(--color-info)' },
  completed:    { label: 'Completed',    color: 'var(--text-tertiary)' },
  defaulted:    { label: 'Defaulted',    color: 'var(--color-error)' },
  cancelled:    { label: 'Cancelled',    color: 'var(--text-disabled)' },
}
