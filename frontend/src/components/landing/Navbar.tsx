import { useState, useEffect } from 'react';

const NAV_LINKS = [
  { label: 'Launch', href: '/launch' },
  { label: 'Docs', href: 'https://krexa.mintlify.app' },
  { label: 'GitHub', href: 'https://github.com/Yatharth4599/Krexa' },
  { label: 'Dashboard', href: '/app/solana/credit' },
];

export function Navbar() {
  const [hidden, setHidden] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

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

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  return (
    <>
      <nav
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '64px',
          background: 'rgba(5, 5, 5, 0.8)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          zIndex: 100,
          transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          transform: hidden && !menuOpen ? 'translateY(-100%)' : 'translateY(0)',
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
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #22d3ee, #34d399)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                fontWeight: 700,
                color: '#050505',
                fontFamily: "'Geist', 'Inter', sans-serif",
              }}
            >
              K
            </div>
            <span
              style={{
                fontSize: '18px',
                fontWeight: 600,
                color: '#f0f0f0',
                letterSpacing: '0.02em',
                fontFamily: "'Geist', 'Inter', sans-serif",
              }}
            >
              KREXA
            </span>
          </a>

          {/* Hamburger menu button */}
          <button
            style={{
              background: 'none',
              border: 'none',
              color: '#a0a0a8',
              cursor: 'pointer',
              padding: '8px',
            }}
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label="Toggle menu"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile menu overlay */}
      {menuOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: '#050505',
            zIndex: 200,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Overlay header — logo + close button */}
          <div
            style={{
              height: '64px',
              padding: '0 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <a
              href="/"
              onClick={() => setMenuOpen(false)}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #22d3ee, #34d399)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                  fontWeight: 700,
                  color: '#050505',
                  fontFamily: "'Geist', 'Inter', sans-serif",
                }}
              >
                K
              </div>
              <span
                style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  color: '#f0f0f0',
                  letterSpacing: '0.02em',
                  fontFamily: "'Geist', 'Inter', sans-serif",
                }}
              >
                KREXA
              </span>
            </a>

            <button
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
              style={{
                background: 'none',
                border: 'none',
                color: '#a0a0a8',
                cursor: 'pointer',
                padding: '8px',
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Overlay links */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '36px',
            }}
          >
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target={link.href.startsWith('http') ? '_blank' : undefined}
                rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                onClick={() => setMenuOpen(false)}
                style={{
                  fontSize: '24px',
                  color: '#f0f0f0',
                  textDecoration: 'none',
                  fontWeight: 500,
                  fontFamily: "'Geist', 'Inter', sans-serif",
                  transition: 'color 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#22d3ee')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#f0f0f0')}
              >
                {link.label}
              </a>
            ))}

            <a
              href="https://krexa.mintlify.app/docs/quickstart"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMenuOpen(false)}
              style={{
                marginTop: '12px',
                padding: '12px 32px',
                background: 'linear-gradient(135deg, #22d3ee, #34d399)',
                color: '#050505',
                fontSize: '16px',
                fontWeight: 600,
                borderRadius: '9999px',
                textDecoration: 'none',
                fontFamily: "'Geist', 'Inter', sans-serif",
              }}
            >
              Get Started
            </a>
          </div>
        </div>
      )}
    </>
  );
}
