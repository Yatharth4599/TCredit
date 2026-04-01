import { Router } from 'express';
import type { Address } from 'viem';
import { z } from 'zod';
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

// POST /api/v1/oracle/payment — webhook receiver (requires API key)
// TODO [BUG-104]: API keys need an `ownerWallet` field in the schema so we can
// enforce `from === apiKey.ownerWallet`. Until then, log mismatches as security events.
router.post('/payment', requireAdmin, async (req, res, next) => {
  try {
    const parsed = paymentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, `Invalid request: ${parsed.error.issues.map((i) => i.message).join(', ')}`);
    }

    // BUG-104: Log security event — `from` address is not bound to the API key.
    // API keys currently lack wallet binding, so any valid key can submit payments
    // for any `from` address (on-chain allowance still required).
    const apiKeyId = (req as unknown as { apiKeyId?: string }).apiKeyId ?? 'unknown';
    console.warn(
      `[security] oracle/payment: from=${parsed.data.from} submitted by apiKey=${apiKeyId}. ` +
      'API key is not wallet-bound — payer identity is NOT verified. ' +
      'TODO: add ownerWallet to ApiKey schema and enforce match.',
    );

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

    const payments = await prisma.oraclePayment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(limit) || 50, 100),
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
