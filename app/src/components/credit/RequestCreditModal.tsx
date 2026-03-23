import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Info } from 'lucide-react'

interface RequestCreditModalProps {
  isOpen: boolean
  onClose: () => void
  creditLevel?: number
}

const LEVEL_LIMITS: Record<number, { name: string; max: string; rate: string }> = {
  1: { name: 'Starter', max: '$500', rate: '36.5%' },
  2: { name: 'Established', max: '$20,000', rate: '29.2%' },
  3: { name: 'Trusted', max: '$50,000', rate: '21.9%' },
  4: { name: 'Elite', max: '$500,000', rate: '18.25%' },
}

export function RequestCreditModal({ isOpen, onClose, creditLevel = 1 }: RequestCreditModalProps) {
  const [amount, setAmount] = useState('')
  const levelInfo = LEVEL_LIMITS[creditLevel] ?? LEVEL_LIMITS[1]

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

            <div className="space-y-4">
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
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 flex items-start gap-2">
                <Info size={16} className="text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-400">
                  Credit requests require oracle co-signature. On devnet, requests are processed automatically within a few minutes.
                </p>
              </div>

              <button
                disabled
                className="w-full bg-blue-600/50 text-white/60 font-medium px-6 py-3 rounded-xl cursor-not-allowed"
              >
                Request Credit (Oracle Required)
              </button>
              <p className="text-xs text-gray-500 text-center">
                Credit request flow requires the oracle to co-sign. This will be enabled after oracle deployment.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
