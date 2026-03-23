import { useQuery } from '@tanstack/react-query'
import { useKrexa } from './useKrexa'
import { config } from '../config'

export function useVaultStats() {
  const client = useKrexa()

  return useQuery({
    queryKey: ['vault-stats'],
    queryFn: () => client.vault.getStats(),
    refetchInterval: config.refreshIntervals.vault,
    retry: 1,
  })
}
