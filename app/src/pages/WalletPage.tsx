import { useRef, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { PageHeader } from '../components/layout'
import { WalletCard } from '../components/agent'
import { EmptyState } from '../components/shared'
import { Wallet, Download, Upload, Key } from 'lucide-react'
import { exportAgentKeypair, importAgentKeypair, hasAgentKeypair } from '../utils/agentKeystore'
import toast from 'react-hot-toast'

export default function WalletPage() {
  const { connected, publicKey } = useWallet()

  if (!connected) {
    return (
      <EmptyState
        icon={<Wallet size={48} />}
        title="Connect your wallet"
        description="Connect a Solana wallet to view wallet details."
      />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Agent Wallet" subtitle="Manage your agent wallet and spending limits" />
      <WalletCard />
      {publicKey && <KeypairManagement ownerPubkey={publicKey.toBase58()} />}
    </div>
  )
}

function KeypairManagement({ ownerPubkey }: { ownerPubkey: string }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [hasKey, setHasKey] = useState(() => hasAgentKeypair(ownerPubkey))

  const handleExport = async () => {
    const json = await exportAgentKeypair(ownerPubkey)
    if (!json) {
      toast.error('No agent keypair found to export')
      return
    }
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `krexa-agent-${ownerPubkey.slice(0, 8)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Keypair exported')
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      await importAgentKeypair(ownerPubkey, text)
      setHasKey(true)
      toast.success('Keypair imported successfully')
    } catch (err) {
      toast.error(`Import failed: ${(err as Error).message}`)
    }
    // Reset file input
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <Key size={16} className="text-amber-400" />
        <h3 className="text-sm font-medium text-gray-400">Agent Keypair</h3>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Your agent keypair is stored encrypted in this browser. Export a backup to restore on another device.
      </p>
      <div className="flex gap-3 flex-wrap">
        {hasKey && (
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border border-amber-500/30 transition-colors"
          >
            <Download size={14} />
            Export Backup
          </button>
        )}
        <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 transition-colors cursor-pointer">
          <Upload size={14} />
          Import Keypair
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
        </label>
      </div>
      {!hasKey && (
        <p className="text-xs text-gray-600 mt-3">
          No agent keypair found. Register an agent from the Dashboard, or import a backup file.
        </p>
      )}
    </div>
  )
}
