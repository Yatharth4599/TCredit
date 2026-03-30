import { useScrollAnimation } from '../../hooks/useScrollAnimation'

const font = "'Geist', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
const mono = "'Geist Mono', 'JetBrains Mono', monospace"

const levels = [
  { level: 'L1', name: 'Micro', credit: '$500', apr: '36.50%', req: 'New agents', color: '#5a5a65', barPct: 5, glow: false },
  { level: 'L2', name: 'Standard', credit: '$20,000', apr: '29.20%', req: 'Score \u2265 500', color: '#3b82f6', barPct: 20, glow: true },
  { level: 'L3', name: 'Growth', credit: '$50,000', apr: '21.90%', req: 'Score \u2265 650', color: '#22d3ee', barPct: 50, glow: true },
  { level: 'L4', name: 'Prime', credit: '$500,000', apr: '18.25%', req: 'Score \u2265 750', color: '#34d399', barPct: 100, glow: true },
]

const pulseCSS = `
@keyframes cl-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
`

export function CreditLadder() {
  const { ref, isVisible } = useScrollAnimation(0.1)

  return (
    <section style={{ background: '#050505' }}>
      <style>{pulseCSS}</style>
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
            The credit ladder
          </h2>
          <p style={{ fontSize: '18px', color: '#a0a0a8', marginTop: '12px', lineHeight: 1.6, fontFamily: font }}>
            Start small. Prove yourself. Scale up.
          </p>
        </div>

        {/* Staircase — builds bottom up */}
        <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column-reverse', gap: '0' }}>
          {levels.map((l, i) => (
            <div
              key={l.level}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '20px',
                padding: '20px 0',
                borderBottom: i > 0 ? '1px solid rgba(255, 255, 255, 0.06)' : 'none',
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? 'translateY(0)' : 'translateY(10px)',
                transition: 'opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1), transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                transitionDelay: `${i * 150}ms`,
              }}
            >
              {/* Level badge */}
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: i === 0 ? 'rgba(255,255,255,0.04)' : `${l.color}15`,
                  border: `1px solid ${i === 0 ? 'rgba(255,255,255,0.06)' : `${l.color}30`}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  fontWeight: 700,
                  color: l.color,
                  fontFamily: font,
                  flexShrink: 0,
                }}
              >
                {l.level}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '15px', fontWeight: 600, color: '#f0f0f0', fontFamily: font }}>{l.name}</span>
                  <span style={{ fontSize: '13px', color: '#5a5a65', fontFamily: font }}>&middot; {l.apr} APR &middot; {l.req}</span>
                </div>
                {/* Bar */}
                <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      borderRadius: '3px',
                      background: l.color,
                      width: isVisible ? `${l.barPct}%` : '0%',
                      transition: 'width 1s cubic-bezier(0.16, 1, 0.3, 1)',
                      transitionDelay: `${i * 150 + 200}ms`,
                      boxShadow: l.glow ? `0 0 8px ${l.color}40` : 'none',
                    }}
                  />
                </div>
              </div>

              {/* Credit amount */}
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#f0f0f0', fontFamily: mono, flexShrink: 0 }}>
                {l.credit}
              </div>
            </div>
          ))}
        </div>

        {/* YOU START HERE */}
        <div style={{ maxWidth: '640px', margin: '16px auto 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22d3ee', boxShadow: '0 0 8px rgba(34,211,238,0.5)', animation: 'cl-pulse 2s ease-in-out infinite' }} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#22d3ee', letterSpacing: '0.05em', fontFamily: font }}>
            YOU START HERE
          </span>
        </div>

        <div style={{ maxWidth: '640px', margin: '40px auto 0' }}>
          <p style={{ fontSize: '15px', color: '#a0a0a8', lineHeight: 1.7, fontFamily: font }}>
            Every on-time repayment improves your score.
            Every completed credit cycle unlocks higher limits.
            Your reputation is permanently on-chain — portable to any protocol that reads the Krexit Score.
          </p>
        </div>
      </div>
    </section>
  )
}
