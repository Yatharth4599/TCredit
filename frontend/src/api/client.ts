import axios from 'axios'
import type {
  ApiVault,
  ApiVaultDetail,
  ApiInvestor,
  ApiTrancheResponse,
  ApiMilestone,
  ApiVaultEvent,
  ApiMerchantProfile,
  ApiMerchantStats,
  ApiPool,
  ApiPoolsSummary,
  ApiPortfolioInvestment,
  ApiPortfolioSummary,
  ApiPlatformStats,
  ApiPlatformConfig,
  ApiOraclePayment,
  ApiHealthResponse,
  UnsignedTx,
  CreateVaultParams,
} from './types'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    console.error('[API Error]', err.response?.status, err.config?.url)
    return Promise.reject(err)
  }
)

// === Health ===
export const healthApi = {
  check: () => api.get<ApiHealthResponse>('/v1/health'),
}

// === Vaults ===
export const vaultsApi = {
  list: (params?: { state?: string; agent?: string }) =>
    api.get<{ vaults: ApiVault[]; total: number }>('/v1/vaults', { params }),

  detail: (address: string) =>
    api.get<ApiVaultDetail>(`/v1/vaults/${address}`),

  investors: (address: string) =>
    api.get<{ investors: ApiInvestor[]; total: number }>(`/v1/vaults/${address}/investors`),

  waterfall: (address: string) =>
    api.get<{ seniorFunded: string; poolFunded: string; userFunded: string; seniorRepaid: string; poolRepaid: string; communityRepaid: string }>(`/v1/vaults/${address}/waterfall`),

  repayments: (address: string) =>
    api.get<{ repayments: ApiVaultEvent[]; total: number }>(`/v1/vaults/${address}/repayments`),

  tranches: (address: string) =>
    api.get<ApiTrancheResponse>(`/v1/vaults/${address}/tranches`),

  milestones: (address: string) =>
    api.get<{ milestones: ApiMilestone[]; total: number }>(`/v1/vaults/${address}/milestones`),

  create: (body: CreateVaultParams) =>
    api.post<UnsignedTx>('/v1/vaults/create', body),

  submitMilestone: (address: string, body: { trancheIndex: number; evidenceHash: string }) =>
    api.post<UnsignedTx>(`/v1/vaults/${address}/milestone/submit`, body),

  voteMilestone: (address: string, body: { trancheIndex: number; approve: boolean }) =>
    api.post<UnsignedTx>(`/v1/vaults/${address}/milestone/vote`, body),
}

// === Merchants ===
export const merchantApi = {
  profile: (address: string) =>
    api.get<ApiMerchantProfile>(`/v1/merchants/${address}`),

  stats: (address: string) =>
    api.get<ApiMerchantStats>(`/v1/merchants/${address}/stats`),

  vaults: (address: string) =>
    api.get<{ vaults: ApiVault[]; total: number }>(`/v1/merchants/${address}/vaults`),

  register: (body: { metadataURI: string }) =>
    api.post<UnsignedTx>('/v1/merchants/register', body),

  updateCreditScore: (address: string, body: { score: number }) =>
    api.post<UnsignedTx>(`/v1/merchants/${address}/credit-score`, body),
}

// === Pools ===
export const poolsApi = {
  list: () =>
    api.get<{ pools: ApiPool[]; total: number; summary: ApiPoolsSummary }>('/v1/pools'),

  detail: (address: string) =>
    api.get<ApiPool>(`/v1/pools/${address}`),

  deposit: (body: { poolAddress: string; amount: string }) =>
    api.post<UnsignedTx>('/v1/pools/deposit', body),

  withdraw: (body: { poolAddress: string; amount: string }) =>
    api.post<UnsignedTx>('/v1/pools/withdraw', body),

  allocate: (body: { poolAddress: string; vaultAddress: string; amount: string }) =>
    api.post<UnsignedTx>('/v1/pools/allocate', body),
}

// === Investments ===
export const investApi = {
  portfolio: (address: string) =>
    api.get<{ investments: ApiPortfolioInvestment[]; total: number; summary: ApiPortfolioSummary }>(`/v1/portfolio/${address}`),

  invest: (body: { vaultAddress: string; amount: string }) =>
    api.post<UnsignedTx>('/v1/invest', body),

  claim: (body: { vaultAddress: string }) =>
    api.post<UnsignedTx>('/v1/claim', body),

  refund: (body: { vaultAddress: string }) =>
    api.post<UnsignedTx>('/v1/refund', body),
}

// === Platform ===
export const platformApi = {
  stats: () =>
    api.get<ApiPlatformStats>('/v1/platform/stats'),

  config: () =>
    api.get<ApiPlatformConfig>('/v1/platform/config'),

  indexer: () =>
    api.get<{ running: boolean; lastIndexedBlock: string; latestBlock: string; lagBlocks: string; synced: boolean; eventCounts: Record<string, number> }>('/v1/platform/indexer'),

  keeper: () =>
    api.get<{ status: string; running: boolean }>('/v1/platform/keeper'),
}

// === Oracle ===
export const oracleApi = {
  health: () =>
    api.get<{ status: string; oracleConfigured: boolean; queue: { pending: number; submitted: number; failed: number } }>('/v1/oracle/health'),

  payments: (params?: { status?: string; vault?: string; limit?: number }) =>
    api.get<{ payments: ApiOraclePayment[]; total: number }>('/v1/oracle/payments', { params }),
}

// === Waitlist ===
export const waitlistApi = {
  join: (email: string, walletAddress?: string) =>
    api.post<{ success: boolean; id: string }>('/v1/waitlist', { email, walletAddress }),
  count: () =>
    api.get<{ count: number }>('/v1/waitlist/count'),
}

// === Payments ===
export const paymentsApi = {
  recent: (vaultId?: string) =>
    api.get<{ payments: ApiVaultEvent[]; total: number }>('/v1/payments/recent', { params: { vaultId } }),
}
