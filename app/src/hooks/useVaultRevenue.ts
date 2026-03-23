import { useQuery } from '@tanstack/react-query'
import { useKrexa } from './useKrexa'
import { config } from '../config'

export function useVaultRevenue() {
  const client = useKrexa()
  return useQuery({
    queryKey: ['vault-revenue'],
    queryFn: () => client.vault.getRevenueBreakdown(),
    staleTime: config.refreshIntervals.vault,
    retry: 1,
  })
}
