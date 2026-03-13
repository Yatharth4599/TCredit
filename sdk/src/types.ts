// All monetary values are USDC wei strings (6 decimals)

// ─────────────────────────────────────────────────────────────────────────────
// Agent Credit System (Solana) + Chain-agnostic types
// ─────────────────────────────────────────────────────────────────────────────

export type Chain = 'solana' | 'base';

/** Unsigned Solana transaction (base64-encoded, ready for wallet signing). */
export interface UnsignedSolanaTx {
  transaction: string;   // base64
  encoding: 'base64';
  description?: string;
}

export interface AgentWalletState {
  agentPubkey?: string;  // Solana
  address?: string;       // Base EVM
  chain: Chain;
  ownerPubkey: string;
  ownerType: 'eoa' | 'multisig';
  pendingOwner: string | null;
  creditLevel: number;
  creditLimit: string;    // USDC base units
  creditDrawn: string;
  totalDebt: string;
  collateralShares: string;
  dailySpendLimit: string;
  dailySpent: string;
  healthFactorBps: number;
  healthFactor: string;   // human-readable "1.3500"
  isFrozen: boolean;
  isLiquidating: boolean;
  totalTrades: string;
  totalVolume: string;
  totalRepaid: string;
  lastHealthCheck: string;
  createdAt: string;
}

export interface CreditLineState {
  exists: boolean;
  creditLimit: string;
  creditDrawn: string;
  accruedInterest: string;
  totalOwed: string;
  interestRateBps: number;
  isActive: boolean;
  healthFactorBps: number | null;
  isFrozen: boolean | null;
  originatedAt: string;
}

export interface CreditEligibility {
  eligible: boolean;
  creditLevel: number;
  maxCreditUsdc: number;
  reason: string;
  agentPubkey: string;
  creditScore: number;
  kyaTier: number;
}

export interface CreditScore {
  agentPubkey: string;
  score: number;
  level: number;
  history: Array<{
    score: number;
    level: number;
    components: { repayment: number; profit: number; behavior: number; usage: number; age: number };
    snapshotAt: string;
  }>;
}

export interface KyaStatus {
  agentPubkey: string;
  onChainTier: number;
  onChainLevel: number;
  verifications: Array<{
    id: string;
    tier: number;
    method: string;
    status: 'pending' | 'approved' | 'rejected';
    verifiedAt: string | null;
  }>;
}

export interface KyaSubmitResult {
  status: 'approved' | 'pending' | 'rejected';
  tier: number;
  verificationId: string;
  txSignature?: string;
  reason?: string;
}

export interface AgentStatus {
  wallet: AgentWalletState | null;
  credit: CreditLineState | null;
  eligibility: CreditEligibility | null;
  kya: KyaStatus | null;
  balance: { balanceBaseUnits: string; balanceUsdc: string } | null;
}

export interface SolanaVaultStats {
  initialized: boolean;
  totalDepositsUsdc: string;
  availableLiquidityUsdc: string;
  utilizationPct: string;
  utilizationCapBps: number;
  baseInterestRateBps: number;
  isPaused: boolean;
  insuranceBalanceUsdc: string;
}

export interface TradeParams {
  venue: string;       // e.g. "jupiter"
  from: string;        // token symbol or mint, e.g. "USDC"
  to: string;          // token symbol or mint, e.g. "SOL"
  amount: number;      // in USDC (or from-token units)
}

export interface PayX402Params {
  recipient: string;   // merchant address
  amount: number;      // in USDC
  paymentId?: string;
}

export interface WithdrawParams {
  amount: number;      // in USDC
  toAddress: string;   // destination wallet/ATA
}

export interface RepayParams {
  amount: number;      // in USDC
  callerAddress?: string;
}

export interface DepositParams {
  amount: number;      // in USDC
  ownerAddress: string;
}

export interface RequestCreditParams {
  amount: number;      // in USDC
  rateBps?: number;
  creditLevel?: number;
  collateralValueUsdc?: number;
}

/** Generic operation result for write operations. */
export interface OperationResult {
  success: boolean;
  signature?: string;           // Solana tx signature
  txHash?: string;              // EVM tx hash
  transaction?: string;         // unsigned base64 (Solana) for manual signing
  description?: string;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// x402 Payment types
// ─────────────────────────────────────────────────────────────────────────────

export interface X402PaymentRequirement {
  scheme: 'exact';
  network: string;
  maxAmountRequired: string;    // USDC base units
  resource: string;             // full URL being accessed
  description: string;
  payTo: string;                // merchant address
  maxTimeoutSeconds: number;
  asset: string;                // USDC contract address
}

export interface X402Challenge {
  type: 'x402';
  version: '1';
  accepts: X402PaymentRequirement[];
  error?: string;
}

export interface UnsignedTx {
  to: string;
  data: string;
  description?: string;
}

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  version: string;
  database: boolean;
  chain: boolean;
  chainId: number;
  latestBlock: number;
}

export interface Vault {
  address: string;
  agent: string;
  state: 'fundraising' | 'active' | 'repaying' | 'completed' | 'defaulted' | 'cancelled';
  targetAmount: string;
  totalRaised: string;
  totalRepaid: string;
  totalToRepay: string;
  interestRate: number;
  durationMonths: number;
  numTranches: number;
  tranchesReleased: number;
  investorCount: number;
  percentFunded: number;
}

export interface VaultDetail extends Vault {
  waterfall?: WaterfallData;
}

export interface WaterfallData {
  seniorFunded: string;
  poolFunded: string;
  userFunded: string;
  seniorRepaid: string;
  poolRepaid: string;
  communityRepaid: string;
}

export interface Investor {
  investor: string;
  balance: string;
  claimable: string;
}

export interface Milestone {
  trancheIndex: number;
  status: 'pending' | 'submitted' | 'approved' | 'rejected';
  approvalCount: number;
  submittedAt: string | null;
}

export interface TrancheResponse {
  numTranches: number;
  tranchesReleased: number;
  tranches: Array<{ index: number; released: boolean }>;
}

export interface VaultEvent {
  id: string;
  eventType: string;
  data: Record<string, unknown>;
  blockNumber: string;
  txHash: string;
  timestamp: string;
}

export interface MerchantProfile {
  address: string;
  metadataURI: string;
  registeredAt: string;
  totalPaymentsReceived: string;
  totalPaymentsSent: string;
  hasActiveCreditLine: boolean;
  vault: string;
  active: boolean;
  creditTier: 'A' | 'B' | 'C' | 'D';
  creditTierNum: number;
  creditValid: boolean;
}

export interface MerchantStats {
  address: string;
  creditTier: string;
  creditRating: string;
  creditValid: boolean;
  activeLoanCount: number;
  totalVaults: number;
  totalBorrowed: string;
  totalRepaid: string;
  totalPaymentsReceived: string;
  totalPaymentsSent: string;
  hasActiveCreditLine: boolean;
}

export interface Pool {
  address: string;
  name: string;
  isAlpha: boolean;
  totalDeposits: string;
  totalAllocated: string;
  availableBalance: string;
  utilizationPct: number;
}

export interface PoolsSummary {
  totalDeposits: string;
  totalAllocated: string;
  totalAvailable: string;
}

export interface PortfolioInvestment {
  vaultAddress: string;
  agent: string;
  state: string;
  amountInvested: string;
  claimable: string;
  interestRate: number;
  durationMonths: number;
}

export interface PortfolioSummary {
  totalInvested: string;
  totalClaimable: string;
}

export interface PlatformStats {
  totalVaults: number;
  activeVaults: number;
  tvl: string;
  totalRepaid: string;
  poolLiquidity: string;
}

export interface PlatformConfig {
  platformFeeBps: number;
  maxFeeBps: number;
  minDurationSeconds: number;
  maxDurationSeconds: number;
  chainId: number;
  contracts: Record<string, string>;
}

export interface OraclePayment {
  id: string;
  from: string;
  to: string;
  vault: string;
  amount: string;
  nonce: string;
  deadline: string;
  status: 'pending' | 'submitted' | 'confirmed' | 'failed';
  txHash: string | null;
  createdAt: string;
}

export interface CreateVaultParams {
  agent: string;
  targetAmount: string;
  interestRateBps?: number;
  durationSeconds?: number;
  numTranches?: number;
  repaymentRateBps?: number;
  minPaymentInterval?: number;
  maxSinglePayment?: number;
  lateFeeBps?: number;
  gracePeriodSeconds?: number;
  fundraisingDeadline?: number;
}

export interface Allocation {
  amount: string;
  returnedAmount: string;
  allocatedAt: string | null;
  active: boolean;
}

export interface ApiKey {
  id: string;
  key: string;
  name: string;
  rateLimit: number;
  active: boolean;
  createdAt: string;
}

export interface TxConfig {
  to: `0x${string}`;
  data: `0x${string}`;
}
