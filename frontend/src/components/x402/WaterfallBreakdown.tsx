import React from 'react'
import { type WaterfallState, fmtUSD, SENIOR_TRANCHE, MEZZANINE_TRANCHE, JUNIOR_TRANCHE } from '../../lib/x402MockData'
import { ShieldIcon, LayersIcon, BankIcon } from './Icons'
import s from './WaterfallBreakdown.module.css'

interface WaterfallBreakdownProps {
  state: WaterfallState
}

function ProgressTier({
  label,
  sublabel,
  current,
  target,
  color,
  icon,
}: {
  label: string
  sublabel: string
  current: number
  target: number
  color: string
  icon: React.ReactNode
}) {
  const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0

  return (
    <div className={s.tier}>
      <div className={s.tierHeader}>
        <div className={s.tierLeft}>
          <span className={s.tierIcon}>{icon}</span>
          <div>
            <span className={s.tierLabel}>{label}</span>
            <span className={s.tierSub}>{sublabel}</span>
          </div>
        </div>
        <div className={s.tierRight}>
          <span className={s.tierAmount}>{fmtUSD(current)}</span>
          <span className={s.tierOf}>/ {fmtUSD(target)}</span>
        </div>
      </div>
      <div className={s.barTrack}>
        <div
          className={s.barFill}
          style={{
            width: `${pct}%`,
            background: color,
            boxShadow: `0 0 12px ${color}40`,
          }}
        />
      </div>
      <div className={s.tierFooter}>
        <span className={s.tierPct} style={{ color }}>{pct.toFixed(1)}%</span>
        {pct >= 100 && <span className={s.completeBadge}>FULLY REPAID ✓</span>}
      </div>
    </div>
  )
}

export default function WaterfallBreakdown({ state }: WaterfallBreakdownProps) {
  return (
    <div className={s.container}>
      <div className={s.header}>
        <h3 className={s.title}>Waterfall Distribution</h3>
        <span className={s.subtitle}>Priority: Senior → Mezzanine → Junior</span>
      </div>

      <div className={s.tiers}>
        <ProgressTier
          label={SENIOR_TRANCHE.name}
          sublabel={`${SENIOR_TRANCHE.yieldRate}%/mo · NBFC · Priority repayment`}
          current={state.seniorRepaid}
          target={state.seniorTarget}
          color="#3b82f6"
          icon={<ShieldIcon size={20} color="#3b82f6" />}
        />
        <div className={s.connector}>
          <div className={s.connectorLine} />
          <span className={s.connectorLabel}>then</span>
          <div className={s.connectorLine} />
        </div>
        <ProgressTier
          label={MEZZANINE_TRANCHE.name}
          sublabel={`${MEZZANINE_TRANCHE.yieldRate}%/mo · LP · Mid-risk`}
          current={state.mezzanineRepaid}
          target={state.mezzanineTarget}
          color="#a855f7"
          icon={<LayersIcon size={20} color="#a855f7" />}
        />
        <div className={s.connector}>
          <div className={s.connectorLine} />
          <span className={s.connectorLabel}>then</span>
          <div className={s.connectorLine} />
        </div>
        <ProgressTier
          label={JUNIOR_TRANCHE.name}
          sublabel={`${JUNIOR_TRANCHE.yieldRate}%/mo · First-loss · Highest yield`}
          current={state.juniorRepaid}
          target={state.juniorTarget}
          color="#3B82F6"
          icon={<BankIcon size={20} color="#3B82F6" />}
        />
      </div>
    </div>
  )
}
