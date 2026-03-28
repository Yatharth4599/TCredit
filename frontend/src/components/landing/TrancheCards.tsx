import { useScrollAnimation } from '../../hooks/useScrollAnimation';

const tranches = [
  {
    name: 'SENIOR',
    apr: '10%',
    color: '#3b82f6',
    lines: ['First to be paid', 'Last to lose'],
    cta: 'Deposit \u2192',
    href: '/app/solana/vault',
  },
  {
    name: 'MEZZANINE',
    apr: '12%',
    color: '#22d3ee',
    lines: ['Balanced', 'risk-reward'],
    cta: 'Deposit \u2192',
    href: '/app/solana/vault',
  },
  {
    name: 'JUNIOR',
    apr: '20%',
    color: '#34d399',
    lines: ['Highest yield', 'First loss'],
    cta: null,
    label: 'Protocol Only',
  },
];

export function TrancheCards() {
  const { ref, isVisible } = useScrollAnimation(0.1);
  const mono = "'Geist Mono', 'JetBrains Mono', monospace";

  return (
    <div ref={ref} className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {tranches.map((t, i) => (
        <div
          key={t.name}
          style={{
            background: '#0a0a0c',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '16px',
            padding: '32px',
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.4s, transform 0.4s, border-color 0.2s',
            transitionDelay: `${i * 100}ms`,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.10)')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)')}
        >
          <div
            style={{
              fontSize: '13px',
              fontWeight: 500,
              color: '#5a5a65',
              letterSpacing: '0.05em',
              marginBottom: '20px',
              fontFamily: "'Geist', 'Inter', sans-serif",
            }}
          >
            {t.name}
          </div>
          <div
            style={{
              fontSize: '36px',
              fontWeight: 600,
              color: t.color,
              fontFamily: mono,
              marginBottom: '20px',
              lineHeight: 1,
            }}
          >
            {t.apr}
            <span style={{ fontSize: '16px', color: '#5a5a65', marginLeft: '8px' }}>APR</span>
          </div>
          {t.lines.map((line) => (
            <p
              key={line}
              style={{
                fontSize: '15px',
                color: '#a0a0a8',
                margin: '0 0 4px',
                lineHeight: 1.6,
                fontFamily: "'Geist', 'Inter', sans-serif",
              }}
            >
              {line}
            </p>
          ))}
          <div style={{ marginTop: '24px' }}>
            {t.cta ? (
              <a
                href={t.href}
                style={{
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#22d3ee',
                  textDecoration: 'none',
                  transition: 'opacity 0.2s',
                  fontFamily: "'Geist', 'Inter', sans-serif",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.7')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                {t.cta}
              </a>
            ) : (
              <span style={{ fontSize: '14px', color: '#3a3a42', fontFamily: "'Geist', 'Inter', sans-serif" }}>
                {t.label}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
