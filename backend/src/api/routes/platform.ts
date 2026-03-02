import { Router } from 'express';

const router = Router();

router.get('/stats', async (_req, res) => {
  res.json({
    tvl: '0',
    activeVaults: 0,
    totalRepaid: '0',
    totalInvestors: 0,
  });
});

router.get('/config', async (_req, res) => {
  res.json({
    platformFeeBps: 200,
    maxFeeBps: 500,
    minDuration: 604800,
    maxDuration: 63072000,
    chainId: 84532,
  });
});

export default router;
