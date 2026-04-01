import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom'
import { lazy, Suspense, useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import ErrorBoundary from './components/ErrorBoundary'
import Navbar from './components/layout/Navbar'
import styles from './App.module.css'

const LandingPage = lazy(() => import('./pages/LandingPage'))
const DemoPage = lazy(() => import('./pages/DemoPage'))
const Home = lazy(() => import('./pages/Home'))
const SolanaCreditDashboard = lazy(() => import('./pages/SolanaCreditDashboard'))
const SolanaLPDashboard = lazy(() => import('./pages/SolanaLPDashboard'))
const KrexitScoreDashboard = lazy(() => import('./pages/KrexitScoreDashboard'))
const MyAgents = lazy(() => import('./pages/MyAgents'))
const NotFound = lazy(() => import('./pages/NotFound'))
const Onboard = lazy(() => import('./pages/Onboard'))
const LaunchpadPage = lazy(() => import('./pages/launchpad/LaunchpadPage'))

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  useEffect(() => {
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.classList.add('dark')
  }, [pathname])
  return <>{children}</>
}

function PageLoader() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
      <div style={{ width: 28, height: 28, border: '4px solid #222', borderTopColor: '#2DD4BF', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )
}

function AppShell() {
  const { pathname } = useLocation()
  const isLanding = pathname === '/'
  const isDemo = pathname === '/demo'
  const isLaunch = pathname === '/launch'

  return (
    <div className={styles.app}>
      {!isLanding && !isDemo && !isLaunch && <Navbar />}
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#111111',
            color: '#FFFFFF',
            border: '4px solid #333333',
            borderRadius: '0px',
            fontSize: '13px',
            fontFamily: "'Space Grotesk', sans-serif",
            padding: '10px 20px',
            boxShadow: 'none',
          },
        }}
      />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Landing — public */}
          <Route path="/" element={<LandingPage />} />
          {/* App home */}
          <Route path="/app" element={<Home />} />
          {/* Solana Agent Credit Protocol */}
          <Route path="/app/solana/credit" element={<SolanaCreditDashboard />} />
          <Route path="/app/solana/lp" element={<SolanaLPDashboard />} />
          <Route path="/app/solana/score" element={<KrexitScoreDashboard />} />
          <Route path="/app/my-agents" element={<MyAgents />} />
          {/* Onboard + Launchpad */}
          <Route path="/onboard" element={<Onboard />} />
          <Route path="/launch" element={<LaunchpadPage />} />
          {/* Live demo — public */}
          <Route path="/demo" element={<DemoPage />} />
          {/* 404 */}
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
