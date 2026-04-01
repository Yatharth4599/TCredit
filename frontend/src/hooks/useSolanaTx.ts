import { useState, useCallback } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { Transaction } from '@solana/web3.js'
import { PROGRAM_IDS } from '../config/solana'

/** Programs the frontend is allowed to interact with */
const ALLOWED_PROGRAMS = new Set<string>([
  // Krexa protocol programs
  ...Object.values(PROGRAM_IDS),
  // SPL Token
  'TokenkegQEcnFi1EJkVhTag4wLnb82x2E6aUCGRBt',
  // System Program
  '11111111111111111111111111111111',
  // Associated Token Program
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
])

export type TxStatus = 'idle' | 'signing' | 'submitted' | 'confirming' | 'confirmed' | 'failed'

export function useSolanaTx() {
  const { connection } = useConnection()
  const { signTransaction, publicKey } = useWallet()
  const [status, setStatus] = useState<TxStatus>('idle')
  const [txSig, setTxSig] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reset = useCallback(() => {
    setStatus('idle')
    setTxSig(null)
    setError(null)
  }, [])

  const execute = useCallback(async (base64Tx: string): Promise<string> => {
    if (!signTransaction || !publicKey) {
      throw new Error('Wallet not connected')
    }

    try {
      setStatus('signing')
      setError(null)
      setTxSig(null)

      // Decode the base64 unsigned transaction
      const txBuffer = Buffer.from(base64Tx, 'base64')
      const transaction = Transaction.from(txBuffer)

      // ── Security: validate fee payer matches connected wallet ──
      if (transaction.feePayer && !transaction.feePayer.equals(publicKey)) {
        throw new Error(
          `Transaction fee payer (${transaction.feePayer.toBase58()}) does not match connected wallet (${publicKey.toBase58()})`
        )
      }

      // ── Security: validate all instruction programIds against allowlist ──
      for (const ix of transaction.instructions) {
        const programId = ix.programId.toBase58()
        if (!ALLOWED_PROGRAMS.has(programId)) {
          throw new Error(`Transaction contains unknown program: ${programId}`)
        }
      }

      // Wallet signs
      const signed = await signTransaction(transaction)
      setStatus('submitted')

      // Send to Solana
      const sig = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      })
      setTxSig(sig)
      setStatus('confirming')

      // Wait for confirmation
      const confirmation = await connection.confirmTransaction(sig, 'confirmed')
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`)
      }

      setStatus('confirmed')
      return sig
    } catch (err) {
      setStatus('failed')
      const msg = err instanceof Error ? err.message : 'Transaction failed'
      setError(msg)
      throw err
    }
  }, [connection, signTransaction, publicKey])

  return { execute, status, txSig, error, reset }
}
