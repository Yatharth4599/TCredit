import { Router } from 'express';
import type { Address, Hex } from 'viem';
import { parseUnits } from 'viem';
import { getResource, getFacilitatorFeeBps } from '../../chain/facilitator.js';
import { hashResourceUrl, registerResourceTx, verifyPaymentReceipt } from '../../services/facilitator.service.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// Facilitator address — will come from env once deployed
const FACILITATOR_ADDRESS = (process.env.KREXA_402_FACILITATOR_ADDRESS ?? '0x0000000000000000000000000000000000000000') as Address;

// POST /api/v1/x402/register-resource — register URL with pricing
router.post('/register-resource', async (req, res, next) => {
  try {
    const { url, pricePerCallUsdc } = req.body;
    if (!url || !pricePerCallUsdc) {
      throw new AppError(400, 'url and pricePerCallUsdc required');
    }
    const price = parseUnits(String(pricePerCallUsdc), 6);
    const tx = await registerResourceTx(FACILITATOR_ADDRESS, url, price);

    res.json({
      resourceHash: tx.resourceHash,
      unsignedTx: { to: tx.to, data: tx.data },
      description: 'Sign and submit this transaction to register the resource',
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/x402/verify — verify payment receipt
router.post('/verify', async (req, res, next) => {
  try {
    const { resourceHash, txHash } = req.body;
    if (!resourceHash || !txHash) {
      throw new AppError(400, 'resourceHash and txHash required');
    }
    const result = await verifyPaymentReceipt(
      FACILITATOR_ADDRESS,
      resourceHash as Hex,
      txHash as Hex,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/x402/resource/:hash — get resource pricing
router.get('/resource/:hash', async (req, res, next) => {
  try {
    const resourceHash = req.params.hash as `0x${string}`;
    const resource = await getResource(FACILITATOR_ADDRESS, resourceHash);
    const feeBps = await getFacilitatorFeeBps(FACILITATOR_ADDRESS);

    res.json({
      ...resource,
      facilitatorFeeBps: feeBps,
      resourceHash,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
