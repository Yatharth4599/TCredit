import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Loader2 } from 'lucide-react'
import { useWithdrawLP } from '../../hooks/useWithdrawLP'

interface WithdrawModalProps {
  isOpen: boolean
  onClose: () => void
  tranche?: number
  availableShares?: string
}

const TRANCHE_NAMES: Record<number, string> = { 0: 'Senior', 1: 'Mezzanine', 2: 'Junior' }

export function WithdrawModal({ isOpen, onClose, tranche = 0, availableShares }: WithdrawModalProps) {
  const [shares, setShares] = useState('')
  const withdraw = useWithdrawLP()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const val = parseFloat(shares)
    if (isNaN(val) || val <= 0) return

    await withdraw.mutateAsync({ shares: val, tranche })
    setShares('')
    onClose()
  }

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
              <h2 className="text-lg font-semibold text-white">
                Withdraw — {TRANCHE_NAMES[tranche] ?? 'Unknown'} Tranche
              </h2>
              <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
                <X size={20} />
              </button>
            </div>

            {availableShares && (
              <div className="bg-gray-800/50 rounded-xl p-3 mb-4">
                <p className="text-xs text-gray-400">Available Shares</p>
                <p className="text-lg font-bold text-gray-100">{availableShares}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">
                  Shares to Withdraw
                </label>
                <input
                  type="number"
                  value={shares}
                  onChange={(e) => setShares(e.target.value)}
                  placeholder="500.00"
                  step="0.01"
                  min="0.01"
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={withdraw.isPending || !shares || parseFloat(shares) <= 0}
                className="w-full bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium px-6 py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {withdraw.isPending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Withdrawing...
                  </>
                ) : (
                  'Withdraw'
                )}
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
