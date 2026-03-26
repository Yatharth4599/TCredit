// ── Agent Wallet ──────────────────────────────────────────────────────────

export interface OnChainAgent {
  agent: string
  owner: string
  walletUsdc: string
  creditLevel: number
  creditLimit: string
  creditDrawn: string
  totalDebt: string
  collateralShares: string
  dailySpendLimit: string
  dailySpent: string
  healthFactorBps: number
  healthFactorDisplay: string
  lastHealthCheck: string
  isFrozen: boolean
  isLiquidating: boolean
  totalTrades: string
  totalVolume: string
  totalRepaid: string
  createdAt: string
  ownerType: 'eoa' | 'multisig'
}

export interface AgentWalletResponse {
  onChain: OnChainAgent
  db: Record<string, unknown> | null
}

export interface HealthData {
  agentPubkey: string
  healthFactorBps: number
  healthFactor: string
  status: 'critical' | 'danger' | 'warning' | 'healthy'
  creditDrawn: string
  totalDebt: string
  isFrozen: boolean
  isLiquidating: boolean
  lastHealthCheck: string
}

export interface BalanceData {
  walletUsdc: string
  balanceBaseUnits: string
  balanceUsdc: string
}

// ── Credit ────────────────────────────────────────────────────────────────

export interface CreditLineData {
  agentPubkey: string
  exists: boolean
  creditLimit: string
  creditDrawn: string
  accruedInterest: string
  totalInterestPaid: string
  totalOwed: string
  interestRateBps: number
  isActive: boolean
  originatedAt: string
  lastAccrualTimestamp: string
  healthFactorBps: number | null
  isFrozen: boolean | null
}

export interface EligibilityData {
  eligible: boolean
  creditLevel: number
  maxCreditUsdc: number
  reason: string
  agentPubkey: string
  creditScore: number
  kyaTier: number
}

export interface ProtocolLevel {
  name: string
  maxUsdc: number
  maxDisplay: string
  rateBps: number
  rateDisplay: string
  minScore: number
  minKyaTier: number
}

export interface ProtocolTranche {
  aprBps: number
  aprDisplay: string
  risk: string
  description: string
  protocolOnly: boolean
}

export interface ProtocolParamsData {
  levels: Record<string, ProtocolLevel>
  tranches: Record<string, ProtocolTranche>
}

export interface CreditRequestData {
  id: string
  agentPubkey: string
  amount: string
  creditLevel: number
  status: string
  txSignature: string | null
  requestedAt: string
  resolvedAt: string | null
}

// ── Score ─────────────────────────────────────────────────────────────────

export interface ScoreComponents {
  c1Repayment: number
  c2Profitability: number
  c3Behavioral: number
  c4Usage: number
  c5Maturity: number
}

export interface ScoreHistoryEntry {
  timestamp: string
  oldScore: number
  newScore: number
  eventType: number
  deltaBps: number
}

export interface ScoreData {
  source: 'on-chain' | 'preview'
  agentPubkey: string
  scorePda: string
  score: number
  creditLevel: number
  kyaTier: number
  agentType: number
  components: ScoreComponents
  repaymentStats: {
    onTimeRepayments: number
    lateRepayments: number
    missedRepayments: number
    liquidations: number
    defaults: number
    creditCyclesCompleted: number
  }
  financials: {
    cumulativeBorrowed: string
    cumulativeRepaid: string
    currentDebt: string
  }
  riskMetrics: {
    pnlRatioBps: number
    maxDrawdownBps: number
    sharpeRatioBps: number
  }
  timeInZone: {
    greenTimeBps: number
    yellowTimeBps: number
    orangeTimeBps: number
    redTimeBps: number
  }
  activityMetrics: {
    venueEntropyBps: number
    uniqueVenues: number
    totalTransactions: number
    avgDailyVolume: string
  }
  timestamps: {
    registeredAt: string
    lastScoreUpdate: string
    lastCriticalEvent: string
    lastRepayment: string
  }
  history: ScoreHistoryEntry[]
  revenueHealthBps: number
  milestoneCompletionBps: number
  isActive: boolean
  isBlacklisted: boolean
  // Preview-only fields
  preview?: {
    score: number
    network: string
    txCount: number
    walletAgeDays: number
    breakdown: Record<string, number>
    components: ScoreComponents
    note: string
  }
  creditPreview?: {
    estimatedLevel: number
    maxCreditUsd: number
    description: string
    kyaRequired: number
    levels: Array<{
      level: number
      minScore: number
      minKya: number
      maxUsd: number
      qualified: boolean
      pointsNeeded: number
      description: string
    }>
  }
}

// ── Vault ─────────────────────────────────────────────────────────────────

export interface VaultStatsData {
  initialized: boolean
  totalDeposits: string
  totalDepositsUsdc: string
  totalShares: string
  totalDeployed: string
  totalDeployedUsdc: string
  availableLiquidity: string
  availableLiquidityUsdc: string
  utilizationBps: number
  utilizationPct: string
  utilizationCapBps: number
  baseInterestRateBps: number
  totalInterestEarned: string
  totalDefaults: string
  insuranceBalance: string
  insuranceBalanceUsdc: string
  isPaused: boolean
  lockupSeconds: string
}

export interface LpPositionData {
  depositor: string
  hasPosition: boolean
  shares: string
  depositedAmount: string
  depositedUsdc: string
  currentValue: string
  currentValueUsdc: string
  yieldEarned: string
  yieldEarnedUsdc: string
  depositTimestamp: string
  isCollateral: boolean
}

export interface CollateralData {
  agent: string
  hasCollateral: boolean
  shares: string
  depositedAmount: string
  currentValue: string
  currentValueUsdc: string
  depositTimestamp: string
}

// ── KYA ───────────────────────────────────────────────────────────────────

export interface KyaStatusData {
  agentPubkey: string
  onChainTier: number
  onChainLevel: number
  verifications: Array<{
    id: string
    tier: number
    method: string
    status: string
    createdAt: string
  }>
}

// ── Faucet ────────────────────────────────────────────────────────────────

export interface FaucetResponse {
  signature: string
  ata: string
  amountUsdc: number
  mint: string
  explorerUrl: string
}

// ── Unsigned Transaction ──────────────────────────────────────────────────

export interface UnsignedTxResponse {
  transaction: string
  encoding: 'base64'
  description?: string
}
