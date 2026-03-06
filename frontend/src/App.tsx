import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { lazy, Suspense, useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import ErrorBoundary from './components/ErrorBoundary'
import Navbar from './components/layout/Navbar'
import styles from './App.module.css'

const Home = lazy(() => import('./pages/Home'))
const Waitlist = lazy(() => import('./pages/Waitlist'))
const VaultsMarketing = lazy(() => import('./pages/VaultsMarketing'))
const MerchantMarketing = lazy(() => import('./pages/MerchantMarketing'))
const PoolsMarketing = lazy(() => import('./pages/PoolsMarketing'))
const PortfolioMarketing = lazy(() => import('./pages/PortfolioMarketing'))
const X402Demo = lazy(() => import('./pages/X402Demo'))
// App pages
const Vaults = lazy(() => import('./pages/Vaults'))
const VaultDetail = lazy(() => import('./pages/VaultDetail'))
const LiquidityPools = lazy(() => import('./pages/LiquidityPools'))
const Portfolio = lazy(() => import('./pages/Portfolio'))
const MerchantDashboard = lazy(() => import('./pages/MerchantDashboard'))

function getThemeFromPath(pathname: string): string {
  if (pathname === '/') return 'home'
  if (pathname.startsWith('/vaults') || pathname.startsWith('/app/vaults')) return 'vaults'
  if (pathname.startsWith('/portfolio') || pathname.startsWith('/app/portfolio')) return 'portfolio'
  if (pathname.startsWith('/merchant') || pathname.startsWith('/app/merchant')) return 'merchant'
  if (pathname.startsWith('/pools') || pathname.startsWith('/app/pools')) return 'pools'
  if (pathname.startsWith('/x402')) return 'x402'
  return 'home'
}

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const theme = getThemeFromPath(pathname)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    return () => document.documentElement.removeAttribute('data-theme')
  }, [theme])

  return <>{children}</>
}

function PageLoader() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 28, height: 28, border: '2px solid rgba(245,245,247,0.08)', borderTopColor: 'rgba(245,245,247,0.5)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <ThemeProvider>
          <div className={styles.app}>
            <Navbar />
            <Toaster
              position="bottom-right"
              toastOptions={{
                style: {
                  background: '#10141C',
                  color: '#F5F5F7',
                  border: 'none',
                  borderRadius: '9999px',
                  fontSize: '13px',
                  fontFamily: "'Inter', -apple-system, sans-serif",
                  padding: '10px 20px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                },
              }}
            />
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/waitlist" element={<Waitlist />} />
                {/* Marketing pages */}
                <Route path="/vaults" element={<VaultsMarketing />} />
                <Route path="/merchant" element={<MerchantMarketing />} />
                <Route path="/pools" element={<PoolsMarketing />} />
                <Route path="/portfolio" element={<PortfolioMarketing />} />
                <Route path="/x402" element={<X402Demo />} />
                {/* App pages */}
                <Route path="/app/vaults" element={<Vaults />} />
                <Route path="/app/vaults/:address" element={<VaultDetail />} />
                <Route path="/app/pools" element={<LiquidityPools />} />
                <Route path="/app/portfolio" element={<Portfolio />} />
                <Route path="/app/merchant" element={<MerchantDashboard />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </div>
        </ThemeProvider>
      </Router>
    </ErrorBoundary>
  )
}

export default App
