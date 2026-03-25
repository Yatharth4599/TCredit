import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Loader2 } from 'lucide-react'
import { useRepay } from '../../hooks/useRepay'

interface RepayModalProps {
  isOpen: boolean
  onClose: () => void
  agentPubkey: string
  currentDebt?: string
  accruedInterest?: string
  /** Raw debt in USDC base units (6 decimals) for "Repay All" */
  rawDebtUsdc?: number
  /** Raw accrued interest in USDC base units (6 decimals) */
  rawInterestUsdc?: number
}

export function RepayModal({ isOpen, onClose, agentPubkey, currentDebt, accruedInterest, rawDebtUsdc, rawInterestUsdc }: RepayModalProps) {
  const [amount, setAmount] = useState('')
  const repay = useRepay()

  const totalDebtUsdc = rawDebtUsdc != null && rawInterestUsdc != null
    ? ((rawDebtUsdc + rawInterestUsdc) / 1e6)
    : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const val = parseFloat(amount)
    if (isNaN(val) || val <= 0) return

    await repay.mutateAsync({ agentPubkey, amount: val })
    setAmount('')
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
              <h2 className="text-lg font-semibold text-white">Repay Debt</h2>
              <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
                <X size={20} />
              </button>
            </div>

            {currentDebt && (
              <div className="bg-gray-800/50 rounded-xl p-4 mb-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-400">Principal</p>
                  <p className="text-lg font-bold text-gray-100">{currentDebt}</p>
                </div>
                {accruedInterest && (
                  <div>
                    <p className="text-xs text-gray-400">Accrued Interest</p>
                    <p className="text-lg font-bold text-gray-100">{accruedInterest}</p>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">
                  Amount (USDC)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="100.00"
                    step="0.01"
                    min="0.01"
                    className="flex-1 bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                  {totalDebtUsdc != null && totalDebtUsdc > 0 && (
                    <button
                      type="button"
                      onClick={() => setAmount(totalDebtUsdc.toFixed(2))}
                      className="px-3 py-2 text-xs font-medium bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-500/30 rounded-xl transition-colors whitespace-nowrap"
                    >
                      Repay All
                    </button>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={repay.isPending || !amount || parseFloat(amount) <= 0}
                className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium px-6 py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {repay.isPending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Repay'
                )}
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
