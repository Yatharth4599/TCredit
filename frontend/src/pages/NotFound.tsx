import { useNavigate } from 'react-router-dom'

export default function NotFound() {
  const navigate = useNavigate()

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '16px',
      padding: '40px',
      color: '#fff',
    }}>
      <span style={{ fontSize: '5rem', fontWeight: 800, opacity: 0.15, lineHeight: 1 }}>404</span>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>Page not found</h1>
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', margin: 0 }}>
        The page you're looking for doesn't exist.
      </p>
      <button
        onClick={() => navigate('/')}
        style={{
          marginTop: '8px',
          padding: '10px 24px',
          background: 'linear-gradient(135deg, #FF6B35, #ff8f6b)',
          border: 'none',
          borderRadius: '10px',
          color: '#000',
          fontWeight: 700,
          fontSize: '0.85rem',
          cursor: 'pointer',
        }}
      >
        Back to Home
      </button>
    </div>
  )
}
