import type { Request, Response, NextFunction } from 'express';
import type { X402Config, X402PaymentRequirements } from './types.js';

/**
 * Creates Express middleware that gates an endpoint behind x402 payment.
 *
 * Usage:
 *   app.get('/api/translate', krexa402({ ... }), (req, res) => { ... });
 *
 * If the request has no X-402-Payment header, returns 402 with payment requirements.
 * If the header is present, verifies the payment receipt with the Krexa backend.
 */
export function krexa402(config: X402Config) {
  const facilitatorAddress = process.env.KREXA_402_FACILITATOR_ADDRESS ?? '';
  const usdcAddress = process.env.KREXA_USDC_ADDRESS ?? '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

  return async (req: Request, res: Response, next: NextFunction) => {
    const paymentHeader = req.headers['x-402-payment'] as string | undefined;

    if (!paymentHeader) {
      // Return 402 with payment requirements
      const requirements: X402PaymentRequirements = {
        x402Version: 1,
        accepts: [{
          scheme: 'exact',
          network: 'base-sepolia',
          token: usdcAddress,
          amount: config.priceUsdc,
          resourceHash: config.resourceHash,
          facilitatorAddress,
          merchantAddress: config.merchantAddress,
        }],
      };

      res.status(402).json(requirements);
      return;
    }

    // Verify payment receipt
    try {
      const parsed = JSON.parse(paymentHeader);
      const verifyRes = await fetch(`${config.kresxaApiUrl}/x402/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceHash: config.resourceHash,
          txHash: parsed.txHash,
        }),
      });

      if (!verifyRes.ok) {
        res.status(402).json({ error: 'Payment verification failed' });
        return;
      }

      const result = await verifyRes.json() as { valid: boolean; reason?: string };
      if (!result.valid) {
        res.status(402).json({ error: result.reason ?? 'Invalid payment' });
        return;
      }

      // Payment verified — proceed
      next();
    } catch {
      res.status(402).json({ error: 'Invalid X-402-Payment header' });
    }
  };
}
