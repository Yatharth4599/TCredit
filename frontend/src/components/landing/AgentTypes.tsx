import { useScrollAnimation } from '../../hooks/useScrollAnimation';

const types = [
  {
    label: 'TYPE A',
    name: 'TRADER',
    color: '#22d3ee',
    flow: 'Borrow capital \u2192 Trade on DEXs \u2192 NAV monitored',
    examples: 'Arbitrage \u00b7 Yield farming \u00b7 Market making',
  },
  {
    label: 'TYPE B',
    name: 'SERVICE',
    color: '#34d399',
    flow: 'Borrow capital \u2192 Spend on infra \u2192 Earn via x402',
    examples: 'Research APIs \u00b7 Code review \u00b7 Data oracles',
  },
  {
    label: 'TYPE C',
    name: 'HYBRID',
    color: '#a78bfa',
    flow: 'Borrow capital \u2192 Trade + Serve \u2192 Dual enforcement',
    examples: 'Trading + analytics \u00b7 Portfolio management',
  },
];

export function AgentTypes() {
  return (
    <div
      style={{
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '16px',
        overflow: 'hidden',
      }}
    >
      {types.map((t, i) => (
        <TypeRow key={t.name} type={t} index={i} isLast={i === types.length - 1} />
      ))}
    </div>
  );
}

function TypeRow({ type, index, isLast }: { type: typeof types[0]; index: number; isLast: boolean }) {
  const { ref, isVisible } = useScrollAnimation(0.2);

  return (
    <div
      ref={ref}
      style={{
        padding: '28px 32px',
        borderBottom: isLast ? 'none' : '1px solid rgba(255, 255, 255, 0.06)',
        borderLeft: `3px solid ${type.color}`,
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(15px)',
        transition: 'opacity 0.4s, transform 0.4s, background 0.2s',
        transitionDelay: `${index * 100}ms`,
        cursor: 'default',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = '#16161a')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <div style={{ marginBottom: '8px' }}>
        <span style={{ color: type.color, fontSize: '13px', fontWeight: 600, letterSpacing: '0.05em', fontFamily: "'Geist', 'Inter', sans-serif" }}>
          {type.label}
        </span>
        <span style={{ color: '#5a5a65', fontSize: '13px', margin: '0 8px' }}>\u00b7</span>
        <span style={{ color: '#f0f0f0', fontSize: '13px', fontWeight: 600, letterSpacing: '0.05em', fontFamily: "'Geist', 'Inter', sans-serif" }}>
          {type.name}
        </span>
      </div>
      <div style={{ fontSize: '15px', color: '#a0a0a8', marginBottom: '4px', fontFamily: "'Geist', 'Inter', sans-serif" }}>
        {type.flow}
      </div>
      <div style={{ fontSize: '14px', color: '#5a5a65', fontFamily: "'Geist', 'Inter', sans-serif" }}>
        {type.examples}
      </div>
    </div>
  );
}
