import axios from 'axios'

const KREXA_API_URL = import.meta.env.VITE_KREXA_API_URL || 'http://localhost:3001'

// Prevent mixed-content requests in production: block http:// API URLs on https:// pages
if (
  typeof window !== 'undefined' &&
  window.location.protocol === 'https:' &&
  KREXA_API_URL.startsWith('http://') &&
  !KREXA_API_URL.startsWith('https://')
) {
  throw new Error(
    `Refusing to use insecure API URL (${KREXA_API_URL}) on an HTTPS page. ` +
    'Set VITE_KREXA_API_URL to an https:// endpoint.'
  )
}

export const solanaApi = axios.create({
  baseURL: KREXA_API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

solanaApi.interceptors.response.use(
  (res) => res,
  (err) => {
    if (import.meta.env.DEV) console.error('[Solana API Error]', err.response?.status, err.config?.url)
    return Promise.reject(err)
  }
)

// === Agent Wallet (mounted at /solana/wallets) ===
export const agentApi = {
  getProfile: (address: string) => solanaApi.get(`/solana/wallets/${address}`),
  getWallet: (address: string) => solanaApi.get(`/solana/wallets/${address}`),
  getHealth: (address: string) => solanaApi.get(`/solana/wallets/${address}/health`),
  getBalance: (address: string) => solanaApi.get(`/solana/wallets/${address}/balance`),
  getScore: (address: string) => solanaApi.get(`/solana/score/${address}`),
  getTerms: (address: string) => solanaApi.get(`/solana/credit/${address}/line`),
  getServicePlan: (address: string) => solanaApi.get(`/solana/wallets/${address}/service-plan`),
  createWallet: (agent: string, owner: string, dailySpendLimitUsdc?: number, agentType?: number) =>
    solanaApi.post('/solana/wallets/create', { agent, owner, dailySpendLimitUsdc, agentType }),
}

// === Credit (mounted at /solana/credit) ===
export const creditApi = {
  getCreditLine: (address: string) => solanaApi.get(`/solana/credit/${address}/line`),
  getRepaymentEstimate: (address: string) => solanaApi.get(`/solana/credit/${address}/repayment-estimate`),
  getUpgradeCheck: (address: string) => solanaApi.get(`/solana/credit/${address}/upgrade-check`),
  getEligibility: (address: string) => solanaApi.get(`/solana/credit/${address}/eligibility`),
  getScoreBreakdown: (address: string) => solanaApi.get(`/solana/credit/${address}/score-breakdown`),
  getProtocolParams: () => solanaApi.get('/solana/credit/protocol-params'),
  requestCredit: (agent: string, amount: number, creditLevel: number) =>
    solanaApi.post(`/solana/credit/${agent}/request`, { amount, creditLevel }),
  repay: (agent: string, amount: number | string, callerPubkey: string) =>
    solanaApi.post(`/solana/credit/${agent}/repay`, { amount: String(amount), callerPubkey }),
  getActivity: (agent: string) => solanaApi.get(`/solana/credit/${agent}/activity`),
  getRequests: (agent: string) => solanaApi.get(`/solana/credit/${agent}/requests`),
  signAgreement: (agent: string, creditLevel: number) =>
    solanaApi.post(`/solana/credit/${agent}/sign-agreement`, { creditLevel }),
}

// === Vault (mounted at /solana/vault) ===
export const vaultApi = {
  getStats: () => solanaApi.get('/solana/vault/stats'),
  getTrancheStats: (tranche: string) => solanaApi.get(`/solana/vault/tranche/${tranche}`),
  getRevenue: () => solanaApi.get('/solana/vault/revenue'),
  getLossBuffer: () => solanaApi.get('/solana/vault/loss-buffer'),
  getLpPosition: (address: string) => solanaApi.get(`/solana/vault/lp/${address}`),
  getCollateral: (address: string) => solanaApi.get(`/solana/vault/collateral/${address}`),
  getIdleCapital: () => solanaApi.get('/solana/vault/idle-capital'),
  getMeteoraYield: () => solanaApi.get('/solana/vault/meteora-yield'),
}

// === LP ===
export const lpApi = {
  getPositions: (address: string) => solanaApi.get(`/solana/vault/lp/${address}`),
  getPosition: (address: string, tranche: string) => solanaApi.get(`/solana/vault/lp/${address}/${tranche}`),
  previewDeposit: (tranche: string, amount: string) => solanaApi.get(`/solana/vault/lp/preview/deposit`, { params: { tranche, amount } }),
  previewWithdraw: (tranche: string, shares: string) => solanaApi.get(`/solana/vault/lp/preview/withdraw`, { params: { tranche, shares } }),
}

// === Wallet (owner-level) ===
export const walletApi = {
  getByOwner: (ownerPubkey: string, limit = 50) =>
    solanaApi.get('/solana/wallets', { params: { owner: ownerPubkey, limit } }),
}

// === Score (mounted at /solana/score) ===
export const scoreApi = {
  getScore: (address: string) => solanaApi.get(`/solana/score/${address}`),
  getProfile: (address: string) => solanaApi.get(`/solana/wallets/${address}`),
  getHealth: (address: string) => solanaApi.get(`/solana/wallets/${address}/health`),
  getServicePlan: (address: string) => solanaApi.get(`/solana/wallets/${address}/service-plan`),
}

// === KYA (mounted at /solana/kya) ===
export const kyaApi = {
  basicVerify: (agent: string, ownerPubkey: string, ownerSignature: string) =>
    solanaApi.post(`/solana/kya/${agent}/basic`, { ownerPubkey, ownerSignature }),
  getStatus: (agent: string) => solanaApi.get(`/solana/kya/${agent}/status`),
}

// === Faucet (mounted at /solana/faucet) ===
export const faucetApi = {
  mintUsdc: (recipient: string, amountUsdc: number) =>
    solanaApi.post('/solana/faucet/usdc', { recipient, amountUsdc }),
}

// === Oracle (mounted at /solana/oracle) ===
export const oracleApi = {
  signCredit: (params: {
    agentPubkey: string
    agentOrOwnerPubkey: string
    amount: number | string
    rateBps?: number
    creditLevel?: number
    collateralValueUsdc?: number | string
  }) => solanaApi.post('/solana/oracle/sign-credit', params),
}

// === Health ===
export const healthApi = {
  check: () => solanaApi.get('/health'),
  vaultHealth: () => solanaApi.get('/solana/vault/health'),
}
