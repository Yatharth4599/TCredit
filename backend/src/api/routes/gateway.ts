import { Router } from 'express';
import type { Address } from 'viem';
import { getGatewaySummary } from '../../services/gateway.service.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// GET /api/v1/gateway/:address/summary — aggregated revenue across all sources
router.get('/:address/summary', async (req, res, next) => {
  try {
    const addr = req.params.address as Address;
    const summary = await getGatewaySummary(addr);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/gateway/:address/breakdown — revenue by source (for charts)
router.get('/:address/breakdown', async (req, res, next) => {
  try {
    const addr = req.params.address as Address;
    const summary = await getGatewaySummary(addr);
    const breakdown = [
      { source: 'Direct Crypto', volume: summary.sources.crypto.volume, count: summary.sources.crypto.count, color: '#3B82F6' },
      { source: 'x402 Payments', volume: summary.sources.x402.volume, count: summary.sources.x402.count, color: '#FF6B35' },
      { source: 'Fiat (Stripe/PayPal)', volume: summary.sources.fiat.volume, count: summary.sources.fiat.count, color: '#8B5CF6' },
    ];
    res.json({ breakdown, totalRevenue: summary.totalRevenue, totalPayments: summary.totalPayments });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/gateway/:address/payments — unified payment feed
router.get('/:address/payments', async (req, res, next) => {
  try {
    const addr = req.params.address as Address;
    const summary = await getGatewaySummary(addr);
    res.json({
      payments: summary.recentPayments,
      total: summary.recentPayments.length,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
