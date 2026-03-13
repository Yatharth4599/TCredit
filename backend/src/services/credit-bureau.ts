/**
 * Credit Bureau Service — The CIBIL Moat
 *
 * This is the core data moat: every platform that extends credit to AI agents
 * must query Krexa for the agent's credit history. Just like CIBIL/Experian
 * for humans — copycats can fork code but can't fork credit history data.
 *
 * Three tiers:
 *   - Score lookup (free, 100 req/day) — score + level + last updated
 *   - Full report (paid)               — components, payment history, risk flags
 *   - Credit history (paid)            — full event timeline with pagination
 */

import { PublicKey } from '@solana/web3.js';
import { prisma } from '../config/prisma.js';
import { readAgentProfile, readCreditLine, readAgentWallet } from '../chain/solana/reader.js';

// ---------------------------------------------------------------------------
// Score Lookup (free tier)
// ---------------------------------------------------------------------------

export interface CreditScore {
  agent: string;
  score: number;
  level: number;
  lastUpdated: string | null;
  isExpired: boolean;
  attestationHash: string | null;
}

export async function getAgentScore(agentPubkey: string): Promise<CreditScore> {
  const [snapshot, profile] = await Promise.all([
    prisma.scoreSnapshot.findFirst({
      where: { agentPubkey },
      orderBy: { snapshotAt: 'desc' },
    }),
    readAgentProfile(new PublicKey(agentPubkey)).catch(() => null),
  ]);

  const score = snapshot?.score ?? profile?.creditScore ?? 0;
  const level = profile?.creditLevel ?? snapshot?.level ?? 0;
  const lastUpdated = snapshot?.snapshotAt ?? null;

  // Score expires after 30 days without update
  const EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;
  const isExpired = lastUpdated ? Date.now() - lastUpdated.getTime() > EXPIRY_MS : true;

  return {
    agent: agentPubkey,
    score,
    level,
    lastUpdated: lastUpdated?.toISOString() ?? null,
    isExpired,
    attestationHash: snapshot?.attestationHash ?? null,
  };
}

// ---------------------------------------------------------------------------
// Full Credit Report (paid tier)
// ---------------------------------------------------------------------------

export interface CreditReport {
  agent: string;
  score: number;
  level: number;
  components: Record<string, number> | null;
  activeCreditLine: {
    creditLimit: string;
    creditDrawn: string;
    accruedInterest: string;
    interestRateBps: number;
    isActive: boolean;
  } | null;
  wallet: {
    healthFactorBps: number;
    isFrozen: boolean;
    isLiquidating: boolean;
    totalTrades: string;
    totalVolume: string;
    totalRepaid: string;
  } | null;
  paymentHistory: {
    totalBorrowed: string;
    totalRepaid: string;
    liquidationCount: number;
    repaymentRate: number;
  };
  healthHistory: Array<{
    healthFactorBps: number;
    snapshotAt: string;
  }>;
  riskFlags: string[];
  scoreHistory30d: Array<{
    score: number;
    level: number;
    snapshotAt: string;
  }>;
  legalAgreementSigned: boolean;
  lastUpdated: string | null;
}

export async function getAgentReport(agentPubkey: string): Promise<CreditReport> {
  const agentPk = new PublicKey(agentPubkey);
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [profile, creditLine, wallet, latestSnapshot, scoreHistory, healthHistory] =
    await Promise.all([
      readAgentProfile(agentPk).catch(() => null),
      readCreditLine(agentPk).catch(() => null),
      readAgentWallet(agentPk).catch(() => null),
      prisma.scoreSnapshot.findFirst({
        where: { agentPubkey },
        orderBy: { snapshotAt: 'desc' },
      }),
      prisma.scoreSnapshot.findMany({
        where: { agentPubkey, snapshotAt: { gte: since30d } },
        orderBy: { snapshotAt: 'asc' },
        select: { score: true, level: true, snapshotAt: true },
      }),
      prisma.healthSnapshot.findMany({
        where: { agentPubkey, snapshotAt: { gte: since30d } },
        orderBy: { snapshotAt: 'desc' },
        take: 100,
        select: { healthFactorBps: true, snapshotAt: true },
      }),
    ]);

  // Compute risk flags
  const riskFlags: string[] = [];
  if (profile && !profile.isActive) riskFlags.push('AGENT_DEACTIVATED');
  if (wallet?.isFrozen) riskFlags.push('WALLET_FROZEN');
  if (wallet?.isLiquidating) riskFlags.push('LIQUIDATION_IN_PROGRESS');
  if (wallet && wallet.healthFactorBps < 12000) riskFlags.push('LOW_HEALTH_FACTOR');
  if (profile && profile.liquidationCount > 0) riskFlags.push('HAS_LIQUIDATION_HISTORY');
  if (!latestSnapshot || Date.now() - latestSnapshot.snapshotAt.getTime() > 30 * 24 * 60 * 60 * 1000) {
    riskFlags.push('STALE_SCORE');
  }

  const totalBorrowed = profile?.totalBorrowed ?? 0n;
  const totalRepaid = profile?.totalRepaid ?? 0n;
  const repaymentRate = totalBorrowed > 0n
    ? Number(totalRepaid) / Number(totalBorrowed)
    : 0;

  return {
    agent: agentPubkey,
    score: latestSnapshot?.score ?? profile?.creditScore ?? 0,
    level: profile?.creditLevel ?? 0,
    components: (latestSnapshot?.components as Record<string, number>) ?? null,
    activeCreditLine: creditLine ? {
      creditLimit: creditLine.creditLimit.toString(),
      creditDrawn: creditLine.creditDrawn.toString(),
      accruedInterest: creditLine.accruedInterest.toString(),
      interestRateBps: creditLine.interestRateBps,
      isActive: creditLine.isActive,
    } : null,
    wallet: wallet ? {
      healthFactorBps: wallet.healthFactorBps,
      isFrozen: wallet.isFrozen,
      isLiquidating: wallet.isLiquidating,
      totalTrades: wallet.totalTrades.toString(),
      totalVolume: wallet.totalVolume.toString(),
      totalRepaid: wallet.totalRepaid.toString(),
    } : null,
    paymentHistory: {
      totalBorrowed: totalBorrowed.toString(),
      totalRepaid: totalRepaid.toString(),
      liquidationCount: profile?.liquidationCount ?? 0,
      repaymentRate: Math.round(repaymentRate * 10000) / 10000,
    },
    healthHistory: healthHistory.map((h) => ({
      healthFactorBps: h.healthFactorBps,
      snapshotAt: h.snapshotAt.toISOString(),
    })),
    riskFlags,
    scoreHistory30d: scoreHistory.map((s) => ({
      score: s.score,
      level: s.level,
      snapshotAt: s.snapshotAt.toISOString(),
    })),
    legalAgreementSigned: profile ? profile.legalAgreementSignedAt > 0n : false,
    lastUpdated: latestSnapshot?.snapshotAt?.toISOString() ?? null,
  };
}

// ---------------------------------------------------------------------------
// Credit Event History (paid tier)
// ---------------------------------------------------------------------------

export interface CreditEvent {
  type: string;
  timestamp: string;
  details: Record<string, unknown>;
}

export interface CreditHistory {
  events: CreditEvent[];
  total: number;
  page: number;
  pageSize: number;
}

export async function getAgentHistory(
  agentPubkey: string,
  page = 1,
  pageSize = 50,
): Promise<CreditHistory> {
  const skip = (page - 1) * pageSize;

  // Pull credit-related events from SolanaEvent table
  const creditEventTypes = [
    'CreditReceived', 'CreditRepaid', 'CreditDefault',
    'LiquidationTriggered', 'LiquidationCompleted',
    'CreditScoreUpdated', 'LevelChanged',
    'CollateralDeposited', 'CollateralWithdrawn',
    'LegalAgreementSigned', 'ScoreAttested',
  ];

  const [events, total] = await Promise.all([
    prisma.solanaEvent.findMany({
      where: {
        eventType: { in: creditEventTypes },
        data: { path: ['agent'], equals: agentPubkey },
      },
      orderBy: { indexedAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.solanaEvent.count({
      where: {
        eventType: { in: creditEventTypes },
        data: { path: ['agent'], equals: agentPubkey },
      },
    }),
  ]);

  // Also include trade history as credit events
  const trades = await prisma.solanaAgentTrade.findMany({
    where: { agentPubkey },
    orderBy: { executedAt: 'desc' },
    skip,
    take: pageSize,
    select: { venue: true, amount: true, direction: true, executedAt: true },
  });

  const mappedEvents: CreditEvent[] = [
    ...events.map((e) => ({
      type: e.eventType,
      timestamp: e.indexedAt.toISOString(),
      details: e.data as Record<string, unknown>,
    })),
    ...trades.map((t) => ({
      type: 'Trade',
      timestamp: t.executedAt.toISOString(),
      details: {
        venue: t.venue,
        amount: t.amount.toString(),
        direction: t.direction,
      },
    })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
   .slice(0, pageSize);

  return { events: mappedEvents, total, page, pageSize };
}

// ---------------------------------------------------------------------------
// Inquiry logging
// ---------------------------------------------------------------------------

export async function logInquiry(agentPubkey: string, requesterKey: string, type: string): Promise<void> {
  await prisma.creditInquiry.create({
    data: { agentPubkey, requesterKey, inquiryType: type },
  });
}
