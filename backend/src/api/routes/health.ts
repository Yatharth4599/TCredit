import { Router } from 'express';
import { publicClient } from '../../chain/client.js';
import { solanaConnection } from '../../chain/solana/connection.js';
import type { HealthResponse } from '../../types/index.js';
import { prisma } from '../../config/prisma.js';
import { getSolanaKeeperHealth } from '../../services/solana-keeper.js';
import { getSolanaIndexerHealth } from '../../indexer/solana-indexer.js';

const router = Router();

router.get('/health', async (_req, res) => {
  let dbOk = false;
  let chainOk = false;
  let solanaOk = false;
  let latestBlock = 0;
  let chainId = 0;
  let solanaSlot = 0;

  const startMs = Date.now();

  // Check DB
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    /* db down */
  }

  // Check EVM chain
  try {
    const block = await publicClient.getBlockNumber();
    latestBlock = Number(block);
    chainId = await publicClient.getChainId();
    chainOk = true;
  } catch {
    /* chain unreachable */
  }

  // Check Solana RPC
  try {
    solanaSlot = await solanaConnection.getSlot('confirmed');
    solanaOk = true;
  } catch {
    /* solana unreachable */
  }

  // Gather subsystem health
  const keeperHealth = getSolanaKeeperHealth();
  const indexerHealth = await getSolanaIndexerHealth().catch(() => null);

  const allOk = dbOk && (chainOk || solanaOk);
  const status = allOk ? 'ok' : (dbOk ? 'degraded' : 'down');

  const response: HealthResponse & Record<string, unknown> = {
    status,
    timestamp: new Date().toISOString(),
    version: '0.2.0',
    database: dbOk,
    chain: chainOk,
    chainId,
    latestBlock,
    solana: solanaOk,
    solanaSlot,
    responseTimeMs: Date.now() - startMs,
    services: {
      solanaKeeper: keeperHealth,
      solanaIndexer: indexerHealth,
    },
  };

  const httpStatus = status === 'down' ? 503 : 200;
  res.status(httpStatus).json(response);
});

export default router;
