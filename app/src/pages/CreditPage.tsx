import { useWallet } from '@solana/wallet-adapter-react'
import { PageHeader } from '../components/layout'
import { CreditLineCard } from '../components/agent'
import { EmptyState } from '../components/shared'
import { TrendingUp } from 'lucide-react'

export default function CreditPage() {
  const { connected } = useWallet()

  if (!connected) {
    return (
      <EmptyState
        icon={<TrendingUp size={48} />}
        title="Connect your wallet"
        description="Connect a Solana wallet to view your credit line."
      />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Credit Line" subtitle="Your active credit line and terms" />
      <CreditLineCard />
    </div>
  )
}
