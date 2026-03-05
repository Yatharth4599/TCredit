import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom'
import { lazy, Suspense, useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import ErrorBoundary from './components/ErrorBoundary'
import Navbar from './components/layout/Navbar'
import styles from './App.module.css'

const Home = lazy(() => import('./pages/Home'))
const VaultsMarketing = lazy(() => import('./pages/VaultsMarketing'))
const PortfolioMarketing = lazy(() => import('./pages/PortfolioMarketing'))
const PoolsMarketing = lazy(() => import('./pages/PoolsMarketing'))
const MerchantMarketing = lazy(() => import('./pages/MerchantMarketing'))
const Vaults = lazy(() => import('./pages/Vaults'))
const Portfolio = lazy(() => import('./pages/Portfolio'))
const MerchantDashboard = lazy(() => import('./pages/MerchantDashboard'))
const LiquidityPools = lazy(() => import('./pages/LiquidityPools'))
const VaultDetail = lazy(() => import('./pages/VaultDetail'))
const X402Demo = lazy(() => import('./pages/X402Demo'))
const NotFound = lazy(() => import('./pages/NotFound'))

function getThemeFromPath(pathname: string): string {
  if (pathname === '/') return 'home'
  if (pathname.startsWith('/app/vaults') || pathname.startsWith('/vaults')) return 'vaults'
  if (pathname.startsWith('/app/portfolio') || pathname.startsWith('/portfolio')) return 'portfolio'
  if (pathname.startsWith('/app/merchant') || pathname.startsWith('/merchant')) return 'merchant'
  if (pathname.startsWith('/app/pools') || pathname.startsWith('/pools')) return 'pools'
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
                <Route path="/x402" element={<X402Demo />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </div>
        </ThemeProvider>
      </Router>
    </ErrorBoundary>
  )
}

export default App
