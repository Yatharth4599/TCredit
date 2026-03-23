import { useAgentProfile } from '../../hooks'
import { StatCard, ScoreBadge, LevelBadge, LoadingSpinner } from '../shared'
import { formatUsdc, timeAgo } from '../../lib/utils'

export function AgentCard({ agentPubkey }: { agentPubkey?: string }) {
  const { data: profile, isLoading } = useAgentProfile(agentPubkey)

  if (isLoading) return <div className="flex justify-center py-8"><LoadingSpinner /></div>
  if (!profile) return null

  const nameBytes = profile.name.filter((b: number) => b !== 0)
  const name = new TextDecoder().decode(new Uint8Array(nameBytes))

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">{name || 'Unnamed Agent'}</h3>
          <p className="text-xs text-white/30 font-mono mt-0.5">{profile.agent.toBase58()}</p>
        </div>
        <div className="flex items-center gap-2">
          <LevelBadge level={profile.creditLevel} />
          <ScoreBadge score={profile.creditScore} />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Volume" value={`$${formatUsdc(profile.totalVolume)}`} />
        <StatCard label="Total Trades" value={profile.totalTrades.toString()} />
        <StatCard label="Total Borrowed" value={`$${formatUsdc(profile.totalBorrowed)}`} />
        <StatCard label="Registered" value={timeAgo(profile.registeredAt.toNumber())} />
      </div>
    </div>
  )
}
