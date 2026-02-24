import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    console.error('[API Error]', err.response?.status, err.config?.url)
    return Promise.reject(err)
  }
)

// Vault endpoints
export const vaultsApi = {
  list: () => api.get('/vaults'),
  get: (id: string) => api.get(`/vaults/${id}`),
  invest: (id: string, amount: number) => api.post(`/vaults/${id}/invest`, { amount }),
}

// Merchant endpoints
export const merchantApi = {
  stats: (id: string) => api.get(`/merchant/${id}/stats`),
  vaults: (id: string) => api.get(`/merchant/${id}/vaults`),
  repaymentSchedule: (id: string) => api.get(`/merchant/${id}/repayments`),
}

// Payment stream endpoints
export const paymentsApi = {
  recent: (vaultId?: string) => api.get('/payments/recent', { params: { vaultId } }),
  waterfall: (paymentId: string) => api.get(`/payments/${paymentId}/waterfall`),
}
