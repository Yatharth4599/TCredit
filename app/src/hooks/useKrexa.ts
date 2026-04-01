import { useMemo } from 'react'
import { useConnection } from '@solana/wallet-adapter-react'
import { KrexaClient } from '@krexa/solana-sdk'

export function useKrexa() {
  const { connection } = useConnection()

  const client = useMemo(() => {
    return new KrexaClient({ connection })
  }, [connection])

  return client
}
