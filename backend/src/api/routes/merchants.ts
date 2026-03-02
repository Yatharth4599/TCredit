import { Router } from 'express';

const router = Router();

router.get('/:address', async (_req, res) => {
  res.status(501).json({ error: 'NotImplemented', message: 'Merchant detail — Phase 3' });
});

router.get('/:address/vaults', async (_req, res) => {
  res.json({ vaults: [], total: 0 });
});

export default router;
