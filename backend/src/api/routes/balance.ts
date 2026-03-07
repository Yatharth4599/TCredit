import { Router } from 'express';
import type { Address } from 'viem';
import { formatUnits, erc20Abi } from 'viem';
import { publicClient } from '../../chain/client.js';
import { addresses } from '../../config/contracts.js';

const router = Router();

// GET /api/v1/balance/:address — on-chain USDC balance
router.get('/:address', async (req, res, next) => {
  try {
    const addr = req.params.address as Address;
    const balance = await publicClient.readContract({
      address: addresses.usdc,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [addr],
    }) as bigint;

    res.json({
      address: addr,
      balanceUsdc: formatUnits(balance, 6),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
