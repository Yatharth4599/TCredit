// x402 Demo Mock Data — TranslateBot $50K Credit Line Example
// Economics: Senior (NBFC) 1%/mo, Mezzanine (LP) 1.25%/mo, Junior (Treasury) 1.5%/mo

export interface Agent {
  id: string
  name: string
  type: string
  address: string
  metadataUri: string
  avatar: string
}

export interface VaultConfig {
  target: number
  durationDays: number
  durationMonths: number
  repaymentRate: number
  monthlyInterest: number
  blendedRate: number
}

export interface Investor {
  name: string
  type: 'senior' | 'mezzanine' | 'junior'
  amount: number
  yieldRate: number
  monthlyYield: number
  totalReturn: number
  profit: number
}

export interface Payment {
  id: string
  from: Agent
  to: Agent
  amount: number
  vaultRepayment: number
  agentNet: number
  timestamp: string
  oracleVerified: boolean
  nonce: number
}

export interface WaterfallState {
  seniorRepaid: number
  seniorTarget: number
  mezzanineRepaid: number
  mezzanineTarget: number
  juniorRepaid: number
  juniorTarget: number
}

export interface CreditAssessment {
  paymentHistory: number
  totalTransactions: number
  averageMonthlyRevenue: number
  activeSubscriptions: number
  onTimePaymentRate: number
  riskScore: string
  creditLimit: number
  approved: boolean
}

// ── AI Credit Assessment ──

export const CREDIT_ASSESSMENT: CreditAssessment = {
  paymentHistory: 14,
  totalTransactions: 2_847,
  averageMonthlyRevenue: 12_500,
  activeSubscriptions: 342,
  onTimePaymentRate: 99.2,
  riskScore: 'A',
  creditLimit: 50_000,
  approved: true,
}

// ── Agents ──

export const TRANSLATE_BOT: Agent = {
  id: 'agent-001',
  name: 'TranslateBot',
  type: 'AI Translation Service',
  address: '0x7a3B...4f2E',
  metadataUri: 'ipfs://Qm...translateBot',
  avatar: 'translate',
}

export const SHOP_BOT: Agent = {
  id: 'agent-002',
  name: 'ShopBot',
  type: 'E-Commerce Agent',
  address: '0x3cF1...8a9D',
  metadataUri: 'ipfs://Qm...shopBot',
  avatar: 'shop',
}

export const DATA_BOT: Agent = {
  id: 'agent-003',
  name: 'DataBot',
  type: 'Data Analytics Service',
  address: '0x9eA2...1b7C',
  metadataUri: 'ipfs://Qm...dataBot',
  avatar: 'data',
}

export const CODE_BOT: Agent = {
  id: 'agent-004',
  name: 'CodeBot',
  type: 'Code Review Agent',
  address: '0x5dB8...6e3A',
  metadataUri: 'ipfs://Qm...codeBot',
  avatar: 'code',
}

export const ALL_AGENTS = [TRANSLATE_BOT, SHOP_BOT, DATA_BOT, CODE_BOT]
export const PAYING_AGENTS = [SHOP_BOT, DATA_BOT, CODE_BOT]

// ── Vault Configuration — single disbursement ──

export const VAULT_CONFIG: VaultConfig = {
  target: 50_000,
  durationDays: 180,
  durationMonths: 6,
  repaymentRate: 15, // 15% of incoming payments
  monthlyInterest: 588, // $250 + $188 + $150
  blendedRate: 1.18, // weighted avg across 3 tranches
}

// ── Three-Pool Capital Structure ──

export const SENIOR_TRANCHE: Investor = {
  name: 'NBFC Pool (Senior)',
  type: 'senior',
  amount: 25_000,
  yieldRate: 1, // 1%/month
  monthlyYield: 250, // 1% of $25K
  totalReturn: 26_500, // $25K + 6 × $250
  profit: 1_500,
}

export const MEZZANINE_TRANCHE: Investor = {
  name: 'LP Pool (Mezzanine)',
  type: 'mezzanine',
  amount: 15_000,
  yieldRate: 1.25, // 1.25%/month
  monthlyYield: 188, // 1.25% of $15K (rounded)
  totalReturn: 16_128, // $15K + 6 × $188
  profit: 1_128,
}

export const JUNIOR_TRANCHE: Investor = {
  name: 'Protocol Treasury (Junior)',
  type: 'junior',
  amount: 10_000,
  yieldRate: 1.5, // 1.5%/month
  monthlyYield: 150, // 1.5% of $10K
  totalReturn: 10_900, // $10K + 6 × $150
  profit: 900,
}

export const ALL_INVESTORS = [SENIOR_TRANCHE, MEZZANINE_TRANCHE, JUNIOR_TRANCHE]

// Total obligation = all principal + all yield
export const TOTAL_OBLIGATION =
  SENIOR_TRANCHE.totalReturn + MEZZANINE_TRANCHE.totalReturn + JUNIOR_TRANCHE.totalReturn // $53,528

// ── Simulated Payment Stream ──

function makePayment(
  id: number,
  from: Agent,
  amount: number,
  hour: number,
  min: number,
  sec: number,
): Payment {
  const vaultRepayment = Math.round(amount * VAULT_CONFIG.repaymentRate / 100)
  const agentNet = amount - vaultRepayment
  return {
    id: `txn-${String(id).padStart(3, '0')}`,
    from,
    to: TRANSLATE_BOT,
    amount,
    vaultRepayment,
    agentNet,
    timestamp: `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`,
    oracleVerified: true,
    nonce: id,
  }
}

export const PAYMENT_STREAM: Payment[] = [
  makePayment(1, SHOP_BOT, 1_000, 8, 22, 11),
  makePayment(2, DATA_BOT, 2_500, 8, 25, 34),
  makePayment(3, CODE_BOT, 800, 8, 31, 7),
  makePayment(4, SHOP_BOT, 1_200, 9, 2, 45),
  makePayment(5, DATA_BOT, 3_000, 9, 15, 22),
  makePayment(6, CODE_BOT, 650, 9, 28, 53),
  makePayment(7, SHOP_BOT, 1_800, 10, 4, 18),
  makePayment(8, DATA_BOT, 2_200, 10, 19, 41),
  makePayment(9, SHOP_BOT, 900, 10, 45, 6),
  makePayment(10, CODE_BOT, 1_500, 11, 8, 29),
  makePayment(11, DATA_BOT, 4_000, 11, 33, 12),
  makePayment(12, SHOP_BOT, 1_100, 12, 1, 55),
  makePayment(13, CODE_BOT, 2_800, 12, 22, 38),
  makePayment(14, DATA_BOT, 1_700, 13, 5, 14),
  makePayment(15, SHOP_BOT, 3_500, 13, 41, 47),
  makePayment(16, CODE_BOT, 950, 14, 12, 3),
  makePayment(17, DATA_BOT, 2_100, 14, 38, 26),
  makePayment(18, SHOP_BOT, 1_300, 15, 2, 59),
]

export const STREAM_TOTALS = {
  totalRevenue: PAYMENT_STREAM.reduce((s, p) => s + p.amount, 0),
  totalVaultRepayment: PAYMENT_STREAM.reduce((s, p) => s + p.vaultRepayment, 0),
  totalAgentKept: PAYMENT_STREAM.reduce((s, p) => s + p.agentNet, 0),
}

// ── Waterfall Computation ──

export function computeWaterfallState(totalRepaid: number): WaterfallState {
  const seniorTarget = SENIOR_TRANCHE.totalReturn
  const mezzanineTarget = MEZZANINE_TRANCHE.totalReturn
  const juniorTarget = JUNIOR_TRANCHE.totalReturn
  const totalTarget = TOTAL_OBLIGATION

  const capped = Math.min(totalRepaid, totalTarget)

  // Proportional distribution — each tier gets its share of every dollar repaid
  const seniorRepaid = Math.min(Math.round(capped * seniorTarget / totalTarget), seniorTarget)
  const mezzanineRepaid = Math.min(Math.round(capped * mezzanineTarget / totalTarget), mezzanineTarget)
  const juniorRepaid = Math.min(Math.round(capped * juniorTarget / totalTarget), juniorTarget)

  return {
    seniorRepaid,
    seniorTarget,
    mezzanineRepaid,
    mezzanineTarget,
    juniorRepaid,
    juniorTarget,
  }
}

// Helper: format currency
export function fmtUSD(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}
