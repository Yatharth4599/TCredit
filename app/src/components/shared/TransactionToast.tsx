import { useEffect, useState } from 'react'
import { useConnection } from '@solana/wallet-adapter-react'
import { ExternalLink, CheckCircle, XCircle, Loader2 } from 'lucide-react'

interface TransactionToastProps {
  signature: string
  onConfirmed?: () => void
  onError?: (err: Error) => void
}

export function TransactionToast({ signature, onConfirmed, onError }: TransactionToastProps) {
  const { connection } = useConnection()
  const [status, setStatus] = useState<'pending' | 'confirmed' | 'error'>('pending')

  useEffect(() => {
    let cancelled = false
    connection.confirmTransaction(signature, 'confirmed')
      .then(() => {
        if (!cancelled) {
          setStatus('confirmed')
          onConfirmed?.()
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setStatus('error')
          onError?.(err)
        }
      })
    return () => { cancelled = true }
  }, [signature, connection, onConfirmed, onError])

  const explorerUrl = `https://explorer.solana.com/tx/${signature}?cluster=devnet`

  return (
    <div className="flex items-center gap-3 text-sm">
      {status === 'pending' && (
        <Loader2 size={16} className="text-blue-400 animate-spin shrink-0" />
      )}
      {status === 'confirmed' && (
        <CheckCircle size={16} className="text-green-400 shrink-0" />
      )}
      {status === 'error' && (
        <XCircle size={16} className="text-red-400 shrink-0" />
      )}
      <span className={status === 'error' ? 'text-red-400' : status === 'confirmed' ? 'text-green-400' : 'text-gray-300'}>
        {status === 'pending' ? 'Confirming...' : status === 'confirmed' ? 'Confirmed' : 'Failed'}
      </span>
      <a
        href={explorerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
      >
        Explorer <ExternalLink size={12} />
      </a>
    </div>
  )
}

export function explorerTxUrl(sig: string): string {
  return `https://explorer.solana.com/tx/${sig}?cluster=devnet`
}
