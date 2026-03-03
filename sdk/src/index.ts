export { createTCreditClient, type TCreditClient, type TCreditConfig } from './client.js';
export { toTxConfig, sendTx, waitForTx } from './tx.js';
export type {
  UnsignedTx, TxConfig, HealthResponse,
  Vault, VaultDetail, WaterfallData, Investor, Milestone, TrancheResponse, VaultEvent,
  MerchantProfile, MerchantStats,
  Pool, PoolsSummary, Allocation,
  PortfolioInvestment, PortfolioSummary,
  PlatformStats, PlatformConfig,
  OraclePayment, CreateVaultParams, ApiKey,
} from './types.js';
