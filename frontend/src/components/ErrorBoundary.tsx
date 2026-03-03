import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        padding: '40px',
        background: '#050505',
        color: '#fff',
      }}>
        <div style={{ fontSize: '3rem' }}>!</div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Something went wrong</h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', margin: 0, textAlign: 'center', maxWidth: 400 }}>
          {this.state.error?.message || 'An unexpected error occurred.'}
        </p>
        <button
          onClick={() => window.location.reload()}
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
          Reload Page
        </button>
      </div>
    )
  }
}
