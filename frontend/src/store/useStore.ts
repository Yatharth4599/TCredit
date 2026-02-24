import { create } from 'zustand'

export interface Vault {
  id: string
  merchant: string
  description: string
  targetAmount: number
  totalRaised: number
  interestRate: number
  duration: number
  investorCount: number
  status: 'fundraising' | 'active' | 'repaying' | 'completed'
  category: string
  riskScore: string
  totalSeniorRepaid?: number
  totalPoolRepaid?: number
}

export interface MerchantStats {
  businessName: string
  creditScore: number
  creditRating: string
  totalBorrowed: number
  activeLoanCount: number
  totalRepaid: number
  onTimePayments: number
  availableCredit: number
}

interface AppState {
  // Vaults
  vaults: Vault[]
  vaultsLoading: boolean
  setVaults: (v: Vault[]) => void
  setVaultsLoading: (b: boolean) => void

  // Merchant
  merchantStats: MerchantStats | null
  setMerchantStats: (s: MerchantStats) => void

  // Wallet
  walletAddress: string | null
  setWalletAddress: (a: string | null) => void
}

export const useStore = create<AppState>((set) => ({
  vaults: [],
  vaultsLoading: false,
  setVaults: (vaults) => set({ vaults }),
  setVaultsLoading: (vaultsLoading) => set({ vaultsLoading }),

  merchantStats: null,
  setMerchantStats: (merchantStats) => set({ merchantStats }),

  walletAddress: null,
  setWalletAddress: (walletAddress) => set({ walletAddress }),
}))
