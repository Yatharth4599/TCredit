import { useWallet } from '@solana/wallet-adapter-react'
import { PageHeader } from '../components/layout'
import { PositionCard } from '../components/lp'
import { useLPPositions } from '../hooks'
import { EmptyState, LoadingSpinner } from '../components/shared'
import { Layers } from 'lucide-react'

export default function LPPage() {
  const { connected } = useWallet()
  const { data: positions, isLoading } = useLPPositions()

  if (!connected) {
    return (
      <EmptyState
        icon={<Layers size={48} />}
        title="Connect your wallet"
        description="Connect a Solana wallet to view your LP positions."
      />
    )
  }

  if (isLoading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>

  const positionEntries = positions ? Array.from(positions.values()) : []

  return (
    <div className="space-y-6">
      <PageHeader title="LP Positions" subtitle="Your liquidity positions across tranches" />
      {positionEntries.length > 0 ? (
        <div className="space-y-4">
          {positionEntries.map((pos, i) => (
            <PositionCard key={i} position={pos} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No positions"
          description="You don't have any LP positions yet."
        />
      )}
    </div>
  )
}
