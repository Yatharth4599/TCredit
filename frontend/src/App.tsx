import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom'
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

  return (
    <div className={`${styles.app} ${!isHome ? styles.appWithSidebar : ''}`}>
      {!isHome && <Sidebar />}
      <div className={styles.main}>
        {!isHome && <Topbar title={title} />}
        <div className={styles.content}>
          <Routes>
            <Route path="/" element={<Home />} />
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
      <AppLayout />
    </Router>
  )
}

export default App
