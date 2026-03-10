import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { motion, AnimatePresence } from 'motion/react'
import { kickstartApi } from '../api/client'
import { truncateAddress } from '../lib/format'
import { useContractTx } from '../hooks/useContractTx'
import { Rocket, Loader2, Zap, ExternalLink, TrendingUp } from 'lucide-react'
import { Skeleton } from '../components/ui/Skeleton'
import { AnimatedNumber } from '../components/ui/AnimatedNumber'
import type { EnrichedKickstartToken } from '../api/types'
import styles from './Kickstart.module.css'

const HOW_IT_WORKS = [
  {
    icon: <Rocket size={22} />,
    title: 'Create Token',
    desc: 'Launch with a name, symbol, and metadata. Optionally fund the initial buy with Krexa credit.',
  },
  {
    icon: <TrendingUp size={22} />,
    title: 'Bonding Curve Fills',
    desc: 'Price rises as buyers enter. Every ETH raised is locked in the bonding curve contract on Base.',
  },
  {
    icon: <Zap size={22} />,
    title: 'Graduate to Aerodrome',
    desc: 'At ~4.5 ETH raised your token graduates to real DEX liquidity on Aerodrome automatically.',
  },
]

// ── Token Card ─────────────────────────────────────────────────────────────

function TokenCard({
  token,
  index,
  onBuy,
}: {
  token: EnrichedKickstartToken
  index: number
  onBuy: () => void
}) {
  const initials = token.symbol.replace(/[^A-Z0-9]/gi, '').slice(0, 2).toUpperCase() || '??'
  const hue = parseInt(token.curve.slice(2, 6), 16) % 360

  return (
    <motion.div
      className={styles.card}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: Math.min(index * 0.05, 0.4) }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
    >
      {token.graduated && <div className={styles.graduatedBadge}>Graduated ✓</div>}

      <div className={styles.cardAvatar} style={{ '--avatar-hue': hue } as React.CSSProperties}>
        {initials}
      </div>

      <div className={styles.cardNameRow}>
        <span className={styles.cardName}>{token.name}</span>
        <span className={styles.cardSymbol}>${token.symbol}</span>
      </div>

      <div className={styles.progressContainer}>
        <div className={styles.progressBar}>
          <motion.div
            className={styles.progressFill}
            initial={{ width: 0 }}
            whileInView={{ width: `${Math.min(token.progressPct, 100)}%` }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: Math.min(index * 0.05 + 0.2, 0.6) }}
          />
        </div>
        <div className={styles.progressLabels}>
          <span>{token.ethRaisedEth} ETH raised</span>
          <span>{token.progressPct.toFixed(1)}%</span>
        </div>
      </div>

      <div className={styles.cardMeta}>
        <span>Curve</span>
        <a
          href={`https://basescan.org/address/${token.curve}`}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.cardLink}
          onClick={e => e.stopPropagation()}
        >
          {truncateAddress(token.curve, 6)} <ExternalLink size={10} />
        </a>
      </div>

      <button className={styles.buyBtn} onClick={onBuy}>
        Buy {token.symbol}
      </button>
    </motion.div>
  )
}

// ── Buy Modal ───────────────────────────────────────────────────────────────

function BuyModal({
  token,
  ethAmount,
  onChangeAmount,
  buying,
  onBuy,
  onClose,
}: {
  token: EnrichedKickstartToken
  ethAmount: string
  onChangeAmount: (v: string) => void
  buying: boolean
  onBuy: () => void
  onClose: () => void
}) {
  const hue = parseInt(token.curve.slice(2, 6), 16) % 360
  const initials = token.symbol.replace(/[^A-Z0-9]/gi, '').slice(0, 2).toUpperCase() || '??'

  return (
    <motion.div className={styles.overlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className={styles.modal} initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={e => e.stopPropagation()}>
        <h3 className={styles.modalTitle}>Buy Token</h3>

        <div className={styles.buyModalToken}>
          <div className={styles.cardAvatar} style={{ '--avatar-hue': hue, width: 40, height: 40, fontSize: 13 } as React.CSSProperties}>
            {initials}
          </div>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{token.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>${token.symbol}</div>
          </div>
        </div>

        <div className={styles.buyModalProgress}>
          <div className={styles.progressBar} style={{ marginBottom: 6 }}>
            <div className={styles.progressFill} style={{ width: `${Math.min(token.progressPct, 100)}%` }} />
          </div>
          <span>{token.ethRaisedEth} ETH raised · {token.progressPct.toFixed(1)}% to graduation</span>
        </div>

        <div className={styles.formGroup}>
          <label>ETH Amount to Spend</label>
          <input
            value={ethAmount}
            onChange={e => onChangeAmount(e.target.value)}
            placeholder="0.01"
            type="text"
            className={styles.input}
          />
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4, display: 'block' }}>
            Transaction submits on Base mainnet — you need ETH on Base.
          </span>
        </div>

        <button className={styles.submitBtn} onClick={onBuy} disabled={buying || !ethAmount}>
          {buying ? <Loader2 size={16} className={styles.spin} /> : <Zap size={16} />}
          {buying ? 'Buying...' : `Buy on Base Mainnet`}
        </button>
      </motion.div>
    </motion.div>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function Kickstart() {
  const { address: walletAddress } = useAccount()
  const [tokens, setTokens] = useState<EnrichedKickstartToken[]>([])
  const [stats, setStats] = useState<{ totalTokens: number; graduatedCount: number; totalEthRaisedEth: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [buyTarget, setBuyTarget] = useState<EnrichedKickstartToken | null>(null)
  const [buyEthAmount, setBuyEthAmount] = useState('0.01')
  const [buying, setBuying] = useState(false)

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
    kickstartApi.enrichedTokens({ count: 20 })
      .then(({ data }) => {
        setTokens(data?.tokens ?? [])
        setStats(data?.stats ?? null)
      })
      .catch(() =>
        kickstartApi.tokens({ count: 20 })
          .then(({ data }) => setTokens(
            (data?.tokens ?? []).map(t => ({
              ...t,
              name: 'Unknown',
              symbol: '???',
              ethRaisedEth: '0.0000',
              progressPct: 0,
              graduated: false,
            }))
          ))
          .catch(() => setTokens([]))
      )
      .finally(() => setLoading(false))
  }, [])

  const handleLaunch = async () => {
    if (!nameInput || !symbolInput) return
    setCreating(true)
    try {
      if (useCredit) {
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
        let uri = ''
        const { data: metaResult } = await kickstartApi.uploadMetadata({
          name: nameInput,
          ticker: symbolInput,
          description: descInput,
          imageUrl: imageUrlInput || undefined,
        })
        uri = metaResult.uri

        const { data: tx } = await kickstartApi.createToken({
          name: nameInput,
          symbol: symbolInput,
          uri,
          initialBuyEth: initialBuyInput || undefined,
        })
        await executeTx({ to: tx.to, data: tx.data, description: tx.description, value: tx.value })
        setShowCreate(false)
      }
    } catch { /* toast handled by useContractTx */ }
    finally { setCreating(false) }
  }

  const handleBuy = async () => {
    if (!buyTarget || !buyEthAmount) return
    setBuying(true)
    try {
      const { data: tx } = await kickstartApi.buyToken({
        curveAddress: buyTarget.curve,
        ethAmount: buyEthAmount,
        minTokensOut: '0',
      })
      await executeTx({ to: tx.to, data: tx.data, description: `Buy ${buyTarget.symbol}`, value: tx.value })
      setBuyTarget(null)
    } catch { /* toast handled */ }
    finally { setBuying(false) }
  }

  const totalEthRaised = parseFloat(stats?.totalEthRaisedEth ?? '0')

  return (
    <div className={styles.page}>

      {/* ── Hero ─────────────────────────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.heroBg} />
        <motion.div
          className={styles.heroContent}
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className={styles.liveIndicator}>
            <span className={styles.liveDot} />
            Live on Base
          </div>

          <h1 className={styles.heroTitle}>
            Launch Your Token<br />
            <span className={styles.heroAccent}>on Base</span>
          </h1>

          <p className={styles.heroSubtitle}>
            Powered by EasyA Kickstart — bonding curves, real DEX liquidity, AI agent credit.
          </p>

          <div className={styles.heroStats}>
            <div className={styles.heroStat}>
              <AnimatedNumber value={stats?.totalTokens ?? 0} className={styles.heroStatVal} />
              <span className={styles.heroStatLabel}>Tokens Launched</span>
            </div>
            <div className={styles.heroStat}>
              <span className={styles.heroStatVal}>
                <AnimatedNumber value={totalEthRaised} decimals={2} /> ETH
              </span>
              <span className={styles.heroStatLabel}>Total Raised</span>
            </div>
            <div className={styles.heroStat}>
              <AnimatedNumber value={stats?.graduatedCount ?? 0} className={styles.heroStatVal} />
              <span className={styles.heroStatLabel}>Graduated</span>
            </div>
          </div>

          {walletAddress ? (
            <button className={styles.heroCta} onClick={() => setShowCreate(true)}>
              <Rocket size={18} /> Launch Token
            </button>
          ) : (
            <p className={styles.connectHint}>Connect wallet to launch a token</p>
          )}
        </motion.div>
      </section>

      {/* ── How It Works ─────────────────────────────────── */}
      <section className={styles.howItWorks}>
        <h2 className={styles.sectionHeading}>How It Works</h2>
        <div className={styles.stepsRow}>
          {HOW_IT_WORKS.map((step, i) => (
            <motion.div
              key={i}
              className={styles.stepCard}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: i * 0.1 }}
            >
              <div className={styles.stepNum}>{i + 1}</div>
              <div className={styles.stepIcon}>{step.icon}</div>
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={styles.stepDesc}>{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Launch Steps (post credit-and-launch) ─────────── */}
      <AnimatePresence>
        {launchSteps && (
          <motion.div
            className={styles.stepsCardWrap}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className={styles.stepsCard}>
              <h2 className={styles.sectionHeading} style={{ marginBottom: 20 }}>Launch Steps</h2>
              {launchSteps.map(s => (
                <div key={s.step} className={styles.step}>
                  <div className={styles.stepNumBadge}>{s.step}</div>
                  <div className={styles.stepContent}>
                    <div className={styles.stepAction}>{s.description}</div>
                    <div className={styles.stepNetwork}>{s.network}</div>
                    {s.tx && (
                      <div className={styles.stepNote}>
                        Contract: {truncateAddress(s.tx.to, 8)}
                        {s.tx.value && s.tx.value !== '0' && ` · ${s.tx.value} wei`}
                      </div>
                    )}
                    {s.note && <div className={styles.stepNote}>{s.note}</div>}
                  </div>
                </div>
              ))}
              <button className={styles.submitBtn} style={{ marginTop: 20 }} onClick={() => setLaunchSteps(null)}>
                Done
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Live Token Grid ───────────────────────────────── */}
      <section className={styles.tokenSection}>
        <div className={styles.sectionHeader}>
          <div className={styles.liveIndicator}>
            <span className={styles.liveDot} />
            Live Tokens
          </div>
          <span className={styles.tokenCount}>{tokens.length} tokens</span>
        </div>

        {loading ? (
          <div className={styles.grid}>
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Skeleton key={i} style={{ height: 230, borderRadius: 16 }} />
            ))}
          </div>
        ) : tokens.length === 0 ? (
          <div className={styles.empty}>
            <Rocket size={40} style={{ opacity: 0.25, color: 'var(--accent)' }} />
            <p>No tokens yet — be the first to launch!</p>
            {walletAddress && (
              <button className={styles.heroCta} onClick={() => setShowCreate(true)} style={{ marginTop: 16 }}>
                <Rocket size={16} /> Launch First Token
              </button>
            )}
          </div>
        ) : (
          <div className={styles.grid}>
            {tokens.map((t, idx) => (
              <TokenCard key={t.curve} token={t} index={idx} onBuy={() => setBuyTarget(t)} />
            ))}
          </div>
        )}
      </section>

      {/* ── Buy Modal ─────────────────────────────────────── */}
      <AnimatePresence>
        {buyTarget && (
          <BuyModal
            token={buyTarget}
            ethAmount={buyEthAmount}
            onChangeAmount={setBuyEthAmount}
            buying={buying}
            onBuy={handleBuy}
            onClose={() => setBuyTarget(null)}
          />
        )}
      </AnimatePresence>

      {/* ── Create Modal ──────────────────────────────────── */}
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
                <label>Image URL <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(optional)</span></label>
                <input value={imageUrlInput} onChange={e => setImageUrlInput(e.target.value)} placeholder="https://..." className={styles.input} />
              </div>

              <div className={styles.formGroup}>
                <label>Initial Buy <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(ETH, optional)</span></label>
                <input value={initialBuyInput} onChange={e => setInitialBuyInput(e.target.value)} placeholder="0.01" type="text" className={styles.input} />
              </div>

              <label className={styles.toggle}>
                <input type="checkbox" checked={useCredit} onChange={e => setUseCredit(e.target.checked)} />
                <span>Fund with Krexa Credit</span>
              </label>

              {useCredit && (
                <div className={styles.formGroup}>
                  <label>Credit Vault Address <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(Base Sepolia)</span></label>
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
