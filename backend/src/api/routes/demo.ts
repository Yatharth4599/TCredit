import { Router } from 'express';
import type { Address } from 'viem';
import { processPayment } from '../../services/oracle.service.js';

const router = Router();

// ── Demo split constants (mirrors PaymentRouter + WaterfallLib logic) ──
const PLATFORM_FEE_BPS = 250;  // 2.5%
const SENIOR_BPS       = 2000; // 20% of net → Senior Pool
const POOL_BPS         = 1000; // 10% of net → Liquidity Pool
const COMMUNITY_BPS    = 500;  // 5%  of net → Community Investors
// Merchant receives the remaining 65% of net

// ── Demo addresses (GlobalTextiles merchant from SeedDemo) ──
// Derived from keccak256("krexa.demo.merchant_a.v1") → vm.addr
const DEMO_MERCHANT: Address = '0xA1090527B7E0F5C649f1D0fcd40b2E7cA1eE7d2';

// Payer pool (x402 payment agents)
const DEMO_PAYERS: Record<string, Address> = {
  shopbot:   '0x3cF168E6B4e5A2F4ee0A9B2B43b2e5c9b7a3F1d' as Address,
  databot:   '0x9eA2b3C4D5E6F7A8B9C0D1E2F3A4B5C6D7E8F9A' as Address,
  codebot:   '0x5dB832A1C2D3E4F5A6B7C8D9E0F1A2B3C4D5E6' as Address,
  customer1: '0x2aE4B5C6D7E8F9A0B1C2D3E4F5A6B7C8D9E0F1' as Address,
};

// ── Payment split math ──────────────────────────────────────────────────────
export interface DemoPaymentSplit {
  total: number;
  platformFee: number;
  net: number;
  seniorTranche: number;
  liquidityPool: number;
  communityInvestors: number;
  merchantReceives: number;
}

function computeSplit(amountUSDC: number): DemoPaymentSplit {
  const total = amountUSDC;
  const platformFee = parseFloat((total * PLATFORM_FEE_BPS / 10000).toFixed(2));
  const net = parseFloat((total - platformFee).toFixed(2));
  const seniorTranche = parseFloat((net * SENIOR_BPS / 10000).toFixed(2));
  const liquidityPool = parseFloat((net * POOL_BPS / 10000).toFixed(2));
  const communityInvestors = parseFloat((net * COMMUNITY_BPS / 10000).toFixed(2));
  const merchantReceives = parseFloat((net - seniorTranche - liquidityPool - communityInvestors).toFixed(2));
  return { total, platformFee, net, seniorTranche, liquidityPool, communityInvestors, merchantReceives };
}

// ── POST /api/v1/demo/simulate-payment ──────────────────────────────────────
// No auth required — public demo endpoint.
// Computes the waterfall split and optionally submits on-chain via oracle service.
router.post('/simulate-payment', async (req, res, next) => {
  try {
    const rawAmount = Number(req.body?.amount);
    const amount = Number.isFinite(rawAmount) && rawAmount > 0
      ? Math.min(Math.max(Math.round(rawAmount * 100) / 100, 100), 10_000)
      : 2_500;

    const sourceKey = String(req.body?.source ?? 'shopbot').toLowerCase();
    const from: Address = DEMO_PAYERS[sourceKey] ?? DEMO_PAYERS['shopbot'];

    const split = computeSplit(amount);

    let txHash: string | null = null;
    let txUrl: string | null = null;
    let mode: 'live' | 'demo' = 'demo';

    try {
      // Amount in USDC base units (6 decimals)
      const amountRaw = String(BigInt(Math.round(amount)) * 1_000_000n);
      const result = await processPayment({ from, to: DEMO_MERCHANT, amount: amountRaw });
      if (result.txHash) {
        txHash = result.txHash;
        txUrl = `https://sepolia.basescan.org/tx/${result.txHash}`;
        mode = 'live';
      }
    } catch {
      // Oracle not configured or tx failed — stay in demo mode
    }

    res.json({ mode, txHash, txUrl, split });
  } catch (err) {
    next(err);
  }
});

export default router;
