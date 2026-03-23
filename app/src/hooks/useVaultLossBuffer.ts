import { useQuery } from '@tanstack/react-query'
import { useKrexa } from './useKrexa'
import { config } from '../config'

export function useVaultLossBuffer() {
  const client = useKrexa()
  return useQuery({
    queryKey: ['vault-loss-buffer'],
    queryFn: () => client.vault.getLossBufferStatus(),
    staleTime: config.refreshIntervals.vault,
    retry: 1,
  })
}
