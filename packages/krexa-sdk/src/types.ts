import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

// ─────────────────────────────────────────────────────────────────────────────
// Program IDs
// ─────────────────────────────────────────────────────────────────────────────

export const PROGRAM_IDS = {
  AGENT_REGISTRY:  new PublicKey("KrXAgReg11111111111111111111111111111111111"),
  CREDIT_VAULT:    new PublicKey("KrXAcvt111111111111111111111111111111111111"),
  AGENT_WALLET:    new PublicKey("KrXAWaT111111111111111111111111111111111111"),
  VENUE_WHITELIST: new PublicKey("KrXAvwT111111111111111111111111111111111111"),
  PAYMENT_ROUTER:  new PublicKey("KrXAprt111111111111111111111111111111111111"),
  SERVICE_PLAN:    new PublicKey("KrXAsvc111111111111111111111111111111111111"),
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Enums (matching on-chain Anchor enums)
// ─────────────────────────────────────────────────────────────────────────────

export enum CreditLevel {
  KyaOnly = 0,
  Starter = 1,
  Established = 2,
  Trusted = 3,
  Elite = 4,
}

export enum KyaTier {
  None = 0,
  Basic = 1,
  Enhanced = 2,
  Institutional = 3,
}

export enum Tranche {
  Senior = 0,
  Mezzanine = 1,
  Junior = 2,
}

export enum AgentType {
  Trader = 0,
  Service = 1,
  Hybrid = 2,
}

export enum ServiceHealth {
  Green = 0,
  Yellow = 1,
  Orange = 2,
  Red = 3,
}

export enum RevenueSourceClass {
  Verified = 0,
  Rejected = 1,
  Quarantined = 2,
  PendingKeeper = 3,
}

export enum WalletStatus {
  Active = 0,
  Warning = 1,
  Deleveraging = 2,
  Liquidating = 3,
  Closed = 4,
}

// ─────────────────────────────────────────────────────────────────────────────
// On-chain account types (krexa-agent-registry)
// ─────────────────────────────────────────────────────────────────────────────

export interface RegistryConfig {
  admin: PublicKey;
  oracle: PublicKey;
  walletProgram: PublicKey;
  totalAgents: BN;
  isPaused: boolean;
  bump: number;
}

export interface AgentProfile {
  agent: PublicKey;
  owner: PublicKey;
  ownerType: number;
  name: number[];           // [u8; 32]
  creditScore: number;      // u16
  creditLevel: number;      // u8 (CreditLevel as_u8)
  kyaTier: number;          // u8 (KyaTier as_u8)
  isActive: boolean;
  registeredAt: BN;         // i64
  lastScoreUpdate: BN;      // i64
  legalAgreementHash: number[]; // [u8; 32]
  legalAgreementSignedAt: BN;   // i64
  attestationHash: number[];     // [u8; 32]
  attestationAt: BN;             // i64
  walletPda: PublicKey;
  liquidationCount: number; // u16
  totalVolume: BN;
  totalTrades: BN;
  totalRepaid: BN;
  totalBorrowed: BN;
  agentType: number;        // u8 (AgentType as_u8)
  bump: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// On-chain account types (krexa-agent-wallet)
// ─────────────────────────────────────────────────────────────────────────────

export interface WalletConfig {
  admin: PublicKey;
  creditVaultProgram: PublicKey;
  agentRegistryProgram: PublicKey;
  venueWhitelistProgram: PublicKey;
  paymentRouterProgram: PublicKey;
  usdcMint: PublicKey;
  keeper: PublicKey;
  totalWallets: BN;
  isPaused: boolean;
  bump: number;
}

export interface AgentWallet {
  agent: PublicKey;
  owner: PublicKey;
  config: PublicKey;
  walletUsdc: PublicKey;
  collateralShares: BN;
  creditLimit: BN;
  creditDrawn: BN;
  totalDebt: BN;
  dailySpendLimit: BN;
  dailySpent: BN;
  lastDailyReset: BN;
  healthFactorBps: number;
  lastHealthCheck: BN;
  creditLevel: number;
  isFrozen: boolean;
  isLiquidating: boolean;
  totalTrades: BN;
  totalVolume: BN;
  totalRepaid: BN;
  createdAt: BN;
  bump: number;
  usdcBump: number;
  ownerType: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// On-chain account types (krexa-credit-vault)
// ─────────────────────────────────────────────────────────────────────────────

export interface VaultConfig {
  admin: PublicKey;
  oracle: PublicKey;
  walletProgram: PublicKey;
  routerProgram: PublicKey;
  usdcMint: PublicKey;
  vaultTokenAccount: PublicKey;
  insuranceTokenAccount: PublicKey;
  totalDeposits: BN;
  totalBorrowed: BN;
  totalRepaid: BN;
  insuranceBalance: BN;
  utilizationCapBps: number;
  baseInterestRateBps: number;
  lockupSeconds: BN;
  treasuryAccount: PublicKey;
  isPaused: boolean;
  bump: number;
  // Tranche tracking
  seniorDeposits: BN;
  seniorShares: BN;
  mezzanineDeposits: BN;
  mezzanineShares: BN;
  juniorDeposits: BN;
  juniorShares: BN;
  servicePlanProgram: PublicKey;
}

export interface DepositPosition {
  owner: PublicKey;
  depositAmount: BN;
  shares: BN;
  depositedAt: BN;
  tranche: number;
  isCollateral: boolean;
  bump: number;
}

export interface CreditLine {
  agent: PublicKey;
  creditLimit: BN;
  creditDrawn: BN;
  accruedInterest: BN;
  interestRateBps: number;
  originatedAt: BN;
  lastAccrualAt: BN;
  creditLevel: number;
  isActive: boolean;
  bump: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// On-chain account types (krexa-venue-whitelist)
// ─────────────────────────────────────────────────────────────────────────────

export interface WhitelistConfig {
  admin: PublicKey;
  totalVenues: BN;
  isPaused: boolean;
  bump: number;
}

export interface WhitelistedVenue {
  programId: PublicKey;
  name: number[];    // [u8; 32]
  category: number;  // u8
  isActive: boolean;
  addedAt: BN;
  bump: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// On-chain account types (krexa-payment-router)
// ─────────────────────────────────────────────────────────────────────────────

export interface RouterConfig {
  admin: PublicKey;
  oracle: PublicKey;
  walletProgram: PublicKey;
  vaultProgram: PublicKey;
  usdcMint: PublicKey;
  platformFeeRecipient: PublicKey;
  totalSettlements: BN;
  isPaused: boolean;
  bump: number;
}

export interface MerchantSettlement {
  merchant: PublicKey;
  agent: PublicKey;
  totalReceived: BN;
  totalFees: BN;
  lastSettlement: BN;
  settlementCount: BN;
  bump: number;
}

export interface RevenueValidator {
  agent: PublicKey;
  registeredSources: PublicKey[];   // [Pubkey; 30]
  numRegisteredSources: number;
  associatedWallets: PublicKey[];   // [Pubkey; 10]
  numAssociatedWallets: number;
  expectedDailyRevenue: BN;
  totalCredit: BN;
  cumulativeValidatedRevenue: BN;
  totalDisbursed: BN;
  lastDisbursementTs: BN;
  violationCount: number;
  bump: number;
}

export interface PaymentRecord {
  source: PublicKey;
  amount: BN;
  timestamp: BN;
  classification: number;
  isX402: boolean;
  patternScore: number;
}

export interface PaymentHistory {
  agent: PublicKey;
  payments: PaymentRecord[];        // [PaymentRecord; 50]
  paymentHead: number;
  paymentCount: number;
  outflows: OutflowRecord[];        // [OutflowRecord; 20]
  outflowHead: number;
  outflowCount: number;
  bump: number;
}

export interface OutflowRecord {
  destination: PublicKey;
  amount: BN;
  timestamp: BN;
}

export interface GlobalBlocklist {
  entries: PublicKey[];   // [Pubkey; 50]
  count: number;
  bump: number;
}

export interface PlatformWhitelist {
  entries: PublicKey[];   // [Pubkey; 20]
  count: number;
  bump: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// On-chain account types (krexa-service-plan)
// ─────────────────────────────────────────────────────────────────────────────

export interface ServicePlanConfig {
  admin: PublicKey;
  oracle: PublicKey;
  walletProgram: PublicKey;
  vaultProgram: PublicKey;
  isPaused: boolean;
  bump: number;
}

export interface Milestone {
  amount: BN;
  condition: number;     // 0 = Immediate, 1 = TimeElapsed, 2 = RevenueTarget, 3 = OracleApproval
  conditionValue: BN;
  isDisbursed: boolean;
  disbursedAt: BN;
}

export interface ServicePlan {
  agent: PublicKey;
  owner: PublicKey;
  totalCredit: BN;
  milestones: Milestone[];  // [Milestone; 8]
  numMilestones: number;
  projectedRevenue: BN;
  cumulativeRevenue: BN;
  healthStatus: number;     // ServiceHealth as_u8
  zeroRevenueDays: number;
  lastRevenueAt: BN;
  windDownStartedAt: BN;
  windDownStatus: number;   // 0=None, 1=Grace, 2=Executing, 3=Completed
  createdAt: BN;
  bump: number;
}

export interface ExpenseDestination {
  plan: PublicKey;
  destination: PublicKey;
  category: number;
  isActive: boolean;
  bump: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Protocol constants (matching krexa-common/constants.rs)
// ─────────────────────────────────────────────────────────────────────────────

export const PROTOCOL_CONSTANTS = {
  // Credit scoring
  MAX_CREDIT_SCORE: 850,
  MIN_CREDIT_SCORE: 200,
  DEFAULT_CREDIT_SCORE: 400,

  // Health factors (BPS, 10000 = 1.0x)
  HF_HEALTHY: 15_000,
  HF_WARNING: 13_000,
  HF_DANGER: 12_000,
  HF_LIQUIDATION: 10_500,
  HF_DECIMALS: 10_000,

  // Position limits (BPS)
  MAX_PER_TRADE_BPS: 2_000,
  MAX_PER_VENUE_BPS: 5_000,
  WITHDRAWAL_BUFFER_BPS: 12_000,

  // Fee rates (BPS)
  PROTOCOL_FEE_BPS: 1_000,
  LIQUIDATION_REWARD_BPS: 50,
  PLATFORM_FEE_BPS: 1_000,
  BPS_DENOMINATOR: 10_000,

  // Time
  SECONDS_PER_YEAR: 31_536_000,
  SCORE_EXPIRY_SECONDS: 90 * 24 * 60 * 60,

  // Credit levels — max credit (USDC 6 decimals)
  LEVEL_0_MAX_CREDIT: 0,
  LEVEL_1_MAX_CREDIT: 500_000_000,
  LEVEL_2_MAX_CREDIT: 20_000_000_000,
  LEVEL_3_MAX_CREDIT: 50_000_000_000,
  LEVEL_4_MAX_CREDIT: 500_000_000_000,

  // Credit levels — interest rates (BPS annual)
  LEVEL_1_RATE_BPS: 3_650,
  LEVEL_2_RATE_BPS: 2_920,
  LEVEL_3_RATE_BPS: 2_190,
  LEVEL_4_RATE_BPS: 1_825,

  // NAV triggers (BPS)
  LEVEL_1_NAV_TRIGGER_BPS: 9_000,
  LEVEL_2_NAV_TRIGGER_BPS: 8_500,
  LEVEL_3_NAV_TRIGGER_BPS: 8_000,
  LEVEL_4_NAV_TRIGGER_BPS: 8_000,

  // Tranches
  SENIOR_APR_BPS: 1_000,
  MEZZANINE_APR_BPS: 1_200,
  JUNIOR_APR_BPS: 2_000,
  SENIOR_SHARE_BPS: 5_000,
  MEZZANINE_SHARE_BPS: 3_000,
  JUNIOR_SHARE_BPS: 2_000,

  // Vault
  UTILIZATION_CAP_BPS: 8_000,
  INSURANCE_TARGET_BPS: 2_000,
  LIQUIDATION_SCORE_PENALTY: 40,

  // USDC
  USDC_DECIMALS: 6,
  USDC_ONE: 1_000_000,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// PDA seeds
// ─────────────────────────────────────────────────────────────────────────────

export const PDA_SEEDS = {
  // Registry
  REGISTRY_CONFIG: Buffer.from("registry_config"),
  AGENT_PROFILE: Buffer.from("agent_profile"),

  // Wallet
  WALLET_CONFIG: Buffer.from("wallet_config"),
  AGENT_WALLET: Buffer.from("agent_wallet"),
  WALLET_USDC: Buffer.from("wallet_usdc"),
  VENUE_EXPOSURE: Buffer.from("venue_exposure"),
  OWNERSHIP_TRANSFER: Buffer.from("ownership_transfer"),

  // Vault
  VAULT_CONFIG: Buffer.from("vault_config"),
  LP_DEPOSIT: Buffer.from("lp_deposit"),
  COLLATERAL: Buffer.from("collateral"),
  CREDIT_LINE: Buffer.from("credit_line"),

  // Venue whitelist
  WHITELIST_CONFIG: Buffer.from("whitelist_config"),
  VENUE: Buffer.from("venue"),

  // Payment router
  ROUTER_CONFIG: Buffer.from("router_config"),
  SETTLEMENT: Buffer.from("settlement"),
  REVENUE_VALIDATOR: Buffer.from("revenue_validator"),
  PAYMENT_HISTORY: Buffer.from("payment_history"),
  GLOBAL_BLOCKLIST: Buffer.from("global_blocklist"),
  PLATFORM_WHITELIST: Buffer.from("platform_whitelist"),

  // Service plan
  SERVICE_PLAN_CONFIG: Buffer.from("service_plan_config"),
  SERVICE_PLAN: Buffer.from("service_plan"),
  EXPENSE_DESTINATION: Buffer.from("expense_dest"),
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Computed types for SDK consumers
// ─────────────────────────────────────────────────────────────────────────────

export interface AgentHealth {
  healthFactorBps: number;
  healthFactor: string;           // human-readable "1.35"
  status: WalletStatus;
  walletBalance: BN;
  collateralValue: BN;
  totalDebt: BN;
  creditDrawn: BN;
  accruedInterest: BN;
}

export interface VaultStats {
  totalDeposits: BN;
  totalBorrowed: BN;
  availableLiquidity: BN;
  utilizationBps: number;
  utilizationPct: string;
  insuranceBalance: BN;
  isPaused: boolean;
  tranches: {
    senior: { deposits: BN; shares: BN; aprBps: number };
    mezzanine: { deposits: BN; shares: BN; aprBps: number };
    junior: { deposits: BN; shares: BN; aprBps: number };
  };
}

export interface LPPosition {
  owner: PublicKey;
  tranche: Tranche;
  depositAmount: BN;
  shares: BN;
  depositedAt: BN;
  estimatedValue: BN;
  estimatedYield: BN;
}

export interface CreditTerms {
  creditLevel: CreditLevel;
  maxCredit: BN;
  interestRateBps: number;
  interestRateDaily: string;
  interestRateAnnual: string;
  navTriggerBps: number;
  kyaRequired: KyaTier;
  collateralRequired: boolean;
  leverageRatio: string;
}
