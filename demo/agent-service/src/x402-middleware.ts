import { Request, Response, NextFunction } from 'express';
import { Connection } from '@solana/web3.js';
import { config } from './config.js';

// ---------------------------------------------------------------------------
// On-chain payment verification (BUG-036: replay protection + merchant check)
// ---------------------------------------------------------------------------

// BUG-094 fix: Map with timestamps for age-based cleanup (1 hour TTL)
const usedSignatures = new Map<string, number>();
const SIG_TTL_MS = 60 * 60 * 1000; // 1 hour

async function verifyPayment(signature: string, requiredAmount = 0): Promise<boolean> {
  if (usedSignatures.has(signature)) return false; // replay protection

  const connection = new Connection(config.solanaRpcUrl, 'confirmed');
  const tx = await connection.getTransaction(signature, {
    commitment: 'confirmed',
    maxSupportedTransactionVersion: 0,
  });

  if (!tx) return false;
  const now = Math.floor(Date.now() / 1000);
  if (tx.blockTime && now - tx.blockTime > config.paymentMaxAgeSecs) return false;
  if (tx.meta?.err !== null) return false;

  // Verify merchant wallet is in the transaction
  // BUG-114 fix: verify actual payment amount, not just presence
  const preBalances = tx.meta?.preTokenBalances ?? [];
  const postBalances = tx.meta?.postTokenBalances ?? [];

  // Find merchant's USDC balance change
  const merchantPostBal = postBalances.find(
    (b) => b.owner === config.merchantWallet && b.mint === config.usdcMint
  );
  const merchantPreBal = preBalances.find(
    (b) => b.owner === config.merchantWallet && b.mint === config.usdcMint
  );

  const preAmount = merchantPreBal?.uiTokenAmount?.uiAmount ?? 0;
  const postAmount = merchantPostBal?.uiTokenAmount?.uiAmount ?? 0;
  const balanceChange = postAmount - preAmount;

  // Verify merchant received at least the required amount
  if (balanceChange < requiredAmount) {
    return false;
  }

  usedSignatures.set(signature, Date.now());
  // BUG-094 fix: age-based cleanup — remove entries older than 1 hour
  if (usedSignatures.size > 10_000) {
    const now = Date.now();
    for (const [sig, ts] of usedSignatures) {
      if (now - ts > SIG_TTL_MS) usedSignatures.delete(sig);
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
      const verified = await verifyPayment(signature, amount);
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
