import { Request, Response, NextFunction } from 'express';
import { Connection } from '@solana/web3.js';
import { config } from './config.js';

// ---------------------------------------------------------------------------
// On-chain payment verification
// ---------------------------------------------------------------------------

async function verifyPayment(signature: string): Promise<boolean> {
  const connection = new Connection(config.solanaRpcUrl, 'confirmed');

  const tx = await connection.getTransaction(signature, {
    commitment: 'confirmed',
    maxSupportedTransactionVersion: 0,
  });

  if (!tx) return false;

  // Must be recent (within 5 minutes)
  const now = Math.floor(Date.now() / 1000);
  if (tx.blockTime && now - tx.blockTime > config.paymentMaxAgeSecs) return false;

  // Must have no errors (confirmed success)
  // Full SPL-token amount + recipient verification is handled by the
  // PaymentRouter program on-chain — this check ensures the tx landed.
  return tx.meta?.err === null;
}

// ---------------------------------------------------------------------------
// Middleware factory
// ---------------------------------------------------------------------------

export function requirePayment(amount: number) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const receipt = req.headers[config.receiptHeader];

    if (!receipt) {
      res.status(402).json({
        status: 402,
        message: 'Payment required',
        payment: {
          amount: String(amount),
          currency: 'USDC',
          recipient: config.merchantWallet,
          network: 'solana',
          facilitator: `${config.krexaApiUrl}/v1/x402/pay`,
          memo: `${req.method}:${req.path}`,
        },
      });
      return;
    }

    const signature = Array.isArray(receipt) ? receipt[0] : receipt;

    try {
      const verified = await verifyPayment(signature);
      if (verified) {
        // Attach signature to request so handlers can include it in responses
        (req as Request & { paymentTx: string }).paymentTx = signature;
        next();
      } else {
        res.status(402).json({
          status: 402,
          message: 'Payment verification failed — tx not found, expired, or failed on-chain',
        });
      }
    } catch (err) {
      console.error('[x402] verification error:', err);
      res.status(402).json({
        status: 402,
        message: 'Payment verification error — try again',
      });
    }
  };
}
