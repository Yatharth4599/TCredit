import { useWallet } from '@solana/wallet-adapter-react'
import { PageHeader } from '../components/layout'
import { HealthIndicator } from '../components/agent'
import { EmptyState } from '../components/shared'
import { Shield } from 'lucide-react'

export default function HealthPage() {
  const { connected } = useWallet()

  if (!connected) {
    return (
      <EmptyState
        icon={<Shield size={48} />}
        title="Connect your wallet"
        description="Connect a Solana wallet to monitor your health factor."
      />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Health Monitor" subtitle="Real-time health factor tracking" />
      <HealthIndicator />
    </div>
  )
}
