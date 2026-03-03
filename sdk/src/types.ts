// All monetary values are USDC wei strings (6 decimals)

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
