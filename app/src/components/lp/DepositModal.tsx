import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Loader2 } from 'lucide-react'
import { useDepositLP } from '../../hooks/useDepositLP'

interface DepositModalProps {
  isOpen: boolean
  onClose: () => void
}

const TRANCHES = [
  { value: 0, label: 'Senior', apr: '10%', desc: 'Lowest risk, first priority on yields', color: 'text-blue-400' },
  { value: 1, label: 'Mezzanine', apr: '12%', desc: 'Medium risk, absorbs losses after junior', color: 'text-purple-400' },
  { value: 2, label: 'Junior', apr: '20%', desc: 'Highest risk/reward, first-loss position', color: 'text-orange-400', disabled: true },
]

export function DepositModal({ isOpen, onClose }: DepositModalProps) {
  const [tranche, setTranche] = useState(0)
  const [amount, setAmount] = useState('')
  const deposit = useDepositLP()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const val = parseFloat(amount)
    if (isNaN(val) || val <= 0) return

    await deposit.mutateAsync({ amount: val, tranche })
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
              <h2 className="text-lg font-semibold text-white">Deposit Liquidity</h2>
              <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">
                  Tranche
                </label>
                <div className="space-y-2">
                  {TRANCHES.map((t) => (
                    <label
                      key={t.value}
                      className={`flex items-center justify-between p-3 rounded-xl cursor-pointer border transition-colors ${
                        t.disabled ? 'opacity-40 cursor-not-allowed border-gray-700/30' :
                        tranche === t.value
                          ? 'border-blue-500/50 bg-blue-500/10'
                          : 'border-gray-700/50 bg-gray-800/30 hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="tranche"
                          value={t.value}
                          checked={tranche === t.value}
                          onChange={() => !t.disabled && setTranche(t.value)}
                          disabled={t.disabled}
                          className="accent-blue-500"
                        />
                        <div>
                          <span className={`text-sm font-medium ${t.color}`}>{t.label}</span>
                          <p className="text-xs text-gray-500">{t.desc}</p>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-gray-300">{t.apr}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">
                  Amount (USDC)
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="1000.00"
                  step="0.01"
                  min="1"
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={deposit.isPending || !amount || parseFloat(amount) <= 0}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium px-6 py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {deposit.isPending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Depositing...
                  </>
                ) : (
                  'Deposit'
                )}
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
