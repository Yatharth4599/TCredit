/**
 * Credit Score Calculator — runs as a daily cron job.
 *
 * For each agent with a solana wallet, compute a 5-component weighted score:
 *   repayment  30%  — on-time repayment rate
 *   profit     25%  — trading P&L (positive = higher score)
 *   behavior   20%  — health factor stability over last 30 days
 *   usage      15%  — utilisation consistency (regular small draws)
 *   age        10%  — time since registration (older = more trust)
 *
 * Score range: 200–850 (matching FICO-like range used in programs).
 * Updated on-chain via update_credit_score oracle instruction.
 */

import { createHash } from 'crypto';
import { PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { solanaConnection, oracleSolanaKeypair } from '../chain/solana/connection.js';
import { readAgentProfile } from '../chain/solana/reader.js';
import { buildUpdateCreditScore } from '../chain/solana/builder.js';
import { prisma } from '../config/prisma.js';
import { dispatchWebhook } from './webhook.service.js';

// ---------------------------------------------------------------------------
// Weights
// ---------------------------------------------------------------------------

const WEIGHTS = {
  repayment: 0.30,
  profit:    0.25,
  behavior:  0.20,
  usage:     0.15,
  age:       0.10,
} as const;

const SCORE_MIN = 200;
const SCORE_MAX = 850;
const SCORE_RANGE = SCORE_MAX - SCORE_MIN;

// ---------------------------------------------------------------------------
// Component calculators (return 0–100)
// ---------------------------------------------------------------------------

interface AgentStats {
  agentPubkey: string;
  totalRepaid: bigint;
  totalBorrowed: bigint;
  totalTrades: bigint;
  totalVolume: bigint;
  createdAt: Date;
}

function repaymentScore(stats: AgentStats): number {
  if (stats.totalBorrowed === 0n) return 50; // no history = neutral
  const rate = Number(stats.totalRepaid) / Number(stats.totalBorrowed);
  return Math.min(100, Math.round(rate * 100));
}

function profitScore(stats: AgentStats): number {
  // Proxy: trade volume relative to total borrowed suggests positive P&L
  if (stats.totalBorrowed === 0n) return 50;
  const ratio = Number(stats.totalVolume) / Number(stats.totalBorrowed);
  // ratio > 2 → excellent, < 0.5 → poor
  if (ratio >= 2) return 100;
  if (ratio >= 1) return 75;
  if (ratio >= 0.5) return 50;
  return 25;
}

async function behaviorScore(agentPubkey: string): Promise<number> {
  // Average health factor over last 30 days from DB snapshots
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const snaps = await prisma.healthSnapshot.findMany({
    where: { agentPubkey, snapshotAt: { gte: since } },
    select: { healthFactorBps: true },
  });

  if (snaps.length === 0) return 50;
  const avg = snaps.reduce((s, r) => s + r.healthFactorBps, 0) / snaps.length;

  // avg >= 15000 (1.5x) → perfect, <= 10500 (1.05x) → liquidation zone
  if (avg >= 15_000) return 100;
  if (avg >= 13_000) return 80;
  if (avg >= 12_000) return 60;
  if (avg >= 11_000) return 40;
  return 20;
}

function usageScore(stats: AgentStats): number {
  // Reward consistent regular usage (measured by total trades)
  if (stats.totalTrades >= 100n) return 100;
  if (stats.totalTrades >= 50n) return 80;
  if (stats.totalTrades >= 20n) return 60;
  if (stats.totalTrades >= 5n) return 40;
  return 20;
}

function ageScore(stats: AgentStats): number {
  const ageMs = Date.now() - stats.createdAt.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays >= 365) return 100;
  if (ageDays >= 180) return 80;
  if (ageDays >= 90) return 60;
  if (ageDays >= 30) return 40;
  return 20;
}

// ---------------------------------------------------------------------------
// Composite score
// ---------------------------------------------------------------------------

async function computeScore(stats: AgentStats): Promise<{
  score: number;
  components: Record<string, number>;
}> {
  const [repayment, profit, behavior, usage, age] = await Promise.all([
    repaymentScore(stats),
    profitScore(stats),
    behaviorScore(stats.agentPubkey),
    usageScore(stats),
    ageScore(stats),
  ]);

  const weighted =
    repayment * WEIGHTS.repayment +
    profit    * WEIGHTS.profit    +
    behavior  * WEIGHTS.behavior  +
    usage     * WEIGHTS.usage     +
    age       * WEIGHTS.age;

  // Map 0–100 → SCORE_MIN–SCORE_MAX
  const score = Math.round(SCORE_MIN + (weighted / 100) * SCORE_RANGE);

  return {
    score: Math.max(SCORE_MIN, Math.min(SCORE_MAX, score)),
    components: { repayment, profit, behavior, usage, age },
  };
}

// ---------------------------------------------------------------------------
// Level calculation (mirrors on-chain calculate_level)
// ---------------------------------------------------------------------------

function calculateLevelFromScore(score: number, kyaTier: number): number {
  if (score >= 750 && kyaTier >= 3) return 4;
  if (score >= 650 && kyaTier >= 2) return 3;
  if (score >= 500 && kyaTier >= 2) return 2;
  if (score >= 400 && kyaTier >= 1) return 1;
  return 0;
}

// ---------------------------------------------------------------------------
// Score Attestation — keccak256(agent, score, level, timestamp)
// ---------------------------------------------------------------------------

function computeAttestationHash(agent: string, score: number, level: number, timestamp: number): string {
  const data = Buffer.concat([
    Buffer.from(agent),
    Buffer.from(score.toString()),
    Buffer.from(level.toString()),
    Buffer.from(timestamp.toString()),
  ]);
  return createHash('sha256').update(data).digest('hex');
}

// ---------------------------------------------------------------------------
// Update on-chain
// ---------------------------------------------------------------------------

async function updateScoreOnChain(agent: PublicKey, score: number): Promise<string | null> {
  if (!oracleSolanaKeypair) return null;
  try {
    const ixn = buildUpdateCreditScore({
      oracle: oracleSolanaKeypair.publicKey,
      agent,
      newScore: score,
    });
    const { blockhash } = await solanaConnection.getLatestBlockhash('confirmed');
    const { Transaction } = await import('@solana/web3.js');
    const tx = new Transaction({ recentBlockhash: blockhash, feePayer: oracleSolanaKeypair.publicKey });
    tx.add(ixn);
    return sendAndConfirmTransaction(solanaConnection, tx, [oracleSolanaKeypair], { commitment: 'confirmed' });
  } catch (err) {
    console.error(`[CreditScore] On-chain update failed for ${agent.toBase58()}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Daily job
// ---------------------------------------------------------------------------

export async function runDailyCreditScoreUpdate(): Promise<void> {
  console.log('[CreditScore] Starting daily score update');

  const wallets = await prisma.solanaAgentWallet.findMany({
    select: {
      agentPubkey: true,
      ownerPubkey: true,
      totalTrades: true,
      totalVolume: true,
      totalRepaid: true,
      createdAt: true,
    },
  });

  let updated = 0;
  let failed = 0;

  for (const w of wallets) {
    try {
      const profile = await readAgentProfile(new PublicKey(w.agentPubkey));

      const stats: AgentStats = {
        agentPubkey: w.agentPubkey,
        totalRepaid: w.totalRepaid,
        totalBorrowed: profile ? profile.totalBorrowed : 0n,
        totalTrades: w.totalTrades,
        totalVolume: w.totalVolume,
        createdAt: w.createdAt,
      };

      const { score, components } = await computeScore(stats);
      const level = profile?.creditLevel ?? 0;
      const oldScore = profile?.creditScore ?? 0;
      const oldLevel = level;

      // Compute attestation hash
      const timestamp = Math.floor(Date.now() / 1000);
      const attestationHash = computeAttestationHash(w.agentPubkey, score, level, timestamp);

      // Persist snapshot with attestation
      await prisma.scoreSnapshot.create({
        data: {
          agentPubkey: w.agentPubkey,
          score,
          level,
          components,
          attestationHash,
        },
      });

      // Update on-chain (fire and forget — don't fail the whole job)
      const sig = await updateScoreOnChain(new PublicKey(w.agentPubkey), score);
      if (sig) {
        console.log(`[CreditScore] Updated ${w.agentPubkey} → ${score} — sig: ${sig}`);
      }

      // Dispatch score_changed webhook if score actually changed
      if (score !== oldScore) {
        const newLevel = profile
          ? calculateLevelFromScore(score, profile.kyaTier)
          : level;
        await dispatchWebhook('score_changed', {
          agent: w.agentPubkey,
          oldScore,
          newScore: score,
          oldLevel,
          newLevel,
          attestationHash,
          timestamp: new Date().toISOString(),
        }).catch((err) => {
          console.error(`[CreditScore] Webhook dispatch failed for ${w.agentPubkey}:`, err);
        });
      }

      updated++;
    } catch (err) {
      console.error(`[CreditScore] Failed for ${w.agentPubkey}:`, err instanceof Error ? err.message : err);
      failed++;
    }
  }

  console.log(`[CreditScore] Done: ${updated} updated, ${failed} failed`);
}

// ---------------------------------------------------------------------------
// Lifecycle — daily interval (24 h)
// ---------------------------------------------------------------------------

const DAILY_MS = 24 * 60 * 60 * 1000;
let scoreInterval: NodeJS.Timeout | null = null;

export function startCreditScoreJob(): void {
  if (scoreInterval) return;
  if (!oracleSolanaKeypair) {
    console.log('[CreditScore] Not started: SOLANA_ORACLE_PRIVATE_KEY not set');
    return;
  }

  console.log('[CreditScore] Daily score job started');
  // Run first cycle after 10 s (let other services initialise)
  setTimeout(() => {
    runDailyCreditScoreUpdate().catch((err) => console.error('[CreditScore] Initial run error:', err));
  }, 10_000);

  scoreInterval = setInterval(() => {
    runDailyCreditScoreUpdate().catch((err) => console.error('[CreditScore] Cycle error:', err));
  }, DAILY_MS);
}

export function stopCreditScoreJob(): void {
  if (scoreInterval) {
    clearInterval(scoreInterval);
    scoreInterval = null;
  }
}
