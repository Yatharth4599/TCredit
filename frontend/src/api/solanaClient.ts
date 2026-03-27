import axios from 'axios'

const KREXA_API_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_KREXA_API_URL || 'http://localhost:3001'

export const solanaApi = axios.create({
  baseURL: KREXA_API_URL,
  timeout: 120000,
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
  createWallet: (agent: string, owner: string, dailySpendLimitUsdc?: number) =>
    solanaApi.post('/solana/wallets/create', { agent, owner, dailySpendLimitUsdc }),
}

// === Credit  (mounted at /solana/credit) ===
export const creditApi = {
  getLine:       (address: string) => solanaApi.get(`/solana/credit/${address}/line`),
  getEligibility:(address: string) => solanaApi.get(`/solana/credit/${address}/eligibility`),
  getScoreBreakdown: (address: string) => solanaApi.get(`/solana/credit/${address}/score-breakdown`),
  getProtocolParams: ()             => solanaApi.get('/solana/credit/protocol-params'),
  requestCredit: (agent: string, amount: number, creditLevel: number) =>
    solanaApi.post(`/solana/credit/${agent}/request`, { amount, creditLevel }),
  repay: (agent: string, amount: number) =>
    solanaApi.post(`/solana/credit/${agent}/repay`, { amount }),
  getActivity: (agent: string) => solanaApi.get(`/solana/credit/${agent}/activity`),
  getRequests: (agent: string) => solanaApi.get(`/solana/credit/${agent}/requests`),
  signAgreement: (agent: string, creditLevel: number) =>
    solanaApi.post(`/solana/credit/${agent}/sign-agreement`, { creditLevel }),
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

// === KYA  (mounted at /solana/kya) ===
export const kyaApi = {
  basicVerify: (agent: string, ownerPubkey: string, ownerSignature: string) =>
    solanaApi.post(`/solana/kya/${agent}/basic`, { ownerPubkey, ownerSignature }),
  getStatus: (agent: string) => solanaApi.get(`/solana/kya/${agent}/status`),
}

// === Faucet  (mounted at /solana/faucet) ===
export const faucetApi = {
  mintUsdc: (recipient: string, amountUsdc: number) =>
    solanaApi.post('/solana/faucet/usdc', { recipient, amountUsdc }),
}

// === Oracle  (mounted at /solana/oracle) ===
export const oracleApi = {
  signCredit: (transaction: string) =>
    solanaApi.post('/solana/oracle/sign-credit', { transaction }),
}

// === Health ===
export const healthApi = {
  check:      () => solanaApi.get('/health'),
  vaultHealth:() => solanaApi.get('/solana/vault/health'),
}
