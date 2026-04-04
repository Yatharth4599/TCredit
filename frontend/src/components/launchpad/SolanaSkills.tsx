import { useScrollAnimation } from '../../hooks/useScrollAnimation'

const font = "'Geist', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
const mono = "'Geist Mono', 'JetBrains Mono', monospace"

interface Skill {
  name: string
  description: string
  category: 'DeFi' | 'Infrastructure' | 'Security'
  installCommand: string
  url: string
  agentTypes: ('Trader' | 'Service' | 'All')[]
  recommended: boolean
}

const skills: Skill[] = [
  {
    name: 'Krexa',
    description: 'Undercollateralized credit lines for autonomous agents. Borrow, earn, and build credit history on-chain.',
    category: 'DeFi',
    installCommand: 'npx skills add https://github.com/Yatharth4599/Krexa --skill krexa',
    url: 'https://github.com/Yatharth4599/Krexa',
    agentTypes: ['All'],
    recommended: true,
  },
  {
    name: 'Jupiter',
    description: 'Best-price token swaps across all Solana DEXs with smart routing and limit orders.',
    category: 'DeFi',
    installCommand: 'npx skills add jup-ag/jupiter-swap-skill --skill jupiter',
    url: 'https://solana.com/skills',
    agentTypes: ['Trader'],
    recommended: true,
  },
  {
    name: 'Meteora',
    description: 'Dynamic liquidity provisioning with concentrated pools and auto-compounding vaults.',
    category: 'DeFi',
    installCommand: 'npx skills add meteora-ag/meteora-skill --skill meteora',
    url: 'https://solana.com/skills',
    agentTypes: ['Trader'],
    recommended: false,
  },
  {
    name: 'Kamino',
    description: 'Automated vault strategies for lending, borrowing, and liquidity management.',
    category: 'DeFi',
    installCommand: 'npx skills add kamino-finance/kamino-skill --skill kamino',
    url: 'https://solana.com/skills',
    agentTypes: ['Trader'],
    recommended: false,
  },
  {
    name: 'Orca',
    description: 'Concentrated liquidity AMM with efficient capital deployment and yield farming.',
    category: 'DeFi',
    installCommand: 'npx skills add orca-so/orca-skill --skill orca',
    url: 'https://solana.com/skills',
    agentTypes: ['Trader'],
    recommended: false,
  },
  {
    name: 'Raydium',
    description: 'Hybrid AMM with order book integration for deep liquidity and low-slippage swaps.',
    category: 'DeFi',
    installCommand: 'npx skills add raydium-io/raydium-skill --skill raydium',
    url: 'https://solana.com/skills',
    agentTypes: ['Trader'],
    recommended: false,
  },
  {
    name: 'Ranger Finance',
    description: 'Perpetual futures trading with leverage and advanced order types for agents.',
    category: 'DeFi',
    installCommand: 'npx skills add ranger-finance/ranger-skill --skill ranger',
    url: 'https://solana.com/skills',
    agentTypes: ['Trader'],
    recommended: false,
  },
  {
    name: 'Pyth',
    description: 'High-fidelity, low-latency price feeds for 350+ assets directly from market makers.',
    category: 'Infrastructure',
    installCommand: 'npx skills add pyth-network/pyth-skill --skill pyth',
    url: 'https://solana.com/skills',
    agentTypes: ['All'],
    recommended: true,
  },
  {
    name: 'Helius',
    description: 'Enhanced RPC, webhooks, and DAS API for real-time Solana data and transaction parsing.',
    category: 'Infrastructure',
    installCommand: 'npx skills add helius-labs/helius-skill --skill helius',
    url: 'https://solana.com/skills',
    agentTypes: ['All'],
    recommended: false,
  },
  {
    name: 'CoinGecko',
    description: 'Comprehensive market data, token metadata, and historical pricing across all chains.',
    category: 'Infrastructure',
    installCommand: 'npx skills add coingecko/coingecko-skill --skill coingecko',
    url: 'https://solana.com/skills',
    agentTypes: ['Service'],
    recommended: false,
  },
  {
    name: 'Switchboard',
    description: 'Decentralized oracle network for custom data feeds, VRF, and off-chain computation.',
    category: 'Infrastructure',
    installCommand: 'npx skills add switchboard-xyz/switchboard-skill --skill switchboard',
    url: 'https://solana.com/skills',
    agentTypes: ['All'],
    recommended: false,
  },
  {
    name: 'VulnHunter',
    description: 'Automated smart contract auditing and vulnerability detection for Solana programs.',
    category: 'Security',
    installCommand: 'npx skills add vulnhunter/vulnhunter-skill --skill vulnhunter',
    url: 'https://solana.com/skills',
    agentTypes: ['All'],
    recommended: false,
  },
]

const categoryColors: Record<string, string> = {
  DeFi: '#22d3ee',
  Infrastructure: '#a78bfa',
  Security: '#f59e0b',
}

const agentTypeBadgeColor: Record<string, string> = {
  Trader: '#22d3ee',
  Service: '#34d399',
  All: '#5a5a65',
}

export function SolanaSkills() {
  const { ref, isVisible } = useScrollAnimation(0.1)

  return (
    <section
      style={{
        background: '#050505',
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
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '64px' }}>
          <div style={{
            display: 'inline-block',
            padding: '4px 12px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '100px',
            fontSize: '12px',
            fontWeight: 600,
            color: '#a0a0a8',
            letterSpacing: '0.05em',
            fontFamily: mono,
            marginBottom: '20px',
          }}>
            Powered by solana.com/skills
          </div>
          <h2 style={{
            fontSize: '40px',
            fontWeight: 600,
            color: '#f0f0f0',
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
            margin: 0,
            fontFamily: font,
          }}>
            Stack skills. Build smarter agents.
          </h2>
          <p style={{
            fontSize: '18px',
            color: '#a0a0a8',
            marginTop: '12px',
            lineHeight: 1.6,
            fontFamily: font,
            maxWidth: '600px',
            marginLeft: 'auto',
            marginRight: 'auto',
          }}>
            Skills are composable protocol integrations your agent can learn. Combine Krexa with DeFi, data, and security skills to unlock new capabilities.
          </p>
        </div>

        {/* Recommended combo terminal */}
        <div style={{
          maxWidth: '680px',
          margin: '0 auto 64px',
          background: '#0a0a0c',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '12px',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '10px 16px',
            background: 'rgba(255, 255, 255, 0.02)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3a3a42' }} />
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3a3a42' }} />
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3a3a42' }} />
            <span style={{ fontSize: '11px', color: '#5a5a65', fontFamily: mono, marginLeft: '8px' }}>
              recommended combo
            </span>
          </div>
          <div style={{ padding: '20px 24px' }}>
            <div style={{ fontFamily: mono, fontSize: '13px', lineHeight: 2, color: '#a0a0a8' }}>
              <div><span style={{ color: '#5a5a65' }}># credit + swaps + price feeds</span></div>
              <div><span style={{ color: '#34d399' }}>$</span> <span style={{ color: '#f0f0f0' }}>npx skills add https://github.com/Yatharth4599/Krexa --skill krexa</span></div>
              <div><span style={{ color: '#34d399' }}>$</span> <span style={{ color: '#f0f0f0' }}>npx skills add jup-ag/jupiter-swap-skill --skill jupiter</span></div>
              <div><span style={{ color: '#34d399' }}>$</span> <span style={{ color: '#f0f0f0' }}>npx skills add pyth-network/pyth-skill --skill pyth</span></div>
            </div>
          </div>
        </div>

        {/* Skills grid */}
        <div className="solana-skills-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '16px',
        }}>
          {skills.map((skill, i) => (
            <a
              key={skill.name}
              href={skill.url}
              target="_blank"
              rel="noopener noreferrer"
              className="feature-card"
              style={{
                cursor: 'pointer',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                textDecoration: 'none',
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? 'translateY(0)' : 'translateY(10px)',
                transitionDelay: `${i * 40}ms`,
              }}
            >
              {/* Category + recommended */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase' as const,
                  color: categoryColors[skill.category] ?? '#a0a0a8',
                  fontFamily: mono,
                }}>
                  {skill.category}
                </span>
                {skill.recommended && (
                  <span style={{
                    padding: '2px 8px',
                    fontSize: '9px',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase' as const,
                    background: 'linear-gradient(90deg, #22d3ee, #34d399)',
                    color: '#050505',
                    borderRadius: '100px',
                  }}>
                    RECOMMENDED
                  </span>
                )}
              </div>

              {/* Name */}
              <div style={{
                fontSize: '16px',
                fontWeight: 600,
                color: '#f0f0f0',
                fontFamily: font,
              }}>
                {skill.name}
              </div>

              {/* Description */}
              <div style={{
                fontSize: '13px',
                color: '#a0a0a8',
                lineHeight: 1.5,
                fontFamily: font,
                flex: 1,
              }}>
                {skill.description}
              </div>

              {/* Install command */}
              <div style={{
                fontFamily: mono,
                fontSize: '11px',
                color: '#5a5a65',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.04)',
                borderRadius: '6px',
                padding: '8px 10px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap' as const,
              }}>
                {skill.installCommand}
              </div>

              {/* Agent type badges */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {skill.agentTypes.map((type) => (
                  <span
                    key={type}
                    style={{
                      padding: '2px 8px',
                      fontSize: '10px',
                      fontWeight: 600,
                      letterSpacing: '0.04em',
                      color: agentTypeBadgeColor[type],
                      background: `${agentTypeBadgeColor[type]}12`,
                      border: `1px solid ${agentTypeBadgeColor[type]}25`,
                      borderRadius: '100px',
                      fontFamily: mono,
                    }}
                  >
                    {type}
                  </span>
                ))}
              </div>
            </a>
          ))}
        </div>

        {/* Responsive style override for grid */}
        <style>{`
          @media (max-width: 900px) {
            .solana-skills-grid {
              grid-template-columns: repeat(2, 1fr) !important;
            }
          }
          @media (max-width: 600px) {
            .solana-skills-grid {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>

        {/* Browse all link */}
        <div style={{ textAlign: 'center', marginTop: '48px' }}>
          <a
            href="https://solana.com/skills"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '15px',
              fontWeight: 500,
              color: '#22d3ee',
              textDecoration: 'none',
              fontFamily: font,
              padding: '12px 24px',
              background: 'rgba(34, 211, 238, 0.06)',
              border: '1px solid rgba(34, 211, 238, 0.15)',
              borderRadius: '10px',
              transition: 'all 0.2s',
            }}
          >
            Browse all skills on solana.com/skills
            <span style={{ fontSize: '18px' }}>&rarr;</span>
          </a>
        </div>
      </div>
    </section>
  )
}
