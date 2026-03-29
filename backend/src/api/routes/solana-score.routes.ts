/**
 * Solana Score routes — score lookup for any wallet address
 *
 * GET  /api/v1/solana/score/:agent          — full score (on-chain or preview)
 * GET  /api/v1/solana/score/:agent/preview  — preview without registration
 */

import { Router } from 'express';
import { PublicKey } from '@solana/web3.js';
import { solanaConnection } from '../../chain/solana/connection.js';
import { krexitScorePda } from '../../chain/solana/programs.js';
import { readAgentProfile } from '../../chain/solana/reader.js';
import { AppError } from '../middleware/errorHandler.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { apiKeyAuth, type AuthenticatedRequest } from '../middleware/apiKeyAuth.js';

const router = Router();

// BUG-070: rate limit score lookups to prevent RPC exhaustion
router.use(rateLimit);

function parsePubkey(raw: string): PublicKey {
  try { return new PublicKey(raw); }
  catch { throw new AppError(400, `Invalid Solana public key: ${raw}`); }
}

// Borsh read helpers (no dep on Anchor)
function readU16LE(buf: Buffer, offset: number): number {
  return buf.readUInt16LE(offset);
}
function readU8(buf: Buffer, offset: number): number {
  return buf.readUInt8(offset);
}
function readU32LE(buf: Buffer, offset: number): number {
  return buf.readUInt32LE(offset);
}
function readI32LE(buf: Buffer, offset: number): number {
  return buf.readInt32LE(offset);
}
function readI16LE(buf: Buffer, offset: number): number {
  return buf.readInt16LE(offset);
}
function readU64LE(buf: Buffer, offset: number): bigint {
  return buf.readBigUInt64LE(offset);
}
function readI64LE(buf: Buffer, offset: number): bigint {
  return buf.readBigInt64LE(offset);
}
function readBool(buf: Buffer, offset: number): boolean {
  return buf.readUInt8(offset) !== 0;
}
function readPubkeyStr(buf: Buffer, offset: number): string {
  return new PublicKey(buf.slice(offset, offset + 32)).toBase58();
}

/** Deserialize the KrexitScore Borsh account (matching krexa-score state.rs). */
function deserializeKrexitScore(buf: Buffer) {
  let off = 8; // skip 8-byte discriminator
  const agent         = readPubkeyStr(buf, off); off += 32;
  const owner         = readPubkeyStr(buf, off); off += 32;
  const score         = readU16LE(buf, off);      off += 2;
  const creditLevel   = readU8(buf, off);         off += 1;
  const kyaTier       = readU8(buf, off);         off += 1;
  const c1Repayment   = readU16LE(buf, off);      off += 2;
  const c2Profitability = readU16LE(buf, off);    off += 2;
  const c3Behavioral  = readU16LE(buf, off);      off += 2;
  const c4Usage       = readU16LE(buf, off);      off += 2;
  const c5Maturity    = readU16LE(buf, off);      off += 2;
  const onTimeRepayments  = readU32LE(buf, off);  off += 4;
  const lateRepayments    = readU16LE(buf, off);  off += 2;
  const missedRepayments  = readU16LE(buf, off);  off += 2;
  const liquidations      = readU16LE(buf, off);  off += 2;
  const defaults          = readU16LE(buf, off);  off += 2;
  const creditCyclesCompleted = readU32LE(buf, off); off += 4;
  const cumulativeBorrowed = readU64LE(buf, off); off += 8;
  const cumulativeRepaid   = readU64LE(buf, off); off += 8;
  const currentDebt        = readU64LE(buf, off); off += 8;
  const pnlRatioBps        = readI32LE(buf, off); off += 4;
  const maxDrawdownBps     = readU16LE(buf, off); off += 2;
  const sharpeRatioBps     = readI16LE(buf, off); off += 2;
  const greenTimeBps       = readU16LE(buf, off); off += 2;
  const yellowTimeBps      = readU16LE(buf, off); off += 2;
  const orangeTimeBps      = readU16LE(buf, off); off += 2;
  const redTimeBps         = readU16LE(buf, off); off += 2;
  const venueEntropyBps    = readU16LE(buf, off); off += 2;
  const uniqueVenues       = readU8(buf, off);    off += 1;
  const totalTransactions  = readU32LE(buf, off); off += 4;
  const avgDailyVolume     = readU64LE(buf, off); off += 8;
  const registeredAt       = readI64LE(buf, off); off += 8;
  const lastScoreUpdate    = readI64LE(buf, off); off += 8;
  const lastCriticalEvent  = readI64LE(buf, off); off += 8;
  const lastRepayment      = readI64LE(buf, off); off += 8;

  // History: 30 entries × 15 bytes each (BUG-075: bounds check)
  const history = [];
  for (let i = 0; i < 30; i++) {
    if (off + 15 > buf.length) break; // malformed account guard
    const ts = readI64LE(buf, off); off += 8;
    const oldScore = readU16LE(buf, off); off += 2;
    const newScore = readU16LE(buf, off); off += 2;
    const eventType = readU8(buf, off);  off += 1;
    const deltaBps = readI16LE(buf, off); off += 2;
    if (ts > 0n) history.push({ timestamp: ts.toString(), oldScore, newScore, eventType, deltaBps });
  }

  const historyIndex             = readU8(buf, off);   off += 1;
  const agentType                = readU8(buf, off);   off += 1;
  const revenueHealthBps         = readU16LE(buf, off); off += 2;
  const milestoneCompletionBps   = readU16LE(buf, off); off += 2;
  const isActive                 = readBool(buf, off); off += 1;
  const isBlacklisted            = readBool(buf, off); off += 1;
  const bump                     = readU8(buf, off);

  return {
    agent, owner, score, creditLevel, kyaTier,
    components: { c1Repayment, c2Profitability, c3Behavioral, c4Usage, c5Maturity },
    repaymentStats: { onTimeRepayments, lateRepayments, missedRepayments, liquidations, defaults, creditCyclesCompleted },
    financials: {
      cumulativeBorrowed: cumulativeBorrowed.toString(),
      cumulativeRepaid: cumulativeRepaid.toString(),
      currentDebt: currentDebt.toString(),
    },
    riskMetrics: { pnlRatioBps, maxDrawdownBps, sharpeRatioBps },
    timeInZone: { greenTimeBps, yellowTimeBps, orangeTimeBps, redTimeBps },
    activityMetrics: { venueEntropyBps, uniqueVenues, totalTransactions, avgDailyVolume: avgDailyVolume.toString() },
    timestamps: {
      registeredAt: registeredAt.toString(),
      lastScoreUpdate: lastScoreUpdate.toString(),
      lastCriticalEvent: lastCriticalEvent.toString(),
      lastRepayment: lastRepayment.toString(),
    },
    history,
    historyIndex,
    agentType,
    revenueHealthBps,
    milestoneCompletionBps,
    isActive,
    isBlacklisted,
    bump,
  };
}

/**
 * Compute a simple "activity preview" score for unregistered wallets.
 * Uses Solana RPC data only — no Krexa PDAs needed.
 */
async function computePreviewScore(agent: PublicKey): Promise<{
  score: number;
  breakdown: Record<string, number>;
  note: string;
}> {
  const [accountInfo, signatures] = await Promise.all([
    solanaConnection.getAccountInfo(agent),
    solanaConnection.getSignaturesForAddress(agent, { limit: 100 }).catch(() => []),
  ]);

  const solBalance = (accountInfo?.lamports ?? 0) / 1e9;
  const txCount = signatures.length;

  // Estimate wallet age from oldest signature
  let walletAgeDays = 0;
  if (signatures.length > 0) {
    const oldest = signatures[signatures.length - 1];
    if (oldest.blockTime) {
      walletAgeDays = (Date.now() / 1000 - oldest.blockTime) / 86400;
    }
  }

  // Simple scoring heuristics (200–600 range for unregistered)
  const baseScore = 200;

  // Age: up to +150 pts (30 pts per month, capped at 5 months)
  const ageScore = Math.min(150, Math.floor(walletAgeDays / 30) * 30);

  // Activity: up to +100 pts (1 pt per tx, capped at 100)
  const activityScore = Math.min(100, txCount);

  // Balance: up to +50 pts (5 pts per SOL, capped at 50)
  const balanceScore = Math.min(50, Math.floor(solBalance * 5));

  // Token account diversity: check if wallet exists at all
  const existenceScore = accountInfo ? 50 : 0;

  const totalScore = Math.min(600, baseScore + ageScore + activityScore + balanceScore + existenceScore);

  return {
    score: totalScore,
    breakdown: {
      base: baseScore,
      walletAge: ageScore,
      transactionActivity: activityScore,
      solBalance: balanceScore,
      accountExists: existenceScore,
    },
    note: `Preview score computed from ${txCount} transactions over ${Math.round(walletAgeDays)} days. Register as a Krexa agent to get a full 5-component Krexit Score.`,
  };
}

// GET /api/v1/solana/score/:agent — full score or preview
// BUG-068: Use optional API key auth; redact sensitive fields for unauthenticated requests
router.get('/:agent', apiKeyAuth as any, async (req, res, next) => {
  try {
    const agentPk = parsePubkey(req.params.agent);
    const isAuthenticated = !!(req as AuthenticatedRequest).apiKey;

    // 1. Try to read on-chain KrexitScore PDA
    const scorePda = krexitScorePda(agentPk);
    const scoreInfo = await solanaConnection.getAccountInfo(scorePda);

    if (scoreInfo && scoreInfo.data.length >= 8) {
      try {
        const parsed = deserializeKrexitScore(scoreInfo.data as unknown as Buffer);

        // BUG-068: Redact sensitive fields for unauthenticated requests
        if (!isAuthenticated) {
          return res.json({
            source: 'on-chain',
            agentPubkey: req.params.agent,
            scorePda: scorePda.toBase58(),
            score: parsed.score,
            isActive: parsed.isActive,
            isBlacklisted: parsed.isBlacklisted,
            _redacted: 'Authenticate with API key (X-API-Key) for full score breakdown',
          });
        }

        return res.json({
          source: 'on-chain',
          agentPubkey: req.params.agent,
          scorePda: scorePda.toBase58(),
          ...parsed,
        });
      } catch (deErr) {
        console.warn('[Score] KrexitScore deserialization failed, falling through to preview:', deErr);
      }
    }

    // 2. Check if agent is registered (has AgentProfile) — give more context
    const profile = await readAgentProfile(agentPk).catch(() => null);

    // 3. Compute preview from raw Solana activity
    const preview = await computePreviewScore(agentPk);

    // BUG-068: Redact creditLevel and kyaTier equivalent fields for unauthenticated requests
    res.json({
      source: 'preview',
      agentPubkey: req.params.agent,
      scorePda: scorePda.toBase58(),
      isRegistered: !!profile,
      registeredName: profile ? Buffer.from(profile.name as unknown as Buffer).toString('utf-8').replace(/\0/g, '').trim() : null,
      creditScore: profile?.creditScore ?? null,
      creditLevel: isAuthenticated ? (profile?.creditLevel ?? null) : undefined,
      preview,
      ...(!isAuthenticated && profile?.creditLevel != null
        ? { _redacted: 'Authenticate with API key (X-API-Key) for creditLevel and full metadata' }
        : {}),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
