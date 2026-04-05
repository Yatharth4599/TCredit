import { Router } from 'express';
import { cacheGet, cacheSet } from '../../config/redis.js';
import type { Address } from 'viem';
import { getTotalDeposits, getAvailableBalance, getAllocation } from '../../chain/liquidityPool.js';
import { addresses } from '../../config/contracts.js';
import { LiquidityPoolABI } from '../../config/abis.js';
import { encodeFunctionData } from 'viem';
import { AppError } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validate.js';
import { PoolDepositSchema, PoolWithdrawSchema, PoolAllocateSchema } from '../schemas.js';

const router = Router();

const POOLS = [
  { address: addresses.seniorPool, name: 'Senior Pool (Alpha)', isAlpha: true },
  { address: addresses.generalPool, name: 'General Pool', isAlpha: false },
] as const;

async function getPoolData(pool: typeof POOLS[number]) {
  const [totalDeposits, available] = await Promise.all([
    getTotalDeposits(pool.address),
    getAvailableBalance(pool.address),
  ]);
  const deposits = totalDeposits as bigint;
  const avail = available as bigint;
  const allocated = deposits - avail;

  return {
    address: pool.address,
    name: pool.name,
    isAlpha: pool.isAlpha,
    totalDeposits: deposits.toString(),
    totalAllocated: allocated > 0n ? allocated.toString() : '0',
    availableBalance: avail.toString(),
    utilizationPct: deposits > 0n ? Math.round(Number((allocated * 10000n) / deposits) / 100) : 0,
  };
}

// GET /api/v1/pools
router.get('/', async (_req, res, next) => {
  try {
    const cached = await cacheGet('pools:all');
    if (cached) return res.json(cached);

    const pools = await Promise.all(POOLS.map(getPoolData));
    const totalDeposits = pools.reduce((s, p) => s + BigInt(p.totalDeposits), 0n);
    const totalAllocated = pools.reduce((s, p) => s + BigInt(p.totalAllocated), 0n);

    const data = {
      pools,
      total: pools.length,
      summary: {
        totalDeposits: totalDeposits.toString(),
        totalAllocated: totalAllocated.toString(),
        totalAvailable: (totalDeposits - totalAllocated).toString(),
      },
    };
    await cacheSet('pools:all', data, 30);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/pools/:address
router.get('/:address', async (req, res, next) => {
  try {
    const poolAddr = req.params.address as Address;
    const cached = await cacheGet(`pools:${poolAddr.toLowerCase()}`);
    if (cached) return res.json(cached);

    const pool = POOLS.find((p) => p.address.toLowerCase() === poolAddr.toLowerCase());
    if (!pool) throw new AppError(404, 'Pool not found');
    const data = await getPoolData(pool);
    await cacheSet(`pools:${poolAddr.toLowerCase()}`, data, 30);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/pools/:address/allocation/:vault
router.get('/:address/allocation/:vault', async (req, res, next) => {
  try {
    const poolAddr = req.params.address as Address;
    const vaultAddr = req.params.vault as Address;
    const alloc = await getAllocation(poolAddr, vaultAddr) as {
      amount: bigint; returnedAmount: bigint; allocatedAt: bigint; active: boolean;
    };
    res.json({
      amount: alloc.amount.toString(),
      returnedAmount: alloc.returnedAmount.toString(),
      allocatedAt: alloc.allocatedAt > 0n ? new Date(Number(alloc.allocatedAt) * 1000).toISOString() : null,
      active: alloc.active,
    });
  } catch (err) {
    next(err);
  }
});

function parseAmount(raw: unknown): bigint {
  if (raw === undefined || raw === null || raw === '') throw new AppError(400, 'amount is required');
  const str = String(raw).trim();
  if (!/^\d+$/.test(str)) throw new AppError(400, 'amount must be a non-negative integer string (wei)');
  return BigInt(str);
}

// POST /api/v1/pools/deposit — build unsigned deposit tx
router.post('/deposit', validate(PoolDepositSchema), async (req, res, next) => {
  try {
    const { poolAddress, amount } = req.body;

    const data = encodeFunctionData({
      abi: LiquidityPoolABI,
      functionName: 'deposit',
      args: [parseAmount(amount)],
    });

    res.json({ to: poolAddress as Address, data, description: 'deposit — sign with your wallet' });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/pools/withdraw — build unsigned withdraw tx
router.post('/withdraw', validate(PoolWithdrawSchema), async (req, res, next) => {
  try {
    const { poolAddress, amount } = req.body;

    const data = encodeFunctionData({
      abi: LiquidityPoolABI,
      functionName: 'withdraw',
      args: [parseAmount(amount)],
    });

    res.json({ to: poolAddress as Address, data, description: 'withdraw — sign with your wallet' });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/pools/allocate — build unsigned allocateToVault tx (admin only)
router.post('/allocate', validate(PoolAllocateSchema), async (req, res, next) => {
  try {
    const { poolAddress, vaultAddress, amount } = req.body;

    const data = encodeFunctionData({
      abi: LiquidityPoolABI,
      functionName: 'allocateToVault',
      args: [vaultAddress as Address, parseAmount(amount)],
    });

    res.json({ to: poolAddress as Address, data, description: 'allocateToVault — admin only' });
  } catch (err) {
    next(err);
  }
});

export default router;
