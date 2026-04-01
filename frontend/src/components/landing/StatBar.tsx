import { useScrollAnimation } from '../../hooks/useScrollAnimation';
import { useCountUp } from '../../hooks/useCountUp';

const stats = [
  { value: 7, label: 'Solana Programs', suffix: '' },
  { value: 850, label: 'Score Range', prefix: '200–' },
  { label: 'x402 Native', static: true },
  { value: 3, label: 'Agent Types', suffix: '' },
];

export function StatBar() {
  const { ref, isVisible } = useScrollAnimation(0.3);

  return (
    <div
      ref={ref}
      style={{
        background: '#0a0a0c',
        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        padding: '32px 24px',
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px 48px',
          opacity: isVisible ? 1 : 0,
          transition: 'opacity 0.6s ease',
        }}
      >
        {stats.map((stat, i) => (
          <StatItem key={i} stat={stat} isVisible={isVisible} />
        ))}
      </div>
    </div>
  );
}

function StatItem({ stat, isVisible }: { stat: any; isVisible: boolean }) {
  const count = useCountUp(stat.value || 0, 1200, isVisible);
  const mono = "'Geist Mono', 'JetBrains Mono', monospace";

  if (stat.static) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontFamily: mono, fontSize: '16px', fontWeight: 600, color: '#f0f0f0' }}>
          x402
        </span>
        <span style={{ fontSize: '13px', color: '#5a5a65', fontFamily: "'Geist', 'Inter', sans-serif" }}>
          Native
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ fontFamily: mono, fontSize: '16px', fontWeight: 600, color: '#f0f0f0', fontVariantNumeric: 'tabular-nums' }}>
        {stat.prefix || ''}{count}{stat.suffix || ''}
      </span>
      <span style={{ fontSize: '13px', color: '#5a5a65', fontFamily: "'Geist', 'Inter', sans-serif" }}>
        {stat.label}
      </span>
    </div>
  );
}
