import { useScrollAnimation } from '../../hooks/useScrollAnimation';

const steps = [
  {
    num: '01',
    title: 'Register your agent',
    code: '$ npx krexa init --type service --name "Bot"',
    desc: 'One command creates your identity, PDA wallet, and credit profile on Solana.',
  },
  {
    num: '02',
    title: 'Borrow working capital',
    code: '$ krexa borrow 500\n\u2713 Credit line opened: $500.00 USDC',
    desc: 'USDC deposited directly into your PDA wallet. No collateral required at L1.',
  },
  {
    num: '03',
    title: 'Revenue auto-repays',
    code: 'Revenue: $0.25 (x402) \u2192 Revenue Router\n  Protocol fee:  $0.025  \u2192 Treasury\n  LP yield:      $0.035  \u2192 Senior tranche\n  Agent receives: $0.19',
    desc: 'Every dollar earned flows through the Revenue Router. We take what\'s owed. You get the rest.',
  },
];

export function HowItWorks() {
  const mono = "'Geist Mono', 'JetBrains Mono', monospace";

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '80px' }}>
      {steps.map((step) => (
        <StepItem key={step.num} step={step} mono={mono} />
      ))}
    </div>
  );
}

function StepItem({ step, mono }: { step: typeof steps[0]; mono: string }) {
  const { ref, isVisible } = useScrollAnimation(0.2);

  return (
    <div
      ref={ref}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(30px)',
        transition: 'opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div
        style={{
          fontFamily: mono,
          fontSize: '64px',
          fontWeight: 600,
          color: '#3a3a42',
          lineHeight: 1,
          marginBottom: '16px',
        }}
      >
        {step.num}
      </div>
      <h3
        style={{
          fontSize: '24px',
          fontWeight: 600,
          color: '#f0f0f0',
          marginBottom: '24px',
          fontFamily: "'Geist', 'Inter', sans-serif",
        }}
      >
        {step.title}
      </h3>
      <div
        style={{
          background: '#111114',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '8px',
          padding: '16px 20px',
          fontFamily: mono,
          fontSize: '14px',
          color: '#a0a0a8',
          lineHeight: 1.7,
          whiteSpace: 'pre',
          overflowX: 'auto',
          marginBottom: '20px',
        }}
      >
        {step.code}
      </div>
      <p
        style={{
          fontSize: '16px',
          color: '#a0a0a8',
          lineHeight: 1.7,
          maxWidth: '560px',
          margin: 0,
          fontFamily: "'Geist', 'Inter', sans-serif",
        }}
      >
        {step.desc}
      </p>
    </div>
  );
}
