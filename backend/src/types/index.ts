export type VaultState = 'fundraising' | 'active' | 'repaying' | 'completed' | 'cancelled' | 'defaulted';

export interface VaultResponse {
  address: string;
  merchant: string;
  merchantAddr: string;
  targetAmount: string;
  totalRaised: string;
  totalRepaid: string;
  totalToRepay: string;
  interestRateBps: number;
  durationSeconds: number;
  numTranches: number;
  tranchesReleased: number;
  state: VaultState;
  seniorFunded: string;
  poolFunded: string;
  userFunded: string;
  totalSeniorRepaid: string;
  totalPoolRepaid: string;
  investorCount: number;
  createdAt: string;
  activatedAt: string | null;
  percentFunded: number;
  interestRate: number;
  durationMonths: number;
}

export interface MerchantResponse {
  address: string;
  name: string | null;
  creditScore: number;
  creditTier: number;
  scoreUpdated: string | null;
  registeredAt: string;
  vaultCount: number;
}

export interface PoolResponse {
  address: string;
  admin: string;
  isAlpha: boolean;
  totalDeposits: string;
  totalAllocated: string;
  availableBalance: string;
  maxAllocationPerVault: string;
  paused: boolean;
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

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}
