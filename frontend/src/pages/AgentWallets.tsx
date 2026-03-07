import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { motion, AnimatePresence } from 'motion/react'
import { walletsApi } from '../api/client'
import type { ApiAgentWallet } from '../api/types'
import { formatUSDC, truncateAddress } from '../lib/format'
import { useContractTx } from '../hooks/useContractTx'
import { Wallet, Plus, Shield, ShieldOff, Loader2, ChevronRight } from 'lucide-react'
import { Skeleton } from '../components/ui/Skeleton'
import styles from './AgentWallets.module.css'

export default function AgentWallets() {
  const navigate = useNavigate()
  const { address: walletAddress } = useAccount()
  const [wallets, setWallets] = useState<ApiAgentWallet[]>([])
  const [myWallet, setMyWallet] = useState<ApiAgentWallet | null>(null)
  const [loading, setLoading] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [operatorInput, setOperatorInput] = useState('')
  const [dailyInput, setDailyInput] = useState('1000')
  const [perTxInput, setPerTxInput] = useState('200')
  const [creating, setCreating] = useState(false)

  const { execute: executeTx } = useContractTx()

  useEffect(() => {
    setLoading(true)
    const promises: Promise<void>[] = [
      walletsApi.list()
        .then(({ data }) => setWallets(data?.wallets ?? []))
        .catch(() => setWallets([])),
    ]
    if (walletAddress) {
      promises.push(
        walletsApi.byOwner(walletAddress)
          .then(({ data }) => setMyWallet(data))
          .catch(() => setMyWallet(null))
      )
    }
    Promise.all(promises).finally(() => setLoading(false))
  }, [walletAddress])

  const handleCreate = async () => {
    if (!operatorInput) return
    setCreating(true)
    try {
      const { data: tx } = await walletsApi.create({
        operator: operatorInput,
        dailyLimitUsdc: dailyInput,
        perTxLimitUsdc: perTxInput,
      })
      await executeTx(tx)
      setShowCreate(false)
      // Refresh
      if (walletAddress) {
        const { data } = await walletsApi.byOwner(walletAddress)
        setMyWallet(data)
      }
    } catch { /* toast handled by useContractTx */ }
    finally { setCreating(false) }
  }

  return (
    <div className={styles.page}>
      <motion.div className={styles.container} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Agent Wallets</h1>
            <p className={styles.subtitle}>Human-controlled, AI-operated smart wallets with spending limits</p>
          </div>
          {walletAddress && !myWallet && (
            <button className={styles.createBtn} onClick={() => setShowCreate(true)}>
              <Plus size={16} /> Create Wallet
            </button>
          )}
        </div>

        {/* My Wallet Card */}
        {myWallet && (
          <div className={styles.myWallet}>
            <div className={styles.myWalletHeader}>
              <Wallet size={20} />
              <span>My Agent Wallet</span>
              {myWallet.frozen && <span className={styles.frozenBadge}>Frozen</span>}
            </div>
            <div className={styles.myWalletAddress} onClick={() => navigate(`/app/wallets/${myWallet.address}`)}>
              {truncateAddress(myWallet.address, 8)}
              <ChevronRight size={16} />
            </div>
            <div className={styles.myWalletStats}>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Daily Limit</span>
                <span className={styles.statValue}>{formatUSDC(myWallet.dailyLimit)}</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Per-Tx Limit</span>
                <span className={styles.statValue}>{formatUSDC(myWallet.perTxLimit)}</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Remaining Today</span>
                <span className={styles.statValue}>{formatUSDC(myWallet.remainingDaily)}</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Operator</span>
                <span className={styles.statValue}>{truncateAddress(myWallet.operator)}</span>
              </div>
            </div>
          </div>
        )}

        {/* All Wallets */}
        <h2 className={styles.sectionTitle}>All Wallets ({wallets.length})</h2>
        {loading ? (
          <div className={styles.grid}>
            {[1, 2, 3].map(i => <Skeleton key={i} style={{ height: 160, borderRadius: 16 }} />)}
          </div>
        ) : wallets.length === 0 ? (
          <div className={styles.empty}>
            <Shield size={32} />
            <p>No wallets created yet</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {wallets.map(w => (
              <motion.div
                key={w.address}
                className={styles.card}
                whileHover={{ y: -2 }}
                onClick={() => navigate(`/app/wallets/${w.address}`)}
              >
                <div className={styles.cardHeader}>
                  <span className={styles.cardAddr}>{truncateAddress(w.address, 6)}</span>
                  {w.frozen ? (
                    <ShieldOff size={16} className={styles.frozenIcon} />
                  ) : (
                    <Shield size={16} className={styles.activeIcon} />
                  )}
                </div>
                <div className={styles.cardRow}>
                  <span>Owner</span>
                  <span>{truncateAddress(w.owner)}</span>
                </div>
                <div className={styles.cardRow}>
                  <span>Daily Limit</span>
                  <span>{formatUSDC(w.dailyLimit)}</span>
                </div>
                <div className={styles.cardRow}>
                  <span>Remaining</span>
                  <span>{formatUSDC(w.remainingDaily)}</span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div className={styles.overlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCreate(false)}>
            <motion.div className={styles.modal} initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={e => e.stopPropagation()}>
              <h3 className={styles.modalTitle}>Create Agent Wallet</h3>
              <div className={styles.formGroup}>
                <label>Operator (AI Agent) Address</label>
                <input value={operatorInput} onChange={e => setOperatorInput(e.target.value)} placeholder="0x..." className={styles.input} />
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Daily Limit (USDC)</label>
                  <input value={dailyInput} onChange={e => setDailyInput(e.target.value)} type="number" className={styles.input} />
                </div>
                <div className={styles.formGroup}>
                  <label>Per-Tx Limit (USDC)</label>
                  <input value={perTxInput} onChange={e => setPerTxInput(e.target.value)} type="number" className={styles.input} />
                </div>
              </div>
              <button className={styles.submitBtn} onClick={handleCreate} disabled={creating || !operatorInput}>
                {creating ? <Loader2 size={16} className={styles.spin} /> : null}
                {creating ? 'Creating...' : 'Create Wallet'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
