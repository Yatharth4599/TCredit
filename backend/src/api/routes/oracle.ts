import { Router } from 'express';
import type { Address } from 'viem';
import { z } from 'zod';
import { processPayment, getOracleHealth } from '../../services/oracle.service.js';
import { AppError } from '../middleware/errorHandler.js';
import { requireApiKey } from '../middleware/apiKeyAuth.js';
import { prisma } from '../../config/prisma.js';

const router = Router();

const paymentSchema = z.object({
  from: z.string().startsWith('0x').length(42),
  to: z.string().startsWith('0x').length(42),
  amount: z.string().regex(/^\d+$/),
  paymentId: z.string().startsWith('0x').optional(),
});

// POST /api/v1/oracle/payment — webhook receiver (requires API key)
router.post('/payment', requireApiKey, async (req, res, next) => {
  try {
    const parsed = paymentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, `Invalid request: ${parsed.error.issues.map((i) => i.message).join(', ')}`);
    }

    const result = await processPayment({
      from: parsed.data.from as Address,
      to: parsed.data.to as Address,
      amount: parsed.data.amount,
      paymentId: parsed.data.paymentId,
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
