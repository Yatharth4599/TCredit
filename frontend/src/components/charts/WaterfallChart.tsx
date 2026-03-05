import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import styles from './WaterfallChart.module.css'

interface WaterfallProps {
  seniorPayment: number
  poolPayment: number
  userPayment: number
  totalAmount: number
}

function getCSSVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

function getColors() {
  return {
    senior: getCSSVar('--accent', '#FF6B35'),
    pool: getCSSVar('--accent-light', '#FF8C5A'),
    user: getCSSVar('--text-secondary', 'rgba(245,245,247,0.6)'),
  }
}

interface TooltipPayload {
  name: string
  value: number
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null
  return (
    <div className={styles.tooltip}>
      <p className={styles.tooltipLabel}>{payload[0].name}</p>
      <p className={styles.tooltipValue}>${payload[0].value.toLocaleString()}</p>
    </div>
  )
}

export function WaterfallChart({ seniorPayment, poolPayment, userPayment, totalAmount }: WaterfallProps) {
  const COLORS = getColors()
  const data = [
    { name: 'Incoming', value: totalAmount, color: 'rgba(255,255,255,0.15)' },
    { name: 'Senior', value: seniorPayment, color: COLORS.senior },
    { name: 'Pool', value: poolPayment, color: COLORS.pool },
    { name: 'Merchant', value: userPayment, color: COLORS.user },
  ]

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>Payment Waterfall</span>
        <span className={styles.total}>${totalAmount.toLocaleString()}</span>
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} margin={{ top: 8, right: 0, left: -20, bottom: 0 }}>
          <XAxis dataKey="name" tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className={styles.legend}>
        {[
          { label: 'Senior', value: seniorPayment, color: COLORS.senior },
          { label: 'Pool', value: poolPayment, color: COLORS.pool },
          { label: 'Merchant', value: userPayment, color: COLORS.user },
        ].map((item) => (
          <div key={item.label} className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: item.color }} />
            <span className={styles.legendLabel}>{item.label}</span>
            <span className={styles.legendValue}>${item.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
