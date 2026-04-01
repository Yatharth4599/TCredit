import { useScrollAnimation } from '../../hooks/useScrollAnimation';

const components = [
  { name: 'Repayment History', weight: 30, width: 72 },
  { name: 'Profitability', weight: 25, width: 60 },
  { name: 'Behavioral Health', weight: 20, width: 48 },
  { name: 'Usage Patterns', weight: 15, width: 36 },
  { name: 'Account Maturity', weight: 10, width: 24 },
];

export function ScoreVisualization() {
  const { ref, isVisible } = useScrollAnimation(0.2);
  const mono = "'Geist Mono', 'JetBrains Mono', monospace";

  return (
    <div ref={ref}>
      {/* Score bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '48px' }}>
        {components.map((c, i) => (
          <div
            key={c.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              opacity: isVisible ? 1 : 0,
              transition: `opacity 0.4s ease ${i * 100}ms`,
            }}
          >
            <span
              style={{
                fontSize: '14px',
                color: '#a0a0a8',
                width: '180px',
                flexShrink: 0,
                fontFamily: "'Geist', 'Inter', sans-serif",
              }}
              className="hidden sm:block"
            >
              {c.name}
            </span>
            <span
              style={{
                fontSize: '13px',
                color: '#a0a0a8',
                width: '100px',
                flexShrink: 0,
                fontFamily: "'Geist', 'Inter', sans-serif",
              }}
              className="sm:hidden"
            >
              {c.name.split(' ')[0]}
            </span>
            {/* Bar track */}
            <div style={{ flex: 1, height: '8px', background: '#111114', borderRadius: '4px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: isVisible ? `${c.width}%` : '0%',
                  background: 'linear-gradient(90deg, #22d3ee, #34d399)',
                  borderRadius: '4px',
                  transition: `width 1s cubic-bezier(0.16, 1, 0.3, 1) ${i * 100 + 200}ms`,
                }}
              />
            </div>
            <span
              style={{
                fontFamily: mono,
                fontSize: '13px',
                color: '#5a5a65',
                width: '36px',
                textAlign: 'right',
                flexShrink: 0,
              }}
            >
              {c.weight}%
            </span>
          </div>
        ))}
      </div>

      {/* Composability note */}
      <p
        style={{
          fontSize: '16px',
          color: '#a0a0a8',
          lineHeight: 1.7,
          maxWidth: '560px',
          marginBottom: '32px',
          fontFamily: "'Geist', 'Inter', sans-serif",
          opacity: isVisible ? 1 : 0,
          transition: 'opacity 0.6s ease 0.5s',
        }}
      >
        Your score is composable. Any Solana program can read it in one CPI call. No oracle needed.
      </p>

      {/* Code example */}
      <div
        style={{
          background: '#111114',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '8px',
          padding: '16px 20px',
          fontFamily: mono,
          fontSize: '14px',
          maxWidth: '480px',
          opacity: isVisible ? 1 : 0,
          transition: 'opacity 0.6s ease 0.6s',
        }}
      >
        <div style={{ color: '#3a3a42' }}>$ krexa score 7xK2mN9...3pF4</div>
        <div style={{ color: '#a0a0a8', marginTop: '4px' }}>
          Krexit Score: <span style={{ color: '#22d3ee' }}>620</span> / 850 (L2 — Standard)
        </div>
      </div>
    </div>
  );
}
