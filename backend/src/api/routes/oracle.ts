import { Router } from 'express';
import type { Address } from 'viem';
import { processPayment, getOracleHealth } from '../../services/oracle.service.js';
import { requireApiKey } from '../middleware/apiKeyAuth.js';
import { validate } from '../middleware/validate.js';
import { OraclePaymentSchema } from '../schemas.js';
import { prisma } from '../../config/prisma.js';

const router = Router();

// POST /api/v1/oracle/payment — webhook receiver (requires API key)
router.post('/payment', requireApiKey, validate(OraclePaymentSchema), async (req, res, next) => {
  try {
    const result = await processPayment({
      from: req.body.from as Address,
      to: req.body.to as Address,
      amount: req.body.amount,
      paymentId: req.body.paymentId,
    });

    res.status(result.status === 'confirmed' ? 200 : 202).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/oracle/health — oracle service status
router.get('/health', async (_req, res, next) => {
  try {
    const health = await getOracleHealth();
    res.status(health.status === 'down' ? 503 : 200).json(health);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/oracle/payments — list oracle payments (with optional filters)
router.get('/payments', async (req, res, next) => {
  try {
    const { status, vault, limit } = req.query;
    const where: Record<string, unknown> = {};
    if (status && typeof status === 'string') where.status = status;
    if (vault && typeof vault === 'string') where.vault = vault.toLowerCase();

    const limitNum = limit !== undefined ? parseInt(String(limit), 10) : 50;
    const take = Number.isFinite(limitNum) && limitNum > 0 ? Math.min(limitNum, 100) : 50;

    const payments = await prisma.oraclePayment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
    });

    res.json({
      payments: payments.map((p) => ({
        ...p,
        amount: p.amount.toString(),
        nonce: p.nonce.toString(),
        deadline: p.deadline.toString(),
      })),
      total: payments.length,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
