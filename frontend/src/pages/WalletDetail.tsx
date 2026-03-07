import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { motion } from 'motion/react'
import { walletsApi } from '../api/client'
import type { ApiAgentWallet } from '../api/types'
import { formatUSDC, truncateAddress } from '../lib/format'
import { useContractTx } from '../hooks/useContractTx'
import { addressUrl } from '../config/contracts'
import { Shield, ShieldOff, Snowflake, Sun, Settings, Loader2, ExternalLink } from 'lucide-react'
import { Skeleton } from '../components/ui/Skeleton'
import styles from './WalletDetail.module.css'

export default function WalletDetail() {
  const { address } = useParams<{ address: string }>()
  const { address: walletAddress } = useAccount()
  const [wallet, setWallet] = useState<ApiAgentWallet | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState('')

  // Edit state
  const [editLimits, setEditLimits] = useState(false)
  const [dailyInput, setDailyInput] = useState('')
  const [perTxInput, setPerTxInput] = useState('')
  const [operatorInput, setOperatorInput] = useState('')
  const [editOperator, setEditOperator] = useState(false)

  const { execute: executeTx } = useContractTx()

  const isOwner = wallet && walletAddress && wallet.owner.toLowerCase() === walletAddress.toLowerCase()

  useEffect(() => {
    if (!address) return
    setLoading(true)
    walletsApi.detail(address)
      .then(({ data }) => setWallet(data))
      .catch(() => setWallet(null))
      .finally(() => setLoading(false))
  }, [address])

  const handleFreeze = async () => {
    if (!address || !wallet) return
    setActionLoading('freeze')
    try {
      const { data: tx } = wallet.frozen
        ? await walletsApi.unfreeze(address)
        : await walletsApi.freeze(address)
      await executeTx(tx)
      const { data } = await walletsApi.detail(address)
      setWallet(data)
    } catch { /* handled */ }
    finally { setActionLoading('') }
  }

  const handleSetLimits = async () => {
    if (!address) return
    setActionLoading('limits')
    try {
      const { data: tx } = await walletsApi.setLimits(address, {
        dailyLimitUsdc: dailyInput,
        perTxLimitUsdc: perTxInput,
      })
      await executeTx(tx)
      setEditLimits(false)
      const { data } = await walletsApi.detail(address)
      setWallet(data)
    } catch { /* handled */ }
    finally { setActionLoading('') }
  }

  const handleSetOperator = async () => {
    if (!address || !operatorInput) return
    setActionLoading('operator')
    try {
      const { data: tx } = await walletsApi.setOperator(address, { operator: operatorInput })
      await executeTx(tx)
      setEditOperator(false)
      const { data } = await walletsApi.detail(address)
      setWallet(data)
    } catch { /* handled */ }
    finally { setActionLoading('') }
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <Skeleton style={{ height: 40, width: 300, borderRadius: 8, marginBottom: 24 }} />
          <Skeleton style={{ height: 200, borderRadius: 16 }} />
        </div>
      </div>
    )
  }

  if (!wallet) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', paddingTop: 100 }}>Wallet not found</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <motion.div className={styles.container} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>
              {wallet.frozen ? <ShieldOff size={24} className={styles.frozenIcon} /> : <Shield size={24} className={styles.activeIcon} />}
              Agent Wallet
            </h1>
            <a href={addressUrl(wallet.address)} target="_blank" rel="noopener noreferrer" className={styles.addressLink}>
              {wallet.address} <ExternalLink size={12} />
            </a>
          </div>
          {isOwner && (
            <button className={styles.freezeBtn} onClick={handleFreeze} disabled={actionLoading === 'freeze'}>
              {actionLoading === 'freeze' ? <Loader2 size={14} className={styles.spin} /> : wallet.frozen ? <Sun size={14} /> : <Snowflake size={14} />}
              {wallet.frozen ? 'Unfreeze' : 'Freeze'}
            </button>
          )}
        </div>

        {/* Stats Grid */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Owner</span>
            <span className={styles.statVal}>{truncateAddress(wallet.owner, 6)}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Operator</span>
            <span className={styles.statVal}>{truncateAddress(wallet.operator, 6)}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Daily Limit</span>
            <span className={styles.statVal}>{formatUSDC(wallet.dailyLimit)}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Per-Tx Limit</span>
            <span className={styles.statVal}>{formatUSDC(wallet.perTxLimit)}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Spent Today</span>
            <span className={styles.statVal}>{formatUSDC(wallet.spentToday)}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Remaining Today</span>
            <span className={styles.statVal}>{formatUSDC(wallet.remainingDaily)}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Whitelist</span>
            <span className={styles.statVal}>{wallet.whitelistEnabled ? 'Enabled' : 'Disabled'}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Credit Vault</span>
            <span className={styles.statVal}>{wallet.creditVault === '0x0000000000000000000000000000000000000000' ? 'None' : truncateAddress(wallet.creditVault)}</span>
          </div>
        </div>

        {/* Owner Actions */}
        {isOwner && (
          <div className={styles.actions}>
            <h2 className={styles.sectionTitle}><Settings size={16} /> Manage Wallet</h2>

            {/* Edit Limits */}
            <div className={styles.actionCard}>
              <div className={styles.actionHeader}>
                <span>Spending Limits</span>
                <button className={styles.editBtn} onClick={() => { setEditLimits(!editLimits); setDailyInput(''); setPerTxInput('') }}>
                  {editLimits ? 'Cancel' : 'Edit'}
                </button>
              </div>
              {editLimits && (
                <div className={styles.actionForm}>
                  <div className={styles.formRow}>
                    <input value={dailyInput} onChange={e => setDailyInput(e.target.value)} placeholder="Daily limit (USDC)" type="number" className={styles.input} />
                    <input value={perTxInput} onChange={e => setPerTxInput(e.target.value)} placeholder="Per-tx limit (USDC)" type="number" className={styles.input} />
                  </div>
                  <button className={styles.actionSubmit} onClick={handleSetLimits} disabled={actionLoading === 'limits'}>
                    {actionLoading === 'limits' ? <Loader2 size={14} className={styles.spin} /> : null}
                    Update Limits
                  </button>
                </div>
              )}
            </div>

            {/* Edit Operator */}
            <div className={styles.actionCard}>
              <div className={styles.actionHeader}>
                <span>Operator</span>
                <button className={styles.editBtn} onClick={() => { setEditOperator(!editOperator); setOperatorInput('') }}>
                  {editOperator ? 'Cancel' : 'Change'}
                </button>
              </div>
              {editOperator && (
                <div className={styles.actionForm}>
                  <input value={operatorInput} onChange={e => setOperatorInput(e.target.value)} placeholder="New operator address (0x...)" className={styles.input} />
                  <button className={styles.actionSubmit} onClick={handleSetOperator} disabled={actionLoading === 'operator' || !operatorInput}>
                    {actionLoading === 'operator' ? <Loader2 size={14} className={styles.spin} /> : null}
                    Update Operator
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}
