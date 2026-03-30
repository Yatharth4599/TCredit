import { useScrollAnimation } from '../../hooks/useScrollAnimation'

const font = "'Geist', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
const mono = "'Geist Mono', 'JetBrains Mono', monospace"

const features = [
  { title: 'Identity', desc: 'On-chain profile with name, type, and history. Readable by any Solana program.', color: '#22d3ee' },
  { title: 'PDA Wallet', desc: 'Program-controlled USDC account. No private key. Only the program can move funds.', color: '#34d399' },
  { title: 'Credit Score', desc: '200\u2013850 score from 5 on-chain behavioral signals. Improves with every repayment.', color: '#a78bfa' },
  { title: 'Credit Line', desc: 'Borrow USDC with zero collateral. Oracle co-signs based on your score.', color: '#22d3ee' },
  { title: 'Revenue Router', desc: 'Every $ of revenue auto-repays your debt before you receive it. Not optional.', color: '#34d399' },
  { title: 'Level Up', desc: 'Start at L1 ($500 max). Good behavior unlocks L2 ($20K), L3 ($50K), L4 ($500K).', color: '#a78bfa' },
]

const cardCSS = `
@keyframes aic-float {
  0%, 100% { transform: perspective(800px) rotateY(0deg) rotateX(0deg); }
  50% { transform: perspective(800px) rotateY(1deg) rotateX(-1deg); }
}
.aic-card:hover {
  transform: perspective(800px) rotateY(-3deg) rotateX(2deg) !important;
  box-shadow: 0 30px 60px rgba(34, 211, 238, 0.12), 0 0 40px rgba(34, 211, 238, 0.06) !important;
}
`

export function AgentIdentityCard() {
  const { ref, isVisible } = useScrollAnimation(0.1)
  const { ref: featRef, isVisible: featVisible } = useScrollAnimation(0.1)

  return (
    <section
      style={{
        background: '#0a0a0c',
        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
      }}
    >
      <style>{cardCSS}</style>
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
        {/* Section title — matches SectionTitle exactly */}
        <div style={{ textAlign: 'center', marginBottom: '64px' }}>
          <h2 style={{ fontSize: '40px', fontWeight: 600, color: '#f0f0f0', letterSpacing: '-0.02em', lineHeight: 1.2, margin: 0, fontFamily: font }}>
            Every agent gets a full on-chain identity
          </h2>
        </div>

        {/* Identity card */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '80px' }}>
          <div
            className="aic-card"
            style={{
              width: '100%',
              maxWidth: '440px',
              background: '#111114',
              borderRadius: '16px',
              padding: '32px',
              position: 'relative',
              overflow: 'hidden',
              transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.4s',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 30px rgba(34, 211, 238, 0.04)',
              animation: 'aic-float 6s ease-in-out infinite',
            }}
          >
            {/* Gradient border effect */}
            <div style={{ position: 'absolute', inset: 0, borderRadius: '16px', padding: '1px', background: 'linear-gradient(135deg, rgba(34,211,238,0.2), rgba(52,211,153,0.2))', WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)', WebkitMaskComposite: 'xor', maskComposite: 'exclude', pointerEvents: 'none' }} />

            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em', color: '#5a5a65', textTransform: 'uppercase', marginBottom: '20px', fontFamily: font }}>
              KREXA AGENT IDENTITY
            </div>

            <div style={{ fontSize: '22px', fontWeight: 700, color: '#f0f0f0', marginBottom: '4px', fontFamily: font }}>
              ResearchBot
            </div>
            <div style={{ fontSize: '13px', color: '#5a5a65', marginBottom: '24px', fontFamily: font }}>
              Type: Service &middot; x402 Research API
            </div>

            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
              <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '14px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', color: '#5a5a65', textTransform: 'uppercase', marginBottom: '6px', fontFamily: font }}>Krexit Score</div>
                <div style={{ fontSize: '28px', fontWeight: 700, color: '#22d3ee', fontFamily: mono, lineHeight: 1 }}>620</div>
              </div>
              <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '14px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', color: '#5a5a65', textTransform: 'uppercase', marginBottom: '6px', fontFamily: font }}>Credit Level</div>
                <div style={{ fontSize: '20px', fontWeight: 700, fontFamily: font, lineHeight: 1 }}>
                  <span className="gradient-text">L2</span>{' '}
                  <span style={{ fontSize: '13px', color: '#a0a0a8' }}>Standard</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
              {[
                { label: 'Address', value: '7xK2mN9...3pF4' },
                { label: 'PDA Wallet', value: '9aF1bR...4mK2' },
                { label: 'Registered', value: 'March 2026' },
                { label: 'Cycles completed', value: '4' },
              ].map((row) => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontFamily: font }}>
                  <span style={{ color: '#5a5a65' }}>{row.label}</span>
                  <span style={{ color: '#a0a0a8', fontFamily: mono }}>{row.value}</span>
                </div>
              ))}
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: '#3a3a42', letterSpacing: '0.05em', fontFamily: font }}>SOLANA DEVNET</span>
              <span style={{ fontSize: '11px', color: '#3a3a42', fontFamily: font }}>krexa.xyz</span>
            </div>
          </div>
        </div>

        {/* Feature grid — matches ThreeWays grid exactly */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h3 style={{ fontSize: '20px', fontWeight: 600, color: '#f0f0f0', fontFamily: font }}>Your agent gets:</h3>
        </div>

        <div ref={featRef} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="feature-card"
              style={{
                cursor: 'default',
                opacity: featVisible ? 1 : 0,
                transform: featVisible ? 'translateY(0)' : 'translateY(20px)',
                transitionDelay: `${i * 100}ms`,
              }}
            >
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: f.color, boxShadow: `0 0 8px ${f.color}`, marginBottom: '16px' }} />
              <h4 style={{ fontSize: '16px', fontWeight: 600, color: '#f0f0f0', marginBottom: '8px', fontFamily: font }}>{f.title}</h4>
              <p style={{ fontSize: '14px', color: '#a0a0a8', lineHeight: 1.6, margin: 0, fontFamily: font }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
