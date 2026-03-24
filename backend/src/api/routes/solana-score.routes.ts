/**
 * Solana Score routes — score lookup for any wallet address
 *
 * GET  /api/v1/solana/score/:agent          — full score (on-chain or preview)
 * GET  /api/v1/solana/score/:agent/preview  — preview without registration
 */

import { Router } from 'express';
import { Connection, PublicKey } from '@solana/web3.js';
import { solanaConnection } from '../../chain/solana/connection.js';
import { krexitScorePda } from '../../chain/solana/programs.js';
import { readAgentProfile } from '../../chain/solana/reader.js';
import { AppError } from '../middleware/errorHandler.js';

// Mainnet RPCs tried in order — first successful one wins
const MAINNET_RPC_URLS: string[] = process.env.SOLANA_MAINNET_RPC_URL
  ? [process.env.SOLANA_MAINNET_RPC_URL]
  : [
      'https://rpc.ankr.com/solana',
      'https://solana-mainnet.g.alchemy.com/v2/demo',
      'https://api.mainnet-beta.solana.com',
    ];

// Read-only mainnet connection (used as identity sentinel only)
const mainnetConnection = new Connection(MAINNET_RPC_URLS[0], { commitment: 'confirmed', disableRetryOnRateLimit: true });

/** Raw JSON-RPC call with timeout */
async function rpcCall(url: string, method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'krexa-backend/1.0' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(7000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  const json = await res.json() as { result?: unknown; error?: { message: string } };
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

/** Try each mainnet RPC in order, return first success */
async function rpcCallWithFallback(method: string, params: unknown[]): Promise<unknown> {
  let lastErr: Error | undefined;
  for (const url of MAINNET_RPC_URLS) {
    try {
      return await rpcCall(url, method, params);
    } catch (e) {
      lastErr = e as Error;
      console.warn(`[Score] RPC ${url} failed (${method}):`, lastErr.message);
    }
  }
  throw lastErr ?? new Error('All mainnet RPCs failed');
}

const router = Router();

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

  // History: 30 entries × 15 bytes each
  const history = [];
  for (let i = 0; i < 30; i++) {
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

// ─── Credit level definitions (mirrors krexa-common constants) ──────────────
const CREDIT_LEVELS = [
  {
    level: 4, minScore: 750, minKya: 3,
    maxUsdc: 500_000_000_000, // $500,000
    type: 'undercollateralized' as const,
    description: 'Elite — up to $500,000, no collateral required',
  },
  {
    level: 3, minScore: 650, minKya: 2,
    maxUsdc: 100_000_000_000, // $100,000
    type: 'collateralized' as const,
    description: 'Trusted — up to $100,000, 10× collateral required',
    ltv: 10,
  },
  {
    level: 2, minScore: 500, minKya: 2,
    maxUsdc: 10_000_000_000,  // $10,000
    type: 'collateralized' as const,
    description: 'Established — up to $10,000, 5× collateral required',
    ltv: 5,
  },
  {
    level: 1, minScore: 400, minKya: 1,
    maxUsdc: 200_000_000,     // $200
    type: 'undercollateralized' as const,
    description: 'Starter — up to $200, no collateral required',
  },
] as const;

function computeCreditPreview(score: number) {
  // For a preview (unregistered) wallet, KYA = 0 so they can't draw credit yet.
  // We show what level they'd reach if they register and complete KYA.
  // We also show the next threshold needed.
  const eligibleLevel = CREDIT_LEVELS.find(l => score >= l.minScore) ?? null;

  const levels = CREDIT_LEVELS.slice().reverse().map(l => ({
    level: l.level,
    minScore: l.minScore,
    minKya: l.minKya,
    maxUsd: l.maxUsdc / 1_000_000,
    type: l.type,
    description: l.description,
    ...(('ltv' in l) ? { ltv: l.ltv } : {}),
    qualified: score >= l.minScore,
    pointsNeeded: Math.max(0, l.minScore - score),
  }));

  const currentLevel = eligibleLevel ?? null;
  const nextLevel = currentLevel
    ? CREDIT_LEVELS.find(l => l.minScore > score) ?? null
    : CREDIT_LEVELS[CREDIT_LEVELS.length - 1]; // L1 is first target

  return {
    estimatedLevel: currentLevel?.level ?? 0,
    type: currentLevel?.type ?? 'none',
    maxCreditUsd: currentLevel ? currentLevel.maxUsdc / 1_000_000 : 0,
    description: currentLevel?.description ?? 'Score below 400 — not yet eligible for any credit level',
    kyaRequired: currentLevel?.minKya ?? 1,
    nextLevel: nextLevel ? {
      level: nextLevel.level,
      minScore: nextLevel.minScore,
      pointsNeeded: Math.max(0, nextLevel.minScore - score),
      maxCreditUsd: nextLevel.maxUsdc / 1_000_000,
      type: nextLevel.type,
    } : null,
    levels,
    note: score < 400
      ? 'Register as a Krexa agent and complete KYA to unlock credit. Building on-chain history increases your score.'
      : `With score ${score} and basic KYA you qualify for Level ${currentLevel!.level} credit. Register to activate.`,
  };
}

/**
 * Compute a preview score for unregistered wallets from on-chain signals.
 * Uses raw JSON-RPC for mainnet to bypass Connection class IP blocks.
 */
async function computePreviewScore(agent: PublicKey, conn: Connection): Promise<{
  score: number;
  breakdown: Record<string, number>;
  note: string;
  network: string;
  txCount: number;
  walletAgeDays: number;
}> {
  const isMainnet = conn === mainnetConnection;
  const addrStr = agent.toBase58();

  let accountLamports = 0;
  let signatures: Array<{ blockTime?: number | null }> = [];
  let tokenAccountCount = 0;

  if (isMainnet) {
    const [acctResult, sigsResult, tokenResult] = await Promise.allSettled([
      rpcCallWithFallback('getAccountInfo', [addrStr, { encoding: 'base64' }]),
      // Try both method names — some RPCs use the old name
      rpcCallWithFallback('getSignaturesForAddress', [addrStr, { limit: 100, commitment: 'confirmed' }])
        .catch(() => rpcCallWithFallback('getConfirmedSignaturesForAddress2', [addrStr, { limit: 100 }])),
      rpcCallWithFallback('getTokenAccountsByOwner', [
        addrStr,
        { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
        { encoding: 'base64' },
      ]),
    ]);

    if (acctResult.status === 'fulfilled' && acctResult.value) {
      const val = acctResult.value as { value?: { lamports?: number } };
      accountLamports = val?.value?.lamports ?? 0;
    }
    if (sigsResult.status === 'fulfilled' && Array.isArray(sigsResult.value)) {
      signatures = sigsResult.value as Array<{ blockTime?: number | null }>;
    } else {
      console.warn('[Score] Mainnet signatures fetch failed — using token account count as proxy');
    }
    if (tokenResult.status === 'fulfilled' && tokenResult.value) {
      const val = tokenResult.value as { value?: unknown[] };
      tokenAccountCount = Array.isArray(val?.value) ? val.value.length : 0;
    }
  } else {
    const [accountInfo, sigs] = await Promise.all([
      conn.getAccountInfo(agent),
      conn.getSignaturesForAddress(agent, { limit: 100 }).catch(() => []),
    ]);
    accountLamports = accountInfo?.lamports ?? 0;
    signatures = sigs;
  }

  const solBalance = accountLamports / 1e9;
  const txCount = signatures.length;

  // Estimate wallet age from oldest signature
  let walletAgeDays = 0;
  if (signatures.length > 0) {
    const oldest = signatures[signatures.length - 1];
    if (oldest.blockTime) {
      walletAgeDays = (Date.now() / 1000 - oldest.blockTime) / 86400;
    }
  }

  // ── Scoring heuristics (200–600 for unregistered) ──
  const baseScore = 200;

  // Age: +30 per month, capped at +150 (5 months)
  const ageScore = Math.min(150, Math.floor(walletAgeDays / 30) * 30);

  // Activity: 1 pt per tx, capped at +100
  // If signatures fail, use token account count as proxy (each SPL token = 10 activity pts)
  const activityScore = txCount > 0
    ? Math.min(100, txCount)
    : Math.min(100, tokenAccountCount * 10);

  // Balance: +5 per SOL, capped at +50
  const balanceScore = Math.min(50, Math.floor(solBalance * 5));

  // Existence: +50 if wallet exists
  const existenceScore = accountLamports > 0 ? 50 : 0;

  // Token diversity bonus: +30 if holding 3+ SPL tokens (shows DeFi engagement)
  const tokenDiversityScore = tokenAccountCount >= 3 ? 30 : tokenAccountCount >= 1 ? 10 : 0;

  const totalScore = Math.min(600, baseScore + ageScore + activityScore + balanceScore + existenceScore + tokenDiversityScore);
  const network = isMainnet ? 'mainnet' : 'devnet';
  const activitySource = txCount > 0 ? `${txCount} transactions` : tokenAccountCount > 0 ? `${tokenAccountCount} token accounts` : '0 transactions';

  return {
    score: totalScore,
    network,
    txCount,
    walletAgeDays: Math.round(walletAgeDays),
    breakdown: {
      base: baseScore,
      walletAge: ageScore,
      transactionActivity: activityScore,
      solBalance: balanceScore,
      accountExists: existenceScore,
      tokenDiversity: tokenDiversityScore,
    },
    note: `Preview score based on ${activitySource} over ${Math.round(walletAgeDays)} days on ${network}. Register as a Krexa agent for a full 5-component Krexit Score.`,
  };
}

// GET /api/v1/solana/score/:agent — full score or preview
router.get('/:agent', async (req, res, next) => {
  try {
    const agentPk = parsePubkey(req.params.agent);

    // 1. Try to read on-chain KrexitScore PDA
    const scorePda = krexitScorePda(agentPk);
    const scoreInfo = await solanaConnection.getAccountInfo(scorePda);

    if (scoreInfo && scoreInfo.data.length >= 8) {
      try {
        const parsed = deserializeKrexitScore(scoreInfo.data as unknown as Buffer);
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

    // 3. Compute preview — try devnet first, fall back to mainnet if no activity
    let preview = await computePreviewScore(agentPk, solanaConnection);
    if (preview.breakdown.accountExists === 0 && preview.breakdown.transactionActivity === 0) {
      // No devnet activity at all — try mainnet
      const mainnetPreview = await computePreviewScore(agentPk, mainnetConnection).catch((e) => {
        console.warn('[Score] Mainnet fallback failed:', e?.message);
        return null;
      });
      if (mainnetPreview && mainnetPreview.score > preview.score) {
        preview = mainnetPreview;
      }
    }

    // 4. Compute credit eligibility preview from the score
    const creditPreview = computeCreditPreview(preview.score);

    res.json({
      source: 'preview',
      agentPubkey: req.params.agent as string,
      scorePda: scorePda.toBase58(),
      isRegistered: !!profile,
      registeredName: profile ? Buffer.from(profile.name as unknown as Buffer).toString('utf-8').replace(/\0/g, '').trim() : null,
      creditScore: profile?.creditScore ?? null,
      creditLevel: profile?.creditLevel ?? null,
      preview,
      creditPreview,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
