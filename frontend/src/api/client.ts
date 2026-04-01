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
  ApiSettlement,
  ApiRepaymentResult,
  ApiAgentIdentity,
  ApiGatewaySummary,
  ApiGatewayBreakdown,
  ApiAgentWallet,
  UnsignedTx,
  CreateVaultParams,
  EnrichedTokensResponse,
  ApiTraderProfile,
  ApiTraderVault,
  PolymarketStats,
} from './types'

const BASE_URL = import.meta.env.VITE_API_URL || '/api'

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
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
    api.post<{ success: boolean; txHash: string; status: string; description: string }>('/v1/vaults/create', body),

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

  settlement: (address: string) =>
    api.get<ApiSettlement>(`/v1/merchants/${address}/settlement`),

  repayments: (address: string, params?: { limit?: number }) =>
    api.get<{ repayments: ApiOraclePayment[]; total: number }>(`/v1/merchants/${address}/repayments`, { params }),

  repay: (address: string, body: { repaymentAmount: string }) =>
    api.post<ApiRepaymentResult>(`/v1/merchants/${address}/repay`, body),
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
    api.post<{ success: boolean; id: string; alreadyJoined: boolean }>('/v1/waitlist', { email, walletAddress }),
  count: () =>
    api.get<{ count: number }>('/v1/waitlist/count'),
  all: (apiKey: string) => {
    if (import.meta.env.DEV) console.warn('Admin API key used in client-side code — migrate to server-side auth')
    return api.get<{ entries: Array<{ id: string; email: string; walletAddress: string | null; createdAt: string }>; total: number }>(
      '/v1/admin/waitlist', { headers: { 'x-api-key': apiKey } }
    )
  },
  exportCsv: (apiKey: string) => {
    if (import.meta.env.DEV) console.warn('Admin API key used in client-side code — migrate to server-side auth')
    return api.get('/v1/admin/waitlist/export', { headers: { 'x-api-key': apiKey }, responseType: 'blob' })
  },
}

// === Agent Identity ===
export const identityApi = {
  get: (address: string) =>
    api.get<ApiAgentIdentity>(`/v1/identity/${address}`),

  score: (address: string) =>
    api.get<{ agent: string; score: number; hasIdentity: boolean }>(`/v1/identity/${address}/score`),

  mint: (body: { agent: string }) =>
    api.post<UnsignedTx>('/v1/identity/mint', body),
}

// === Gateway ===
export const gatewayApi = {
  summary: (address: string) =>
    api.get<ApiGatewaySummary>(`/v1/gateway/${address}/summary`),

  breakdown: (address: string) =>
    api.get<ApiGatewayBreakdown>(`/v1/gateway/${address}/breakdown`),

  payments: (address: string) =>
    api.get<{ payments: ApiGatewaySummary['recentPayments']; total: number }>(`/v1/gateway/${address}/payments`),
}

// === Agent Wallets ===
export const walletsApi = {
  list: () =>
    api.get<{ wallets: ApiAgentWallet[]; total: number }>('/v1/wallets'),

  byOwner: (address: string) =>
    api.get<ApiAgentWallet>(`/v1/wallets/by-owner/${address}`),

  detail: (address: string) =>
    api.get<ApiAgentWallet>(`/v1/wallets/${address}`),

  create: (body: { operator: string; dailyLimitUsdc?: string; perTxLimitUsdc?: string }) =>
    api.post<UnsignedTx>('/v1/wallets/create', body),

  setLimits: (address: string, body: { dailyLimitUsdc: string; perTxLimitUsdc: string }) =>
    api.post<UnsignedTx>(`/v1/wallets/${address}/set-limits`, body),

  setOperator: (address: string, body: { operator: string }) =>
    api.post<UnsignedTx>(`/v1/wallets/${address}/set-operator`, body),

  whitelist: (address: string, body: { recipient: string; allowed: boolean }) =>
    api.post<UnsignedTx>(`/v1/wallets/${address}/whitelist`, body),

  freeze: (address: string) =>
    api.post<UnsignedTx>(`/v1/wallets/${address}/freeze`),

  unfreeze: (address: string) =>
    api.post<UnsignedTx>(`/v1/wallets/${address}/unfreeze`),

  linkCredit: (address: string, body: { vault: string }) =>
    api.post<UnsignedTx>(`/v1/wallets/${address}/link-credit`, body),

  transfer: (address: string, body: { to: string; amountUsdc: string }) =>
    api.post<UnsignedTx>(`/v1/wallets/${address}/transfer`, body),

  deposit: (address: string, body: { amountUsdc: string }) =>
    api.post<UnsignedTx>(`/v1/wallets/${address}/deposit`, body),

  balance: (address: string) =>
    api.get<{ address: string; balanceUsdc: string }>(`/v1/wallets/${address}/balance`),

  emergencyWithdraw: (address: string, body: { to: string }) =>
    api.post<UnsignedTx>(`/v1/wallets/${address}/emergency-withdraw`, body),

  toggleWhitelist: (address: string, body: { enabled: boolean }) =>
    api.post<UnsignedTx>(`/v1/wallets/${address}/toggle-whitelist`, body),

  history: (address: string) =>
    api.get<{ events: Array<{ to: string; amount: string; blockNumber: string; txHash: string }>; total: number }>(`/v1/wallets/${address}/history`),
}

// === Payments ===
export const paymentsApi = {
  recent: (vaultId?: string) =>
    api.get<{ payments: ApiVaultEvent[]; total: number }>('/v1/payments/recent', { params: { vaultId } }),
}

// === Traders (Polymarket Credit) ===
export const tradersApi = {
  profile: (address: string) =>
    api.get<ApiTraderProfile>(`/v1/traders/${address}`),

  stats: (address: string) =>
    api.get<PolymarketStats>(`/v1/traders/${address}/stats`),

  vault: (address: string) =>
    api.get<ApiTraderVault>(`/v1/traders/${address}/vault`),

  register: (body?: { metadataURI?: string }) =>
    api.post<UnsignedTx>('/v1/traders/register', body ?? {}),

  createVault: () =>
    api.post<UnsignedTx>('/v1/traders/create-vault', {}),

  draw: (vaultAddress: string, body: { amount: string }) =>
    api.post<UnsignedTx>(`/v1/traders/${vaultAddress}/draw`, body),

  repay: (vaultAddress: string, body: { amount: string }) =>
    api.post<UnsignedTx>(`/v1/traders/${vaultAddress}/repay`, body),

  score: (address: string) =>
    api.post<UnsignedTx & { polymarketStats: PolymarketStats; suggestedScore: number }>(`/v1/traders/${address}/score`, {}),
}

// === Kickstart (EasyA) ===
export const kickstartApi = {
  uploadMetadata: (body: { name: string; ticker: string; description: string; imageUrl?: string; imageBase64?: string; imageMime?: string; twitter?: string; telegram?: string; website?: string }) =>
    api.post<{ uri: string; description: string }>('/v1/kickstart/upload-metadata', body),

  createToken: (body: { name: string; symbol: string; uri: string; initialBuyEth?: string }) =>
    api.post<UnsignedTx & { value: string; chainId: number }>('/v1/kickstart/create-token', body),

  buyToken: (body: { curveAddress: string; ethAmount: string; minTokensOut?: string }) =>
    api.post<UnsignedTx & { value: string; chainId: number }>('/v1/kickstart/buy-token', body),

  creditAndLaunch: (body: {
    vaultAddress?: string; name: string; symbol: string;
    description?: string; imageUrl?: string; initialBuyEth?: string;
  }) =>
    api.post<{
      steps: Array<{
        step: number; network: string; chainId: number; action: string;
        description: string; tx?: { to: string; data: string; value?: string }; note?: string;
      }>;
      totalSteps: number; note: string;
    }>('/v1/kickstart/credit-and-launch', body),

  tokens: (params?: { start?: number; count?: number }) =>
    api.get<{ tokens: Array<{ curve: string; token: string | null }>; total: number }>(
      '/v1/kickstart/tokens', { params }
    ),

  enrichedTokens: (params?: { start?: number; count?: number }) =>
    api.get<EnrichedTokensResponse>('/v1/kickstart/tokens/enriched', { params }),

  config: () =>
    api.get<{ factory: string; chainId: number; virtualEth: string; virtualToken: string; targetEth: string }>(
      '/v1/kickstart/config'
    ),
}
