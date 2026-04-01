import { useState } from 'react'
import { motion } from 'framer-motion'
import { Shield, Loader2, CheckCircle } from 'lucide-react'
import { useCreateWallet } from '../../hooks/useCreateWallet'

interface CreateWalletStepProps {
  agentPubkey?: string
  onSuccess?: () => void
}

export function CreateWalletStep({ agentPubkey, onSuccess }: CreateWalletStepProps) {
  const [dailyLimit, setDailyLimit] = useState('1000')
  const createWallet = useCreateWallet()

  const handleCreate = async () => {
    const limit = parseFloat(dailyLimit)
    if (isNaN(limit) || limit <= 0) return

    await createWallet.mutateAsync({ dailySpendLimit: limit })
    onSuccess?.()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6"
    >
      <div className="flex items-center gap-2 mb-4">
        <Shield size={20} className="text-purple-400" />
        <h3 className="text-lg font-semibold text-white">Create Agent Wallet</h3>
      </div>

      <p className="text-sm text-gray-400 mb-4">
        Set up a credit wallet for your agent. This creates an on-chain wallet PDA with a daily spending limit.
      </p>

      {agentPubkey && (
        <div className="bg-gray-900/50 rounded-xl px-3 py-2 mb-4">
          <p className="text-xs text-gray-500">Agent</p>
          <p className="text-xs text-gray-300 font-mono break-all">{agentPubkey}</p>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">
            Daily Spend Limit (USDC)
          </label>
          <input
            type="number"
            value={dailyLimit}
            onChange={(e) => setDailyLimit(e.target.value)}
            placeholder="1000"
            min="1"
            step="1"
            className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            Maximum USDC the agent can spend per day. Can be changed later.
          </p>
        </div>

        {createWallet.isSuccess ? (
          <div className="flex items-center gap-2 text-green-400 py-2">
            <CheckCircle size={16} />
            <span className="text-sm">Wallet created successfully!</span>
          </div>
        ) : (
          <button
            onClick={handleCreate}
            disabled={createWallet.isPending || !dailyLimit || parseFloat(dailyLimit) <= 0}
            className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium px-6 py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {createWallet.isPending ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Creating Wallet...
              </>
            ) : (
              'Create Wallet'
            )}
          </button>
        )}
      </div>
    </motion.div>
  )
}
