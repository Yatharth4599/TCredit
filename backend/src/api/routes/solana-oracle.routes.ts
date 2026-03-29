/**
 * Solana Oracle routes — oracle co-signing for credit operations
 *
 * POST /api/v1/solana/oracle/sign-credit  — build + oracle-sign a request_credit tx
 */

import { Router } from 'express';
import { Keypair, PublicKey, Transaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { evaluateCredit } from '../../services/solana-oracle.js';
import { buildRequestCredit } from '../../chain/solana/builder.js';
import { readAgentWallet } from '../../chain/solana/reader.js';
import { AppError } from '../middleware/errorHandler.js';
import { requireApiKey } from '../middleware/apiKeyAuth.js';
import { env } from '../../config/env.js';

const router = Router();

function parsePubkey(raw: string): PublicKey {
  try { return new PublicKey(raw); }
  catch { throw new AppError(400, `Invalid Solana public key: ${raw}`); }
}

function loadOracleKeypair(): Keypair {
  const raw = env.SOLANA_ORACLE_PRIVATE_KEY;
  if (!raw) throw new AppError(503, 'Oracle keypair not configured (SOLANA_ORACLE_PRIVATE_KEY)');
  try {
    // Support both base58 and JSON array formats
    if (raw.startsWith('[')) {
      return Keypair.fromSecretKey(new Uint8Array(JSON.parse(raw)));
    }
    return Keypair.fromSecretKey(bs58.decode(raw));
  } catch {
    throw new AppError(503, 'Oracle keypair is invalid');
  }
}

/**
 * POST /api/v1/solana/oracle/sign-credit
 *
 * Evaluates credit eligibility, builds a request_credit transaction,
 * partially signs it with the oracle keypair, and returns it for the
 * browser wallet to add the second signature (agent_or_owner).
 *
 * Body: { agentPubkey, agentOrOwnerPubkey, amount, rateBps?, creditLevel?, collateralValueUsdc? }
 * Response: { transaction: string (base64), encoding: 'base64', feePayer: string, instructions: string }
 */
router.post('/sign-credit', requireApiKey, async (req, res, next) => {
  try {
    const { agentPubkey, agentOrOwnerPubkey, amount, rateBps, creditLevel, collateralValueUsdc } = req.body;

    if (!agentPubkey || !agentOrOwnerPubkey || !amount) {
      throw new AppError(400, 'agentPubkey, agentOrOwnerPubkey, and amount are required');
    }

    const agentPk = parsePubkey(agentPubkey);
    const agentOrOwnerPk = parsePubkey(agentOrOwnerPubkey);

    // BUG-066: Log security event — REST endpoints cannot verify wallet ownership
    // of agentOrOwnerPubkey. The on-chain program enforces the real signer check
    // when the browser wallet co-signs the transaction. This log is for audit trails.
    console.warn('[SECURITY] Credit co-sign requested for agent', agentPubkey, 'by API key', (req as any).apiKeyId ?? 'unknown');

    // Load oracle keypair (fails with 503 if not configured)
    const oracleKeypair = loadOracleKeypair();

    // Validate eligibility
    const eligibility = await evaluateCredit(agentPubkey);
    if (!eligibility.eligible) {
      throw new AppError(400, `Credit not eligible: ${eligibility.reason}`);
    }

    // BUG-110: Validate amount does not exceed evaluated credit limit
    const requestedAmount = BigInt(amount);
    if (requestedAmount <= 0n) {
      throw new AppError(400, 'Amount must be positive');
    }
    if (requestedAmount > BigInt(eligibility.maxCreditUsdc ?? 0)) {
      throw new AppError(400, `Amount ${amount} exceeds credit limit of ${eligibility.maxCreditUsdc}`);
    }

    // BUG-109: Never use client-supplied creditLevel — always use oracle evaluation
    const evaluatedLevel = eligibility.creditLevel ?? 1;
    if (creditLevel !== undefined && creditLevel > evaluatedLevel) {
      throw new AppError(400, `Requested level ${creditLevel} exceeds evaluated level ${evaluatedLevel}`);
    }

    // Validate wallet state
    const wallet = await readAgentWallet(agentPk);
    if (!wallet) throw new AppError(404, 'Agent wallet not found — create wallet first');
    if (wallet.isFrozen) throw new AppError(400, 'Wallet is frozen');
    if (wallet.creditDrawn > 0n) throw new AppError(400, 'Existing credit must be repaid first');

    // Build the instruction — use oracle-evaluated values, not client-supplied
    const ixn = buildRequestCredit({
      agent: agentPk,
      oracle: oracleKeypair.publicKey,
      agentOrOwner: agentOrOwnerPk,
      amount: requestedAmount,
      rateBps: rateBps ?? 1000,
      creditLevel: evaluatedLevel,
      collateralValueUsdc: 0n, // BUG-109: collateral must be computed on-chain, not client-supplied
    });

    // Build transaction with oracle as fee payer
    const { solanaConnection } = await import('../../chain/solana/connection.js');
    const { blockhash } = await solanaConnection.getLatestBlockhash('confirmed');
    const tx = new Transaction({ recentBlockhash: blockhash, feePayer: oracleKeypair.publicKey });
    tx.add(ixn);

    // Oracle partially signs (adds its signature)
    tx.partialSign(oracleKeypair);

    const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64');

    res.json({
      transaction: serialized,
      encoding: 'base64',
      feePayer: oracleKeypair.publicKey.toBase58(),
      description: `Oracle-signed request_credit for ${agentPubkey}: ${(Number(amount) / 1_000_000).toFixed(2)} USDC at level ${creditLevel ?? eligibility.creditLevel ?? 1}`,
      instructions: 'Submit transaction to browser wallet to add agent_or_owner signature, then send to devnet',
    });
  } catch (err) {
    next(err);
  }
});

export default router;
