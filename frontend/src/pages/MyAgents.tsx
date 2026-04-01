import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { walletApi } from '../api/solanaClient'
import styles from './MyAgents.module.css'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CREDIT_LEVEL_LABELS: Record<number, string> = {
  0: 'KYA Only',
  1: 'Starter ($500)',
  2: 'Established ($20K)',
  3: 'Trusted ($50K)',
  4: 'Elite ($500K)',
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AgentWallet {
  agentPubkey: string
  ownerPubkey: string
  ownerType: 'eoa' | 'multisig'
  pendingOwner: string | null
  creditLevel: number
  healthFactorBps: number
  isFrozen: boolean
  isLiquidating: boolean
  creditDrawn: string
}

interface WalletApiResponse {
  wallets: AgentWallet[]
  total: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncatePubkey(pubkey: string): string {
  if (pubkey.length <= 14) return pubkey
  return `${pubkey.slice(0, 8)}...${pubkey.slice(-4)}`
}

function formatUsdc(raw: string): string {
  const val = Number(raw) / 1e6
  return val.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function formatHealthFactor(bps: number): string {
  return (bps / 10000).toFixed(3) + 'x'
}

interface HealthZone {
  label: string
  textClass: string
  bgClass: string
  dotColor: string
}

function getHealthZone(bps: number): HealthZone {
  if (bps >= 15000) {
    return {
      label: 'Healthy',
      textClass: styles.healthHealthy,
      bgClass: styles.badgeHealthy,
      dotColor: '#22c55e',
    }
  }
  if (bps >= 13000) {
    return {
      label: 'Warning',
      textClass: styles.healthWarning,
      bgClass: styles.badgeWarning,
      dotColor: '#eab308',
    }
  }
  if (bps >= 12000) {
    return {
      label: 'Danger',
      textClass: styles.healthDanger,
      bgClass: styles.badgeDanger,
      dotColor: '#f97316',
    }
  }
  return {
    label: 'Liquidation Risk',
    textClass: styles.healthLiquidation,
    bgClass: styles.badgeLiquidation,
    dotColor: '#ef4444',
  }
}

// ---------------------------------------------------------------------------
// Skeleton card
// ---------------------------------------------------------------------------

function SkeletonCard() {
  return (
    <div className={styles.skeletonCard}>
      <div className={`${styles.skeletonLine} ${styles.skeletonLineWide}`} />
      <div className={`${styles.skeletonLine} ${styles.skeletonLineShort}`} />
      <div className={`${styles.skeletonLine} ${styles.skeletonLineMedium}`} />
      <div className={`${styles.skeletonLine} ${styles.skeletonLineShort}`} />
      <div className={`${styles.skeletonLine} ${styles.skeletonLineButton}`} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Agent card
// ---------------------------------------------------------------------------

function AgentCard({ agent, onViewDashboard }: { agent: AgentWallet; onViewDashboard: (pubkey: string) => void }) {
  const zone = getHealthZone(agent.healthFactorBps)
  const levelLabel = CREDIT_LEVEL_LABELS[agent.creditLevel] ?? `L${agent.creditLevel}`
  const creditDrawnFormatted = formatUsdc(agent.creditDrawn)
  const healthFormatted = formatHealthFactor(agent.healthFactorBps)

  return (
    <div className={styles.agentCard}>
      {/* Top row: pubkey + health badge */}
      <div className={styles.cardTopRow}>
        <span className={styles.pubkeyLabel}>{truncatePubkey(agent.agentPubkey)}</span>
        <span className={`${styles.healthBadge} ${zone.bgClass}`}>{zone.label}</span>
      </div>

      {/* Credit level badge */}
      <div className={styles.levelRow}>
        <span className={styles.levelBadge}>
          L{agent.creditLevel} — {levelLabel}
        </span>
        {agent.ownerType === 'multisig' && (
          <span className={styles.multisigBadge}>MULTISIG</span>
        )}
      </div>

      {/* Credit drawn */}
      <div className={styles.drawnRow}>
        <span className={styles.drawnLabel}>DRAWN</span>
        <span className={styles.drawnValue}>{creditDrawnFormatted}</span>
      </div>

      {/* Health factor */}
      <div className={styles.healthRow}>
        <span className={styles.healthLabel}>HEALTH</span>
        <div className={styles.healthRight}>
          <span
            className={`${styles.healthValue} ${zone.textClass}`}
          >
            {healthFormatted}
          </span>
          <span
            className={styles.healthDot}
            style={{ backgroundColor: zone.dotColor }}
          />
        </div>
      </div>

      {/* Status flags */}
      {(agent.isFrozen || agent.isLiquidating) && (
        <div className={styles.statusFlags}>
          {agent.isFrozen && <span className={styles.frozenBadge}>FROZEN</span>}
          {agent.isLiquidating && <span className={styles.liquidatingBadge}>LIQUIDATING</span>}
        </div>
      )}

      {/* Pending owner notice */}
      {agent.pendingOwner && (
        <div className={styles.pendingOwnerRow}>
          <span className={styles.pendingOwnerLabel}>PENDING TRANSFER</span>
          <span className={styles.pendingOwnerValue}>{truncatePubkey(agent.pendingOwner)}</span>
        </div>
      )}

      {/* View dashboard button */}
      <button
        className={styles.viewButton}
        onClick={() => onViewDashboard(agent.agentPubkey)}
        type="button"
      >
        VIEW FULL DASHBOARD →
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function MyAgents() {
  const navigate = useNavigate()
  const [ownerInput, setOwnerInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<WalletApiResponse | null>(null)
  const [searched, setSearched] = useState(false)

  const handleLookup = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    const pubkey = ownerInput.trim()
    if (!pubkey) return

    setSearched(true)
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await walletApi.getByOwner(pubkey, 50)
      setResult(res.data as WalletApiResponse)
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Request failed. Check the pubkey and try again.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [ownerInput])

  const handleViewDashboard = useCallback((agentPubkey: string) => {
    navigate(`/app/solana/credit?agent=${agentPubkey}`)
  }, [navigate])

  const agents = result?.wallets ?? []

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* ---- Header ---- */}
        <div className={styles.header}>
          <span className={styles.deployerTag}>DEPLOYER VIEW</span>
          <h1 className={styles.heading}>MY AGENTS</h1>
          <p className={styles.subtitle}>
            Track all agents you own. Enter your Solana owner pubkey to see your portfolio.
          </p>
        </div>

        {/* ---- Search form ---- */}
        <form className={styles.searchForm} onSubmit={handleLookup}>
          <input
            className={styles.searchInput}
            type="text"
            value={ownerInput}
            onChange={(e) => setOwnerInput(e.target.value)}
            placeholder="Solana owner pubkey (e.g. 7xKXtg...)"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            className={styles.searchButton}
            type="submit"
            disabled={!ownerInput.trim() || loading}
          >
            {loading ? 'SEARCHING...' : 'LOOKUP AGENTS →'}
          </button>
        </form>

        {/* ---- Initial empty state (before any search) ---- */}
        {!searched && (
          <div className={styles.emptyState}>
            <p className={styles.emptyStateText}>
              Enter your Solana owner pubkey above to view all agents in your portfolio.
            </p>
          </div>
        )}

        {/* ---- Loading skeletons ---- */}
        {searched && loading && (
          <div className={styles.skeletonGrid}>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {/* ---- Error banner ---- */}
        {searched && !loading && error && (
          <div className={styles.errorBanner}>
            <span className={styles.errorLabel}>ERROR</span>
            <span>{error}</span>
          </div>
        )}

        {/* ---- No results ---- */}
        {searched && !loading && !error && result && agents.length === 0 && (
          <div className={styles.noResults}>
            <p className={styles.noResultsText}>
              No agents found for this owner. Deploy your first agent on Krexa.
            </p>
          </div>
        )}

        {/* ---- Results ---- */}
        {searched && !loading && !error && agents.length > 0 && (
          <>
            <div className={styles.resultsHeader}>
              <span className={styles.resultsCount}>
                FOUND {result?.total ?? agents.length} AGENT{(result?.total ?? agents.length) !== 1 ? 'S' : ''}
              </span>
              {result?.total != null && result.total > agents.length && (
                <span className={styles.resultsTruncated}>
                  Showing first {agents.length}
                </span>
              )}
            </div>
            <div className={styles.agentGrid}>
              {agents.map((agent) => (
                <AgentCard
                  key={agent.agentPubkey}
                  agent={agent}
                  onViewDashboard={handleViewDashboard}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
