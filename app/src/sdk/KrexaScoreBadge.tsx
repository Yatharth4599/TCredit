/**
 * KrexaScoreBadge — embeddable React component for third-party sites.
 *
 * Usage:
 *   import { KrexaScoreBadge } from '@krexa/sdk/badge'
 *   <KrexaScoreBadge agent="AgentPubkeyHere..." apiUrl="https://api.krexa.xyz" />
 *
 * Fetches the agent's credit score from the Krexa Credit Bureau API
 * and renders a compact badge with score, tier, and pass/fail status.
 */

import { useState, useEffect } from 'react'

interface CreditCheck {
  agent: string
  pass: boolean
  score: number
  tier: string
  maxCredit: string
  riskFlags: string[]
  checkedAt: string
}

export interface KrexaScoreBadgeProps {
  /** Solana agent public key */
  agent: string
  /** Krexa API base URL (default: /api/v1) */
  apiUrl?: string
  /** Compact mode — score only, no tier label */
  compact?: boolean
  /** Custom class name for the outer container */
  className?: string
}

const TIER_COLORS: Record<string, string> = {
  none: '#6b7280',
  starter: '#22c55e',
  established: '#3b82f6',
  trusted: '#a855f7',
  elite: '#f59e0b',
}

function getScoreColor(score: number): string {
  if (score >= 700) return '#22c55e'
  if (score >= 500) return '#3b82f6'
  if (score >= 300) return '#f59e0b'
  return '#ef4444'
}

export function KrexaScoreBadge({
  agent,
  apiUrl = '/api/v1',
  compact = false,
  className = '',
}: KrexaScoreBadgeProps) {
  const [data, setData] = useState<CreditCheck | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(`${apiUrl}/credit-bureau/${agent}/check`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((json: CreditCheck) => {
        if (!cancelled) setData(json)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [agent, apiUrl])

  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: compact ? '4px 10px' : '8px 14px',
    borderRadius: '12px',
    backgroundColor: '#111827',
    border: '1px solid #374151',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: compact ? '12px' : '13px',
    color: '#e5e7eb',
  }

  if (loading) {
    return (
      <span style={baseStyle} className={className}>
        <span style={{ color: '#6b7280' }}>Loading…</span>
      </span>
    )
  }

  if (error || !data) {
    return (
      <span style={baseStyle} className={className}>
        <span style={{ color: '#ef4444' }}>Score unavailable</span>
      </span>
    )
  }

  const scoreColor = getScoreColor(data.score)
  const tierColor = TIER_COLORS[data.tier] ?? '#6b7280'

  if (compact) {
    return (
      <span style={baseStyle} className={className}>
        <span style={{ fontWeight: 700, color: scoreColor }}>{data.score}</span>
        <span style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: data.pass ? '#22c55e' : '#ef4444',
          display: 'inline-block',
        }} />
      </span>
    )
  }

  return (
    <span style={baseStyle} className={className}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={tierColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
      <span style={{ fontWeight: 700, color: scoreColor }}>{data.score}</span>
      <span style={{
        textTransform: 'capitalize',
        color: tierColor,
        fontSize: '11px',
        fontWeight: 500,
      }}>
        {data.tier}
      </span>
      <span style={{
        padding: '1px 6px',
        borderRadius: '6px',
        fontSize: '10px',
        fontWeight: 600,
        backgroundColor: data.pass ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
        color: data.pass ? '#22c55e' : '#ef4444',
      }}>
        {data.pass ? 'PASS' : 'FAIL'}
      </span>
    </span>
  )
}
