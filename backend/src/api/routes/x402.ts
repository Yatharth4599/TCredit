import { Router } from 'express';
import type { Address, Hex } from 'viem';
import { parseUnits } from 'viem';
import { getResource, getResourceKey, getFacilitatorFeeBps } from '../../chain/facilitator.js';
import { hashResourceUrl, registerResourceTx, verifyPaymentReceipt } from '../../services/facilitator.service.js';
import { validate } from '../middleware/validate.js';
import { X402RegisterResourceSchema, X402VerifySchema } from '../schemas.js';
import { env } from '../../config/env.js';

const router = Router();

const FACILITATOR_ADDRESS = env.KREXA_402_FACILITATOR_ADDRESS as Address;

// POST /api/v1/x402/register-resource — register URL with pricing
router.post('/register-resource', validate(X402RegisterResourceSchema), async (req, res, next) => {
  try {
    const { url, pricePerCallUsdc } = req.body;
    const price = parseUnits(String(pricePerCallUsdc), 6);
    const tx = await registerResourceTx(FACILITATOR_ADDRESS, url, price);

    res.json({
      rawResourceHash: tx.resourceHash,
      unsignedTx: { to: tx.to, data: tx.data },
      description: 'Sign and submit this transaction to register the resource. After submission, use GET /x402/resource-key/:rawHash/:owner to get the storage key needed for all subsequent lookups.',
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/x402/verify — verify payment receipt
router.post('/verify', validate(X402VerifySchema), async (req, res, next) => {
  try {
    const { resourceHash, txHash } = req.body;
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

// GET /api/v1/x402/resource/:key — get resource by storage key (owner-bound hash)
// key = keccak256(abi.encode(rawResourceHash, ownerAddress)) — use /resource-key to derive it
router.get('/resource/:key', async (req, res, next) => {
  try {
    const resourceKey = req.params.key as Hex;
    const resource = await getResource(FACILITATOR_ADDRESS, resourceKey);
    const feeBps = await getFacilitatorFeeBps(FACILITATOR_ADDRESS);

    res.json({
      ...resource,
      facilitatorFeeBps: feeBps,
      resourceKey,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/x402/resource-key/:rawHash/:owner — derive storage key from raw hash + owner
router.get('/resource-key/:rawHash/:owner', async (req, res, next) => {
  try {
    const { rawHash, owner } = req.params;
    const key = await getResourceKey(FACILITATOR_ADDRESS, rawHash as Hex, owner as Address);
    res.json({ rawHash, owner, resourceKey: key });
  } catch (err) {
    next(err);
  }
});

export default router;
