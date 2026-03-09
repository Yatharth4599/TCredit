import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { motion, AnimatePresence } from 'motion/react'
import { kickstartApi } from '../api/client'
import { truncateAddress } from '../lib/format'
import { useContractTx } from '../hooks/useContractTx'
import { Rocket, Loader2, Info, Zap, ExternalLink } from 'lucide-react'
import { Skeleton } from '../components/ui/Skeleton'
import styles from './Kickstart.module.css'

interface KickstartToken {
  curve: string
  token: string | null
}

export default function Kickstart() {
  const { address: walletAddress } = useAccount()
  const [tokens, setTokens] = useState<KickstartToken[]>([])
  const [loading, setLoading] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  // Create form state
  const [nameInput, setNameInput] = useState('')
  const [symbolInput, setSymbolInput] = useState('')
  const [descInput, setDescInput] = useState('')
  const [imageUrlInput, setImageUrlInput] = useState('')
  const [initialBuyInput, setInitialBuyInput] = useState('')
  const [useCredit, setUseCredit] = useState(false)
  const [vaultInput, setVaultInput] = useState('')
  const [creating, setCreating] = useState(false)
  const [launchSteps, setLaunchSteps] = useState<Array<{
    step: number; network: string; action: string;
    description: string; tx?: { to: string; data: string; value?: string }; note?: string
  }> | null>(null)

  const { execute: executeTx } = useContractTx()

  useEffect(() => {
    setLoading(true)
    kickstartApi.tokens({ count: 20 })
      .then(({ data }) => setTokens(data?.tokens ?? []))
      .catch(() => setTokens([]))
      .finally(() => setLoading(false))
  }, [])

  const handleLaunch = async () => {
    if (!nameInput || !symbolInput) return
    setCreating(true)
    try {
      if (useCredit) {
        // Use credit-and-launch combined flow
        const { data } = await kickstartApi.creditAndLaunch({
          name: nameInput,
          symbol: symbolInput,
          description: descInput,
          imageUrl: imageUrlInput || undefined,
          initialBuyEth: initialBuyInput || undefined,
          vaultAddress: vaultInput || undefined,
        })
        setLaunchSteps(data.steps)
        setShowCreate(false)
      } else {
        // Direct launch: upload metadata then create token
        let uri = ''
        if (nameInput && symbolInput) {
          const { data: metaResult } = await kickstartApi.uploadMetadata({
            name: nameInput,
            ticker: symbolInput,
            description: descInput,
            imageUrl: imageUrlInput || undefined,
          })
          uri = metaResult.uri
        }

        const { data: tx } = await kickstartApi.createToken({
          name: nameInput,
          symbol: symbolInput,
          uri,
          initialBuyEth: initialBuyInput || undefined,
        })

        await executeTx({ to: tx.to, data: tx.data, description: tx.description })
        setShowCreate(false)
      }
    } catch { /* toast handled by useContractTx */ }
    finally { setCreating(false) }
  }

  return (
    <div className={styles.page}>
      <motion.div className={styles.container} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Kickstart</h1>
            <p className={styles.subtitle}>Launch tokens with bonding curves on Base via EasyA Kickstart</p>
          </div>
          {walletAddress && (
            <button className={styles.launchBtn} onClick={() => setShowCreate(true)}>
              <Rocket size={16} /> Launch Token
            </button>
          )}
        </div>

        {/* Info Banner */}
        <div className={styles.infoBanner}>
          <Info size={20} />
          <p>
            Tokens start with a bonding curve — price rises as people buy. At ~4.5 ETH collected, the token
            graduates to Aerodrome DEX with real liquidity. Agents can draw Krexa credit to fund initial buys.
          </p>
        </div>

        {/* Launch Steps (shown after credit-and-launch) */}
        {launchSteps && (
          <div className={styles.stepsCard}>
            <h2 className={styles.sectionTitle}>Launch Steps</h2>
            {launchSteps.map(s => (
              <div key={s.step} className={styles.step}>
                <div className={styles.stepNum}>{s.step}</div>
                <div className={styles.stepContent}>
                  <div className={styles.stepAction}>{s.description}</div>
                  <div className={styles.stepNetwork}>{s.network} (chain {s.action})</div>
                  {s.tx && (
                    <div className={styles.stepNote}>
                      Contract: {truncateAddress(s.tx.to, 8)}
                      {s.tx.value && s.tx.value !== '0' && ` | Value: ${s.tx.value} wei`}
                    </div>
                  )}
                  {s.note && <div className={styles.stepNote}>{s.note}</div>}
                </div>
              </div>
            ))}
            <button
              className={styles.submitBtn}
              style={{ marginTop: 16 }}
              onClick={() => setLaunchSteps(null)}
            >
              Done
            </button>
          </div>
        )}

        {/* Token List */}
        <h2 className={styles.sectionTitle}>Recent Tokens ({tokens.length})</h2>
        {loading ? (
          <div className={styles.grid}>
            {[1, 2, 3].map(i => <Skeleton key={i} style={{ height: 160, borderRadius: 16 }} />)}
          </div>
        ) : tokens.length === 0 ? (
          <div className={styles.empty}>
            <Zap size={32} />
            <p>No tokens found — be the first to launch!</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {tokens.map((t, idx) => (
              <motion.div
                key={t.curve}
                className={styles.card}
                whileHover={{ y: -2 }}
              >
                <div className={styles.cardHeader}>
                  <span className={styles.cardAddr}>#{idx + 1}</span>
                  <Rocket size={16} style={{ color: 'var(--accent)' }} />
                </div>
                <div className={styles.cardRow}>
                  <span>Curve</span>
                  <span>{truncateAddress(t.curve, 6)}</span>
                </div>
                <div className={styles.cardRow}>
                  <span>Token</span>
                  <span>{t.token ? truncateAddress(t.token, 6) : 'Unknown'}</span>
                </div>
                <a
                  href={`https://basescan.org/address/${t.curve}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.buyBtn}
                  onClick={e => e.stopPropagation()}
                >
                  View on BaseScan <ExternalLink size={12} />
                </a>
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
              <h3 className={styles.modalTitle}>Launch Token on Kickstart</h3>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Token Name</label>
                  <input value={nameInput} onChange={e => setNameInput(e.target.value)} placeholder="Krexa Agent Fund" className={styles.input} />
                </div>
                <div className={styles.formGroup}>
                  <label>Symbol</label>
                  <input value={symbolInput} onChange={e => setSymbolInput(e.target.value)} placeholder="KAF" className={styles.input} />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Description</label>
                <textarea value={descInput} onChange={e => setDescInput(e.target.value)} placeholder="A token for..." className={styles.textarea} />
              </div>

              <div className={styles.formGroup}>
                <label>Image URL (optional)</label>
                <input value={imageUrlInput} onChange={e => setImageUrlInput(e.target.value)} placeholder="https://..." className={styles.input} />
              </div>

              <div className={styles.formGroup}>
                <label>Initial Buy (ETH, optional)</label>
                <input value={initialBuyInput} onChange={e => setInitialBuyInput(e.target.value)} placeholder="0.01" type="text" className={styles.input} />
              </div>

              {/* Credit toggle */}
              <label className={styles.toggle}>
                <input type="checkbox" checked={useCredit} onChange={e => setUseCredit(e.target.checked)} />
                <span>Fund with Krexa Credit</span>
              </label>

              {useCredit && (
                <div className={styles.formGroup}>
                  <label>Credit Vault Address (Base Sepolia)</label>
                  <input value={vaultInput} onChange={e => setVaultInput(e.target.value)} placeholder="0x..." className={styles.input} />
                </div>
              )}

              <button className={styles.submitBtn} onClick={handleLaunch} disabled={creating || !nameInput || !symbolInput}>
                {creating ? <Loader2 size={16} className={styles.spin} /> : <Rocket size={16} />}
                {creating ? 'Launching...' : useCredit ? 'Generate Launch Steps' : 'Launch Token'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
