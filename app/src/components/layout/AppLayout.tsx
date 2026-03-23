import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Toaster } from 'react-hot-toast'

export function AppLayout() {
  return (
    <div className="min-h-screen bg-[#08080d] text-white">
      <Sidebar />
      <main className="ml-60 p-8">
        <Outlet />
      </main>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#111827',
            color: '#F1F5F9',
            border: '1px solid #1E293B',
            borderRadius: '9999px',
            fontSize: '13px',
            padding: '10px 20px',
          },
        }}
      />
    </div>
  )
}
