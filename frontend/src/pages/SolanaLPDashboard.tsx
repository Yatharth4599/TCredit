import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useWallet } from '@solana/wallet-adapter-react'
import { vaultApi } from '../api/solanaClient'
import { BentoCard } from '../components/ui/BentoGrid'
import { GlassCard } from '../components/ui/GlassCard'
import { StatWidget } from '../components/ui/StatWidget'
import { AnimatedNumber } from '../components/ui/AnimatedNumber'
import { Skeleton } from '../components/ui/Skeleton'
import SolanaLayout from '../components/layout/SolanaLayout'
import { containerVariants, cardVariants } from '../utils/motionVariants'
import s from './SolanaLPDashboard.module.css'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyData = any

function CardSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height={32} width={i % 2 === 0 ? '70%' : '50%'} />
      ))}
    </div>
  )
}

export default function SolanaLPDashboard() {
  const { publicKey, connected } = useWallet()
  const [address, setAddress]   = useState('')
  const [searched, setSearched] = useState(false)
  const [position, setPosition] = useState<{ data: AnyData; loading: boolean; error: string | null }>({ data: null, loading: false, error: null })
  const [collateral, setCollateral] = useState<{ data: AnyData; loading: boolean; error: string | null }>({ data: null, loading: false, error: null })

  const lookupPosition = useCallback(async (addr: string) => {
    if (!addr.trim()) return
    setSearched(true)
    setPosition({ data: null, loading: true, error: null })
    setCollateral({ data: null, loading: true, error: null })
    try {
      const [posRes, colRes] = await Promise.allSettled([
        vaultApi.getLpPosition(addr.trim()),
        vaultApi.getCollateral(addr.trim()),
      ])
      setPosition(posRes.status === 'fulfilled'
        ? { data: posRes.value.data, loading: false, error: null }
        : { data: null, loading: false, error: posRes.reason?.message ?? 'Failed' })
      setCollateral(colRes.status === 'fulfilled'
        ? { data: colRes.value.data, loading: false, error: null }
        : { data: null, loading: false, error: null })
    } catch (err: unknown) {
      const msg = (err as AnyData)?.response?.data?.message ?? (err instanceof Error ? err.message : 'Request failed')
      setPosition({ data: null, loading: false, error: msg })
    }
  }, [])

  // Auto-load for connected wallet
  useEffect(() => {
    if (connected && publicKey && !searched) {
      const addr = publicKey.toBase58()
      setAddress(addr)
      lookupPosition(addr)
    }
  }, [connected, publicKey, searched, lookupPosition])

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault()
    lookupPosition(address)
  }

  const pos = position.data

  return (
    <SolanaLayout
      title="LP Dashboard"
      subtitle="View your liquidity position in the Krexa credit vault."
      dataLoaded={!!(pos?.hasPosition)}
    >
      <motion.div variants={containerVariants} initial="hidden" animate="visible">

        {/* ── Wallet Lookup ── */}
        <motion.div variants={cardVariants} style={{ marginBottom: 16 }}>
          <GlassCard variant="highlight">
            <form onSubmit={handleLookup} className={s.searchInner}>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={connected ? 'Connected — or paste another pubkey...' : 'Enter LP wallet address (Solana pubkey)...'}
                className={s.searchInput}
                spellCheck={false}
              />
              <button
                type="submit"
                disabled={!address.trim()}
                className="btn-primary"
                style={{ borderRadius: 'var(--radius-lg)', padding: '14px 28px' }}
              >
                Lookup
              </button>
            </form>
          </GlassCard>
        </motion.div>

        {/* ── Empty state ── */}
        <AnimatePresence>
          {!searched && (
            <motion.div
              className={s.emptyState}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            >
              <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="1.2">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
              </svg>
              <p className={s.emptyText}>Enter a wallet address to view your LP position</p>
              <p className={s.emptyHint}>Deposits are held in the single Krexa credit vault on Solana devnet</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Loading ── */}
        {position.loading && (
          <motion.div variants={cardVariants} style={{ marginBottom: 16 }}>
            <GlassCard><CardSkeleton rows={5} /></GlassCard>
          </motion.div>
        )}

        {/* ── Error ── */}
        {position.error && (
          <motion.div variants={cardVariants} style={{ marginBottom: 16 }}>
            <GlassCard>
              <p style={{ color: 'var(--color-error)', fontSize: 13 }}>{position.error}</p>
            </GlassCard>
          </motion.div>
        )}

        {/* ── Position ── */}
        {pos && (
          pos.hasPosition ? (
            <motion.div variants={cardVariants}>
              <BentoCard glowColor="6, 182, 212" style={{ display: 'block' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                  <p className={s.cardTitle} style={{ marginBottom: 0 }}>Vault Position</p>
                  {pos.isCollateral && (
                    <span style={{
                      padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                      background: 'rgba(139,92,246,0.12)', color: '#8B5CF6',
                      border: '1px solid rgba(139,92,246,0.2)',
                    }}>
                      Collateral
                    </span>
                  )}
                </div>

                <div className={s.stats4}>
                  <StatWidget
                    label="Deposited"
                    value={<AnimatedNumber value={Number(pos.depositedUsdc ?? 0)} decimals={2} prefix="$" /> as unknown as string}
                  />
                  <StatWidget
                    label="Current Value"
                    value={<AnimatedNumber value={Number(pos.currentValueUsdc ?? 0)} decimals={2} prefix="$" /> as unknown as string}
                  />
                  <StatWidget
                    label="Yield Earned"
                    value={<AnimatedNumber value={Number(pos.yieldEarnedUsdc ?? 0)} decimals={2} prefix="$" /> as unknown as string}
                    trend="up"
                  />
                  <StatWidget
                    label="Shares"
                    value={<AnimatedNumber value={Number(pos.shares ?? 0) / 1e6} decimals={4} /> as unknown as string}
                  />
                </div>

                <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-dim)' }}>
                  Deposited {pos.depositTimestamp ? new Date(pos.depositTimestamp).toLocaleDateString() : '—'}
                </div>
              </BentoCard>
            </motion.div>
          ) : (
            <motion.div variants={cardVariants}>
              <GlassCard>
                <p style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '32px 0', fontSize: 14 }}>
                  No LP position found for this wallet on Solana devnet.
                </p>
              </GlassCard>
            </motion.div>
          )
        )}

        {/* ── Collateral Position ── */}
        {collateral.data?.hasCollateral && (
          <motion.div variants={cardVariants} style={{ marginTop: 16 }}>
            <BentoCard glowColor="139, 92, 246" style={{ display: 'block' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <p className={s.cardTitle} style={{ marginBottom: 0 }}>Agent Collateral</p>
                <span style={{
                  padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                  background: 'rgba(139,92,246,0.12)', color: '#8B5CF6',
                  border: '1px solid rgba(139,92,246,0.2)',
                }}>
                  Locked
                </span>
              </div>
              <div className={s.stats4}>
                <StatWidget
                  label="Deposited"
                  value={<AnimatedNumber value={Number(collateral.data.depositedAmount ?? 0) / 1e6} decimals={2} prefix="$" /> as unknown as string}
                />
                <StatWidget
                  label="Current Value"
                  value={<AnimatedNumber value={Number(collateral.data.currentValueUsdc ?? 0)} decimals={2} prefix="$" /> as unknown as string}
                />
                <StatWidget
                  label="Shares"
                  value={<AnimatedNumber value={Number(collateral.data.shares ?? 0) / 1e6} decimals={4} /> as unknown as string}
                />
                <StatWidget
                  label="Deposited On"
                  value={collateral.data.depositTimestamp ? new Date(collateral.data.depositTimestamp).toLocaleDateString() : '—'}
                />
              </div>
            </BentoCard>
          </motion.div>
        )}

      </motion.div>
    </SolanaLayout>
  )
}
