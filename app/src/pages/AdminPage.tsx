import { useIsAdmin } from '../hooks'
import { PageHeader } from '../components/layout'
import { ProtocolStats } from '../components/admin'
import { EmptyState } from '../components/shared'
import { Settings } from 'lucide-react'

export default function AdminPage() {
  const isAdmin = useIsAdmin()

  if (!isAdmin) {
    return (
      <EmptyState
        icon={<Settings size={48} />}
        title="Access Denied"
        description="Your wallet is not authorized for admin access."
      />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Admin Panel" subtitle="Protocol administration and monitoring" />
      <ProtocolStats />
    </div>
  )
}
