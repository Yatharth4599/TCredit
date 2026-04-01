import { useScrollAnimation } from '../../hooks/useScrollAnimation';

const levels = [
  { level: 'L1', name: 'Micro', credit: '$500', apr: '36.50%', daily: '0.10%', req: 'New agent', dot: '#5a5a65' },
  { level: 'L2', name: 'Standard', credit: '$20,000', apr: '29.20%', daily: '0.08%', req: 'Score \u2265 500', dot: '#3b82f6' },
  { level: 'L3', name: 'Growth', credit: '$50,000', apr: '21.90%', daily: '0.06%', req: 'Score \u2265 650', dot: '#22d3ee' },
  { level: 'L4', name: 'Prime', credit: '$500,000', apr: '18.25%', daily: '0.05%', req: 'Score \u2265 750', dot: '#34d399' },
];

const headers = ['Level', 'Max Credit', 'APR', 'Daily', 'Requirement'];

export function CreditLevels() {
  const { ref, isVisible } = useScrollAnimation(0.1);
  const mono = "'Geist Mono', 'JetBrains Mono', monospace";

  return (
    <div ref={ref}>
      {/* Header */}
      <div
        className="hidden md:grid"
        style={{
          gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1.2fr',
          padding: '12px 24px',
          gap: '16px',
          opacity: isVisible ? 1 : 0,
          transition: 'opacity 0.4s ease',
        }}
      >
        {headers.map((h) => (
          <span
            key={h}
            style={{
              fontSize: '13px',
              fontWeight: 500,
              color: '#5a5a65',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              fontFamily: "'Geist', 'Inter', sans-serif",
            }}
          >
            {h}
          </span>
        ))}
      </div>

      {/* Rows */}
      {levels.map((l, i) => (
        <div
          key={l.level}
          className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_1fr_1fr_1.2fr]"
          style={{
            padding: '20px 24px',
            gap: '8px 16px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            transition: 'background 0.2s, opacity 0.4s, transform 0.4s',
            transitionDelay: `${i * 80}ms`,
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? 'translateY(0)' : 'translateY(10px)',
            cursor: 'default',
            borderRadius: '8px',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#16161a')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          {/* Level */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: l.dot, boxShadow: l.dot !== '#5a5a65' ? `0 0 8px ${l.dot}` : 'none' }} />
            <span style={{ fontWeight: 600, color: '#f0f0f0', fontFamily: "'Geist', 'Inter', sans-serif" }}>
              {l.level} {l.name}
            </span>
          </div>
          {/* Max Credit */}
          <div style={{ fontFamily: mono, color: '#f0f0f0', fontSize: '15px' }}>
            <span className="md:hidden" style={{ color: '#5a5a65', fontSize: '12px', marginRight: '8px' }}>Max Credit</span>
            {l.credit}
          </div>
          {/* APR */}
          <div style={{ fontFamily: mono, color: '#a0a0a8', fontSize: '15px' }}>
            <span className="md:hidden" style={{ color: '#5a5a65', fontSize: '12px', marginRight: '8px' }}>APR</span>
            {l.apr}
          </div>
          {/* Daily */}
          <div style={{ fontFamily: mono, color: '#a0a0a8', fontSize: '15px' }}>
            <span className="md:hidden" style={{ color: '#5a5a65', fontSize: '12px', marginRight: '8px' }}>Daily</span>
            {l.daily}
          </div>
          {/* Requirement */}
          <div style={{ color: '#5a5a65', fontSize: '14px', fontFamily: "'Geist', 'Inter', sans-serif" }}>
            <span className="md:hidden" style={{ color: '#5a5a65', fontSize: '12px', marginRight: '8px' }}>Req</span>
            {l.req}
          </div>
        </div>
      ))}
    </div>
  );
}
