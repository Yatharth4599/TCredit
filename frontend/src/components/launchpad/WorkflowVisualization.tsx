import { useScrollAnimation } from '../../hooks/useScrollAnimation'
import { useState } from 'react'

const font = "'Geist', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
const mono = "'Geist Mono', 'JetBrains Mono', monospace"

const steps = [
  {
    num: 1,
    label: 'Build',
    desc: 'Write your agent with any framework',
    color: '#a78bfa',
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
      </svg>
    ),
  },
  {
    num: 2,
    label: 'Fund',
    desc: 'Get USDC from faucet or deposit',
    color: '#3b82f6',
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    num: 3,
    label: 'Deploy',
    desc: 'Register on-chain via Krexa',
    color: '#22d3ee',
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
      </svg>
    ),
  },
  {
    num: 4,
    label: 'Earn',
    desc: 'Trade or serve via x402',
    color: '#34d399',
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2 20h20M5 20V10l4-6 4 8 4-4 3 4v8" />
      </svg>
    ),
  },
  {
    num: 5,
    label: 'Revenue Router',
    desc: 'Auto-split payments',
    color: '#f59e0b',
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
    ),
  },
  {
    num: 6,
    label: 'Scale',
    desc: 'Level up your credit line',
    color: '#ec4899',
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
]

export function WorkflowVisualization() {
  const { ref, isVisible } = useScrollAnimation(0.1)
  const [hoveredStep, setHoveredStep] = useState<number | null>(null)

  return (
    <section style={{ background: '#050505' }}>
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
            The agent lifecycle
          </h2>
          <p style={{ fontSize: '18px', color: '#a0a0a8', marginTop: '12px', lineHeight: 1.6, fontFamily: font }}>
            From code to revenue in 6 steps.
          </p>
        </div>

        {/* Desktop: horizontal flow */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0', justifyContent: 'center', flexWrap: 'wrap' }}>
          {steps.map((s, i) => (
            <div
              key={s.num}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? 'translateY(0)' : 'translateY(15px)',
                transition: 'opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1), transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                transitionDelay: `${i * 100}ms`,
              }}
            >
              {/* Step node */}
              <div
                onMouseEnter={() => setHoveredStep(s.num)}
                onMouseLeave={() => setHoveredStep(null)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                  width: '120px',
                  cursor: 'default',
                }}
              >
                {/* Circle */}
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '16px',
                    background: hoveredStep === s.num ? `${s.color}20` : `${s.color}10`,
                    border: `1.5px solid ${hoveredStep === s.num ? s.color : `${s.color}40`}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: s.color,
                    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                    boxShadow: hoveredStep === s.num ? `0 0 20px ${s.color}30` : 'none',
                  }}
                >
                  {s.icon}
                </div>

                {/* Step number */}
                <span style={{ fontSize: '11px', fontWeight: 700, color: s.color, fontFamily: mono, letterSpacing: '0.05em' }}>
                  STEP {s.num}
                </span>

                {/* Label */}
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#f0f0f0', fontFamily: font, textAlign: 'center' }}>
                  {s.label}
                </span>

                {/* Description */}
                <span style={{ fontSize: '12px', color: '#5a5a65', fontFamily: font, textAlign: 'center', lineHeight: 1.4 }}>
                  {s.desc}
                </span>
              </div>

              {/* Connector arrow */}
              {i < steps.length - 1 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    height: '56px',
                    padding: '0 4px',
                  }}
                >
                  <div
                    style={{
                      width: '24px',
                      height: '1.5px',
                      background: `linear-gradient(90deg, ${s.color}60, ${steps[i + 1].color}60)`,
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        right: '-3px',
                        top: '-3px',
                        width: 0,
                        height: 0,
                        borderTop: '4px solid transparent',
                        borderBottom: '4px solid transparent',
                        borderLeft: `6px solid ${steps[i + 1].color}60`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Loop-back indicator */}
        <div style={{ textAlign: 'center', marginTop: '40px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '100px',
            }}
          >
            <svg width="14" height="14" fill="none" stroke="#a0a0a8" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.992 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
            </svg>
            <span style={{ fontSize: '13px', color: '#a0a0a8', fontFamily: font }}>
              Each repayment cycle improves your Krexit Score and unlocks higher credit
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
