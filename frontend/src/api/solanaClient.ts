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

// === Agent Wallet  (mounted at /solana/wallets) ===
export const agentApi = {
  getWallet:  (address: string) => solanaApi.get(`/solana/wallets/${address}`),
  getHealth:  (address: string) => solanaApi.get(`/solana/wallets/${address}/health`),
  getBalance: (address: string) => solanaApi.get(`/solana/wallets/${address}/balance`),
}

// === Credit  (mounted at /solana/credit) ===
export const creditApi = {
  getLine:       (address: string) => solanaApi.get(`/solana/credit/${address}/line`),
  getEligibility:(address: string) => solanaApi.get(`/solana/credit/${address}/eligibility`),
  getScoreBreakdown: (address: string) => solanaApi.get(`/solana/credit/${address}/score-breakdown`),
  getProtocolParams: ()             => solanaApi.get('/solana/credit/protocol-params'),
}

// === Vault  (mounted at /solana/vault) ===
export const vaultApi = {
  getStats:    () => solanaApi.get('/solana/vault/stats'),
  getLpPosition: (address: string) => solanaApi.get(`/solana/vault/lp/${address}`),
  getCollateral: (address: string) => solanaApi.get(`/solana/vault/collateral/${address}`),
}

// === Score  (mounted at /solana/score) ===
export const scoreApi = {
  getScore: (address: string) => solanaApi.get(`/solana/score/${address}`),
}

// === Health ===
export const healthApi = {
  check:      () => solanaApi.get('/health'),
  vaultHealth:() => solanaApi.get('/solana/vault/health'),
}
