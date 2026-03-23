import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { WalletProvider } from './providers/WalletProvider'
import { QueryProvider } from './providers/QueryProvider'
import { AppLayout } from './components/layout/AppLayout'
import { PublicLayout } from './components/layout/PublicLayout'
import { LoadingSpinner } from './components/shared'

// Public pages
const LandingPage = lazy(() => import('./pages/LandingPage'))
const ScoreLookupPage = lazy(() => import('./pages/ScoreLookupPage'))
const VaultPage = lazy(() => import('./pages/VaultPage'))
const DocsPage = lazy(() => import('./pages/DocsPage'))

// Authenticated pages
const Dashboard = lazy(() => import('./pages/Dashboard'))
const WalletPage = lazy(() => import('./pages/WalletPage'))
const CreditPage = lazy(() => import('./pages/CreditPage'))
const HealthPage = lazy(() => import('./pages/HealthPage'))
const LPPage = lazy(() => import('./pages/LPPage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <LoadingSpinner className="w-8 h-8" />
    </div>
  )
}

function Pg({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>
}

export default function App() {
  return (
    <WalletProvider>
      <QueryProvider>
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<Pg><LandingPage /></Pg>} />
              <Route path="/score" element={<Pg><ScoreLookupPage /></Pg>} />
              <Route path="/score/:address" element={<Pg><ScoreLookupPage /></Pg>} />
              <Route path="/vault" element={<Pg><VaultPage /></Pg>} />
              <Route path="/docs" element={<Pg><DocsPage /></Pg>} />
            </Route>

            {/* Authenticated routes */}
            <Route path="/dashboard" element={<AppLayout />}>
              <Route index element={<Pg><Dashboard /></Pg>} />
              <Route path="wallet" element={<Pg><WalletPage /></Pg>} />
              <Route path="credit" element={<Pg><CreditPage /></Pg>} />
              <Route path="health" element={<Pg><HealthPage /></Pg>} />
              <Route path="lp" element={<Pg><LPPage /></Pg>} />
              <Route path="admin" element={<Pg><AdminPage /></Pg>} />
            </Route>
          </Routes>
        </BrowserRouter>
      </QueryProvider>
    </WalletProvider>
  )
}
