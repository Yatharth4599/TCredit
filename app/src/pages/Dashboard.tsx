import { useWallet } from '@solana/wallet-adapter-react'
import { PageHeader } from '../components/layout'
import { AgentCard, HealthIndicator, CreditLineCard, WalletCard } from '../components/agent'
import { EmptyState } from '../components/shared'
import { Wallet } from 'lucide-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'

export default function Dashboard() {
  const { connected, publicKey } = useWallet()

  if (!connected) {
    return (
      <EmptyState
        icon={<Wallet size={48} />}
        title="Connect your wallet"
        description="Connect a Solana wallet to view your agent dashboard."
        action={
          <div className="[&_button]:!rounded-lg [&_button]:!bg-blue-600 [&_button]:!border-0">
            <WalletMultiButton />
          </div>
        }
      />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agent Dashboard"
        subtitle={`Connected: ${publicKey?.toBase58()}`}
      />
      <AgentCard />
      <div className="grid grid-cols-2 gap-6">
        <HealthIndicator />
        <CreditLineCard />
      </div>
      <WalletCard />
    </div>
  )
}
