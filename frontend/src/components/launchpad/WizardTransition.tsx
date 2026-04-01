import { useScrollAnimation } from '../../hooks/useScrollAnimation'

const font = "'Geist', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif"

const pills = [
  { label: 'Free on devnet', icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
  { label: 'No code needed', icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" /></svg> },
  { label: 'Real Solana txs', icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg> },
]

export function WizardTransition() {
  const { ref, isVisible } = useScrollAnimation(0.15)

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
          padding: '100px 24px',
          textAlign: 'center',
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'translateY(0)' : 'translateY(30px)',
          transition: 'opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <h2
          style={{
            fontSize: 'clamp(28px, 4vw, 48px)',
            fontWeight: 600,
            color: '#f0f0f0',
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
            margin: '0 0 16px',
            fontFamily: font,
          }}
        >
          Ready to deploy?
        </h2>
        <p style={{ fontSize: '18px', color: '#a0a0a8', lineHeight: 1.6, margin: '0 0 40px', fontFamily: font }}>
          Connect your wallet and launch your first agent in under 2 minutes.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
          {pills.map((p, i) => (
            <div
              key={p.label}
              className="feature-card"
              style={{
                cursor: 'default',
                padding: '16px 24px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? 'translateY(0)' : 'translateY(15px)',
                transitionDelay: `${i * 100}ms`,
              }}
            >
              <span style={{ color: '#22d3ee' }}>{p.icon}</span>
              <span style={{ fontSize: '14px', fontWeight: 500, color: '#f0f0f0', fontFamily: font }}>{p.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
