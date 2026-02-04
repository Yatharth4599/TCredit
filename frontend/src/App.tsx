import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Vaults from './pages/Vaults'
import styles from './App.module.css'

function App() {
    return (
        <Router>
            <div className={styles.app}>
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/vaults" element={<Vaults />} />
                </Routes>
            </div>
        </Router>
    )
}

export default App
