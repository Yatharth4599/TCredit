import axios from 'axios'

const KREXA_API_URL = import.meta.env.VITE_KREXA_API_URL || 'http://localhost:3001'

export const solanaApi = axios.create({
  baseURL: KREXA_API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

solanaApi.interceptors.response.use(
  (res) => res,
  (err) => {
    console.error('[Solana API Error]', err.response?.status, err.config?.url)
    return Promise.reject(err)
  }
)

// === Agent ===
export const agentApi = {
  getProfile: (address: string) => solanaApi.get(`/agent/${address}/profile`),
  getWallet: (address: string) => solanaApi.get(`/agent/${address}/wallet`),
  getHealth: (address: string) => solanaApi.get(`/agent/${address}/health`),
  getScore: (address: string) => solanaApi.get(`/agent/${address}/score`),
  getTerms: (address: string) => solanaApi.get(`/agent/${address}/terms`),
  getServicePlan: (address: string) => solanaApi.get(`/agent/${address}/service-plan`),
}

// === Credit ===
export const creditApi = {
  getCreditLine: (address: string) => solanaApi.get(`/credit/${address}/line`),
  getRepaymentEstimate: (address: string) => solanaApi.get(`/credit/${address}/repayment-estimate`),
  getUpgradeCheck: (address: string) => solanaApi.get(`/credit/${address}/upgrade-check`),
}

// === Vault ===
export const vaultApi = {
  getStats: () => solanaApi.get('/vault/stats'),
  getTrancheStats: (tranche: string) => solanaApi.get(`/vault/tranche/${tranche}`),
  getRevenue: () => solanaApi.get('/vault/revenue'),
  getLossBuffer: () => solanaApi.get('/vault/loss-buffer'),
}

// === LP ===
export const lpApi = {
  getPositions: (address: string) => solanaApi.get(`/lp/${address}/positions`),
  getPosition: (address: string, tranche: string) => solanaApi.get(`/lp/${address}/position/${tranche}`),
  previewDeposit: (tranche: string, amount: string) => solanaApi.get(`/lp/preview/deposit`, { params: { tranche, amount } }),
  previewWithdraw: (tranche: string, shares: string) => solanaApi.get(`/lp/preview/withdraw`, { params: { tranche, shares } }),
}

// === Wallet (owner-level) ===
export const walletApi = {
  getByOwner: (ownerPubkey: string, limit = 50) =>
    solanaApi.get('/solana/wallets', { params: { owner: ownerPubkey, limit } }),
}

// === Score ===
export const scoreApi = {
  getScore: (address: string) => solanaApi.get(`/agent/${address}/score`),
  getProfile: (address: string) => solanaApi.get(`/agent/${address}/profile`),
  getHealth: (address: string) => solanaApi.get(`/agent/${address}/health`),
  getServicePlan: (address: string) => solanaApi.get(`/agent/${address}/service-plan`),
}

// === Health ===
export const healthApi = {
  check: () => solanaApi.get('/health'),
}
