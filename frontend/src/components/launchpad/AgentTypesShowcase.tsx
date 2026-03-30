import { useScrollAnimation } from '../../hooks/useScrollAnimation'

const font = "'Geist', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
const mono = "'Geist Mono', 'JetBrains Mono', monospace"

interface Template {
  name: string
  desc: string
  revenue: string
  revenueLabel: string
  frameworks: string[]
}

interface AgentCategory {
  label: string
  name: string
  color: string
  flow: string
  typeId: number
  templates: Template[]
}

const categories: AgentCategory[] = [
  {
    label: 'TYPE A',
    name: 'TRADING AGENTS',
    color: '#22d3ee',
    flow: 'Borrow \u2192 Trade \u2192 Profit \u2192 Auto-repay',
    typeId: 0,
    templates: [
      { name: 'DEX Arbitrage', desc: 'Catch price gaps across Jupiter, Orca, Raydium.', revenue: '~30\u201380%', revenueLabel: 'APY', frameworks: ['Jupiter SDK', 'Olas', 'Python'] },
      { name: 'Yield Optimizer', desc: 'Move capital to highest yield pools on Kamino, MarginFi.', revenue: '~15\u201340%', revenueLabel: 'APY', frameworks: ['Kamino SDK', 'ElizaOS', 'TypeScript'] },
      { name: 'Market Making', desc: 'Provide liquidity and earn bid-ask spreads.', revenue: '~20\u201360%', revenueLabel: 'APY', frameworks: ['Orca SDK', 'Hummingbot', 'Python'] },
    ],
  },
  {
    label: 'TYPE B',
    name: 'SERVICE AGENTS',
    color: '#34d399',
    flow: 'Borrow \u2192 Build \u2192 Earn via x402 \u2192 Auto-repay',
    typeId: 1,
    templates: [
      { name: 'Research API', desc: 'AI-powered research queries. Charges per query.', revenue: '$0.25/call', revenueLabel: '~$7.50/day', frameworks: ['Claude API', 'x402', 'Express'] },
      { name: 'Code Reviewer', desc: 'Analyze smart contracts for bugs. Per audit.', revenue: '$5/review', revenueLabel: '~$25/day', frameworks: ['GPT-4', 'x402', 'FastAPI'] },
      { name: 'Data Oracle', desc: 'Serve real-time crypto prices and social data.', revenue: '$0.01/call', revenueLabel: '~$10/day', frameworks: ['Pyth', 'x402', 'Node.js'] },
    ],
  },
  {
    label: 'TYPE C',
    name: 'HYBRID AGENTS',
    color: '#a78bfa',
    flow: 'Trade AND serve. Dual revenue. Dual enforcement.',
    typeId: 2,
    templates: [
      { name: 'Trader + Analytics', desc: 'Trade on DEXs AND sell market signals as a paid API.', revenue: 'Dual', revenueLabel: 'revenue', frameworks: ['ElizaOS', 'Jupiter SDK', 'x402'] },
      { name: 'Portfolio Manager', desc: 'Manage DeFi strategies AND charge management fees.', revenue: 'Dual', revenueLabel: 'revenue', frameworks: ['Olas', 'LangChain', 'x402'] },
    ],
  },
]

export function AgentTypesShowcase({ onDeployTemplate }: { onDeployTemplate: (typeId: number) => void }) {
  const { ref, isVisible } = useScrollAnimation(0.1)

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
        {/* Section title */}
        <div style={{ textAlign: 'center', marginBottom: '64px' }}>
          <h2 style={{ fontSize: '40px', fontWeight: 600, color: '#f0f0f0', letterSpacing: '-0.02em', lineHeight: 1.2, margin: 0, fontFamily: font }}>
            What kind of agent will you build?
          </h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', marginBottom: '48px' }}>
          {categories.map((cat) => (
            <CategorySection key={cat.name} cat={cat} onDeploy={onDeployTemplate} />
          ))}
        </div>

        {/* Custom agent CTA */}
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '16px', color: '#a0a0a8', marginBottom: '16px', fontFamily: font }}>
            Or build something completely custom.
          </p>
          <button
            onClick={() => onDeployTemplate(2)}
            style={{
              padding: '12px 28px',
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.10)',
              color: '#a0a0a8',
              fontSize: '15px',
              fontWeight: 500,
              borderRadius: '8px',
              cursor: 'pointer',
              fontFamily: font,
              transition: 'border-color 0.2s, color 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.20)'; e.currentTarget.style.color = '#f0f0f0' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'; e.currentTarget.style.color = '#a0a0a8' }}
          >
            Deploy a Custom Agent &rarr;
          </button>
        </div>
      </div>
    </section>
  )
}

function CategorySection({ cat, onDeploy }: { cat: AgentCategory; onDeploy: (typeId: number) => void }) {
  const { ref, isVisible } = useScrollAnimation(0.15)

  return (
    <div
      ref={ref}
      style={{
        background: '#0a0a0c',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '16px',
        borderLeft: `3px solid ${cat.color}`,
        padding: '32px',
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
        transition: 'opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1), transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div style={{ marginBottom: '8px' }}>
        <span style={{ color: cat.color, fontSize: '13px', fontWeight: 600, letterSpacing: '0.05em', fontFamily: font }}>{cat.label}</span>
        <span style={{ color: '#5a5a65', fontSize: '13px', margin: '0 8px' }}>&middot;</span>
        <span style={{ color: '#f0f0f0', fontSize: '13px', fontWeight: 600, letterSpacing: '0.05em', fontFamily: font }}>{cat.name}</span>
      </div>
      <div style={{ fontSize: '15px', color: '#a0a0a8', marginBottom: '24px', fontFamily: font }}>{cat.flow}</div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cat.templates.map((t, i) => (
          <div
            key={t.name}
            className="feature-card"
            style={{
              cursor: 'default',
              opacity: isVisible ? 1 : 0,
              transform: isVisible ? 'translateY(0)' : 'translateY(15px)',
              transitionDelay: `${(i + 1) * 100}ms`,
            }}
          >
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#f0f0f0', marginBottom: '8px', fontFamily: font }}>{t.name}</div>
            <p style={{ fontSize: '13px', color: '#a0a0a8', lineHeight: 1.6, margin: '0 0 16px', fontFamily: font }}>{t.desc}</p>
            <div style={{ marginBottom: '12px' }}>
              <span style={{ fontSize: '18px', fontWeight: 600, color: '#22d3ee', fontFamily: mono }}>{t.revenue}</span>
              <span style={{ fontSize: '12px', color: '#5a5a65', marginLeft: '6px', fontFamily: font }}>{t.revenueLabel}</span>
            </div>

            {/* Framework pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
              {t.frameworks.map((fw) => (
                <span
                  key={fw}
                  style={{
                    fontSize: '11px',
                    fontWeight: 500,
                    color: '#a0a0a8',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '100px',
                    padding: '3px 10px',
                    fontFamily: font,
                  }}
                >
                  {fw}
                </span>
              ))}
            </div>

            <button
              onClick={() => onDeploy(cat.typeId)}
              style={{
                fontSize: '14px',
                fontWeight: 500,
                color: '#22d3ee',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                fontFamily: font,
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.7')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              Deploy &rarr;
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
