import { Skeleton } from './Skeleton'

export function PortfolioSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Stats row skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ padding: '28px 24px', background: 'var(--surface-1)', borderRadius: 0 }}>
            <Skeleton width={100} height={28} borderRadius={0} style={{ marginBottom: 8 }} />
            <Skeleton width={70} height={11} borderRadius={0} />
          </div>
        ))}
      </div>
      {/* Investments list skeleton */}
      <div style={{ background: 'var(--surface-1)', borderRadius: 0, border: '1px solid rgba(255,255,255,0.06)', padding: 24 }}>
        <Skeleton width={120} height={13} borderRadius={0} style={{ marginBottom: 20 }} />
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div>
              <Skeleton width={140} height={13} borderRadius={0} style={{ marginBottom: 8 }} />
              <Skeleton width={100} height={11} borderRadius={0} />
            </div>
            <div style={{ textAlign: 'right' }}>
              <Skeleton width={80} height={16} borderRadius={0} style={{ marginBottom: 6 }} />
              <Skeleton width={60} height={11} borderRadius={0} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
