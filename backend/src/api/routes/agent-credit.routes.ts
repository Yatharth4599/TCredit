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
import { env } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import { initiateAgreement, getAgreementStatus, confirmAgreementSigned } from '../../services/legal-agreement.js';

const router = Router();
const USDC_MINT = new PublicKey(env.SOLANA_USDC_MINT);

function parsePubkey(raw: string): PublicKey {
  try { return new PublicKey(raw); }
  catch { throw new AppError(400, `Invalid Solana public key: ${raw}`); }
}

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
router.post('/:agent/request', async (req, res, next) => {
  try {
    const agentPk = parsePubkey(req.params.agent);
    const { amount, rateBps, creditLevel, collateralValueUsdc } = req.body;

    if (!amount) throw new AppError(400, 'amount (USDC base units) required');

    // Evaluate eligibility first
    const eligibility = await evaluateCredit(req.params.agent);
    if (!eligibility.eligible) {
      throw new AppError(400, `Credit not eligible: ${eligibility.reason}`);
    }

    const wallet = await readAgentWallet(agentPk);
    if (!wallet) throw new AppError(404, 'Agent wallet not found');
    if (wallet.isFrozen) throw new AppError(400, 'Wallet is frozen');
    if (wallet.creditDrawn > 0n) throw new AppError(400, 'Existing credit must be repaid first');

    // Return unsigned transaction for the oracle to sign on-chain
    // Note: request_credit requires oracle as signer — frontend submits to
    // /oracle/sign endpoint which adds the oracle's signature server-side
    const txData = {
      instruction: 'request_credit',
      agentPubkey: req.params.agent,
      amount: BigInt(amount).toString(),
      rateBps: rateBps ?? 1000,         // 10% default
      creditLevel: creditLevel ?? eligibility.creditLevel,
      collateralValueUsdc: BigInt(collateralValueUsdc ?? 0).toString(),
      eligibility,
    };

    res.json({
      ...txData,
      description: `Request ${(Number(amount) / 1_000_000).toFixed(2)} USDC credit at Level ${txData.creditLevel}`,
      note: 'Submit to POST /api/v1/solana/oracle/sign-credit to get oracle-signed transaction',
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
router.post('/:agent/repay', async (req, res, next) => {
  try {
    const agentPk = parsePubkey(req.params.agent);
    const { amount, callerPubkey } = req.body;

    if (!amount || !callerPubkey) {
      throw new AppError(400, 'amount and callerPubkey required');
    }

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

// POST /solana/credit/:agent/sign-agreement — initiate legal e-signing
router.post('/:agent/sign-agreement', async (req, res, next) => {
  try {
    parsePubkey(req.params.agent);
    const { creditLevel } = req.body;
    if (!creditLevel || creditLevel < 3 || creditLevel > 4) {
      throw new AppError(400, 'creditLevel must be 3 or 4');
    }

    const result = await initiateAgreement(req.params.agent, creditLevel);
    res.json(result);
  } catch (err) { next(err); }
});

// POST /solana/credit/:agent/confirm-agreement — confirm after on-chain tx
router.post('/:agent/confirm-agreement', async (req, res, next) => {
  try {
    const { agreementId, txSignature, onChainHash } = req.body;
    if (!agreementId || !txSignature || !onChainHash) {
      throw new AppError(400, 'agreementId, txSignature, and onChainHash required');
    }
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
