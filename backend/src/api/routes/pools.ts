import { Router } from 'express';

const router = Router();

router.get('/', async (_req, res) => {
  res.json({ pools: [], total: 0 });
});

router.get('/:address', async (_req, res) => {
  res.status(501).json({ error: 'NotImplemented', message: 'Pool detail — Phase 3' });
});

export default router;
