/**
 * Credit Bureau API — The CIBIL Moat
 *
 * GET  /api/v1/credit-bureau/:agent/score    — Public score lookup (free tier, 100 req/day)
 * GET  /api/v1/credit-bureau/:agent/report   — Full credit report (paid tier, API key required)
 * GET  /api/v1/credit-bureau/:agent/history  — Credit event history (paid tier, API key required)
 */

import { Router } from 'express';
import { PublicKey } from '@solana/web3.js';
import { getAgentScore, getAgentReport, getAgentHistory, getAgentCheck, logInquiry } from '../../services/credit-bureau.js';
import { apiKeyAuth, type AuthenticatedRequest } from '../middleware/apiKeyAuth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

function parsePubkey(raw: string): PublicKey {
  try { return new PublicKey(raw); }
  catch { throw new AppError(400, `Invalid Solana public key: ${raw}`); }
}

// All bureau routes use optional API key auth for tracking
router.use(apiKeyAuth);

// GET /credit-bureau/:agent/check — simple pass/fail (free, no API key needed)
router.get('/:agent/check', async (req: AuthenticatedRequest, res, next) => {
  try {
    const agent = req.params.agent as string;
    parsePubkey(agent);

    const check = await getAgentCheck(agent);

    const requesterKey = req.apiKey?.id ?? 'anonymous';
    await logInquiry(agent, requesterKey, 'check').catch((e: unknown) => { console.warn('[credit-bureau] failed to log inquiry:', e) });

    res.json(check);
  } catch (err) { next(err); }
});

// GET /credit-bureau/:agent/score — free tier
router.get('/:agent/score', async (req: AuthenticatedRequest, res, next) => {
  try {
    const agent = req.params.agent as string;
    parsePubkey(agent); // validate pubkey format

    const score = await getAgentScore(agent);

    // Log inquiry
    const requesterKey = req.apiKey?.id ?? 'anonymous';
    await logInquiry(agent, requesterKey, 'score').catch((e: unknown) => { console.warn('[credit-bureau] failed to log inquiry:', e) });

    res.json(score);
  } catch (err) { next(err); }
});

// GET /credit-bureau/:agent/report — paid tier only
router.get('/:agent/report', async (req: AuthenticatedRequest, res, next) => {
  try {
    const agent = req.params.agent as string;
    parsePubkey(agent);

    // Require API key for paid endpoints
    if (!req.apiKey) {
      throw new AppError(401, 'API key required for credit reports (X-API-Key header)');
    }

    // Check tier — only paid keys get full reports
    if (req.apiKey.tier !== 'paid') {
      throw new AppError(403, 'Credit reports require a paid-tier API key. Upgrade at krexa.xyz/api');
    }

    const report = await getAgentReport(agent);
    await logInquiry(agent, req.apiKey.id, 'report').catch((e: unknown) => { console.warn('[credit-bureau] failed to log inquiry:', e) });

    res.json(report);
  } catch (err) { next(err); }
});

// GET /credit-bureau/:agent/history — paid tier only
router.get('/:agent/history', async (req: AuthenticatedRequest, res, next) => {
  try {
    const agent = req.params.agent as string;
    parsePubkey(agent);

    if (!req.apiKey) {
      throw new AppError(401, 'API key required for credit history (X-API-Key header)');
    }

    if (req.apiKey.tier !== 'paid') {
      throw new AppError(403, 'Credit history requires a paid-tier API key. Upgrade at krexa.xyz/api');
    }

    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 50, 100);

    const history = await getAgentHistory(agent, page, pageSize);
    await logInquiry(agent, req.apiKey.id, 'history').catch((e: unknown) => { console.warn('[credit-bureau] failed to log inquiry:', e) });

    res.json(history);
  } catch (err) { next(err); }
});

export default router;
