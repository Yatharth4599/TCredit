import { useState, useEffect } from 'react'
import { useScrollAnimation } from '../../hooks/useScrollAnimation'

const font = "'Geist', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif"

const stats = [
  { label: 'On-chain Identity', value: 'Your own PDA on Solana', icon: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15A2.25 2.25 0 002.25 6.75v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm-2.253 4.668a3.375 3.375 0 016.006 0" /></svg> },
  { label: 'Credit Line', value: 'Up to $500 at L1 start', icon: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15A2.25 2.25 0 002.25 6.75v10.5A2.25 2.25 0 004.5 19.5z" /></svg> },
  { label: 'Revenue Router', value: 'Auto-repay on every $', icon: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" /></svg> },
  { label: 'Krexit Score', value: '200\u2013850 portable on-chain', icon: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg> },
]

export function LaunchHero({ onScrollToWizard }: { onScrollToWizard: () => void }) {
  const [loaded, setLoaded] = useState(false)
  const { ref: statsRef, isVisible: statsVisible } = useScrollAnimation(0.1)

  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 100)
    return () => clearTimeout(timer)
  }, [])

  const fadeIn = (delay: number): React.CSSProperties => ({
    opacity: loaded ? 1 : 0,
    transform: loaded ? 'translateY(0)' : 'translateY(20px)',
    transition: `opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
  })

  return (
    <section
      className="dot-grid"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '140px 24px 80px',
        position: 'relative',
      }}
    >
      {/* Radial glow */}
      <div
        className="hero-glow"
        style={{
          position: 'absolute',
          width: '600px',
          height: '400px',
          borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(34, 211, 238, 0.06), transparent 70%)',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -30%)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: '800px' }}>
        <h1
          style={{
            fontSize: 'clamp(36px, 5vw, 64px)',
            fontWeight: 700,
            color: '#f0f0f0',
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            margin: '0 0 24px',
            fontFamily: font,
            ...fadeIn(0),
          }}
        >
          Deploy an <span className="gradient-text">AI agent</span>.
          <br />
          Get credit in 2 minutes.
        </h1>

        <p
          style={{
            fontSize: '18px',
            color: '#a0a0a8',
            lineHeight: 1.7,
            maxWidth: '540px',
            margin: '0 auto 40px',
            fontFamily: font,
            ...fadeIn(150),
          }}
        >
          Launch an autonomous agent on Solana with its own identity,
          credit score, wallet, and revenue stream. No code required
          to get started.
        </p>

        {/* CTAs — identical to landing page */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '80px', ...fadeIn(300) }}>
          <button
            onClick={onScrollToWizard}
            className="gradient-bg"
            style={{
              padding: '12px 28px',
              color: '#050505',
              fontSize: '15px',
              fontWeight: 600,
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontFamily: font,
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            Start Deploying &darr;
          </button>
          <a
            href="https://krexa.mintlify.app"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '12px 28px',
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.10)',
              color: '#a0a0a8',
              fontSize: '15px',
              fontWeight: 500,
              borderRadius: '8px',
              textDecoration: 'none',
              fontFamily: font,
              transition: 'border-color 0.2s, color 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.20)'; e.currentTarget.style.color = '#f0f0f0' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'; e.currentTarget.style.color = '#a0a0a8' }}
          >
            Read how it works &rarr;
          </a>
        </div>

        {/* Stat cards */}
        <div ref={statsRef} className="grid grid-cols-2 md:grid-cols-4 gap-4" style={{ maxWidth: '720px', margin: '0 auto' }}>
          {stats.map((s, i) => (
            <div
              key={s.label}
              className="feature-card"
              style={{
                cursor: 'default',
                padding: '24px 20px',
                opacity: statsVisible ? 1 : 0,
                transform: statsVisible ? 'translateY(0)' : 'translateY(20px)',
                transitionDelay: `${i * 100}ms`,
              }}
            >
              <div style={{ color: '#22d3ee', marginBottom: '12px' }}>{s.icon}</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#f0f0f0', marginBottom: '4px', fontFamily: font }}>{s.label}</div>
              <div style={{ fontSize: '12px', color: '#5a5a65', lineHeight: 1.5, fontFamily: font }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
