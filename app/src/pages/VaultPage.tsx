import { PageHeader } from '../components/layout'
import { VaultOverview } from '../components/lp'

export default function VaultPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Vault Overview" subtitle="Protocol vault stats and tranche breakdown" />
      <VaultOverview />
    </div>
  )
}
