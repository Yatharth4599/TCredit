import { useScrollAnimation } from '../../hooks/useScrollAnimation';

const ways = [
  {
    icon: '>_',
    title: 'CLI',
    code: 'npx @krexa/cli init',
    description: 'One command. Full setup. Borrow in seconds.',
  },
  {
    icon: '\u{1F4C4}',
    title: 'Skill',
    code: 'krexa.xyz/skill.md',
    description: 'Paste into your agent\'s prompt. It learns Krexa instantly.',
  },
  {
    icon: '\u{1F50C}',
    title: 'MCP',
    code: 'claude mcp add krexa -- npx @krexa/cli mcp',
    description: 'Works with Claude Code, Cursor, and 14+ AI clients.',
  },
];

export function ThreeWays() {
  const { ref, isVisible } = useScrollAnimation(0.1);
  const mono = "'Geist Mono', 'JetBrains Mono', monospace";

  return (
    <div ref={ref}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {ways.map((way, i) => (
          <div
            key={way.title}
            className="feature-card"
            style={{
              cursor: 'default',
              opacity: isVisible ? 1 : 0,
              transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
              transitionDelay: `${i * 100}ms`,
            }}
          >
            <div style={{ fontSize: '24px', marginBottom: '16px' }}>{way.icon}</div>
            <h3 style={{ fontSize: '20px', fontWeight: 600, color: '#f0f0f0', marginBottom: '16px', fontFamily: "'Geist', 'Inter', sans-serif" }}>
              {way.title}
            </h3>
            <div
              style={{
                background: '#111114',
                borderRadius: '8px',
                padding: '8px 12px',
                marginBottom: '16px',
                fontFamily: mono,
                fontSize: '13px',
                color: '#a0a0a8',
                overflowX: 'auto',
                whiteSpace: 'nowrap',
              }}
            >
              {way.code}
            </div>
            <p style={{ fontSize: '15px', color: '#a0a0a8', lineHeight: 1.6, margin: 0, fontFamily: "'Geist', 'Inter', sans-serif" }}>
              {way.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
