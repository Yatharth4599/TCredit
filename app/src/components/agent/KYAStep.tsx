import { useState } from 'react'
import { motion } from 'framer-motion'
import { useWallet } from '@solana/wallet-adapter-react'
import { Shield, CheckCircle, Loader2, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'
import { config } from '../../config'

interface KYAStepProps {
  agentPubkey: string
  currentTier?: number
}

const KYA_TIERS = [
  {
    tier: 1,
    name: 'Basic',
    desc: 'Automated verification — sign a message to prove wallet ownership. Unlocks L1 credit ($500).',
    action: 'Verify Now',
    color: 'border-green-500/30 bg-green-500/5',
    badge: 'bg-green-500/20 text-green-400',
  },
  {
    tier: 2,
    name: 'Enhanced',
    desc: 'Identity verification via Sumsub. Required for L2–L3 credit (up to $50K).',
    action: 'Start KYC',
    color: 'border-blue-500/30 bg-blue-500/5',
    badge: 'bg-blue-500/20 text-blue-400',
  },
]

export function KYAStep({ agentPubkey, currentTier = 0 }: KYAStepProps) {
  const { publicKey, signMessage } = useWallet()
  const [loading, setLoading] = useState<number | null>(null)

  const handleBasicKYA = async () => {
    if (!publicKey || !signMessage) {
      toast.error('Wallet must support message signing')
      return
    }

    setLoading(1)
    try {
      // Sign a message proving wallet ownership
      const message = new TextEncoder().encode(
        `Krexa KYA: I verify ownership of agent ${agentPubkey} at ${Date.now()}`
      )
      const signature = await signMessage(message)
      const sigBase64 = btoa(String.fromCharCode(...signature))

      const res = await fetch(`${config.apiUrl}/api/v1/solana/kya/${agentPubkey}/basic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerPubkey: publicKey.toBase58(),
          ownerSignature: sigBase64,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || data.message || 'KYA verification failed')

      if (data.status === 'approved') {
        toast.success('Basic KYA verified! You can now request L1 credit.')
      } else {
        toast.success('KYA submission received — verification pending.')
      }
    } catch (err) {
      toast.error(`KYA failed: ${(err as Error).message}`)
    } finally {
      setLoading(null)
    }
  }

  const handleEnhancedKYA = () => {
    // Enhanced KYA requires Sumsub integration — for now, show a placeholder
    toast('Enhanced KYA (Sumsub) integration coming soon. Contact support for manual verification.', {
      duration: 5000,
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6"
    >
      <div className="flex items-center gap-2 mb-4">
        <Shield size={20} className="text-green-400" />
        <h3 className="text-lg font-semibold text-white">Know Your Agent (KYA)</h3>
      </div>

      <p className="text-sm text-gray-400 mb-5">
        Complete KYA verification to unlock credit. Higher tiers unlock larger credit lines.
      </p>

      <div className="space-y-3">
        {KYA_TIERS.map((t) => {
          const isCompleted = currentTier >= t.tier
          const isNext = currentTier === t.tier - 1
          return (
            <div
              key={t.tier}
              className={`border rounded-xl p-4 ${isCompleted ? 'border-green-500/30 bg-green-500/5' : t.color} ${
                !isNext && !isCompleted ? 'opacity-50' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isCompleted ? (
                    <CheckCircle size={18} className="text-green-400 shrink-0" />
                  ) : (
                    <div className={`w-5 h-5 rounded-full border-2 ${
                      isNext ? 'border-blue-400' : 'border-gray-600'
                    }`} />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-200">Tier {t.tier}: {t.name}</span>
                      {isCompleted && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">Verified</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{t.desc}</p>
                  </div>
                </div>
                {isNext && !isCompleted && (
                  <button
                    onClick={t.tier === 1 ? handleBasicKYA : handleEnhancedKYA}
                    disabled={loading !== null}
                    className="shrink-0 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    {loading === t.tier ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : null}
                    {t.action}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}
