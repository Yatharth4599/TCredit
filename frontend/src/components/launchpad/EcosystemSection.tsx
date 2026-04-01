import { useScrollAnimation } from '../../hooks/useScrollAnimation'

const font = "'Geist', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif"

interface EcosystemItem {
  name: string
  category: string
  color: string
  isNew?: boolean
}

const ecosystem: EcosystemItem[] = [
  // Frameworks
  { name: 'ElizaOS', category: 'Frameworks', color: '#a78bfa' },
  { name: 'Olas', category: 'Frameworks', color: '#a78bfa' },
  { name: 'LangChain', category: 'Frameworks', color: '#a78bfa' },
  { name: 'CrewAI', category: 'Frameworks', color: '#a78bfa' },
  { name: 'AutoGPT', category: 'Frameworks', color: '#a78bfa' },
  // DEXs
  { name: '1inch', category: 'DEXs', color: '#22d3ee', isNew: true },
  { name: 'OKX DEX', category: 'DEXs', color: '#22d3ee', isNew: true },
  { name: 'Jupiter', category: 'DEXs', color: '#22d3ee' },
  { name: 'Orca', category: 'DEXs', color: '#22d3ee' },
  { name: 'Raydium', category: 'DEXs', color: '#22d3ee' },
  { name: 'Meteora', category: 'DEXs', color: '#22d3ee' },
  // DeFi
  { name: 'Kamino', category: 'DeFi', color: '#34d399' },
  { name: 'MarginFi', category: 'DeFi', color: '#34d399' },
  { name: 'Drift', category: 'DeFi', color: '#34d399' },
  { name: 'Marinade', category: 'DeFi', color: '#34d399' },
  // LLMs
  { name: 'Claude', category: 'LLMs', color: '#f59e0b' },
  { name: 'GPT-4', category: 'LLMs', color: '#f59e0b' },
  { name: 'Llama', category: 'LLMs', color: '#f59e0b' },
  { name: 'Mistral', category: 'LLMs', color: '#f59e0b' },
  // Hosting
  { name: 'Railway', category: 'Hosting', color: '#ec4899' },
  { name: 'Render', category: 'Hosting', color: '#ec4899' },
  { name: 'Fly.io', category: 'Hosting', color: '#ec4899' },
  { name: 'AWS Lambda', category: 'Hosting', color: '#ec4899' },
]

const categories = ['Frameworks', 'DEXs', 'DeFi', 'LLMs', 'Hosting']

export function EcosystemSection() {
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
            Works with your stack
          </h2>
          <p style={{ fontSize: '18px', color: '#a0a0a8', marginTop: '12px', lineHeight: 1.6, fontFamily: font }}>
            Krexa agents integrate with every major Solana protocol, AI framework, and hosting provider.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px', maxWidth: '800px', margin: '0 auto' }}>
          {categories.map((cat) => {
            const items = ecosystem.filter(e => e.category === cat)
            return (
              <div key={cat}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: items[0]?.color ?? '#a0a0a8', letterSpacing: '0.05em', marginBottom: '16px', fontFamily: font }}>
                  {cat.toUpperCase()}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {items.map((item, i) => (
                    <div
                      key={item.name}
                      className="feature-card"
                      style={{
                        cursor: 'default',
                        padding: '12px 20px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        opacity: isVisible ? 1 : 0,
                        transform: isVisible ? 'translateY(0)' : 'translateY(10px)',
                        transitionDelay: `${i * 50}ms`,
                      }}
                    >
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: item.color, flexShrink: 0, boxShadow: item.isNew ? `0 0 8px ${item.color}60` : 'none' }} />
                      <span style={{ fontSize: '14px', fontWeight: 500, color: '#f0f0f0', fontFamily: font }}>{item.name}</span>
                      {item.isNew && (
                        <span style={{
                          padding: '1px 6px',
                          fontSize: '9px',
                          fontWeight: 700,
                          letterSpacing: '0.05em',
                          textTransform: 'uppercase' as const,
                          background: 'linear-gradient(90deg, #22d3ee, #34d399)',
                          color: '#050505',
                          borderRadius: '100px',
                        }}>
                          NEW
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
