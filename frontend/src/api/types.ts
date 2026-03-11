// API response types — aligned with backend response shapes
// All monetary values are string (wei), not number

export type VaultState = 'fundraising' | 'active' | 'repaying' | 'completed' | 'defaulted' | 'cancelled';

export interface ApiVault {
  address: string;
  agent: string;
  state: VaultState;
  targetAmount: string;
  totalRaised: string;
  totalRepaid: string;
  totalToRepay: string;
  interestRateBps: number;
  interestRate: number;        // interestRateBps / 100
  durationSeconds: number;
  durationMonths: number;
  numTranches: number;
  tranchesReleased: number;
  activatedAt: string | null;
  lateFeeBps: number;
  percentFunded: number;       // 0-100
}

export interface WaterfallData {
  seniorFunded: string;
  poolFunded: string;
  userFunded: string;
  seniorRepaid: string;
  poolRepaid: string;
  communityRepaid: string;
}

export interface ApiVaultDetail extends ApiVault {
  investorCount: number;
  waterfall: WaterfallData;
}

export interface ApiInvestor {
  investor: string;
  balance: string;
  claimable: string;
}

export interface ApiTranche {
  index: number;
  released: boolean;
}

export interface ApiTrancheResponse {
  numTranches: number;
  tranchesReleased: number;
  tranches: ApiTranche[];
}

export interface ApiMilestone {
  vault: string;
  trancheIndex: number;
  status: string;
  evidenceHash: string | null;
  approvalCount: number;
  submittedAt: string | null;
  approvedAt: string | null;
}

export interface ApiVaultEvent {
  id: string;
  eventType: string;
  data: Record<string, unknown>;
  blockNumber: string;
  txHash: string;
  timestamp: string;
}

export interface ApiMerchantProfile {
  address: string;
  metadataURI: string;
  registeredAt: string;
  totalPaymentsReceived: string;
  totalPaymentsSent: string;
  hasActiveCreditLine: boolean;
  vault: string;
  active: boolean;
  creditTier: string;
  creditTierNum: number;
  creditValid: boolean;
}

export interface ApiMerchantStats {
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

export interface ApiPool {
  address: string;
  name: string;
  isAlpha: boolean;
  totalDeposits: string;
  totalAllocated: string;
  availableBalance: string;
  utilizationPct: number;
}

export interface ApiPoolsSummary {
  totalDeposits: string;
  totalAllocated: string;
  totalAvailable: string;
}

export interface ApiPortfolioInvestment {
  vaultAddress: string;
  agent: string;
  state: VaultState;
  amountInvested: string;
  claimable: string;
  interestRate: number;
  durationMonths: number;
}

export interface ApiPortfolioSummary {
  totalInvested: string;
  totalClaimable: string;
}

export interface ApiPlatformStats {
  totalVaults: number;
  activeVaults: number;
  tvl: string;
  totalRepaid: string;
  poolLiquidity: string;
}

export interface ApiPlatformConfig {
  platformFeeBps: number;
  maxFeeBps: number;
  minDurationSeconds: number;
  maxDurationSeconds: number;
  minInterestRateBps: number;
  maxInterestRateBps: number;
  chainId: number;
  contracts: Record<string, string>;
}

export interface UnsignedTx {
  to: string;
  data: string;
  description: string;
  value?: string;
  chainId?: number;
}

export interface EnrichedKickstartToken {
  curve: string;
  token: string | null;
  name: string;
  symbol: string;
  ethRaisedEth: string;
  progressPct: number;
  graduated: boolean;
}

export interface EnrichedTokensResponse {
  tokens: EnrichedKickstartToken[];
  total: number;
  stats: {
    totalTokens: number;
    graduatedCount: number;
    totalEthRaisedEth: string;
  };
}

export interface ApiOraclePayment {
  id: string;
  from: string;
  to: string;
  vault: string;
  amount: string;
  nonce: string;
  deadline: string;
  paymentId: string;
  status: string;
  txHash: string | null;
  error: string | null;
  attempts: number;
  nextRetryAt: string | null;
  createdAt: string;
  processedAt: string | null;
}

export interface ApiSettlement {
  vault: string;
  repaymentRateBps: number;
  totalRouted: string;
  totalPayments: number;
  active: boolean;
  lastPaymentAt: string | null;
}

export interface ApiRepaymentResult {
  status: string;
  txHash: string | null;
  repaymentAmount: string;
  grossAmount: string;
  netReturned: string;
}

export interface ApiAgentIdentity {
  agent: string;
  hasIdentity: boolean;
  tokenId: string;
  reputationScore: number;
  reputation: {
    totalTransactions: string;
    totalVolumeUsdc: string;
    successfulRepayments: string;
    defaultCount: string;
    firstActiveAt: string;
    metadataURI: string;
  };
}

export interface ApiGatewaySummary {
  totalRevenue: string;
  totalPayments: number;
  sources: {
    crypto: { volume: string; count: number };
    x402: { volume: string; count: number };
    fiat: { volume: string; count: number };
  };
  recentPayments: Array<{
    id: string;
    source: string;
    amount: string;
    from: string;
    to: string;
    status: string;
    timestamp: string;
    txHash: string | null;
  }>;
}

export interface ApiGatewayBreakdown {
  breakdown: Array<{
    source: string;
    volume: string;
    count: number;
    color: string;
  }>;
  totalRevenue: string;
  totalPayments: number;
}

export interface ApiAgentWallet {
  address: string;
  owner: string;
  operator: string;
  dailyLimit: string;
  perTxLimit: string;
  spentToday: string;
  frozen: boolean;
  whitelistEnabled: boolean;
  creditVault: string;
  remainingDaily: string;
}

export interface CreateVaultParams {
  agent: string;
  targetAmount?: string;
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

export interface ApiTraderProfile {
  address: string;
  isRegistered: boolean;
  active: boolean;
  creditScore: number;
  creditTier: string;
  creditUpdatedAt: number;
  vault: string | null;
}

export interface ApiTraderVault {
  vault: string | null;
  message?: string;
  creditLimit: string;
  drawn: string;
  totalRepaid: string;
  totalDrawn: string;
  interestRateBps: number;
  frozen: boolean;
  activatedAt: number;
  utilizationBps: number;
  utilizationPct: number;
  available: string;
  accruedInterest: string;
}

export interface PolymarketStats {
  address: string;
  totalVolume: number;
  realizedPnl: number;
  unrealizedPnl: number;
  winRate: number;
  totalTrades: number;
  openPositions: number;
  accountAgedays: number;
  firstTradeAt: number | null;
  suggestedScore: number;
  scoreBreakdown: {
    winRate: number;
    volume: number;
    realizedPnl: number;
    accountAge: number;
  };
}

export interface ApiHealthResponse {
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  version: string;
  database: boolean;
  chain: boolean;
  chainId: number;
  latestBlock: number;
}
