import { create } from 'zustand'
import type {
  ApiVault,
  ApiVaultDetail,
  ApiMerchantStats,
  ApiPool,
  ApiPoolsSummary,
  ApiPortfolioInvestment,
  ApiPortfolioSummary,
  ApiPlatformStats,
} from '../api/types'

// Pending transaction state for UI feedback
export interface PendingTransaction {
  hash?: string;
  description: string;
  status: 'signing' | 'submitted' | 'confirming' | 'confirmed' | 'failed';
  error?: string;
}

interface AppState {
  // Vaults
  vaults: ApiVault[];
  vaultsLoading: boolean;
  vaultsError: string | null;
  setVaults: (v: ApiVault[]) => void;
  setVaultsLoading: (b: boolean) => void;
  setVaultsError: (e: string | null) => void;

  // Selected vault detail
  selectedVault: ApiVaultDetail | null;
  selectedVaultLoading: boolean;
  setSelectedVault: (v: ApiVaultDetail | null) => void;
  setSelectedVaultLoading: (b: boolean) => void;

  // Portfolio
  portfolio: ApiPortfolioInvestment[];
  portfolioSummary: ApiPortfolioSummary | null;
  portfolioLoading: boolean;
  setPortfolio: (investments: ApiPortfolioInvestment[], summary: ApiPortfolioSummary) => void;
  setPortfolioLoading: (b: boolean) => void;

  // Merchant (connected wallet's merchant profile)
  merchantStats: ApiMerchantStats | null;
  merchantVaults: ApiVault[];
  merchantLoading: boolean;
  setMerchantStats: (s: ApiMerchantStats | null) => void;
  setMerchantVaults: (v: ApiVault[]) => void;
  setMerchantLoading: (b: boolean) => void;

  // Pools
  pools: ApiPool[];
  poolsSummary: ApiPoolsSummary | null;
  poolsLoading: boolean;
  setPoolsData: (pools: ApiPool[], summary: ApiPoolsSummary) => void;
  setPoolsLoading: (b: boolean) => void;

  // Platform stats
  platformStats: ApiPlatformStats | null;
  setPlatformStats: (s: ApiPlatformStats | null) => void;

  // Pending transaction
  pendingTx: PendingTransaction | null;
  setPendingTx: (tx: PendingTransaction | null) => void;
}

export const useStore = create<AppState>((set) => ({
  // Vaults
  vaults: [],
  vaultsLoading: false,
  vaultsError: null,
  setVaults: (vaults) => set({ vaults, vaultsError: null }),
  setVaultsLoading: (vaultsLoading) => set({ vaultsLoading }),
  setVaultsError: (vaultsError) => set({ vaultsError }),

  // Selected vault
  selectedVault: null,
  selectedVaultLoading: false,
  setSelectedVault: (selectedVault) => set({ selectedVault }),
  setSelectedVaultLoading: (selectedVaultLoading) => set({ selectedVaultLoading }),

  // Portfolio
  portfolio: [],
  portfolioSummary: null,
  portfolioLoading: false,
  setPortfolio: (portfolio, portfolioSummary) => set({ portfolio, portfolioSummary }),
  setPortfolioLoading: (portfolioLoading) => set({ portfolioLoading }),

  // Merchant
  merchantStats: null,
  merchantVaults: [],
  merchantLoading: false,
  setMerchantStats: (merchantStats) => set({ merchantStats }),
  setMerchantVaults: (merchantVaults) => set({ merchantVaults }),
  setMerchantLoading: (merchantLoading) => set({ merchantLoading }),

  // Pools
  pools: [],
  poolsSummary: null,
  poolsLoading: false,
  setPoolsData: (pools, poolsSummary) => set({ pools, poolsSummary }),
  setPoolsLoading: (poolsLoading) => set({ poolsLoading }),

  // Platform
  platformStats: null,
  setPlatformStats: (platformStats) => set({ platformStats }),

  // Transaction
  pendingTx: null,
  setPendingTx: (pendingTx) => set({ pendingTx }),
}))
