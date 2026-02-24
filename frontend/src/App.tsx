import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Navbar from './components/layout/Navbar'
import Home from './pages/Home'
import Vaults from './pages/Vaults'
import Portfolio from './pages/Portfolio'
import MerchantDashboard from './pages/MerchantDashboard'
import LiquidityPools from './pages/LiquidityPools'
import styles from './App.module.css'

function App() {
  return (
    <Router>
      <div className={styles.app}>
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/vaults" element={<Vaults />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/pools" element={<LiquidityPools />} />
          <Route path="/merchant" element={<MerchantDashboard />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
