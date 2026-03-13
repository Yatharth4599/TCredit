// ── Primary entry-point ──────────────────────────────────────────────────────
export { KrexaSDK, KrexaError, type KrexaSDKConfig } from './client.js';

// ── Legacy factory (backwards-compatible) ────────────────────────────────────
export { createKrexaClient, type KrexaClient, type KrexaConfig } from './client.js';
export { toTxConfig, sendTx, waitForTx } from './tx.js';

// ── Credit Bureau ─────────────────────────────────────────────────────────────
export type {
  BureauScore, BureauReport, BureauEvent, BureauHistory, HistoryOptions,
} from './credit-bureau.js';

// ── Types ────────────────────────────────────────────────────────────────────
export type {
  // Base chain (original)
  UnsignedTx, TxConfig, HealthResponse,
  Vault, VaultDetail, WaterfallData, Investor, Milestone, TrancheResponse, VaultEvent,
  MerchantProfile, MerchantStats,
  Pool, PoolsSummary, Allocation,
  PortfolioInvestment, PortfolioSummary,
  PlatformStats, PlatformConfig,
  OraclePayment, CreateVaultParams, ApiKey,

  // Agent Credit System (chain-agnostic)
  Chain,
  AgentWalletState, CreditLineState, CreditEligibility, CreditScore,
  KyaStatus, KyaSubmitResult,
  AgentStatus, SolanaVaultStats,
  TradeParams, PayX402Params, WithdrawParams, RepayParams, DepositParams,
  RequestCreditParams, OperationResult,
  X402PaymentRequirement, X402Challenge,
} from './types.js';
