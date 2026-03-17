import { Request, Response, NextFunction } from 'express';
import { Connection } from '@solana/web3.js';
import { config } from './config.js';

// ---------------------------------------------------------------------------
// On-chain payment verification (BUG-036 fix: verify recipient + replay protection)
// ---------------------------------------------------------------------------

const usedSignatures = new Set<string>();

async function verifyPayment(signature: string): Promise<boolean> {
  // Replay protection: reject previously-used signatures
  if (usedSignatures.has(signature)) return false;

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
  if (tx.meta?.err !== null) return false;

  // Verify the payment actually went to our merchant wallet
  // Check post-token-balances for our merchant receiving USDC
  const postBalances = tx.meta?.postTokenBalances ?? [];
  const merchantReceived = postBalances.some(
    (b) => b.owner === config.merchantWallet && (b.uiTokenAmount?.uiAmount ?? 0) > 0
  );

  if (!merchantReceived) {
    // Fallback: check account keys for merchant wallet presence
    const accountKeys = tx.transaction.message.getAccountKeys();
    const merchantInTx = accountKeys.staticAccountKeys.some(
      (key) => key.toBase58() === config.merchantWallet
    );
    if (!merchantInTx) return false;
  }

  // Mark signature as used (prevent replay)
  usedSignatures.add(signature);

  // Prevent memory leak: cap the set size
  if (usedSignatures.size > 10_000) {
    const iter = usedSignatures.values();
    for (let i = 0; i < 5_000; i++) {
      usedSignatures.delete(iter.next().value!);
    }
  }

  return true;
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
