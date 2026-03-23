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
const Demo = lazy(() => import('./pages/Demo'))
const VaultsMarketing = lazy(() => import('./pages/VaultsMarketing'))
const PortfolioMarketing = lazy(() => import('./pages/PortfolioMarketing'))
const PoolsMarketing = lazy(() => import('./pages/PoolsMarketing'))
const MerchantMarketing = lazy(() => import('./pages/MerchantMarketing'))
const Vaults = lazy(() => import('./pages/Vaults'))
const Portfolio = lazy(() => import('./pages/Portfolio'))
const MerchantDashboard = lazy(() => import('./pages/MerchantDashboard'))
const LiquidityPools = lazy(() => import('./pages/LiquidityPools'))
const VaultDetail = lazy(() => import('./pages/VaultDetail'))
const AgentWallets = lazy(() => import('./pages/AgentWallets'))
const WalletDetail = lazy(() => import('./pages/WalletDetail'))
const AgentIdentity = lazy(() => import('./pages/AgentIdentity'))
const Gateway = lazy(() => import('./pages/Gateway'))
const Kickstart = lazy(() => import('./pages/Kickstart'))
const TraderDashboard = lazy(() => import('./pages/TraderDashboard'))
const WaitlistAdmin = lazy(() => import('./pages/WaitlistAdmin'))
const X402Demo = lazy(() => import('./pages/X402Demo'))
const LifecycleDemo = lazy(() => import('./pages/LifecycleDemo'))
const NotFound = lazy(() => import('./pages/NotFound'))
const SolanaCreditDashboard = lazy(() => import('./pages/SolanaCreditDashboard'))
const SolanaVaultDashboard = lazy(() => import('./pages/SolanaVaultDashboard'))
const SolanaLPDashboard = lazy(() => import('./pages/SolanaLPDashboard'))
const KrexitScoreDashboard = lazy(() => import('./pages/KrexitScoreDashboard'))

// Kickstart gets special EasyA green theme; all other pages use default blue
// Landing page (/) gets light mode — removes 'dark' class from <html>
function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const isKickstart = pathname.startsWith('/app/kickstart') || pathname.startsWith('/kickstart')
  const isLanding = pathname === '/'
  const isDemo = pathname === '/demo'

  useEffect(() => {
    if (isKickstart) {
      document.documentElement.setAttribute('data-theme', 'kickstart')
    } else {
      document.documentElement.removeAttribute('data-theme')
    }
  }, [isKickstart])

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
      {!isLanding && !isDemo && <WrongNetworkBanner />}
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
          {/* Marketing landing page — light theme, no app chrome */}
          <Route path="/" element={<LandingPage />} />
          {/* App home */}
          <Route path="/app" element={<Home />} />
          {/* Marketing pages */}
          <Route path="/vaults" element={<VaultsMarketing />} />
          <Route path="/portfolio" element={<PortfolioMarketing />} />
          <Route path="/pools" element={<PoolsMarketing />} />
          <Route path="/merchant" element={<MerchantMarketing />} />
          {/* Functional app pages */}
          <Route path="/app/vaults" element={<Vaults />} />
          <Route path="/app/vaults/:address" element={<VaultDetail />} />
          <Route path="/vaults/:address" element={<VaultDetail />} />
          <Route path="/app/portfolio" element={<Portfolio />} />
          <Route path="/app/pools" element={<LiquidityPools />} />
          <Route path="/app/merchant" element={<MerchantDashboard />} />
          <Route path="/app/wallets" element={<AgentWallets />} />
          <Route path="/app/wallets/:address" element={<WalletDetail />} />
          <Route path="/app/identity" element={<AgentIdentity />} />
          <Route path="/app/gateway" element={<Gateway />} />
          <Route path="/app/kickstart" element={<Kickstart />} />
          <Route path="/app/traders" element={<TraderDashboard />} />
          <Route path="/app/x402" element={<X402Demo />} />
          <Route path="/app/demo" element={<Demo />} />
          <Route path="/app/lifecycle" element={<LifecycleDemo />} />
          {/* Solana credit protocol dashboards */}
          <Route path="/app/solana/credit" element={<SolanaCreditDashboard />} />
          <Route path="/app/solana/vault" element={<SolanaVaultDashboard />} />
          <Route path="/app/solana/lp" element={<SolanaLPDashboard />} />
          <Route path="/app/solana/score" element={<KrexitScoreDashboard />} />
          <Route path="/admin/waitlist" element={<WaitlistAdmin />} />
          {/* Live demo dashboard — light theme, public */}
          <Route path="/demo" element={<DemoPage />} />
          {/* Legacy redirects — keep old paths working */}
          <Route path="/x402" element={<Navigate to="/app/x402" replace />} />
          <Route path="/lifecycle" element={<Navigate to="/app/lifecycle" replace />} />
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
