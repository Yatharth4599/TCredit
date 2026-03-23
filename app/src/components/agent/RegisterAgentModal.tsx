import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, X, Loader2 } from 'lucide-react'
import { useRegisterAgent } from '../../hooks/useRegisterAgent'

interface RegisterAgentModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (agentPubkey: string) => void
}

const AGENT_TYPES = [
  { value: 0, label: 'Trader', desc: 'Algorithmic trading agent with venue access' },
  { value: 1, label: 'Service', desc: 'Revenue-generating service with milestone-based credit' },
  { value: 2, label: 'Hybrid', desc: 'Combined trading and service operations' },
]

export function RegisterAgentModal({ isOpen, onClose, onSuccess }: RegisterAgentModalProps) {
  const [name, setName] = useState('')
  const [agentType, setAgentType] = useState(0)
  const register = useRegisterAgent()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    const result = await register.mutateAsync({ name: name.trim(), agentType })
    onSuccess?.(result.agentPubkey)
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
              <div className="flex items-center gap-2">
                <Bot size={20} className="text-blue-400" />
                <h2 className="text-lg font-semibold text-white">Register Agent</h2>
              </div>
              <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">
                  Agent Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. MyTradingBot"
                  maxLength={32}
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">{name.length}/32 characters</p>
              </div>

              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">
                  Agent Type
                </label>
                <div className="space-y-2">
                  {AGENT_TYPES.map((t) => (
                    <label
                      key={t.value}
                      className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer border transition-colors ${
                        agentType === t.value
                          ? 'border-blue-500/50 bg-blue-500/10'
                          : 'border-gray-700/50 bg-gray-800/30 hover:border-gray-600'
                      }`}
                    >
                      <input
                        type="radio"
                        name="agentType"
                        value={t.value}
                        checked={agentType === t.value}
                        onChange={() => setAgentType(t.value)}
                        className="mt-1 accent-blue-500"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-200">{t.label}</span>
                        <p className="text-xs text-gray-500 mt-0.5">{t.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="bg-gray-800/50 rounded-xl p-3">
                <p className="text-xs text-gray-400">
                  A new agent keypair will be generated and stored in your browser. Your connected wallet becomes the owner (signer for all transactions).
                </p>
              </div>

              <button
                type="submit"
                disabled={!name.trim() || register.isPending}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium px-6 py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {register.isPending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Registering...
                  </>
                ) : (
                  'Register Agent'
                )}
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
