import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Navbar from './components/layout/Navbar'
import Home from './pages/Home'
import Vaults from './pages/Vaults'
import VaultDetail from './pages/VaultDetail'
import Portfolio from './pages/Portfolio'
import MerchantDashboard from './pages/MerchantDashboard'
import styles from './App.module.css'

function App() {
    return (
        <Router>
            <div className={styles.app}>
                <Navbar />
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/vaults" element={<Vaults />} />
                    <Route path="/vaults/:id" element={<VaultDetail />} />
                    <Route path="/portfolio" element={<Portfolio />} />
                    <Route path="/merchant" element={<MerchantDashboard />} />
                </Routes>
            </div>
        </Router>
    )
}

export default App
