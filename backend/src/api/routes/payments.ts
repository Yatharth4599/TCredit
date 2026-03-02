import { Router } from 'express';

const router = Router();

// GET /api/v1/payments/recent — Phase 5 event indexer fills this
// Returns empty for now; live data comes from the oracle service (Phase 4)
router.get('/recent', (_req, res) => {
  res.json({ payments: [], total: 0 });
});

// GET /api/v1/payments/:paymentId/waterfall
router.get('/:paymentId/waterfall', (_req, res) => {
  res.json({ waterfall: null, message: 'Payment waterfall available after Phase 4 oracle service' });
});

export default router;
