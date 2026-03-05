import { Skeleton } from './Skeleton'

export function StatRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${count}, 1fr)`, gap: 2 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            background: 'var(--surface-1)',
            borderRadius: 0,
            padding: '28px 24px',
            border: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          <Skeleton width={100} height={24} borderRadius={0} style={{ marginBottom: 8 }} />
          <Skeleton width={80} height={11} borderRadius={0} />
        </div>
      ))}
    </div>
  )
}
