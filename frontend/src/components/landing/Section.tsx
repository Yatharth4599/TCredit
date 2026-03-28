import { ReactNode } from 'react';
import { useScrollAnimation } from '../../hooks/useScrollAnimation';

interface SectionProps {
  children: ReactNode;
  className?: string;
  id?: string;
  background?: 'primary' | 'secondary';
  padding?: 'default' | 'large';
}

export function Section({ children, className = '', id, background = 'primary', padding = 'default' }: SectionProps) {
  const { ref, isVisible } = useScrollAnimation(0.1);

  const bgColor = background === 'secondary' ? '#0a0a0c' : '#050505';
  const py = padding === 'large' ? '160px' : '120px';
  const pyMobile = padding === 'large' ? '80px' : '64px';

  return (
    <section
      ref={ref}
      id={id}
      className={className}
      style={{
        background: bgColor,
        borderTop: background === 'secondary' ? '1px solid rgba(255, 255, 255, 0.06)' : 'none',
        borderBottom: background === 'secondary' ? '1px solid rgba(255, 255, 255, 0.06)' : 'none',
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: `${py} 24px`,
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'translateY(0)' : 'translateY(30px)',
          transition: 'opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {children}
      </div>
      <style>{`
        @media (max-width: 768px) {
          #${id || 'section'} > div {
            padding-top: ${pyMobile} !important;
            padding-bottom: ${pyMobile} !important;
          }
        }
      `}</style>
    </section>
  );
}

// Reusable section headline
export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: '64px' }}>
      <h2
        style={{
          fontSize: '40px',
          fontWeight: 600,
          color: '#f0f0f0',
          letterSpacing: '-0.02em',
          lineHeight: 1.2,
          margin: 0,
          fontFamily: "'Geist', 'Inter', sans-serif",
        }}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          style={{
            fontSize: '18px',
            color: '#a0a0a8',
            marginTop: '12px',
            lineHeight: 1.6,
            fontFamily: "'Geist', 'Inter', sans-serif",
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
