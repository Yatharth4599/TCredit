/**
 * KYA routes — Know Your Agent verification
 *
 * POST /api/v1/solana/kya/:agent/basic     — basic automated verification (tier 1)
 * POST /api/v1/solana/kya/:agent/enhanced  — Sumsub KYC (tier 2)
 * GET  /api/v1/solana/kya/:agent/status    — current KYA status
 */

import { Router } from 'express';
import { submitBasicKya, submitEnhancedKya, getKyaStatus } from '../../services/kya.service.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// POST /solana/kya/:agent/basic
router.post('/:agent/basic', async (req, res, next) => {
  try {
    const { ownerPubkey, ownerSignature, codeRepoUrl } = req.body;
    if (!ownerPubkey || !ownerSignature) {
      throw new AppError(400, 'ownerPubkey and ownerSignature are required');
    }

    const result = await submitBasicKya({
      agentPubkey: req.params.agent,
      ownerPubkey,
      ownerSignature,
      codeRepoUrl,
    });

    const statusCode = result.status === 'approved' ? 200 : result.status === 'pending' ? 202 : 400;
    res.status(statusCode).json(result);
  } catch (err) { next(err); }
});

// POST /solana/kya/:agent/enhanced
router.post('/:agent/enhanced', async (req, res, next) => {
  try {
    const { ownerPubkey, sumsubApplicantId } = req.body;
    if (!ownerPubkey || !sumsubApplicantId) {
      throw new AppError(400, 'ownerPubkey and sumsubApplicantId are required');
    }

    const result = await submitEnhancedKya({
      agentPubkey: req.params.agent,
      ownerPubkey,
      sumsubApplicantId,
    });

    const statusCode = result.status === 'approved' ? 200 : result.status === 'pending' ? 202 : 400;
    res.status(statusCode).json(result);
  } catch (err) { next(err); }
});

// GET /solana/kya/:agent/status
router.get('/:agent/status', async (req, res, next) => {
  try {
    const status = await getKyaStatus(req.params.agent);
    res.json(status);
  } catch (err) { next(err); }
});

export default router;
