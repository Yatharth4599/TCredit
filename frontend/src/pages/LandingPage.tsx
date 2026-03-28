import { useState, useEffect } from 'react';
import '../styles/landing.css';
import { Navbar } from '../components/landing/Navbar';
import { TerminalAnimation } from '../components/landing/TerminalAnimation';
import { StatBar } from '../components/landing/StatBar';
import { ThreeWays } from '../components/landing/ThreeWays';
import { HowItWorks } from '../components/landing/HowItWorks';
import { CreditLevels } from '../components/landing/CreditLevels';
import { TrancheCards } from '../components/landing/TrancheCards';
import { AgentTypes } from '../components/landing/AgentTypes';
import { ScoreVisualization } from '../components/landing/ScoreVisualization';
import { Footer } from '../components/landing/Footer';
import { Section, SectionTitle } from '../components/landing/Section';
import { useScrollAnimation } from '../hooks/useScrollAnimation';

export default function LandingPage() {
  const [copied, setCopied] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const ctaScroll = useScrollAnimation(0.15);

  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const copyCommand = () => {
    navigator.clipboard.writeText('npx krexa init');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const font = "'Geist', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
  const mono = "'Geist Mono', 'JetBrains Mono', monospace";

  const fadeIn = (delay: number): React.CSSProperties => ({
    opacity: loaded ? 1 : 0,
    transform: loaded ? 'translateY(0)' : 'translateY(20px)',
    transition: `opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
  });

  const ctaFadeIn = (delay: number): React.CSSProperties => ({
    opacity: ctaScroll.isVisible ? 1 : 0,
    transform: ctaScroll.isVisible ? 'translateY(0)' : 'translateY(20px)',
    transition: `opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
  });

  return (
    <div className="landing-root" style={{ minHeight: '100vh' }}>
      <Navbar />

      {/* HERO */}
      <section
        className="dot-grid"
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '140px 24px 80px',
          position: 'relative',
        }}
      >
        {/* Radial glow behind terminal */}
        <div
          className="hero-glow"
          style={{
            position: 'absolute',
            width: '600px',
            height: '400px',
            borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(34, 211, 238, 0.06), transparent 70%)',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -30%)',
            pointerEvents: 'none',
          }}
        />

        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: '800px' }}>
          {/* Headline */}
          <h1
            style={{
              fontSize: 'clamp(36px, 5vw, 64px)',
              fontWeight: 700,
              color: '#f0f0f0',
              letterSpacing: '-0.03em',
              lineHeight: 1.1,
              margin: '0 0 24px',
              fontFamily: font,
              ...fadeIn(0),
            }}
          >
            Credit infrastructure{' '}
            <br className="hidden sm:block" />
            for{' '}
            <span className="gradient-text">AI agents</span>.
          </h1>

          {/* Subheadline */}
          <p
            style={{
              fontSize: '18px',
              color: '#a0a0a8',
              lineHeight: 1.7,
              maxWidth: '500px',
              margin: '0 auto 40px',
              fontFamily: font,
              ...fadeIn(150),
            }}
          >
            Your agent borrows. Operates. Earns.
            <br />
            The Revenue Router repays automatically.
          </p>

          {/* CTAs */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '64px', ...fadeIn(300) }}>
            <a
              href="https://krexa.mintlify.app/docs/quickstart"
              target="_blank"
              rel="noopener noreferrer"
              className="gradient-bg"
              style={{
                padding: '12px 28px',
                color: '#050505',
                fontSize: '15px',
                fontWeight: 600,
                borderRadius: '8px',
                textDecoration: 'none',
                fontFamily: font,
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              Get Started
            </a>
            <a
              href="https://krexa.mintlify.app"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '12px 28px',
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.10)',
                color: '#a0a0a8',
                fontSize: '15px',
                fontWeight: 500,
                borderRadius: '8px',
                textDecoration: 'none',
                fontFamily: font,
                transition: 'border-color 0.2s, color 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.20)';
                e.currentTarget.style.color = '#f0f0f0';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.10)';
                e.currentTarget.style.color = '#a0a0a8';
              }}
            >
              Read the Docs
            </a>
          </div>

          {/* Terminal */}
          <div style={fadeIn(500)}>
            <TerminalAnimation />
          </div>
        </div>
      </section>

      {/* STAT BAR */}
      <StatBar />

      {/* THREE WAYS */}
      <Section id="three-ways">
        <SectionTitle title="Three ways to use Krexa" />
        <ThreeWays />
      </Section>

      {/* HOW IT WORKS */}
      <Section id="how-it-works" background="secondary">
        <SectionTitle title="How it works" />
        <HowItWorks />
      </Section>

      {/* CREDIT LEVELS */}
      <Section id="credit-levels">
        <SectionTitle title="Credit levels" subtitle="Better behavior, better terms." />
        <CreditLevels />
      </Section>

      {/* LP TRANCHES */}
      <Section id="lp" background="secondary">
        <SectionTitle title="Supply capital. Earn yield." subtitle="Choose your risk." />
        <TrancheCards />
      </Section>

      {/* AGENT TYPES */}
      <Section id="agent-types">
        <SectionTitle title="Three types of agents." subtitle="One protocol." />
        <AgentTypes />
      </Section>

      {/* KREXIT SCORE */}
      <Section id="score" background="secondary">
        <SectionTitle title="Krexit Score" subtitle="200–850. Built for agents." />
        <ScoreVisualization />
      </Section>

      {/* FINAL CTA */}
      <section
        ref={ctaScroll.ref}
        style={{
          background: '#050505',
          padding: 'clamp(80px, 12vw, 200px) 24px clamp(80px, 10vw, 160px)',
          textAlign: 'center',
          position: 'relative',
        }}
      >
        {/* Subtle glow */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '600px',
            height: '400px',
            background: 'radial-gradient(ellipse, rgba(34, 211, 238, 0.04), transparent)',
            pointerEvents: 'none',
          }}
        />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2
            style={{
              fontSize: 'clamp(28px, 4vw, 48px)',
              fontWeight: 600,
              color: '#f0f0f0',
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
              margin: '0 0 32px',
              fontFamily: font,
              ...ctaFadeIn(0),
            }}
          >
            Ready to give your agent credit?
          </h2>

          {/* Copy command */}
          <div style={ctaFadeIn(150)}>
            <button
              onClick={copyCommand}
              style={{
                background: '#111114',
                border: '1px solid rgba(255, 255, 255, 0.10)',
                borderRadius: '8px',
                padding: '12px 24px',
                fontFamily: mono,
                fontSize: '16px',
                color: '#a0a0a8',
                cursor: 'pointer',
                marginBottom: '32px',
                transition: 'border-color 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.20)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.10)')}
            >
              {copied ? '✓ Copied!' : '$ npx krexa init'}
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap', ...ctaFadeIn(300) }}>
            <a
              href="https://krexa.mintlify.app/docs/quickstart"
              target="_blank"
              rel="noopener noreferrer"
              className="gradient-bg"
              style={{
                padding: '12px 28px',
                color: '#050505',
                fontSize: '15px',
                fontWeight: 600,
                borderRadius: '8px',
                textDecoration: 'none',
                fontFamily: font,
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              Get Started
            </a>
            <a
              href="https://krexa.mintlify.app"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '12px 28px',
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.10)',
                color: '#a0a0a8',
                fontSize: '15px',
                fontWeight: 500,
                borderRadius: '8px',
                textDecoration: 'none',
                fontFamily: font,
                transition: 'border-color 0.2s, color 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.20)';
                e.currentTarget.style.color = '#f0f0f0';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.10)';
                e.currentTarget.style.color = '#a0a0a8';
              }}
            >
              Read the Docs
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <Footer />
    </div>
  );
}
