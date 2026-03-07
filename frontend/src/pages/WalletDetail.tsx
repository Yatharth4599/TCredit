import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { parseUnits } from 'viem'
import { motion } from 'motion/react'
import { walletsApi, vaultsApi } from '../api/client'
import type { ApiAgentWallet } from '../api/types'
import { formatUSDC, truncateAddress } from '../lib/format'
import { useContractTx } from '../hooks/useContractTx'
import { useUSDCApproval } from '../hooks/useUSDCApproval'
import { addressUrl, txUrl } from '../config/contracts'
import {
  Shield, ShieldOff, Snowflake, Sun, Settings, Loader2, ExternalLink,
  Send, Download, AlertTriangle, List, Link2, DollarSign, ToggleLeft, ToggleRight, Plus, Minus,
} from 'lucide-react'
import { Skeleton } from '../components/ui/Skeleton'
import styles from './WalletDetail.module.css'

interface TransferEvent {
  to: string
  amount: string
  blockNumber: string
  txHash: string
}

export default function WalletDetail() {
  const { address } = useParams<{ address: string }>()
  const { address: walletAddress } = useAccount()
  const [wallet, setWallet] = useState<ApiAgentWallet | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState('')

  // Balance
  const [balance, setBalance] = useState<string | null>(null)

  // Edit state
  const [editLimits, setEditLimits] = useState(false)
  const [dailyInput, setDailyInput] = useState('')
  const [perTxInput, setPerTxInput] = useState('')
  const [operatorInput, setOperatorInput] = useState('')
  const [editOperator, setEditOperator] = useState(false)

  // Transfer state
  const [showTransfer, setShowTransfer] = useState(false)
  const [transferTo, setTransferTo] = useState('')
  const [transferAmount, setTransferAmount] = useState('')

  // Deposit state
  const [showDeposit, setShowDeposit] = useState(false)
  const [depositAmount, setDepositAmount] = useState('')

  // Whitelist state
  const [whitelistAddr, setWhitelistAddr] = useState('')

  // Emergency withdraw state
  const [showEmergency, setShowEmergency] = useState(false)
  const [emergencyTo, setEmergencyTo] = useState('')

  // Credit vault state
  const [showLinkCredit, setShowLinkCredit] = useState(false)
  const [creditVaultInput, setCreditVaultInput] = useState('')
  const [creditVaultAgent, setCreditVaultAgent] = useState('')

  // Transaction history
  const [history, setHistory] = useState<TransferEvent[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const { execute: executeTx } = useContractTx()
  const { approve, needsApproval, isApproving } = useUSDCApproval(address ?? '')

  const isOwner = wallet && walletAddress && wallet.owner.toLowerCase() === walletAddress.toLowerCase()
  const isOperator = wallet && walletAddress && wallet.operator.toLowerCase() === walletAddress.toLowerCase()

  useEffect(() => {
    if (!address) return
    setLoading(true)
    Promise.all([
      walletsApi.detail(address).then(({ data }) => setWallet(data)).catch(() => setWallet(null)),
      walletsApi.balance(address).then(({ data }) => setBalance(data.balanceUsdc)).catch(() => setBalance(null)),
    ]).finally(() => setLoading(false))
  }, [address])

  // Load history
  useEffect(() => {
    if (!address) return
    setHistoryLoading(true)
    walletsApi.history(address)
      .then(({ data }) => setHistory(data.events))
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false))
  }, [address])

  const refreshWallet = async () => {
    if (!address) return
    const [{ data: w }, { data: b }] = await Promise.all([
      walletsApi.detail(address),
      walletsApi.balance(address),
    ])
    setWallet(w)
    setBalance(b.balanceUsdc)
  }

  const handleFreeze = async () => {
    if (!address || !wallet) return
    setActionLoading('freeze')
    try {
      const { data: tx } = wallet.frozen
        ? await walletsApi.unfreeze(address)
        : await walletsApi.freeze(address)
      await executeTx(tx)
      await refreshWallet()
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
      await refreshWallet()
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
      await refreshWallet()
    } catch { /* handled */ }
    finally { setActionLoading('') }
  }

  const handleTransfer = async () => {
    if (!address || !transferTo || !transferAmount) return
    setActionLoading('transfer')
    try {
      const { data: tx } = await walletsApi.transfer(address, { to: transferTo, amountUsdc: transferAmount })
      await executeTx(tx)
      setShowTransfer(false)
      setTransferTo('')
      setTransferAmount('')
      await refreshWallet()
      // Reload history
      walletsApi.history(address).then(({ data }) => setHistory(data.events)).catch(() => {})
    } catch { /* handled */ }
    finally { setActionLoading('') }
  }

  const handleDeposit = async () => {
    if (!address || !depositAmount) return
    setActionLoading('deposit')
    try {
      const amount = parseUnits(depositAmount, 6)
      if (needsApproval(amount)) {
        const approved = await approve(amount)
        if (!approved) { setActionLoading(''); return }
      }
      const { data: tx } = await walletsApi.deposit(address, { amountUsdc: depositAmount })
      await executeTx(tx)
      setShowDeposit(false)
      setDepositAmount('')
      await refreshWallet()
    } catch { /* handled */ }
    finally { setActionLoading('') }
  }

  const handleToggleWhitelist = async () => {
    if (!address || !wallet) return
    setActionLoading('toggleWhitelist')
    try {
      const { data: tx } = await walletsApi.toggleWhitelist(address, { enabled: !wallet.whitelistEnabled })
      await executeTx(tx)
      await refreshWallet()
    } catch { /* handled */ }
    finally { setActionLoading('') }
  }

  const handleWhitelistAddr = async (allowed: boolean) => {
    if (!address || !whitelistAddr) return
    setActionLoading('whitelistAddr')
    try {
      const { data: tx } = await walletsApi.whitelist(address, { recipient: whitelistAddr, allowed })
      await executeTx(tx)
      setWhitelistAddr('')
      await refreshWallet()
    } catch { /* handled */ }
    finally { setActionLoading('') }
  }

  const handleEmergencyWithdraw = async () => {
    if (!address || !emergencyTo) return
    setActionLoading('emergency')
    try {
      const { data: tx } = await walletsApi.emergencyWithdraw(address, { to: emergencyTo })
      await executeTx(tx)
      setShowEmergency(false)
      setEmergencyTo('')
      await refreshWallet()
    } catch { /* handled */ }
    finally { setActionLoading('') }
  }

  const handleLinkCredit = async () => {
    if (!address || !creditVaultInput) return
    setActionLoading('linkCredit')
    try {
      const { data: tx } = await walletsApi.linkCredit(address, { vault: creditVaultInput })
      await executeTx(tx)
      setShowLinkCredit(false)
      setCreditVaultInput('')
      await refreshWallet()
    } catch { /* handled */ }
    finally { setActionLoading('') }
  }

  const handleCreateCreditLine = async () => {
    if (!creditVaultAgent) return
    setActionLoading('createCredit')
    try {
      const { data: tx } = await vaultsApi.create({ agent: creditVaultAgent })
      if (tx.txHash) {
        await refreshWallet()
      }
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

  const hasLinkedVault = wallet.creditVault !== '0x0000000000000000000000000000000000000000'

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
          <div className={`${styles.statCard} ${styles.balanceCard}`}>
            <span className={styles.statLabel}>USDC Balance</span>
            <span className={styles.balanceVal}>{balance !== null ? formatUSDC(balance) : '...'}</span>
          </div>
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
            <span className={styles.statVal}>{hasLinkedVault ? truncateAddress(wallet.creditVault) : 'None'}</span>
          </div>
        </div>

        {/* Deposit Section */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}><Download size={16} /> Deposit USDC</h2>
            <button className={styles.editBtn} onClick={() => { setShowDeposit(!showDeposit); setDepositAmount('') }}>
              {showDeposit ? 'Cancel' : 'Deposit'}
            </button>
          </div>
          {showDeposit && (
            <div className={styles.actionForm}>
              <input value={depositAmount} onChange={e => setDepositAmount(e.target.value)} placeholder="Amount (USDC)" type="number" className={styles.input} />
              <button className={styles.actionSubmit} onClick={handleDeposit} disabled={actionLoading === 'deposit' || isApproving || !depositAmount}>
                {(actionLoading === 'deposit' || isApproving) ? <Loader2 size={14} className={styles.spin} /> : null}
                {isApproving ? 'Approving...' : 'Deposit USDC'}
              </button>
            </div>
          )}
        </div>

        {/* Transfer / Spend Section (operator only) */}
        {isOperator && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}><Send size={16} /> Send USDC</h2>
              <button className={styles.editBtn} onClick={() => { setShowTransfer(!showTransfer); setTransferTo(''); setTransferAmount('') }}>
                {showTransfer ? 'Cancel' : 'Send'}
              </button>
            </div>
            <div className={styles.limitInfo}>
              Remaining daily: {formatUSDC(wallet.remainingDaily)} | Per-tx max: {formatUSDC(wallet.perTxLimit)}
            </div>
            {showTransfer && (
              <div className={styles.actionForm}>
                <input value={transferTo} onChange={e => setTransferTo(e.target.value)} placeholder="Recipient address (0x...)" className={styles.input} />
                <input value={transferAmount} onChange={e => setTransferAmount(e.target.value)} placeholder="Amount (USDC)" type="number" className={styles.input} />
                <button className={styles.actionSubmit} onClick={handleTransfer} disabled={actionLoading === 'transfer' || !transferTo || !transferAmount}>
                  {actionLoading === 'transfer' ? <Loader2 size={14} className={styles.spin} /> : null}
                  Send USDC
                </button>
              </div>
            )}
          </div>
        )}

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

            {/* Whitelist Management */}
            <div className={styles.actionCard}>
              <div className={styles.actionHeader}>
                <span>Whitelist ({wallet.whitelistEnabled ? 'Enabled' : 'Disabled'})</span>
                <button className={styles.editBtn} onClick={handleToggleWhitelist} disabled={actionLoading === 'toggleWhitelist'}>
                  {actionLoading === 'toggleWhitelist' ? <Loader2 size={14} className={styles.spin} /> : wallet.whitelistEnabled ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                  {wallet.whitelistEnabled ? 'Disable' : 'Enable'}
                </button>
              </div>
              <div className={styles.actionForm}>
                <input value={whitelistAddr} onChange={e => setWhitelistAddr(e.target.value)} placeholder="Address to whitelist/remove (0x...)" className={styles.input} />
                <div className={styles.formRow}>
                  <button className={styles.actionSubmit} onClick={() => handleWhitelistAddr(true)} disabled={actionLoading === 'whitelistAddr' || !whitelistAddr}>
                    {actionLoading === 'whitelistAddr' ? <Loader2 size={14} className={styles.spin} /> : <Plus size={14} />}
                    Add
                  </button>
                  <button className={`${styles.actionSubmit} ${styles.dangerBtn}`} onClick={() => handleWhitelistAddr(false)} disabled={actionLoading === 'whitelistAddr' || !whitelistAddr}>
                    <Minus size={14} /> Remove
                  </button>
                </div>
              </div>
            </div>

            {/* Emergency Withdraw */}
            <div className={styles.actionCard}>
              <div className={styles.actionHeader}>
                <span><AlertTriangle size={14} style={{ color: '#ef4444' }} /> Emergency Withdraw</span>
                <button className={styles.editBtn} onClick={() => { setShowEmergency(!showEmergency); setEmergencyTo('') }}>
                  {showEmergency ? 'Cancel' : 'Withdraw'}
                </button>
              </div>
              {showEmergency && (
                <div className={styles.actionForm}>
                  <p className={styles.warningText}>This will withdraw ALL USDC from the wallet to the specified address.</p>
                  <input value={emergencyTo} onChange={e => setEmergencyTo(e.target.value)} placeholder="Recipient address (0x...)" className={styles.input} />
                  <button className={`${styles.actionSubmit} ${styles.dangerBtn}`} onClick={handleEmergencyWithdraw} disabled={actionLoading === 'emergency' || !emergencyTo}>
                    {actionLoading === 'emergency' ? <Loader2 size={14} className={styles.spin} /> : <AlertTriangle size={14} />}
                    Confirm Emergency Withdraw
                  </button>
                </div>
              )}
            </div>

            {/* Link Credit Vault */}
            <div className={styles.actionCard}>
              <div className={styles.actionHeader}>
                <span><Link2 size={14} /> Credit Vault</span>
                <button className={styles.editBtn} onClick={() => { setShowLinkCredit(!showLinkCredit); setCreditVaultInput('') }}>
                  {showLinkCredit ? 'Cancel' : hasLinkedVault ? 'Change' : 'Link'}
                </button>
              </div>
              {hasLinkedVault && (
                <div className={styles.linkedVaultInfo}>
                  <span>Linked: </span>
                  <a href={addressUrl(wallet.creditVault)} target="_blank" rel="noopener noreferrer" className={styles.addressLink}>
                    {truncateAddress(wallet.creditVault)} <ExternalLink size={10} />
                  </a>
                </div>
              )}
              {showLinkCredit && (
                <div className={styles.actionForm}>
                  <input value={creditVaultInput} onChange={e => setCreditVaultInput(e.target.value)} placeholder="Vault address (0x...)" className={styles.input} />
                  <button className={styles.actionSubmit} onClick={handleLinkCredit} disabled={actionLoading === 'linkCredit' || !creditVaultInput}>
                    {actionLoading === 'linkCredit' ? <Loader2 size={14} className={styles.spin} /> : null}
                    Link Vault
                  </button>
                  <div className={styles.divider} />
                  <p className={styles.hintText}>Or create a new credit line:</p>
                  <input value={creditVaultAgent} onChange={e => setCreditVaultAgent(e.target.value)} placeholder="Agent address for credit line" className={styles.input} />
                  <button className={styles.actionSubmit} onClick={handleCreateCreditLine} disabled={actionLoading === 'createCredit' || !creditVaultAgent}>
                    {actionLoading === 'createCredit' ? <Loader2 size={14} className={styles.spin} /> : <DollarSign size={14} />}
                    Create Credit Line
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Transaction History */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}><List size={16} /> Transaction History</h2>
          {historyLoading ? (
            <Skeleton style={{ height: 100, borderRadius: 12 }} />
          ) : history.length === 0 ? (
            <p className={styles.emptyText}>No transactions yet</p>
          ) : (
            <div className={styles.historyList}>
              {history.map((event, i) => (
                <div key={i} className={styles.historyItem}>
                  <div className={styles.historyLeft}>
                    <span className={styles.historyTo}>To: {truncateAddress(event.to, 6)}</span>
                    <span className={styles.historyAmount}>{formatUSDC(event.amount)}</span>
                  </div>
                  <div className={styles.historyRight}>
                    <span className={styles.historyBlock}>Block {event.blockNumber}</span>
                    <a href={txUrl(event.txHash)} target="_blank" rel="noopener noreferrer" className={styles.historyLink}>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
