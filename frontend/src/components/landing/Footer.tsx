export function Footer() {
  const linkStyle = {
    fontSize: '14px',
    color: '#5a5a65',
    textDecoration: 'none' as const,
    lineHeight: 2.2,
    display: 'block' as const,
    transition: 'color 0.2s',
    fontFamily: "'Geist', 'Inter', sans-serif" as const,
  };

  const columnTitleStyle = {
    fontSize: '13px',
    fontWeight: 500 as const,
    color: '#a0a0a8',
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
    marginBottom: '16px',
    fontFamily: "'Geist', 'Inter', sans-serif" as const,
  };

  return (
    <footer style={{ background: '#0a0a0c', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '64px 24px 32px' }}>
        {/* Top: logo + columns */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-8">
          {/* Brand */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
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
                }}
              >
                K
              </div>
              <span style={{ fontSize: '16px', fontWeight: 600, color: '#f0f0f0' }}>KREXA</span>
            </div>
            <p style={{ fontSize: '14px', color: '#5a5a65', lineHeight: 1.6, fontFamily: "'Geist', 'Inter', sans-serif" }}>
              Credit Layer for AI Agents
            </p>
          </div>

          {/* Product */}
          <div>
            <div style={columnTitleStyle}>Product</div>
            {[
              { label: 'Dashboard', href: '/app/solana/credit' },
              { label: 'LP Vault', href: '/app/solana/vault' },
              { label: 'Score Lookup', href: '/app/solana/score' },
            ].map((l) => (
              <a
                key={l.label}
                href={l.href}
                style={linkStyle}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#a0a0a8')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#5a5a65')}
              >
                {l.label}
              </a>
            ))}
          </div>

          {/* Developers */}
          <div>
            <div style={columnTitleStyle}>Developers</div>
            {[
              { label: 'Docs', href: 'https://krexa.mintlify.app' },
              { label: 'GitHub', href: 'https://github.com/Yatharth4599/Krexa' },
              { label: 'CLI Reference', href: 'https://krexa.mintlify.app/docs/cli/overview' },
              { label: 'API Reference', href: 'https://krexa.mintlify.app/docs/api/overview' },
              { label: 'MCP Setup', href: 'https://krexa.mintlify.app/docs/mcp-mode' },
            ].map((l) => (
              <a
                key={l.label}
                href={l.href}
                target={l.href.startsWith('http') ? '_blank' : undefined}
                rel={l.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                style={linkStyle}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#a0a0a8')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#5a5a65')}
              >
                {l.label}
              </a>
            ))}
          </div>

          {/* Community */}
          <div>
            <div style={columnTitleStyle}>Community</div>
            {[
              { label: 'Twitter', href: 'https://x.com/krexa_xyz' },
              { label: 'Discord', href: '#' },
            ].map((l) => (
              <a
                key={l.label}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                style={linkStyle}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#a0a0a8')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#5a5a65')}
              >
                {l.label}
              </a>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            marginTop: '64px',
            paddingTop: '24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <span style={{ fontSize: '13px', color: '#3a3a42', fontFamily: "'Geist', 'Inter', sans-serif" }}>
            © 2026 Krexa Protocol · Built on Solana
          </span>
        </div>
      </div>
    </footer>
  );
}
