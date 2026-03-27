/**
 * Zod validation schemas for all POST/PUT/PATCH request bodies.
 *
 * Organized by route group. Each schema is named `<Route><Action>Schema`.
 * Import and use with the `validate` middleware:
 *
 *   import { validate } from '../middleware/validate.js';
 *   import { WaitlistJoinSchema } from '../schemas.js';
 *   router.post('/', validate(WaitlistJoinSchema), handler);
 */

import { z } from 'zod';

// ─── Reusable field validators ──────────────────────────────────────────────

/** Ethereum 0x-prefixed address (42 chars) */
const evmAddress = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Must be a valid 0x Ethereum address');

/** Solana base58 public key (32–44 chars) */
const solanaPubkey = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, 'Must be a valid Solana public key');

/** Positive integer as string (for BigInt amounts) */
const bigintString = z.string().regex(/^\d+$/, 'Must be a non-negative integer string');

/** Hex string (0x-prefixed) */
const hexString = z.string().regex(/^0x[a-fA-F0-9]+$/, 'Must be a 0x hex string');

/** Positive USDC amount (human-readable, e.g. "100.5") */
const usdcAmount = z.coerce.number().positive('Must be a positive number');

/** Basis points (0–10000) */
const bps = z.coerce.number().int().min(0).max(10000);

/** URL string */
const urlString = z.string().url('Must be a valid URL');

/** Email address */
const email = z.string().email('Invalid email address').transform((e) => e.trim().toLowerCase());


// ═══════════════════════════════════════════════════════════════════════════
// Waitlist
// ═══════════════════════════════════════════════════════════════════════════

export const WaitlistJoinSchema = z.object({
  email,
  walletAddress: z.string().trim().optional(),
});


// ═══════════════════════════════════════════════════════════════════════════
// Admin — API Keys
// ═══════════════════════════════════════════════════════════════════════════

export const AdminCreateKeySchema = z.object({
  name: z.string().min(1, 'name is required').max(100),
  rateLimit: z.coerce.number().int().min(1).max(10000).optional(),
});

export const AdminUpdateKeySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  rateLimit: z.coerce.number().int().min(1).max(10000).optional(),
  active: z.boolean().optional(),
}).refine((d) => Object.keys(d).length > 0, 'At least one field required');

// ═══════════════════════════════════════════════════════════════════════════
// Admin — Webhooks
// ═══════════════════════════════════════════════════════════════════════════

export const AdminCreateWebhookSchema = z.object({
  url: urlString,
  events: z.array(z.string().min(1)).min(1, 'At least one event type required'),
});

export const AdminUpdateWebhookSchema = z.object({
  url: urlString.optional(),
  events: z.array(z.string().min(1)).optional(),
  active: z.boolean().optional(),
}).refine((d) => Object.keys(d).length > 0, 'At least one field required');


// ═══════════════════════════════════════════════════════════════════════════
// Oracle (EVM)
// ═══════════════════════════════════════════════════════════════════════════

export const OraclePaymentSchema = z.object({
  from: evmAddress,
  to: evmAddress,
  amount: bigintString,
  paymentId: hexString.optional(),
});


// ═══════════════════════════════════════════════════════════════════════════
// Credit (EVM)
// ═══════════════════════════════════════════════════════════════════════════

export const CreditAgentLineSchema = z.object({
  agent: evmAddress,
  targetAmountUsdc: usdcAmount,
  interestRateBps: bps.optional(),
  durationDays: z.coerce.number().int().min(1).max(3650).optional(),
  numTranches: z.coerce.number().int().min(1).max(12).optional(),
  repaymentRateBps: bps.optional(),
});

export const CreditVendorSchema = z.object({
  vendorAgent: evmAddress,
  targetAmountUsdc: usdcAmount,
  interestRateBps: bps.optional(),
  durationDays: z.coerce.number().int().min(1).max(3650).optional(),
  repaymentRateBps: bps.optional(),
});


// ═══════════════════════════════════════════════════════════════════════════
// Wallets (EVM — AgentWalletFactory)
// ═══════════════════════════════════════════════════════════════════════════

export const WalletCreateSchema = z.object({
  operator: evmAddress,
  dailyLimitUsdc: usdcAmount.optional(),
  perTxLimitUsdc: usdcAmount.optional(),
});

export const WalletSetLimitsSchema = z.object({
  dailyLimitUsdc: usdcAmount.optional(),
  perTxLimitUsdc: usdcAmount.optional(),
});

export const WalletSetOperatorSchema = z.object({
  operator: evmAddress,
});

export const WalletWhitelistSchema = z.object({
  recipient: evmAddress,
  allowed: z.boolean().optional().default(true),
});

export const WalletLinkCreditSchema = z.object({
  vault: evmAddress,
});

export const WalletTransferSchema = z.object({
  to: evmAddress,
  amountUsdc: usdcAmount,
});

export const WalletDepositSchema = z.object({
  amountUsdc: usdcAmount,
});

export const WalletEmergencyWithdrawSchema = z.object({
  to: evmAddress,
});

export const WalletToggleWhitelistSchema = z.object({
  enabled: z.boolean(),
});


// ═══════════════════════════════════════════════════════════════════════════
// x402
// ═══════════════════════════════════════════════════════════════════════════

export const X402RegisterResourceSchema = z.object({
  url: urlString,
  pricePerCallUsdc: usdcAmount,
});

export const X402VerifySchema = z.object({
  resourceHash: hexString,
  txHash: hexString,
});


// ═══════════════════════════════════════════════════════════════════════════
// Kickstart
// ═══════════════════════════════════════════════════════════════════════════

export const KickstartUploadMetadataSchema = z.object({
  name: z.string().min(1, 'name required').max(100),
  ticker: z.string().min(1, 'ticker required').max(10),
  description: z.string().min(1, 'description required').max(2000),
  imageUrl: urlString.optional(),
  imageBase64: z.string().optional(),
  imageMime: z.string().optional(),
  twitter: z.string().max(200).optional(),
  telegram: z.string().max(200).optional(),
  website: urlString.optional(),
});

export const KickstartCreateTokenSchema = z.object({
  name: z.string().min(1, 'name required').max(100),
  symbol: z.string().min(1, 'symbol required').max(10),
  uri: z.string().min(1, 'uri required'),
  deadlineSeconds: z.coerce.number().int().positive().optional(),
  initialBuyEth: z.coerce.number().nonnegative().optional(),
});

export const KickstartBuyTokenSchema = z.object({
  curveAddress: evmAddress,
  ethAmount: z.coerce.number().positive('ethAmount must be positive'),
  minTokensOut: z.coerce.number().nonnegative().optional(),
});

export const KickstartCreditAndLaunchSchema = z.object({
  vaultAddress: evmAddress.optional(),
  name: z.string().min(1, 'name required').max(100),
  symbol: z.string().min(1, 'symbol required').max(10),
  description: z.string().max(2000).optional(),
  imageUrl: urlString.optional(),
  initialBuyEth: z.coerce.number().nonnegative().optional(),
  deadlineSeconds: z.coerce.number().int().positive().optional(),
});


// ═══════════════════════════════════════════════════════════════════════════
// Investments (EVM)
// ═══════════════════════════════════════════════════════════════════════════

export const InvestSchema = z.object({
  vaultAddress: evmAddress,
  amount: bigintString,
});

export const ClaimSchema = z.object({
  vaultAddress: evmAddress,
});

export const RefundSchema = z.object({
  vaultAddress: evmAddress,
});


// ═══════════════════════════════════════════════════════════════════════════
// Vaults (EVM)
// ═══════════════════════════════════════════════════════════════════════════

export const VaultCreateSchema = z.object({
  agent: evmAddress,
  targetAmount: bigintString,
  interestRateBps: z.coerce.number().int().min(100).max(5000).optional(),
  durationSeconds: z.coerce.number().int().positive().optional(),
  numTranches: z.coerce.number().int().min(1).max(12).optional(),
  repaymentRateBps: bps.optional(),
  minPaymentInterval: z.coerce.number().int().nonnegative().optional(),
  maxSinglePayment: z.coerce.number().int().nonnegative().optional(),
  lateFeeBps: z.coerce.number().int().min(0).max(1000).optional(),
  gracePeriodSeconds: z.coerce.number().int().min(86400).max(2592000).optional(),
  fundraisingDeadline: z.coerce.number().int().positive().optional(),
});

export const MilestoneSubmitSchema = z.object({
  trancheIndex: z.coerce.number().int().nonnegative(),
  evidenceHash: hexString,
});

export const MilestoneVoteSchema = z.object({
  trancheIndex: z.coerce.number().int().nonnegative(),
  approve: z.boolean(),
});


// ═══════════════════════════════════════════════════════════════════════════
// Pools (EVM)
// ═══════════════════════════════════════════════════════════════════════════

export const PoolDepositSchema = z.object({
  poolAddress: evmAddress,
  amount: bigintString,
});

export const PoolWithdrawSchema = z.object({
  poolAddress: evmAddress,
  amount: bigintString,
});

export const PoolAllocateSchema = z.object({
  poolAddress: evmAddress,
  vaultAddress: evmAddress,
  amount: bigintString,
});


// ═══════════════════════════════════════════════════════════════════════════
// Merchants (EVM)
// ═══════════════════════════════════════════════════════════════════════════

export const MerchantRegisterSchema = z.object({
  metadataURI: z.string().optional(),
});

export const MerchantRepaySchema = z.object({
  repaymentAmount: bigintString,
});

export const MerchantCreditScoreSchema = z.object({
  score: z.coerce.number().int().min(0).max(1000),
});


// ═══════════════════════════════════════════════════════════════════════════
// Traders (EVM)
// ═══════════════════════════════════════════════════════════════════════════

export const TraderRegisterSchema = z.object({
  metadataURI: z.string().optional(),
});

export const TraderDrawSchema = z.object({
  amount: bigintString,
});

export const TraderRepaySchema = z.object({
  amount: bigintString,
});


// ═══════════════════════════════════════════════════════════════════════════
// Identity
// ═══════════════════════════════════════════════════════════════════════════

export const IdentityMintSchema = z.object({
  agent: evmAddress,
});


// ═══════════════════════════════════════════════════════════════════════════
// Demo
// ═══════════════════════════════════════════════════════════════════════════

export const DemoSimulatePaymentSchema = z.object({
  vaultAddress: evmAddress.optional(),
  amount: z.coerce.number().positive('amount must be positive'),
  source: z.string().optional(),
});

export const DemoFullLifecycleSchema = z.object({
  agentPubkey: solanaPubkey.optional(),
  loanAmount: z.coerce.number().min(1000).max(10000).optional(),
  numPayments: z.coerce.number().int().min(3).max(20).optional(),
});


// ═══════════════════════════════════════════════════════════════════════════
// Solana — Agent Wallets
// ═══════════════════════════════════════════════════════════════════════════

export const SolanaWalletCreateSchema = z.object({
  agent: solanaPubkey,
  owner: solanaPubkey,
  dailySpendLimitUsdc: usdcAmount.optional(),
  agentType: z.number().int().min(0).max(2).optional(),
});

export const SolanaWalletProposeTransferSchema = z.object({
  owner: solanaPubkey,
  newOwner: solanaPubkey,
  newOwnerType: z.coerce.number().int().min(0).max(1).optional(),
});

export const SolanaWalletAcceptTransferSchema = z.object({
  newOwner: solanaPubkey,
  rentReceiver: solanaPubkey.optional(),
});

export const SolanaWalletCancelTransferSchema = z.object({
  owner: solanaPubkey,
});


// ═══════════════════════════════════════════════════════════════════════════
// Solana — Agent Credit
// ═══════════════════════════════════════════════════════════════════════════

export const SolanaCreditRequestSchema = z.object({
  amount: bigintString,
  rateBps: bps.optional(),
  creditLevel: z.coerce.number().int().min(1).max(4).optional(),
  collateralValueUsdc: bigintString.optional(),
});

export const SolanaCreditRepaySchema = z.object({
  amount: bigintString,
  callerPubkey: solanaPubkey,
});

export const SolanaSignAgreementSchema = z.object({
  creditLevel: z.coerce.number().int().min(3).max(4),
});

export const SolanaConfirmAgreementSchema = z.object({
  agreementId: z.string().uuid(),
  txSignature: z.string().min(1, 'txSignature required'),
  onChainHash: z.string().min(1, 'onChainHash required'),
});


// ═══════════════════════════════════════════════════════════════════════════
// Solana — Oracle
// ═══════════════════════════════════════════════════════════════════════════

export const SolanaOracleSignCreditSchema = z.object({
  agentPubkey: solanaPubkey,
  agentOrOwnerPubkey: solanaPubkey,
  amount: bigintString,
  rateBps: bps.optional(),
  creditLevel: z.coerce.number().int().min(1).max(4).optional(),
  collateralValueUsdc: bigintString.optional(),
});


// ═══════════════════════════════════════════════════════════════════════════
// Solana — Faucet
// ═══════════════════════════════════════════════════════════════════════════

export const SolanaFaucetMintSchema = z.object({
  recipient: solanaPubkey,
  amountUsdc: z.coerce.number().positive().max(100).optional().default(10),
});


// ═══════════════════════════════════════════════════════════════════════════
// Solana — KYA
// ═══════════════════════════════════════════════════════════════════════════

export const KyaBasicSchema = z.object({
  ownerPubkey: solanaPubkey,
  ownerSignature: z.string().min(1, 'ownerSignature required'),
  codeRepoUrl: urlString.optional(),
});

export const KyaEnhancedSchema = z.object({
  ownerPubkey: solanaPubkey,
  sumsubApplicantId: z.string().min(1, 'sumsubApplicantId required'),
});
