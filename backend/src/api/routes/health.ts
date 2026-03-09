import { Router } from 'express';
import { publicClient } from '../../chain/client.js';
import type { HealthResponse } from '../../types/index.js';
import { prisma } from '../../config/prisma.js';

const router = Router();

router.get('/health', async (_req, res) => {
  let dbOk = false;
  let chainOk = false;
  let latestBlock = 0;
  let chainId = 0;

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    /* db down */
  }

  try {
    const block = await publicClient.getBlockNumber();
    latestBlock = Number(block);
    chainId = await publicClient.getChainId();
    chainOk = true;
  } catch {
    /* chain unreachable */
  }

  const status = dbOk && chainOk ? 'ok' : dbOk || chainOk ? 'degraded' : 'down';

  const response: HealthResponse = {
    status,
    timestamp: new Date().toISOString(),
    version: '0.1.0',
    database: dbOk,
    chain: chainOk,
    chainId,
    latestBlock,
  };

  const httpStatus = status === 'down' ? 503 : 200;
  res.status(httpStatus).json(response);
});

export default router;
