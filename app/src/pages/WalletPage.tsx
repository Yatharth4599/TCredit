import { useWallet } from '@solana/wallet-adapter-react'
import { PageHeader } from '../components/layout'
import { WalletCard } from '../components/agent'
import { EmptyState } from '../components/shared'
import { Wallet } from 'lucide-react'

export default function WalletPage() {
  const { connected } = useWallet()

  if (!connected) {
    return (
      <EmptyState
        icon={<Wallet size={48} />}
        title="Connect your wallet"
        description="Connect a Solana wallet to view wallet details."
      />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Agent Wallet" subtitle="Manage your agent wallet and spending limits" />
      <WalletCard />
    </div>
  )
}
