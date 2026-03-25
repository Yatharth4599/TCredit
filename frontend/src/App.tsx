import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { lazy, Suspense, useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import ErrorBoundary from './components/ErrorBoundary'
import Navbar from './components/layout/Navbar'
import WrongNetworkBanner from './components/layout/WrongNetworkBanner'
import styles from './App.module.css'

const LandingPage = lazy(() => import('./pages/LandingPage'))
const DemoPage = lazy(() => import('./pages/DemoPage'))
const Home = lazy(() => import('./pages/Home'))
const Vaults = lazy(() => import('./pages/Vaults'))
const Portfolio = lazy(() => import('./pages/Portfolio'))
const MerchantDashboard = lazy(() => import('./pages/MerchantDashboard'))
const LiquidityPools = lazy(() => import('./pages/LiquidityPools'))
const VaultDetail = lazy(() => import('./pages/VaultDetail'))
const AgentWallets = lazy(() => import('./pages/AgentWallets'))
const WalletDetail = lazy(() => import('./pages/WalletDetail'))
const AgentIdentity = lazy(() => import('./pages/AgentIdentity'))
const Gateway = lazy(() => import('./pages/Gateway'))
const X402Demo = lazy(() => import('./pages/X402Demo'))
const NotFound = lazy(() => import('./pages/NotFound'))

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

  return (
    <div className={styles.app}>
      {!isLanding && !isDemo && <WrongNetworkBanner />}
      {!isLanding && !isDemo && <Navbar />}
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
          {/* Landing — public, no app chrome */}
          <Route path="/" element={<LandingPage />} />
          {/* App pages */}
          <Route path="/app" element={<Home />} />
          <Route path="/app/vaults" element={<Vaults />} />
          <Route path="/app/vaults/:address" element={<VaultDetail />} />
          <Route path="/app/portfolio" element={<Portfolio />} />
          <Route path="/app/pools" element={<LiquidityPools />} />
          <Route path="/app/merchant" element={<MerchantDashboard />} />
          <Route path="/app/wallets" element={<AgentWallets />} />
          <Route path="/app/wallets/:address" element={<WalletDetail />} />
          <Route path="/app/identity" element={<AgentIdentity />} />
          <Route path="/app/gateway" element={<Gateway />} />
          <Route path="/app/x402" element={<X402Demo />} />
          {/* Live demo — public */}
          <Route path="/demo" element={<DemoPage />} />
          {/* Legacy redirects */}
          <Route path="/vaults" element={<Navigate to="/app/vaults" replace />} />
          <Route path="/vaults/:address" element={<VaultDetail />} />
          <Route path="/portfolio" element={<Navigate to="/app/portfolio" replace />} />
          <Route path="/pools" element={<Navigate to="/app/pools" replace />} />
          <Route path="/merchant" element={<Navigate to="/app/merchant" replace />} />
          <Route path="/x402" element={<Navigate to="/app/x402" replace />} />
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
