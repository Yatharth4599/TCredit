import { Router } from 'express';
import { z } from 'zod';
import type { Address } from 'viem';
import { processPayment, getOracleHealth } from '../../services/oracle.service.js';
import { AppError } from '../middleware/errorHandler.js';
import { requireApiKey, requireAdmin } from '../middleware/apiKeyAuth.js';
import { prisma } from '../../config/prisma.js';

const router = Router();

const paymentSchema = z.object({
  from: z.string().startsWith('0x').length(42),
  to: z.string().startsWith('0x').length(42),
  amount: z.string().regex(/^\d+$/),
  paymentId: z.string().startsWith('0x').optional(),
});

const verifyPaymentSchema = z.object({
  token: z.string().min(1),
  recipient: z.string().startsWith('0x').length(42),
  amountUsdc: z.number().finite().positive(),
});

function decodePaymentToken(token: string): { jti?: string; sub?: string; amt?: number; iat?: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = Buffer.from(parts[1]!, 'base64url').toString('utf-8');
    const data = JSON.parse(payload) as { jti?: string; sub?: string; amt?: number; iat?: number };
    return data;
  } catch {
    return null;
  }
}

// POST /api/v1/oracle/payment — webhook receiver (requires admin API key)
// BUG-104 fix: enforce strict payer binding to API key ownerWallet
router.post('/payment', requireAdmin, async (req, res, next) => {
  try {
    const parsed = paymentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, `Invalid request: ${parsed.error.issues.map((i) => i.message).join(', ')}`);
    }

    const apiKeyId = (req as unknown as { apiKey?: { id?: string } }).apiKey?.id;
    if (!apiKeyId) {
      throw new AppError(503, 'Authenticated API key context missing');
    }

    const rows = await prisma.$queryRaw<Array<{ ownerWallet: string | null }>>`
      SELECT "ownerWallet"
      FROM "ApiKey"
      WHERE "id" = ${apiKeyId}
      LIMIT 1
    `;
    const ownerWallet = rows[0]?.ownerWallet ?? null;
    if (rows.length === 0) {
      throw new AppError(401, 'Invalid API key context');
    }
    if (!ownerWallet) {
      throw new AppError(403, 'API key is not bound to an owner wallet');
    }
    if (parsed.data.from.toLowerCase() !== ownerWallet.toLowerCase()) {
      throw new AppError(
        403,
        `Payment 'from' address does not match API key wallet binding. ` +
        `Expected: ${ownerWallet}, got: ${parsed.data.from}`,
      );
    }

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

// POST /api/v1/oracle/verify-payment — verify x402 payment token against settled oracle payment
router.post('/verify-payment', requireApiKey, async (req, res, next) => {
  try {
    const parsed = verifyPaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, `Invalid request: ${parsed.error.issues.map((i) => i.message).join(', ')}`);
    }

    const payload = decodePaymentToken(parsed.data.token);
    if (!payload?.jti) {
      return res.json({ valid: false, reason: 'Invalid token payload' });
    }

    const expectedAmount = BigInt(Math.round(parsed.data.amountUsdc * 1_000_000));
    const payment = await prisma.oraclePayment.findFirst({
      where: {
        paymentId: payload.jti,
        to: parsed.data.recipient.toLowerCase(),
        status: 'confirmed',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!payment) {
      return res.json({ valid: false, reason: 'No confirmed payment for token' });
    }
    if (payment.amount < expectedAmount) {
      return res.json({ valid: false, reason: 'Payment amount below required threshold' });
    }

    return res.json({
      valid: true,
      paymentId: payment.id,
      txHash: payment.txHash,
      amount: payment.amount.toString(),
      status: payment.status,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/oracle/health — oracle service status (BUG-046: auth required)
router.get('/health', requireApiKey, async (_req, res, next) => {
  try {
    const health = await getOracleHealth();
    res.status(health.status === 'down' ? 503 : 200).json(health);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/oracle/payments — list oracle payments (BUG-051: auth required)
router.get('/payments', requireApiKey, async (req, res, next) => {
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
      payments: payments.map((p: {
        id: string;
        from: string;
        to: string;
        amount: bigint;
        nonce: bigint;
        paymentId: string | null;
        txHash: string | null;
        status: string;
        deadline: bigint;
        createdAt: Date;
      }) => ({
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
