import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom'
import { lazy, Suspense, useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import ErrorBoundary from './components/ErrorBoundary'
import Navbar from './components/layout/Navbar'
import styles from './App.module.css'

const Home = lazy(() => import('./pages/Home'))
const Vaults = lazy(() => import('./pages/Vaults'))
const Portfolio = lazy(() => import('./pages/Portfolio'))
const MerchantDashboard = lazy(() => import('./pages/MerchantDashboard'))
const LiquidityPools = lazy(() => import('./pages/LiquidityPools'))
const VaultDetail = lazy(() => import('./pages/VaultDetail'))
const X402Demo = lazy(() => import('./pages/X402Demo'))
const NotFound = lazy(() => import('./pages/NotFound'))

function getThemeFromPath(pathname: string): string {
  if (pathname === '/') return 'home'
  if (pathname.startsWith('/vaults')) return 'vaults'
  if (pathname.startsWith('/portfolio')) return 'portfolio'
  if (pathname.startsWith('/merchant')) return 'merchant'
  if (pathname.startsWith('/pools')) return 'pools'
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
      <div style={{ width: 32, height: 32, border: '3px solid rgba(var(--accent-rgb, 255,107,53),0.2)', borderTopColor: 'var(--accent, #FF6B35)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
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
                  background: '#1a1a1a',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  fontSize: '14px',
                },
              }}
            />
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/vaults" element={<Vaults />} />
                <Route path="/vaults/:address" element={<VaultDetail />} />
                <Route path="/portfolio" element={<Portfolio />} />
                <Route path="/pools" element={<LiquidityPools />} />
                <Route path="/merchant" element={<MerchantDashboard />} />
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
