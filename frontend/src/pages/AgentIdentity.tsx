import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { motion } from 'motion/react'
import { identityApi } from '../api/client'
import type { ApiAgentIdentity } from '../api/types'
import { formatUSDC } from '../lib/format'
import { useContractTx } from '../hooks/useContractTx'
import { addressUrl } from '../config/contracts'
import { Shield, Award, TrendingUp, Clock, AlertTriangle, Loader2, ExternalLink, Fingerprint } from 'lucide-react'
import { Skeleton } from '../components/ui/Skeleton'
import styles from './AgentIdentity.module.css'

function getScoreTier(score: number): { label: string; color: string } {
  if (score >= 750) return { label: 'A — Excellent', color: '#22c55e' }
  if (score >= 500) return { label: 'B — Good', color: '#3b82f6' }
  if (score >= 250) return { label: 'C — Fair', color: '#f59e0b' }
  return { label: 'D — Needs Improvement', color: '#ef4444' }
}

export default function AgentIdentity() {
  const { address: paramAddress } = useParams<{ address: string }>()
  const { address: walletAddress } = useAccount()
  const agentAddress = paramAddress ?? walletAddress
  const [identity, setIdentity] = useState<ApiAgentIdentity | null>(null)
  const [loading, setLoading] = useState(true)
  const [minting, setMinting] = useState(false)

  const { execute: executeTx } = useContractTx()

  useEffect(() => {
    if (!agentAddress) { setLoading(false); return }
    setLoading(true)
    identityApi.get(agentAddress)
      .then(({ data }) => setIdentity(data))
      .catch(() => setIdentity(null))
      .finally(() => setLoading(false))
  }, [agentAddress])

  const handleMint = async () => {
    if (!agentAddress) return
    setMinting(true)
    try {
      const { data: tx } = await identityApi.mint({ agent: agentAddress })
      await executeTx(tx)
      const { data } = await identityApi.get(agentAddress)
      setIdentity(data)
    } catch { /* handled */ }
    finally { setMinting(false) }
  }

  if (!agentAddress) {
    return (
      <div className={styles.page}>
        <div className={styles.empty}>
          <Fingerprint size={32} />
          <p>Connect wallet or provide an agent address</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <Skeleton style={{ height: 40, width: 300, borderRadius: 8, marginBottom: 24 }} />
          <Skeleton style={{ height: 300, borderRadius: 16 }} />
        </div>
      </div>
    )
  }

  const tier = identity ? getScoreTier(identity.reputationScore) : null

  return (
    <div className={styles.page}>
      <motion.div className={styles.container} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className={styles.title}>
          <Fingerprint size={24} /> Agent Identity
        </h1>
        <a href={addressUrl(agentAddress)} target="_blank" rel="noopener noreferrer" className={styles.addressLink}>
          {agentAddress} <ExternalLink size={12} />
        </a>

        {!identity?.hasIdentity ? (
          <div className={styles.mintCard}>
            <Shield size={40} className={styles.mintIcon} />
            <h2>No Identity NFT Found</h2>
            <p>Mint a Krexa Soulbound Identity to build on-chain reputation.</p>
            <button className={styles.mintBtn} onClick={handleMint} disabled={minting}>
              {minting ? <Loader2 size={16} className={styles.spin} /> : <Award size={16} />}
              {minting ? 'Minting...' : 'Mint Identity NFT'}
            </button>
          </div>
        ) : (
          <>
            {/* Score Card */}
            <div className={styles.scoreCard}>
              <div className={styles.scoreCircle} style={{ borderColor: tier?.color }}>
                <span className={styles.scoreValue}>{identity.reputationScore}</span>
                <span className={styles.scoreMax}>/1000</span>
              </div>
              <div className={styles.scoreInfo}>
                <span className={styles.tierLabel} style={{ color: tier?.color }}>{tier?.label}</span>
                <span className={styles.tokenId}>Token #{identity.tokenId}</span>
                <span className={styles.soulbound}>Soulbound — Non-transferable</span>
              </div>
            </div>

            {/* Reputation Stats */}
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <TrendingUp size={18} className={styles.statIcon} />
                <span className={styles.statLabel}>Total Transactions</span>
                <span className={styles.statValue}>{identity.reputation.totalTransactions}</span>
              </div>
              <div className={styles.statCard}>
                <Award size={18} className={styles.statIcon} />
                <span className={styles.statLabel}>Total Volume</span>
                <span className={styles.statValue}>{formatUSDC(identity.reputation.totalVolumeUsdc)}</span>
              </div>
              <div className={styles.statCard}>
                <Shield size={18} className={styles.statIcon} />
                <span className={styles.statLabel}>Successful Repayments</span>
                <span className={styles.statValue}>{identity.reputation.successfulRepayments}</span>
              </div>
              <div className={styles.statCard}>
                <AlertTriangle size={18} className={styles.statIcon} />
                <span className={styles.statLabel}>Defaults</span>
                <span className={styles.statValue}>{identity.reputation.defaultCount}</span>
              </div>
              <div className={styles.statCard}>
                <Clock size={18} className={styles.statIcon} />
                <span className={styles.statLabel}>Active Since</span>
                <span className={styles.statValue}>
                  {identity.reputation.firstActiveAt !== '0'
                    ? new Date(Number(identity.reputation.firstActiveAt) * 1000).toLocaleDateString()
                    : 'N/A'}
                </span>
              </div>
            </div>

            {/* Score Breakdown */}
            <div className={styles.breakdownCard}>
              <h3>Score Breakdown</h3>
              <div className={styles.breakdownRow}>
                <span>Volume (40%)</span>
                <div className={styles.bar}><div className={styles.barFill} style={{ width: `${Math.min(Number(identity.reputation.totalVolumeUsdc) / 100_000e6 * 100, 100)}%`, background: '#3b82f6' }} /></div>
              </div>
              <div className={styles.breakdownRow}>
                <span>Repayments (30%)</span>
                <div className={styles.bar}><div className={styles.barFill} style={{ width: `${Math.min(Number(identity.reputation.successfulRepayments) / 50 * 100, 100)}%`, background: '#22c55e' }} /></div>
              </div>
              <div className={styles.breakdownRow}>
                <span>Account Age (20%)</span>
                <div className={styles.bar}><div className={styles.barFill} style={{ width: `${Math.min((Date.now() / 1000 - Number(identity.reputation.firstActiveAt)) / (365 * 86400) * 100, 100)}%`, background: '#8b5cf6' }} /></div>
              </div>
              <div className={styles.breakdownRow}>
                <span>Default Penalty (-10%)</span>
                <div className={styles.bar}><div className={styles.barFill} style={{ width: `${Math.min(Number(identity.reputation.defaultCount) * 20, 100)}%`, background: '#ef4444' }} /></div>
              </div>
            </div>
          </>
        )}
      </motion.div>
    </div>
  )
}
