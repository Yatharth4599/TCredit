import { Outlet } from 'react-router-dom'
import { Navbar } from './Navbar'
import { Footer } from './Footer'
import { Toaster } from 'react-hot-toast'
import { DevnetBanner } from '../shared/DevnetBanner'

export function PublicLayout() {
  return (
    <div className="min-h-screen bg-[#08080d] text-white flex flex-col">
      <DevnetBanner />
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <Toaster position="bottom-right" toastOptions={{ style: { background: '#111827', color: '#F1F5F9', border: '1px solid #1E293B', borderRadius: '9999px', fontSize: '13px', padding: '10px 20px' } }} />
    </div>
  )
}
