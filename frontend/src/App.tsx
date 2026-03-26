import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { lazy, Suspense, useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import ErrorBoundary from './components/ErrorBoundary'
import Navbar from './components/layout/Navbar'
import styles from './App.module.css'

const LandingPage = lazy(() => import('./pages/LandingPage'))
const NotFound = lazy(() => import('./pages/NotFound'))
const SolanaCreditDashboard = lazy(() => import('./pages/SolanaCreditDashboard'))
const SolanaVaultDashboard = lazy(() => import('./pages/SolanaVaultDashboard'))
const SolanaLPDashboard = lazy(() => import('./pages/SolanaLPDashboard'))
const KrexitScoreDashboard = lazy(() => import('./pages/KrexitScoreDashboard'))
const WaitlistAdmin = lazy(() => import('./pages/WaitlistAdmin'))
const DemoPage = lazy(() => import('./pages/DemoPage'))
const Onboard = lazy(() => import('./pages/Onboard'))

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const isLanding = pathname === '/'
  const isDemo = pathname === '/demo'

  useEffect(() => {
    if (isLanding || isDemo) {
      document.documentElement.classList.remove('dark')
    } else {
      document.documentElement.classList.add('dark')
    }
  }, [isLanding, isDemo])

  return <>{children}</>
}

function PageLoader() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 28, height: 28, border: '2px solid rgba(245,245,247,0.08)', borderTopColor: 'rgba(245,245,247,0.5)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )
}

function AppShell() {
  const { pathname } = useLocation()
  const isLanding = pathname === '/'
  const isDemo = pathname === '/demo'

  return (
    <div className={styles.app}>
      {!isLanding && !isDemo && <Navbar />}
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#111827',
            color: '#F1F5F9',
            border: '1px solid #1E293B',
            borderRadius: '9999px',
            fontSize: '13px',
            fontFamily: "'Inter', -apple-system, sans-serif",
            padding: '10px 20px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          },
        }}
      />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/app" element={<Navigate to="/app/solana/credit" replace />} />
          <Route path="/app/onboard" element={<Onboard />} />
          <Route path="/app/solana/credit" element={<SolanaCreditDashboard />} />
          <Route path="/app/solana/vault" element={<SolanaVaultDashboard />} />
          <Route path="/app/solana/lp" element={<SolanaLPDashboard />} />
          <Route path="/app/solana/score" element={<KrexitScoreDashboard />} />
          <Route path="/demo" element={<DemoPage />} />
          <Route path="/admin/waitlist" element={<WaitlistAdmin />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </div>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <ThemeProvider>
          <AppShell />
        </ThemeProvider>
      </Router>
    </ErrorBoundary>
  )
}

export default App
