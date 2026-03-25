import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Info, Loader2 } from 'lucide-react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useRequestCredit } from '../../hooks/useRequestCredit'

interface RequestCreditModalProps {
  isOpen: boolean
  onClose: () => void
  agentPubkey?: string
  creditLevel?: number
}

const LEVEL_LIMITS: Record<number, { name: string; max: string; rate: string }> = {
  1: { name: 'Starter', max: '$500', rate: '36.5%' },
  2: { name: 'Established', max: '$20,000', rate: '29.2%' },
  3: { name: 'Trusted', max: '$50,000', rate: '21.9%' },
  4: { name: 'Elite', max: '$500,000', rate: '18.25%' },
}

const LEVEL_MAX_USDC: Record<number, number> = {
  1: 500,
  2: 20_000,
  3: 50_000,
  4: 500_000,
}

export function RequestCreditModal({ isOpen, onClose, agentPubkey, creditLevel = 1 }: RequestCreditModalProps) {
  const [amount, setAmount] = useState('')
  const { publicKey } = useWallet()
  const requestCredit = useRequestCredit()
  const levelInfo = LEVEL_LIMITS[creditLevel] ?? LEVEL_LIMITS[1]
  const maxUsdc = LEVEL_MAX_USDC[creditLevel] ?? 500

  const agentKey = agentPubkey ?? publicKey?.toBase58() ?? ''

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const val = parseFloat(amount)
    if (isNaN(val) || val <= 0 || !agentKey) return

    await requestCredit.mutateAsync({
      agentPubkey: agentKey,
      amount: val,
      creditLevel,
    })

    setAmount('')
    onClose()
  }

  const isDisabled = requestCredit.isPending || !amount || parseFloat(amount) <= 0 || !agentKey

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-gray-900 border border-gray-700/50 rounded-2xl p-6 w-full max-w-md mx-4"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">Request Credit</h2>
              <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
                <X size={20} />
              </button>
            </div>

            <div className="bg-gray-800/50 rounded-xl p-4 mb-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-gray-400">Level</p>
                  <p className="text-sm font-bold text-blue-400">L{creditLevel} {levelInfo.name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Max Credit</p>
                  <p className="text-sm font-bold text-gray-100">{levelInfo.max}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Interest</p>
                  <p className="text-sm font-bold text-gray-100">{levelInfo.rate} APY</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">
                  Amount (USDC)
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="500.00"
                  step="0.01"
                  min="1"
                  max={maxUsdc}
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl px-4 py-3 flex items-start gap-2">
                <Info size={16} className="text-blue-400 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-400">
                  Credit requests are oracle co-signed. The oracle will validate your eligibility and add its signature before you confirm.
                </p>
              </div>

              {!agentKey && (
                <p className="text-xs text-red-400 text-center">
                  No agent pubkey found. Register an agent first.
                </p>
              )}

              <button
                type="submit"
                disabled={isDisabled}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium px-6 py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {requestCredit.isPending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Requesting...
                  </>
                ) : (
                  'Request Credit'
                )}
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
