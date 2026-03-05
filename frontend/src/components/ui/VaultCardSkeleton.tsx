import { Skeleton } from './Skeleton'

const CARD_STYLE: React.CSSProperties = {
  background: 'var(--surface-1)',
  borderRadius: 0,
  padding: 20,
  border: '1px solid rgba(255, 255, 255, 0.06)',
}

function VaultCardSkeletonItem() {
  return (
    <div style={CARD_STYLE}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <Skeleton width={40} height={11} borderRadius={0} style={{ marginBottom: 6 }} />
          <Skeleton width={64} height={28} borderRadius={0} />
        </div>
        <Skeleton width={72} height={22} borderRadius={0} />
      </div>
      <Skeleton width="100%" height={4} borderRadius={0} style={{ marginBottom: 8 }} />
      <Skeleton width={120} height={12} borderRadius={0} style={{ marginBottom: 16 }} />
      <Skeleton width={90} height={34} borderRadius={0} />
    </div>
  )
}

export function VaultCardSkeleton({ count = 6 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <VaultCardSkeletonItem key={i} />
      ))}
    </>
  )
}
