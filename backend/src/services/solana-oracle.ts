/**
 * Solana Oracle Service
 *
 * - evaluateCredit: decides whether an agent qualifies for a credit line
 * - submitPayment: builds + signs + submits an execute_payment transaction
 */

import { PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { solanaConnection, oracleSolanaKeypair } from '../chain/solana/connection.js';
import { readAgentProfile, readAgentWallet, readVaultConfig } from '../chain/solana/reader.js';
import { buildExecutePayment, buildActivateSettlement } from '../chain/solana/builder.js';
import { routerConfigPda, walletUsdcPda, agentWalletPda } from '../chain/solana/programs.js';
import { readRouterConfig } from '../chain/solana/reader.js';
import { AppError } from '../api/middleware/errorHandler.js';
import { env } from '../config/env.js';

// Credit level thresholds — mirror krexa-common constants
const CREDIT_THRESHOLDS = [
  { level: 4, minScore: 750, minKya: 3 },
  { level: 3, minScore: 650, minKya: 2 },
  { level: 2, minScore: 500, minKya: 2 },
  { level: 1, minScore: 400, minKya: 1 },
] as const;

const USDC_MINT = new PublicKey(env.SOLANA_USDC_MINT);

// ---------------------------------------------------------------------------
// Credit Evaluation
// ---------------------------------------------------------------------------

export interface CreditEvaluation {
  eligible: boolean;
  creditLevel: number;
  maxCreditUsdc: number;
  reason: string;
  agentPubkey: string;
  creditScore: number;
  kyaTier: number;
}

/** Analyse on-chain agent profile and return an approval/rejection decision. */
export async function evaluateCredit(agentPubkeyStr: string): Promise<CreditEvaluation> {
  let agentPubkey: PublicKey;
  try {
    agentPubkey = new PublicKey(agentPubkeyStr);
  } catch {
    throw new AppError(400, 'Invalid agent public key');
  }

  const [profile, vault] = await Promise.all([
    readAgentProfile(agentPubkey),
    readVaultConfig(),
  ]);

  if (!profile) {
    return {
      eligible: false, creditLevel: 0, maxCreditUsdc: 0,
      reason: 'Agent profile not found on-chain',
      agentPubkey: agentPubkeyStr, creditScore: 0, kyaTier: 0,
    };
  }

  if (!profile.isActive) {
    return {
      eligible: false, creditLevel: 0, maxCreditUsdc: 0,
      reason: 'Agent profile is not active',
      agentPubkey: agentPubkeyStr, creditScore: profile.creditScore, kyaTier: profile.kyaTier,
    };
  }

  if (!profile.hasWallet) {
    return {
      eligible: false, creditLevel: 0, maxCreditUsdc: 0,
      reason: 'Agent does not have a krexa wallet yet',
      agentPubkey: agentPubkeyStr, creditScore: profile.creditScore, kyaTier: profile.kyaTier,
    };
  }

  // Check vault liquidity
  if (vault && vault.isPaused) {
    return {
      eligible: false, creditLevel: 0, maxCreditUsdc: 0,
      reason: 'Credit vault is currently paused',
      agentPubkey: agentPubkeyStr, creditScore: profile.creditScore, kyaTier: profile.kyaTier,
    };
  }

  // Determine highest eligible level
  for (const threshold of CREDIT_THRESHOLDS) {
    if (profile.creditScore >= threshold.minScore && profile.kyaTier >= threshold.minKya) {
      const maxCreditUsdc = creditLimitForLevel(threshold.level, 0);
      return {
        eligible: true,
        creditLevel: threshold.level,
        maxCreditUsdc,
        reason: `Eligible for Level ${threshold.level} credit`,
        agentPubkey: agentPubkeyStr,
        creditScore: profile.creditScore,
        kyaTier: profile.kyaTier,
      };
    }
  }

  return {
    eligible: false, creditLevel: 0, maxCreditUsdc: 0,
    reason: `Score ${profile.creditScore} or KYA tier ${profile.kyaTier} below minimum requirements`,
    agentPubkey: agentPubkeyStr, creditScore: profile.creditScore, kyaTier: profile.kyaTier,
  };
}

/** Mirror of krexa-common constants for credit limits (in USDC base units). */
function creditLimitForLevel(level: number, collateralValueUsdc: number): number {
  const LEVEL_1_MAX = 200_000_000;      // $200
  const LEVEL_2_MAX = 10_000_000_000;   // $10,000
  const LEVEL_3_MAX = 100_000_000_000;  // $100,000
  const LEVEL_4_MAX = 500_000_000_000;  // $500,000
  switch (level) {
    case 1: return LEVEL_1_MAX;
    case 2: return Math.min(Math.floor(collateralValueUsdc * 5 / 1), LEVEL_2_MAX);
    case 3: return Math.min(Math.floor(collateralValueUsdc * 10 / 1), LEVEL_3_MAX);
    case 4: return LEVEL_4_MAX;
    default: return 0;
  }
}

// ---------------------------------------------------------------------------
// Payment Signing & Submission
// ---------------------------------------------------------------------------

export interface SubmitPaymentParams {
  merchant: string;     // merchant's Solana pubkey (base58)
  payer: string;        // buyer's Solana pubkey (base58)
  payerUsdc: string;    // buyer's USDC ATA (base58)
  amount: bigint;       // USDC base units
  nonce: bigint;
}

export interface SubmitPaymentResult {
  signature: string;
  merchant: string;
  amount: string;
  nonce: string;
  status: 'confirmed' | 'failed';
  error?: string;
}

export async function submitPayment(params: SubmitPaymentParams): Promise<SubmitPaymentResult> {
  if (!oracleSolanaKeypair) {
    throw new AppError(503, 'Oracle not configured: SOLANA_ORACLE_PRIVATE_KEY missing');
  }

  const merchant = new PublicKey(params.merchant);
  const payer = new PublicKey(params.payer);
  const payerUsdc = new PublicKey(params.payerUsdc);

  // Read settlement to get agent wallet PDA
  const { readMerchantSettlement } = await import('../chain/solana/reader.js');
  const settlement = await readMerchantSettlement(merchant);
  if (!settlement || !settlement.isActive) {
    throw new AppError(400, `No active settlement for merchant ${params.merchant}`);
  }

  // Nonce replay protection
  if (params.nonce <= settlement.nonce) {
    throw new AppError(400, `Nonce ${params.nonce} already used (current: ${settlement.nonce})`);
  }

  const agentWalletAddress = new PublicKey(settlement.agentWalletPda);
  const agentWallet = await readAgentWallet(agentWalletAddress);
  if (!agentWallet) throw new AppError(400, 'Agent wallet not found');

  // BUG-047: refuse to sign payments to frozen or liquidating wallets
  if (agentWallet.isFrozen) throw new AppError(400, `Wallet ${settlement.agentWalletPda} is frozen`);
  if (agentWallet.isLiquidating) throw new AppError(400, `Wallet ${settlement.agentWalletPda} is being liquidated`);

  const agentWalletUsdcAddress = new PublicKey(agentWallet.walletUsdc);
  const merchantUsdc = getAssociatedTokenAddressSync(USDC_MINT, merchant);

  const routerCfg = await readRouterConfig();
  if (!routerCfg) throw new AppError(503, 'Router config not found on-chain');
  if (routerCfg.isPaused) throw new AppError(400, 'Payment router is paused');

  const ixn = buildExecutePayment({
    oracle: oracleSolanaKeypair.publicKey,
    payer,
    payerUsdc,
    merchant,
    merchantUsdc,
    agentWalletPdaAddress: agentWalletAddress,
    agentWalletUsdc: agentWalletUsdcAddress,
    platformTreasury: new PublicKey(routerCfg.platformTreasury),
    amount: params.amount,
    nonce: params.nonce,
  });

  try {
    const { blockhash } = await solanaConnection.getLatestBlockhash('confirmed');
    const tx = new Transaction({ recentBlockhash: blockhash, feePayer: oracleSolanaKeypair.publicKey });
    tx.add(ixn);

    const sig = await sendAndConfirmTransaction(solanaConnection, tx, [oracleSolanaKeypair], {
      commitment: 'confirmed',
    });

    return {
      signature: sig,
      merchant: params.merchant,
      amount: params.amount.toString(),
      nonce: params.nonce.toString(),
      status: 'confirmed',
    };
  } catch (err) {
    return {
      signature: '',
      merchant: params.merchant,
      amount: params.amount.toString(),
      nonce: params.nonce.toString(),
      status: 'failed',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// Activate Settlement (oracle signs)
// ---------------------------------------------------------------------------

export async function activateSettlement(
  merchantPubkeyStr: string,
  agentPubkeyStr: string,
  splitBps: number,
  hasActiveCredit = false,
): Promise<{ signature: string }> {
  if (!oracleSolanaKeypair) {
    throw new AppError(503, 'Oracle not configured: SOLANA_ORACLE_PRIVATE_KEY missing');
  }

  const merchant = new PublicKey(merchantPubkeyStr);
  const agentWalletAddress = agentWalletPda(new PublicKey(agentPubkeyStr));

  const ixn = buildActivateSettlement({
    oracle: oracleSolanaKeypair.publicKey,
    merchant,
    agentWalletPdaAddress: agentWalletAddress,
    splitBps,
    hasActiveCredit,
  });

  const { blockhash } = await solanaConnection.getLatestBlockhash('confirmed');
  const tx = new Transaction({ recentBlockhash: blockhash, feePayer: oracleSolanaKeypair.publicKey });
  tx.add(ixn);

  const sig = await sendAndConfirmTransaction(solanaConnection, tx, [oracleSolanaKeypair], {
    commitment: 'confirmed',
  });

  return { signature: sig };
}

export function getSolanaOracleHealth() {
  return {
    configured: !!oracleSolanaKeypair,
    address: oracleSolanaKeypair?.publicKey.toBase58() ?? null,
  };
}
