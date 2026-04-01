// Shared helpers for all Solana dashboard pages

export const CREDIT_LEVELS: Record<number, { name: string; limit: string }> = {
  0: { name: 'KYA Only', limit: '$0' },
  1: { name: 'Starter', limit: '$500' },
  2: { name: 'Established', limit: '$20,000' },
  3: { name: 'Trusted', limit: '$50,000' },
  4: { name: 'Elite', limit: '$500,000' },
}

export const KYA_TIERS: Record<number, string> = {
  0: 'None',
  1: 'Basic',
  2: 'Enhanced',
  3: 'Institutional',
}

export const AGENT_TYPES: Record<number, string> = {
  0: 'Trader',
  1: 'Service',
  2: 'Hybrid',
}

export function formatUsdc(raw: number | string): string {
  const val = Number(raw) / 1e6
  return val.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export function formatUsdcRaw(raw: number | string): number {
  return Number(raw) / 1e6
}

export function formatBps(bps: number): string {
  return (bps / 100).toFixed(2) + '%'
}

export function formatPct(bps: number): string {
  return (bps / 100).toFixed(2) + '%'
}

export interface HealthZone {
  label: string
  color: string
  rgb: string
  cssVar: string
}

export function getHealthZone(factor: number): HealthZone {
  if (factor >= 15000) return { label: 'Healthy', color: '#10B981', rgb: '16, 185, 129', cssVar: 'var(--color-emerald)' }
  if (factor >= 13000) return { label: 'Warning', color: '#F59E0B', rgb: '245, 158, 11', cssVar: 'var(--color-warning)' }
  if (factor >= 12000) return { label: 'Danger', color: '#F97316', rgb: '249, 115, 22', cssVar: '#F97316' }
  return { label: 'Liquidation', color: '#EF4444', rgb: '239, 68, 68', cssVar: 'var(--color-error)' }
}

export function scoreColor(score: number): { color: string; rgb: string; label: string } {
  if (score >= 750) return { color: '#3B82F6', rgb: '59, 130, 246', label: 'Elite' }
  if (score >= 650) return { color: '#10B981', rgb: '16, 185, 129', label: 'Trusted' }
  if (score >= 500) return { color: '#F59E0B', rgb: '245, 158, 11', label: 'Established' }
  if (score >= 400) return { color: '#F97316', rgb: '249, 115, 22', label: 'Building' }
  return { color: '#EF4444', rgb: '239, 68, 68', label: 'New' }
}

export const TRANCHE_CONFIG = {
  senior: { label: 'Senior', rgb: '59, 130, 246', color: '#3B82F6', bgClass: 'bg-blue-500' },
  mezzanine: { label: 'Mezzanine', rgb: '139, 92, 246', color: '#8B5CF6', bgClass: 'bg-purple-500' },
  junior: { label: 'Junior', rgb: '249, 115, 22', color: '#F97316', bgClass: 'bg-orange-500' },
} as const
