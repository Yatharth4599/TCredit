import { Router } from 'express';
import { listAllVaults } from '../../services/vault.service.js';
import { getTotalDeposits } from '../../chain/liquidityPool.js';
import { addresses } from '../../config/contracts.js';
import { getIndexerHealth } from '../../services/indexer.service.js';
import { getKeeperHealth } from '../../services/keeper.service.js';

const router = Router();

// GET /api/v1/platform/stats — live TVL, active vaults, total repaid
router.get('/stats', async (_req, res, next) => {
  try {
    const [vaults, seniorDeposits, generalDeposits] = await Promise.all([
      listAllVaults(),
      getTotalDeposits(addresses.seniorPool),
      getTotalDeposits(addresses.generalPool),
    ]);

    const activeVaults = vaults.filter((v) => v.state === 'active' || v.state === 'repaying').length;
    const totalRaised = vaults.reduce((s, v) => s + BigInt(v.totalRaised), 0n);
    const totalRepaid = vaults.reduce((s, v) => s + BigInt(v.totalRepaid), 0n);
    const poolLiquidity = (seniorDeposits as bigint) + (generalDeposits as bigint);

    res.json({
      totalVaults: vaults.length,
      activeVaults,
      tvl: totalRaised.toString(),
      totalRepaid: totalRepaid.toString(),
      poolLiquidity: poolLiquidity.toString(),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/platform/indexer — event indexer health + sync status
router.get('/indexer', async (_req, res, next) => {
  try {
    const health = await getIndexerHealth();
    res.json(health);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/platform/keeper — keeper service health
router.get('/keeper', async (_req, res, next) => {
  try {
    const health = await getKeeperHealth();
    res.json(health);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/platform/config — fee structure and limits (read from chain in Phase 5, static for now)
router.get('/config', (_req, res) => {
  res.json({
    platformFeeBps: 200,
    maxFeeBps: 500,
    minDurationSeconds: 604800,
    maxDurationSeconds: 63072000,
    minInterestRateBps: 0,
    maxInterestRateBps: 5000,
    chainId: 84532,
    contracts: {
      agentRegistry: addresses.agentRegistry,
      paymentRouter: addresses.paymentRouter,
      vaultFactory: addresses.vaultFactory,
      seniorPool: addresses.seniorPool,
      generalPool: addresses.generalPool,
      milestoneRegistry: addresses.milestoneRegistry,
    },
  });
});

export default router;
