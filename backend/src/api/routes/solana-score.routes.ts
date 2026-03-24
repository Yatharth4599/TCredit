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
import { env } from '../../config/env.js';

// Mainnet RPCs — env var first, then public fallback (deduped)
const MAINNET_RPC_URLS: string[] = [...new Set([
  env.SOLANA_MAINNET_RPC_URL,
  'https://api.mainnet-beta.solana.com',
])];

// Read-only mainnet connection (used as identity sentinel only)
const mainnetConnection = new Connection(MAINNET_RPC_URLS[0], { commitment: 'confirmed', disableRetryOnRateLimit: true });

/** Raw JSON-RPC call with timeout */
async function rpcCall(url: string, method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'krexa-backend/1.0' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(15000),
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

/** Fire all RPCs in parallel, pick richest result */
async function rpcCallBest(method: string, params: unknown[]): Promise<unknown> {
  const results = await Promise.allSettled(
    MAINNET_RPC_URLS.map(url => rpcCall(url, method, params))
  );
  let best: unknown = undefined;
  for (const r of results) {
    if (r.status !== 'fulfilled' || r.value == null) continue;
    if (best === undefined) { best = r.value; continue; }
    if (Array.isArray(r.value) && Array.isArray(best) && r.value.length > best.length) {
      best = r.value;
    }
  }
  if (best !== undefined) return best;
  throw new Error('All RPC endpoints failed');
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

// ─── 5-Component Krexit Score Formula ────────────────────────────────────────
// S = 200 + 650 × (0.30×C₁ + 0.25×C₂ + 0.20×C₃ + 0.15×C₄ + 0.10×C₅)
// Each Cᵢ ∈ [0.0, 1.0]

function shannonEntropy(counts: Map<string, number>): number {
  const total = Array.from(counts.values()).reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  let h = 0;
  for (const count of counts.values()) {
    if (count === 0) continue;
    const p = count / total;
    h -= p * Math.log2(p);
  }
  return h;
}

interface ActivityData {
  solBalance: number;
  txCount: number;
  walletAgeDays: number;
  tokenAccounts: number;
  programIds?: string[];
}

function compute5ComponentScore(data: ActivityData): {
  score: number;
  c1: number; c2: number; c3: number; c4: number; c5: number;
  components: { c1Repayment: number; c2Profitability: number; c3Behavioral: number; c4Usage: number; c5Maturity: number };
} {
  // C₁ Repayment History: default 0.70 (benefit of doubt, no credit history)
  const c1 = 0.70;

  // C₂ Profitability: min(1, solBalance / 20)
  const c2 = Math.min(1, data.solBalance / 20);

  // C₃ Behavioral Health: default 0.50 (neutral, no NAV data)
  const c3 = 0.50;

  // C₄ Usage Patterns: Shannon entropy of program IDs / log₂(10)
  let c4 = 0;
  if (data.programIds && data.programIds.length > 0) {
    const counts = new Map<string, number>();
    for (const pid of data.programIds) {
      counts.set(pid, (counts.get(pid) ?? 0) + 1);
    }
    const maxEntropy = Math.log2(10); // normalize by log₂(10)
    c4 = Math.min(1, shannonEntropy(counts) / maxEntropy);
  } else {
    // Fallback: use tokenAccounts as diversity proxy
    c4 = Math.min(1, data.tokenAccounts / 10);
  }

  // C₅ Account Maturity: 0.4×min(1,age/180) + 0.3×min(1,txCount/200) + 0.3×min(1,tokenAccounts/10)
  const c5 = 0.4 * Math.min(1, data.walletAgeDays / 180)
           + 0.3 * Math.min(1, data.txCount / 200)
           + 0.3 * Math.min(1, data.tokenAccounts / 10);

  // S = 200 + 650 × (0.30×C₁ + 0.25×C₂ + 0.20×C₃ + 0.15×C₄ + 0.10×C₅)
  const weighted = 0.30 * c1 + 0.25 * c2 + 0.20 * c3 + 0.15 * c4 + 0.10 * c5;
  const score = Math.round(200 + 650 * weighted);

  // Convert to BPS (0-10000) for component display
  const toBps = (v: number) => Math.round(v * 10000);

  return {
    score: Math.min(850, Math.max(200, score)),
    c1, c2, c3, c4, c5,
    components: {
      c1Repayment: toBps(c1),
      c2Profitability: toBps(c2),
      c3Behavioral: toBps(c3),
      c4Usage: toBps(c4),
      c5Maturity: toBps(c5),
    },
  };
}

/**
 * Compute a preview score for unregistered wallets from on-chain signals.
 * Uses the real 5-component Krexit Score formula with estimated inputs.
 */
async function computePreviewScore(agent: PublicKey, conn: Connection): Promise<{
  score: number;
  breakdown: Record<string, number>;
  components: { c1Repayment: number; c2Profitability: number; c3Behavioral: number; c4Usage: number; c5Maturity: number };
  note: string;
  network: string;
  txCount: number;
  walletAgeDays: number;
}> {
  const isMainnet = conn === mainnetConnection;
  const addrStr = agent.toBase58();

  let accountLamports = 0;
  let tokenAccountCount = 0;
  type Sig = { blockTime?: number | null; signature: string };
  let allSigs: Sig[] = [];

  if (isMainnet) {
    const [acctResult, sigsResult, tokenResult] = await Promise.allSettled([
      rpcCallBest('getAccountInfo', [addrStr, { encoding: 'base64' }]),
      rpcCallBest('getSignaturesForAddress', [addrStr, { limit: 200, commitment: 'confirmed' }]),
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
      allSigs = sigsResult.value as Sig[];

      // Paginate to find true wallet age (up to 5 pages × 200 = 1,000 txs)
      let page = 0;
      while (allSigs.length === (page + 1) * 200 && page < 4) {
        const cursor = allSigs[allSigs.length - 1].signature;
        try {
          const older = await rpcCallBest('getSignaturesForAddress', [
            addrStr,
            { limit: 200, before: cursor, commitment: 'confirmed' },
          ]);
          if (!Array.isArray(older) || older.length === 0) break;
          allSigs = [...allSigs, ...(older as Sig[])];
        } catch { break; }
        page++;
      }
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
    allSigs = sigs.map(s => ({ blockTime: s.blockTime, signature: s.signature }));
  }

  const solBalance = accountLamports / 1e9;
  const txCount = allSigs.length;

  // Estimate wallet age from oldest signature
  let walletAgeDays = 0;
  for (let i = allSigs.length - 1; i >= 0; i--) {
    if (allSigs[i].blockTime) {
      walletAgeDays = (Date.now() / 1000 - allSigs[i].blockTime!) / 86400;
      break;
    }
  }

  // Sample transactions to extract program IDs for C₄
  let programIds: string[] = [];
  if (isMainnet && allSigs.length > 0) {
    const sampled = allSigs.slice(0, 20);
    const txResults = await Promise.allSettled(
      sampled.map(s =>
        rpcCallWithFallback('getTransaction', [s.signature, { encoding: 'json', maxSupportedTransactionVersion: 0 }])
      )
    );
    const programSet = new Set<string>();
    for (const r of txResults) {
      if (r.status !== 'fulfilled' || !r.value) continue;
      const tx = r.value as {
        transaction?: { message?: { accountKeys?: string[] } };
        meta?: { logMessages?: string[] };
      };
      const logs = tx?.meta?.logMessages ?? [];
      for (const log of logs) {
        const match = log.match(/^Program (\w{32,}) invoke/);
        if (match) programSet.add(match[1]);
      }
    }
    programIds = [...programSet];
  }

  // ── 5-Component Krexit Score ──
  const result = compute5ComponentScore({
    solBalance,
    txCount,
    walletAgeDays,
    tokenAccounts: tokenAccountCount,
    programIds: programIds.length > 0 ? programIds : undefined,
  });

  const network = isMainnet ? 'mainnet' : 'devnet';
  const activitySource = txCount > 0 ? `${txCount} transactions` : tokenAccountCount > 0 ? `${tokenAccountCount} token accounts` : '0 transactions';

  // Legacy breakdown for backward compatibility
  const breakdown: Record<string, number> = {
    base: 200,
    walletAge: Math.round(result.c5 * 0.4 * 650 * 0.10),
    transactionActivity: Math.round((0.30 * result.c1 + 0.15 * result.c4) * 650),
    solBalance: Math.round(result.c2 * 0.25 * 650),
    accountExists: accountLamports > 0 ? 50 : 0,
    tokenDiversity: Math.round(result.c4 * 0.15 * 650),
  };

  return {
    score: result.score,
    network,
    txCount,
    walletAgeDays: Math.round(walletAgeDays),
    breakdown,
    components: result.components,
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
    if (preview.breakdown.accountExists === 0 && preview.txCount === 0) {
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
