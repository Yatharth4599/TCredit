/**
 * Agent Credit routes — credit eligibility, extension, and repayment
 *
 * GET  /api/v1/solana/credit/:agent/eligibility  — check if agent can draw credit
 * GET  /api/v1/solana/credit/:agent/line         — current credit line state
 * POST /api/v1/solana/credit/:agent/request      — unsigned request_credit tx
 * POST /api/v1/solana/credit/:agent/repay        — unsigned repay tx
 */

import { Router } from 'express';
import { PublicKey } from '@solana/web3.js';
import { evaluateCredit } from '../../services/solana-oracle.js';
import { readCreditLine, readAgentWallet, readAgentProfile } from '../../chain/solana/reader.js';
import { buildRepay, instructionToUnsignedTx } from '../../chain/solana/builder.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { AppError } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validate.js';
import {
  SolanaCreditRequestSchema, SolanaCreditRepaySchema,
  SolanaSignAgreementSchema, SolanaConfirmAgreementSchema,
} from '../schemas.js';
import { env } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import { initiateAgreement, getAgreementStatus, confirmAgreementSigned } from '../../services/legal-agreement.js';

const router = Router();
const USDC_MINT = new PublicKey(env.SOLANA_USDC_MINT);

function parsePubkey(raw: string): PublicKey {
  try { return new PublicKey(raw); }
  catch { throw new AppError(400, `Invalid Solana public key: ${raw}`); }
}

// GET /solana/credit/protocol-params — static protocol configuration (credit levels + tranche APRs)
router.get('/protocol-params', (_req, res) => {
  res.json({
    levels: {
      1: { name: 'Starter',     maxUsdc: 500,     maxDisplay: '$500',     rateBps: 3650, rateDisplay: '36.5%', minScore: 400, minKyaTier: 1 },
      2: { name: 'Established', maxUsdc: 20_000,  maxDisplay: '$20,000',  rateBps: 2920, rateDisplay: '29.2%', minScore: 500, minKyaTier: 2 },
      3: { name: 'Trusted',     maxUsdc: 50_000,  maxDisplay: '$50,000',  rateBps: 2555, rateDisplay: '25.55%', minScore: 650, minKyaTier: 2 },
      4: { name: 'Elite',       maxUsdc: 500_000, maxDisplay: '$500,000', rateBps: 2190, rateDisplay: '21.9%', minScore: 750, minKyaTier: 3 },
    },
    tranches: {
      senior:    { aprBps: 1000, aprDisplay: '10%', risk: 'low',    description: 'Lowest risk — first priority on yields and repayments', protocolOnly: false },
      mezzanine: { aprBps: 1200, aprDisplay: '12%', risk: 'medium', description: 'Medium risk — absorbs losses after junior buffer is depleted', protocolOnly: false },
      junior:    { aprBps: 2000, aprDisplay: '20%', risk: 'high',   description: 'Highest yield — protocol-managed reserve, not available for external deposits', protocolOnly: true },
    },
  });
});

// GET /solana/credit/:agent/eligibility
router.get('/:agent/eligibility', async (req, res, next) => {
  try {
    const result = await evaluateCredit(req.params.agent);
    res.json(result);
  } catch (err) { next(err); }
});

// GET /solana/credit/:agent/line
router.get('/:agent/line', async (req, res, next) => {
  try {
    const agentPk = parsePubkey(req.params.agent);
    const [creditLine, wallet] = await Promise.all([
      readCreditLine(agentPk),
      readAgentWallet(agentPk),
    ]);

    if (!creditLine) {
      return res.json({
        agentPubkey: req.params.agent,
        exists: false,
        creditDrawn: '0',
        creditLimit: '0',
      });
    }

    const totalOwed = creditLine.creditDrawn + creditLine.accruedInterest;

    res.json({
      agentPubkey: req.params.agent,
      exists: true,
      creditLimit:          creditLine.creditLimit.toString(),
      creditDrawn:          creditLine.creditDrawn.toString(),
      accruedInterest:      creditLine.accruedInterest.toString(),
      totalInterestPaid:    creditLine.totalInterestPaid.toString(),
      totalOwed:            totalOwed.toString(),
      interestRateBps:      creditLine.interestRateBps,
      isActive:             creditLine.isActive,
      originatedAt:         new Date(Number(creditLine.originatedAt) * 1000).toISOString(),
      lastAccrualTimestamp: new Date(Number(creditLine.lastAccrualTimestamp) * 1000).toISOString(),
      // Wallet-level health
      healthFactorBps:      wallet?.healthFactorBps ?? null,
      isFrozen:             wallet?.isFrozen ?? null,
    });
  } catch (err) { next(err); }
});

// POST /solana/credit/:agent/request — build unsigned request_credit tx
router.post('/:agent/request', validate(SolanaCreditRequestSchema), async (req, res, next) => {
  try {
    const agentPk = parsePubkey(req.params.agent as string);
    const { amount, rateBps, creditLevel, collateralValueUsdc } = req.body;

    // Evaluate eligibility first
    const eligibility = await evaluateCredit(req.params.agent as string);
    if (!eligibility.eligible) {
      throw new AppError(400, `Credit not eligible: ${eligibility.reason}`);
    }

    const wallet = await readAgentWallet(agentPk);
    if (!wallet) throw new AppError(404, 'Agent wallet not found');
    if (wallet.isFrozen) throw new AppError(400, 'Wallet is frozen');
    if (wallet.creditDrawn > 0n) throw new AppError(400, 'Existing credit must be repaid first');

    const resolvedLevel = creditLevel ?? eligibility.creditLevel ?? 1;

    // Record credit request in DB
    const creditRequest = await prisma.creditRequest.create({
      data: {
        agentPubkey: req.params.agent as string,
        amount: BigInt(amount),
        creditLevel: resolvedLevel,
        status: 'pending',
      },
    });

    // Return unsigned transaction for the oracle to sign on-chain
    // Note: request_credit requires oracle as signer — frontend submits to
    // /oracle/sign endpoint which adds the oracle's signature server-side
    const txData = {
      instruction: 'request_credit',
      agentPubkey: req.params.agent,
      amount: BigInt(amount).toString(),
      rateBps: rateBps ?? 1000,         // 10% default
      creditLevel: resolvedLevel,
      collateralValueUsdc: BigInt(collateralValueUsdc ?? 0).toString(),
      eligibility,
      requestId: creditRequest.id,
    };

    res.json({
      ...txData,
      description: `Request ${(Number(amount) / 1_000_000).toFixed(2)} USDC credit at Level ${txData.creditLevel}`,
      note: 'Submit to POST /api/v1/solana/oracle/sign-credit to get oracle-signed transaction',
    });
  } catch (err) { next(err); }
});

// GET /solana/credit/:agent/requests — credit request history
router.get('/:agent/requests', async (req, res, next) => {
  try {
    parsePubkey(req.params.agent);
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const skip = (page - 1) * limit;

    const [requests, total] = await Promise.all([
      prisma.creditRequest.findMany({
        where: { agentPubkey: req.params.agent },
        orderBy: { requestedAt: 'desc' },
        take: limit,
        skip,
      }),
      prisma.creditRequest.count({
        where: { agentPubkey: req.params.agent },
      }),
    ]);

    res.json({
      agentPubkey: req.params.agent,
      requests: requests.map(r => ({
        id: r.id,
        amount: r.amount.toString(),
        creditLevel: r.creditLevel,
        status: r.status,
        reason: r.reason,
        txSignature: r.txSignature,
        requestedAt: r.requestedAt.toISOString(),
        resolvedAt: r.resolvedAt?.toISOString() ?? null,
      })),
      total,
      page,
      limit,
    });
  } catch (err) { next(err); }
});

// GET /solana/credit/:agent/score-breakdown — 5-component score breakdown
router.get('/:agent/score-breakdown', async (req, res, next) => {
  try {
    const agentPk = parsePubkey(req.params.agent);

    // Fetch latest score snapshot from DB
    const snapshot = await prisma.scoreSnapshot.findFirst({
      where: { agentPubkey: req.params.agent },
      orderBy: { snapshotAt: 'desc' },
    });

    // Fetch on-chain profile for current level + next level info
    const profile = await readAgentProfile(agentPk);

    const LEVEL_THRESHOLDS = [0, 400, 500, 650, 750];
    const currentLevel = profile?.creditLevel ?? 0;
    const nextLevelScore = currentLevel < 4 ? LEVEL_THRESHOLDS[currentLevel + 1] : null;

    res.json({
      agentPubkey: req.params.agent,
      score: snapshot?.score ?? profile?.creditScore ?? 0,
      components: snapshot?.components ?? null,
      level: currentLevel,
      nextLevelScore,
      pointsToNextLevel: nextLevelScore ? Math.max(0, nextLevelScore - (snapshot?.score ?? profile?.creditScore ?? 0)) : null,
      attestationHash: snapshot?.attestationHash ?? null,
      lastUpdated: snapshot?.snapshotAt?.toISOString() ?? null,
    });
  } catch (err) { next(err); }
});

// POST /solana/credit/:agent/repay — build unsigned repay tx
router.post('/:agent/repay', validate(SolanaCreditRepaySchema), async (req, res, next) => {
  try {
    const agentPk = parsePubkey(req.params.agent as string);
    const { amount, callerPubkey } = req.body;

    const callerPk = parsePubkey(callerPubkey);
    const callerUsdc = getAssociatedTokenAddressSync(USDC_MINT, callerPk);

    const ixn = buildRepay({
      agent: agentPk,
      caller: callerPk,
      callerUsdc,
      amount: BigInt(amount),
    });

    const tx = await instructionToUnsignedTx(ixn, callerPk);

    res.json({
      transaction: tx,
      encoding: 'base64',
      description: `Repay ${(Number(amount) / 1_000_000).toFixed(2)} USDC for agent ${req.params.agent}`,
    });
  } catch (err) { next(err); }
});

// GET /solana/credit/:agent/activity — recent credit activity (score + health snapshots)
router.get('/:agent/activity', async (req, res, next) => {
  try {
    const agentPk = parsePubkey(req.params.agent);
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

    const [scoreSnapshots, healthSnapshots, trades] = await Promise.all([
      prisma.scoreSnapshot.findMany({
        where: { agentPubkey: req.params.agent },
        orderBy: { snapshotAt: 'desc' },
        take: limit,
        select: { score: true, level: true, snapshotAt: true },
      }),
      prisma.healthSnapshot.findMany({
        where: { agentPubkey: req.params.agent },
        orderBy: { snapshotAt: 'desc' },
        take: limit,
        select: { healthFactorBps: true, creditDrawn: true, totalDebt: true, snapshotAt: true },
      }),
      prisma.solanaAgentTrade.findMany({
        where: { agentPubkey: req.params.agent },
        orderBy: { executedAt: 'desc' },
        take: limit,
        select: { venue: true, amount: true, direction: true, txSignature: true, executedAt: true },
      }),
    ]);

    res.json({
      agentPubkey: req.params.agent,
      scoreHistory: scoreSnapshots.map(s => ({
        score: s.score,
        level: s.level,
        timestamp: s.snapshotAt.toISOString(),
      })),
      healthHistory: healthSnapshots.map(h => ({
        healthFactorBps: h.healthFactorBps,
        creditDrawn: h.creditDrawn.toString(),
        totalDebt: h.totalDebt.toString(),
        timestamp: h.snapshotAt.toISOString(),
      })),
      recentTrades: trades.map(t => ({
        venue: t.venue,
        amount: t.amount.toString(),
        direction: t.direction,
        txSignature: t.txSignature,
        timestamp: t.executedAt.toISOString(),
      })),
    });
  } catch (err) { next(err); }
});

// POST /solana/credit/:agent/sign-agreement — initiate legal e-signing
router.post('/:agent/sign-agreement', validate(SolanaSignAgreementSchema), async (req, res, next) => {
  try {
    parsePubkey(req.params.agent as string);
    const { creditLevel } = req.body;

    const result = await initiateAgreement(req.params.agent as string, creditLevel);
    res.json(result);
  } catch (err) { next(err); }
});

// POST /solana/credit/:agent/confirm-agreement — confirm after on-chain tx
router.post('/:agent/confirm-agreement', validate(SolanaConfirmAgreementSchema), async (req, res, next) => {
  try {
    const { agreementId, txSignature, onChainHash } = req.body;
    await confirmAgreementSigned(agreementId, txSignature, onChainHash);
    res.json({ success: true, message: 'Agreement confirmed' });
  } catch (err) { next(err); }
});

// GET /solana/credit/:agent/agreement-status — check signing status
router.get('/:agent/agreement-status', async (req, res, next) => {
  try {
    parsePubkey(req.params.agent);
    const status = await getAgreementStatus(req.params.agent);
    res.json(status);
  } catch (err) { next(err); }
});

export default router;
