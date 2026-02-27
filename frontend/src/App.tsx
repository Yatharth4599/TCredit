import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import Navbar from './components/layout/Navbar'
import styles from './App.module.css'

const Home = lazy(() => import('./pages/Home'))
const Vaults = lazy(() => import('./pages/Vaults'))
const Portfolio = lazy(() => import('./pages/Portfolio'))
const MerchantDashboard = lazy(() => import('./pages/MerchantDashboard'))
const LiquidityPools = lazy(() => import('./pages/LiquidityPools'))
const X402Demo = lazy(() => import('./pages/X402Demo'))

function PageLoader() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, border: '3px solid rgba(255,107,53,0.2)', borderTopColor: '#FF6B35', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )
}

function App() {
  return (
    <Router>
      <div className={styles.app}>
        <Navbar />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/vaults" element={<Vaults />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/pools" element={<LiquidityPools />} />
            <Route path="/merchant" element={<MerchantDashboard />} />
            <Route path="/x402" element={<X402Demo />} />
          </Routes>
        </Suspense>
      </div>
    </Router>
  )
}

export default App
