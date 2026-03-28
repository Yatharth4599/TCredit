import { useState, useEffect } from 'react';

export function Navbar() {
  const [hidden, setHidden] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      if (currentY > lastScrollY && currentY > 80) {
        setHidden(true);
      } else {
        setHidden(false);
      }
      setLastScrollY(currentY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  return (
    <nav
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '64px',
        background: 'rgba(5, 5, 5, 0.8)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        zIndex: 100,
        transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        transform: hidden ? 'translateY(-100%)' : 'translateY(0)',
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 24px',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Logo */}
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              background: 'linear-gradient(135deg, #22d3ee, #34d399)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              fontWeight: 700,
              color: '#050505',
              fontFamily: "'Geist', 'Inter', sans-serif",
            }}
          >
            K
          </div>
          <span
            style={{
              fontSize: '16px',
              fontWeight: 600,
              color: '#f0f0f0',
              letterSpacing: '0.02em',
              fontFamily: "'Geist', 'Inter', sans-serif",
            }}
          >
            KREXA
          </span>
        </a>

        {/* Links — desktop */}
        <div className="hidden md:flex" style={{ alignItems: 'center', gap: '32px' }}>
          {[
            { label: 'Docs', href: 'https://krexa.mintlify.app' },
            { label: 'GitHub', href: 'https://github.com/Yatharth4599/Krexa' },
            { label: 'Dashboard', href: '/app/solana/credit' },
          ].map((link) => (
            <a
              key={link.label}
              href={link.href}
              target={link.href.startsWith('http') ? '_blank' : undefined}
              rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
              style={{
                fontSize: '14px',
                color: '#a0a0a8',
                textDecoration: 'none',
                transition: 'color 0.2s',
                fontFamily: "'Geist', 'Inter', sans-serif",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#f0f0f0')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#a0a0a8')}
            >
              {link.label}
            </a>
          ))}
          <a
            href="https://krexa.mintlify.app/docs/quickstart"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '8px 20px',
              background: 'linear-gradient(135deg, #22d3ee, #34d399)',
              color: '#050505',
              fontSize: '14px',
              fontWeight: 600,
              borderRadius: '9999px',
              textDecoration: 'none',
              fontFamily: "'Geist', 'Inter', sans-serif",
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            Get Started
          </a>
        </div>

        {/* Mobile menu button */}
        <button
          className="md:hidden"
          style={{
            background: 'none',
            border: 'none',
            color: '#a0a0a8',
            cursor: 'pointer',
            padding: '8px',
          }}
          onClick={() => {
            // Simple: just open docs
            window.open('https://krexa.mintlify.app/docs/quickstart', '_blank');
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12h18M3 6h18M3 18h18" />
          </svg>
        </button>
      </div>
    </nav>
  );
}
