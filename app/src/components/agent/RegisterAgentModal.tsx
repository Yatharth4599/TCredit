import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, X, Loader2, Download, AlertTriangle } from 'lucide-react'
import { useRegisterAgent } from '../../hooks/useRegisterAgent'
import { exportAgentKeypair } from '../../utils/agentKeystore'
import { useWallet } from '@solana/wallet-adapter-react'
import toast from 'react-hot-toast'

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
  const [showBackup, setShowBackup] = useState(false)
  const [registeredPubkey, setRegisteredPubkey] = useState<string | null>(null)
  const register = useRegisterAgent()
  const { publicKey } = useWallet()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    const result = await register.mutateAsync({ name: name.trim(), agentType })
    setRegisteredPubkey(result.agentPubkey)
    setShowBackup(true)
    onSuccess?.(result.agentPubkey)
  }

  const handleExportKeypair = async () => {
    if (!publicKey) return
    const json = await exportAgentKeypair(publicKey.toBase58())
    if (!json) {
      toast.error('No keypair found to export')
      return
    }
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `krexa-agent-${registeredPubkey?.slice(0, 8) ?? 'key'}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Keypair exported — store this file securely!')
  }

  const handleClose = () => {
    setShowBackup(false)
    setRegisteredPubkey(null)
    setName('')
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
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-gray-900 border border-gray-700/50 rounded-2xl p-6 w-full max-w-md mx-4"
          >
            {showBackup ? (
              /* Backup prompt after successful registration */
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={20} className="text-amber-400" />
                  <h2 className="text-lg font-semibold text-white">Back Up Your Agent Key</h2>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                  <p className="text-sm text-amber-300 mb-2">
                    Your agent keypair is stored encrypted in this browser. If you clear browser data or switch devices, you will lose access.
                  </p>
                  <p className="text-xs text-amber-400/70">
                    Export and save the backup file securely. You can import it later from Settings.
                  </p>
                </div>
                {registeredPubkey && (
                  <div className="bg-gray-800/50 rounded-xl px-3 py-2">
                    <p className="text-xs text-gray-500">Agent Public Key</p>
                    <p className="text-xs text-gray-300 font-mono break-all">{registeredPubkey}</p>
                  </div>
                )}
                <button
                  onClick={handleExportKeypair}
                  className="w-full bg-amber-600 hover:bg-amber-500 text-white font-medium px-6 py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <Download size={16} />
                  Export Keypair Backup
                </button>
                <button
                  onClick={handleClose}
                  className="w-full text-gray-400 hover:text-gray-200 text-sm py-2 transition-colors"
                >
                  Skip for now
                </button>
              </div>
            ) : (
              /* Registration form */
              <>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <Bot size={20} className="text-blue-400" />
                    <h2 className="text-lg font-semibold text-white">Register Agent</h2>
                  </div>
                  <button onClick={handleClose} className="text-gray-500 hover:text-gray-300">
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
                      A new agent keypair will be generated and stored encrypted in your browser. Your connected wallet becomes the owner. You'll be prompted to export a backup after registration.
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
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
