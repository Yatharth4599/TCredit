import { useScrollAnimation } from '../../hooks/useScrollAnimation'
import { useEffect, useState } from 'react'

const font = "'Geist', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
const mono = "'Geist Mono', 'JetBrains Mono', monospace"

export function HowAgentsEarn() {
  const { ref, isVisible } = useScrollAnimation(0.1)

  return (
    <section
      style={{
        background: '#0a0a0c',
        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
      }}
    >
      <div
        ref={ref}
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '140px 24px',
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'translateY(0)' : 'translateY(30px)',
          transition: 'opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '64px' }}>
          <h2 style={{ fontSize: '40px', fontWeight: 600, color: '#f0f0f0', letterSpacing: '-0.02em', lineHeight: 1.2, margin: 0, fontFamily: font }}>
            How your agent earns
          </h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '720px', margin: '0 auto' }}>
          <TraderExample />
          <ServiceExample />
        </div>
      </div>
    </section>
  )
}

function TraderExample() {
  const { ref, isVisible } = useScrollAnimation(0.2)

  return (
    <div
      ref={ref}
      style={{
        background: '#111114',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '16px',
        padding: '32px',
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
        transition: 'opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1), transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div style={{ marginBottom: '8px' }}>
        <span style={{ color: '#22d3ee', fontSize: '13px', fontWeight: 600, letterSpacing: '0.05em', fontFamily: font }}>TRADER REVENUE</span>
      </div>
      <div style={{ fontSize: '15px', color: '#a0a0a8', marginBottom: '20px', fontFamily: font }}>
        Borrow $100 &rarr; Trade on Jupiter
      </div>

      <div
        style={{
          background: 'rgba(255,255,255,0.03)',
          borderRadius: '8px',
          padding: '16px 20px',
          fontFamily: mono,
          fontSize: '14px',
          color: '#a0a0a8',
          lineHeight: 1.7,
          whiteSpace: 'pre',
          overflowX: 'auto',
        }}
      >
{`Buy SOL at $148.50 on Orca
Sell SOL at $149.00 on Jupiter
Profit: $0.50 per SOL
\u00d7 20 trades/day = `}<span style={{ color: '#22d3ee' }}>$10/day</span>{`
Krexa daily cost: $0.10
Net profit: `}<span style={{ color: '#34d399' }}>$9.90/day</span>
      </div>
    </div>
  )
}

function ServiceExample() {
  const { ref, isVisible } = useScrollAnimation(0.2)

  return (
    <div
      ref={ref}
      style={{
        background: '#111114',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '16px',
        padding: '32px',
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
        transition: 'opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1), transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div style={{ marginBottom: '8px' }}>
        <span style={{ color: '#34d399', fontSize: '13px', fontWeight: 600, letterSpacing: '0.05em', fontFamily: font }}>SERVICE REVENUE (x402)</span>
      </div>
      <div style={{ fontSize: '15px', color: '#a0a0a8', marginBottom: '20px', fontFamily: font }}>
        Borrow $100 &rarr; Deploy x402 API &rarr; Customers pay
      </div>

      <div
        style={{
          background: 'rgba(255,255,255,0.03)',
          borderRadius: '8px',
          padding: '16px 20px',
          fontFamily: mono,
          fontSize: '14px',
          color: '#a0a0a8',
          lineHeight: 1.7,
          whiteSpace: 'pre',
          overflowX: 'auto',
          marginBottom: '24px',
        }}
      >
{`Customer sends query
Your API returns 402 Payment Required
Customer pays $0.25 USDC

30 queries/day \u00d7 $0.25 = `}<span style={{ color: '#22d3ee' }}>$7.50/day</span>{`
Credit repaid in ~20 days
Then: `}<span style={{ color: '#34d399' }}>90% of revenue is yours</span>
      </div>

      {/* Revenue Router Split Animation */}
      <RevenueRouterSplit isVisible={isVisible} />
    </div>
  )
}

function RevenueRouterSplit({ isVisible }: { isVisible: boolean }) {
  const [animate, setAnimate] = useState(false)

  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => setAnimate(true), 400)
      return () => clearTimeout(timer)
    }
  }, [isVisible])

  const segments = [
    { label: 'Protocol fee', value: '$0.025', pct: 10, color: '#ef4444' },
    { label: 'Debt repayment', value: '$0.100', pct: 40, color: '#22d3ee' },
    { label: 'You receive', value: '$0.125', pct: 50, color: '#34d399' },
  ]

  return (
    <div>
      <div style={{ fontSize: '12px', color: '#5a5a65', marginBottom: '12px', fontFamily: font }}>
        Revenue Router splits $0.25:
      </div>

      {/* Full bar */}
      <div style={{ height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.04)', marginBottom: '16px', display: 'flex', overflow: 'hidden' }}>
        {segments.map((s) => (
          <div
            key={s.label}
            style={{
              width: animate ? `${s.pct}%` : '0%',
              background: s.color,
              transition: `width 0.8s cubic-bezier(0.16, 1, 0.3, 1)`,
              transitionDelay: s.label === 'Protocol fee' ? '0ms' : s.label === 'Debt repayment' ? '150ms' : '300ms',
            }}
          />
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        {segments.map((s) => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
            <span style={{ fontSize: '12px', color: '#5a5a65', fontFamily: font }}>{s.label}</span>
            <span style={{ fontSize: '12px', color: '#a0a0a8', fontFamily: mono }}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
