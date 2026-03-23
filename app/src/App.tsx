import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { WalletProvider } from './providers/WalletProvider'
import { QueryProvider } from './providers/QueryProvider'
import { AppLayout } from './components/layout/AppLayout'
import { LoadingSpinner } from './components/shared'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const WalletPage = lazy(() => import('./pages/WalletPage'))
const CreditPage = lazy(() => import('./pages/CreditPage'))
const HealthPage = lazy(() => import('./pages/HealthPage'))
const LPPage = lazy(() => import('./pages/LPPage'))
const VaultPage = lazy(() => import('./pages/VaultPage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <LoadingSpinner className="w-8 h-8" />
    </div>
  )
}

export default function App() {
  return (
    <WalletProvider>
      <QueryProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Suspense fallback={<PageLoader />}><Dashboard /></Suspense>} />
              <Route path="/wallet" element={<Suspense fallback={<PageLoader />}><WalletPage /></Suspense>} />
              <Route path="/credit" element={<Suspense fallback={<PageLoader />}><CreditPage /></Suspense>} />
              <Route path="/health" element={<Suspense fallback={<PageLoader />}><HealthPage /></Suspense>} />
              <Route path="/lp" element={<Suspense fallback={<PageLoader />}><LPPage /></Suspense>} />
              <Route path="/vault" element={<Suspense fallback={<PageLoader />}><VaultPage /></Suspense>} />
              <Route path="/admin" element={<Suspense fallback={<PageLoader />}><AdminPage /></Suspense>} />
            </Route>
          </Routes>
        </BrowserRouter>
      </QueryProvider>
    </WalletProvider>
  )
}
