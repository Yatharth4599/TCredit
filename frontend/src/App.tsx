import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom'
import Navbar from './components/layout/Navbar'
import Sidebar from './components/layout/Sidebar'
import Topbar from './components/layout/Topbar'
import Home from './pages/Home'
import Vaults from './pages/Vaults'
import Portfolio from './pages/Portfolio'
import MerchantDashboard from './pages/MerchantDashboard'
import styles from './App.module.css'

const PAGE_TITLES: Record<string, string> = {
  '/vaults': 'Vaults',
  '/portfolio': 'Portfolio',
  '/merchant': 'Merchant Dashboard',
}

function AppLayout() {
  const location = useLocation()
  const isHome = location.pathname === '/'
  const title = PAGE_TITLES[location.pathname]

  if (isHome) {
    return (
      <div className={styles.app}>
        <Navbar />
        <Home />
      </div>
    )
  }

  return (
    <div className={`${styles.app} ${styles.appWithSidebar}`}>
      <Sidebar />
      <div className={styles.main}>
        <Topbar title={title} />
        <div className={styles.content}>
          <Routes>
            <Route path="/vaults" element={<Vaults />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/merchant" element={<MerchantDashboard />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="*" element={<AppLayout />} />
      </Routes>
    </Router>
  )
}

export default App
