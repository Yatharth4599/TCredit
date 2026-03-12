/**
 * demo.routes.ts
 *
 * Public demo endpoints — no auth required.
 * Lets the frontend simulate x402 payments for any seeded vault.
 *
 * POST /api/v1/demo/simulate-payment
 *   Body (vault-based):  { vaultAddress: string, amount: string }
 *   Body (legacy):       { amount: number, source?: string }
 *   Returns: { success, mode, txHash, txUrl, split, vault? }
 */

import { Router }        from 'express';
import type { Address }  from 'viem';

import { getVaultSnapshot }                                        from '../../chain/merchantVault.js';
import { processPayment }                                          from '../../services/oracle.service.js';
import { AppError }                                                from '../middleware/errorHandler.js';
import { publicClient, walletClient }                              from '../../chain/client.js';
import { addresses, VaultFactoryABI, MerchantVaultABI, LiquidityPoolABI } from '../../config/contracts.js';

const router = Router();

// ── Waterfall split constants (mirrors WaterfallLib.sol) ─────────────────────
const PLATFORM_FEE_BPS = 250;  // 2.5%
const SENIOR_BPS       = 2000; // 20% of net
const POOL_BPS         = 1000; // 10% of net
const COMMUNITY_BPS    = 500;  //  5% of net
// Merchant receives the remaining net (~65%)

// ── Vault state enum (matches MerchantVault.sol State) ───────────────────────
const VAULT_STATE_NAMES = ['fundraising', 'active', 'repaying', 'completed', 'defaulted', 'cancelled'] as const;
type VaultState = typeof VAULT_STATE_NAMES[number];

// States that can accept payments
const PAYABLE_STATES: VaultState[] = ['active', 'repaying'];

// ── Demo payer pool (deterministic addresses, no real funds needed) ───────────
// These are the synthetic payers we use when submitting demo payments on-chain.
const DEMO_PAYERS: Address[] = [
  '0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf' as Address, // shopbot
  '0x2B5AD5c4795c026514f8317c7a215E218DcCD6cF' as Address, // databot
  '0x6813Eb9362372EEF6200f3b1dbC3f819671cBA69' as Address, // codebot
];

// Legacy named payers (backward compat with { source } field)
const LEGACY_PAYERS: Record<string, Address> = {
  shopbot:   DEMO_PAYERS[0],
  databot:   DEMO_PAYERS[1],
  codebot:   DEMO_PAYERS[2],
  customer1: '0x1efF47bc3a10a45D4B230B5d10E37751FE6AA718' as Address,
};

// Default demo merchant for legacy calls (GlobalTextiles from SeedDemo)
const LEGACY_DEMO_MERCHANT: Address = '0xA1090527ac5c019Abc3989F405a5a63bB008008D';

// ── In-memory rate limiter (per vault + global) ───────────────────────────────
// Key → last allowed timestamp (ms).  Simple enough for demo load.
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_MS = 5_000; // 5 seconds
const GLOBAL_KEY   = '__global__';

function checkRateLimit(key: string): void {
  const now = Date.now();

  // Per-key check
  const last = rateLimitMap.get(key) ?? 0;
  if (now - last < RATE_LIMIT_MS) {
    const retryIn = Math.ceil((RATE_LIMIT_MS - (now - last)) / 1000);
    throw new AppError(429, `Rate limit: please wait ${retryIn}s before the next demo payment`);
  }

  // Global throttle (1 payment per second across all vaults)
  const lastGlobal = rateLimitMap.get(GLOBAL_KEY) ?? 0;
  if (now - lastGlobal < 1_000) {
    throw new AppError(429, 'Rate limit: too many demo payments, try again shortly');
  }

  rateLimitMap.set(key, now);
  rateLimitMap.set(GLOBAL_KEY, now);
}

// ── Waterfall split math ──────────────────────────────────────────────────────
interface PaymentSplit {
  total:              number;
  platformFee:        number;
  net:                number;
  senior:             number;
  pool:               number;
  community:          number;
  merchant:           number;
}

function computeSplit(amountUSDC: number): PaymentSplit {
  const total      = amountUSDC;
  const platformFee = +(total * PLATFORM_FEE_BPS / 10_000).toFixed(2);
  const net         = +(total - platformFee).toFixed(2);
  const senior      = +(net * SENIOR_BPS    / 10_000).toFixed(2);
  const pool        = +(net * POOL_BPS      / 10_000).toFixed(2);
  const community   = +(net * COMMUNITY_BPS / 10_000).toFixed(2);
  const merchant    = +(net - senior - pool - community).toFixed(2);
  return { total, platformFee, net, senior, pool, community, merchant };
}

// ── Amount parsing ────────────────────────────────────────────────────────────
// Accepts decimal string ("2500", "2500.50") or plain number.
// Clamps to [100, 50_000] USDC for demo safety.
function parseAmount(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    throw new AppError(400, 'amount must be a positive number (USDC units, e.g. "2500")');
  }
  return Math.min(Math.max(Math.round(n * 100) / 100, 100), 50_000);
}

// ── POST /api/v1/demo/simulate-payment ───────────────────────────────────────
router.post('/simulate-payment', async (req, res, next) => {
  try {
    const body = req.body ?? {};

    // ── Detect call shape ─────────────────────────────────────────────────────
    // New shape: { vaultAddress, amount }   → vault-based flow
    // Old shape: { amount, source? }         → legacy hardcoded merchant flow
    const isVaultBased = typeof body.vaultAddress === 'string' && body.vaultAddress.startsWith('0x');

    // ── Parse and clamp amount ────────────────────────────────────────────────
    const amountUSDC = parseAmount(body.amount);

    // ── Rate limit ────────────────────────────────────────────────────────────
    const rateLimitKey = isVaultBased ? body.vaultAddress.toLowerCase() : 'legacy';
    checkRateLimit(rateLimitKey);

    // ── Determine merchant (agent) and payer addresses ────────────────────────
    let agentAddress: Address;
    let vaultInfo: {
      address: string;
      state: string;
      targetAmount: string;
      totalRaised: string;
      totalRepaid: string;
    } | null = null;

    if (isVaultBased) {
      const vaultAddr = body.vaultAddress as Address;

      // 1. Fetch vault snapshot from chain
      let snap;
      try {
        snap = await getVaultSnapshot(vaultAddr);
      } catch (err) {
        throw new AppError(404, `Vault ${vaultAddr} not found on-chain: ${err instanceof Error ? err.message : String(err)}`);
      }

      // 2. Validate state
      const stateName = VAULT_STATE_NAMES[snap.state] ?? 'unknown';
      if (!PAYABLE_STATES.includes(stateName as VaultState)) {
        throw new AppError(400,
          `Vault is in state "${stateName}" — payments are only processed in states: ${PAYABLE_STATES.join(', ')}`
        );
      }

      agentAddress = snap.agent;
      vaultInfo = {
        address:      vaultAddr,
        state:        stateName,
        targetAmount: snap.targetAmount.toString(),
        totalRaised:  snap.totalRaised.toString(),
        totalRepaid:  snap.totalRepaid.toString(),
      };
    } else {
      // Legacy path — use hardcoded GlobalTextiles demo merchant
      agentAddress = LEGACY_DEMO_MERCHANT;
    }

    // Payer address: round-robin from pool (or source name for legacy)
    let fromAddress: Address;
    if (isVaultBased) {
      const idx = Math.floor(Date.now() / 1000) % DEMO_PAYERS.length;
      fromAddress = DEMO_PAYERS[idx];
    } else {
      const sourceKey = String(body.source ?? 'shopbot').toLowerCase();
      fromAddress = LEGACY_PAYERS[sourceKey] ?? LEGACY_PAYERS['shopbot'];
    }

    // ── Compute waterfall split ───────────────────────────────────────────────
    const split = computeSplit(amountUSDC);

    // ── Attempt live on-chain submission via oracle service ───────────────────
    let txHash: string | null = null;
    let txUrl:  string | null = null;
    let mode: 'live' | 'demo' = 'demo';
    let onChainError: string | null = null;

    try {
      // Convert USDC decimal to on-chain units (6 decimals)
      const amountRaw = String(BigInt(Math.round(amountUSDC)) * 1_000_000n);

      const result = await processPayment({
        from: fromAddress,
        to:   agentAddress,
        amount: amountRaw,
      });

      if (result.txHash) {
        txHash = result.txHash;
        txUrl  = `https://sepolia.basescan.org/tx/${result.txHash}`;
        mode   = 'live';
      } else if (result.status === 'failed') {
        onChainError = result.error ?? 'Oracle submission failed';
      }
    } catch (err) {
      // Oracle not configured or transaction failed — degrade to demo mode
      onChainError = err instanceof Error ? err.message : String(err);
    }

    res.json({
      success: true,
      mode,
      txHash,
      txUrl,
      ...(onChainError && { oracleError: onChainError }),
      waterfall: {
        platformFee: split.platformFee,
        senior:      split.senior,
        pool:        split.pool,
        community:   split.community,
        merchant:    split.merchant,
      },
      // Also expose as "split" for backward compat with X402Demo.tsx
      split: {
        total:              split.total,
        platformFee:        split.platformFee,
        net:                split.net,
        seniorTranche:      split.senior,
        liquidityPool:      split.pool,
        communityInvestors: split.community,
        merchantReceives:   split.merchant,
      },
      ...(vaultInfo && { vault: vaultInfo }),
    });
  } catch (err) {
    next(err);
  }
});

// ── Demo merchant used for the full lifecycle demo ────────────────────────────
const LIFECYCLE_DEMO_MERCHANT: Address = LEGACY_DEMO_MERCHANT;

// Helper: sleep for a given number of milliseconds
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ── POST /api/v1/demo/full-lifecycle ─────────────────────────────────────────
// Streams a Server-Sent Events response that orchestrates the full loan
// lifecycle: vault creation → funding → tranche release → N payments → done.
router.post('/full-lifecycle', async (req, res) => {
  // ── SSE handshake ─────────────────────────────────────────────────────────
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const send = (step: number, event: string, data: object) => {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ step, event, data })}\n\n`);
    }
  };

  const sendError = (message: string) => {
    send(0, 'error', { message });
    res.end();
  };

  try {
    if (!walletClient) {
      sendError('Oracle wallet not configured (ORACLE_PRIVATE_KEY missing)');
      return;
    }

    const body = req.body ?? {};
    const merchantAddress: Address = (
      typeof body.merchantAddress === 'string' && body.merchantAddress.startsWith('0x')
        ? body.merchantAddress
        : LIFECYCLE_DEMO_MERCHANT
    ) as Address;

    const loanUSDC = Math.min(Math.max(Number(body.loanAmount ?? 5000), 1000), 10_000);
    const numPay   = Math.min(Math.max(Number(body.numPayments  ?? 10),    3),      20);

    const targetWei = BigInt(loanUSDC) * 1_000_000n; // USDC has 6 decimals

    // ────────────────────────────────────────────────────────────────────────
    // STEP 1 — Create vault (or reuse existing one for this agent)
    // ────────────────────────────────────────────────────────────────────────
    send(1, 'step_start', { message: 'Creating vault on Base Sepolia…' });

    let vaultAddress: Address;
    let createTxHash: string | null = null;

    try {
      const createHash = await walletClient.writeContract({
        address:      addresses.vaultFactory,
        abi:          VaultFactoryABI,
        functionName: 'createVault',
        args: [
          merchantAddress,
          targetWei,
          1200n,                                                     // 12% APY
          BigInt(90 * 24 * 3600),                                   // 3-month term
          1n,                                                        // 1 tranche (simple)
          2000,                                                      // repaymentRateBps
          60n,                                                       // minPaymentInterval (60 s)
          0n,                                                        // maxSinglePayment (no cap)
          100,                                                       // lateFeeBps (1%)
          BigInt(86400),                                             // gracePeriod (1 day)
          BigInt(Math.floor(Date.now() / 1000) + 30 * 24 * 3600),  // fundraising deadline
        ],
      });

      const createReceipt = await publicClient.waitForTransactionReceipt({ hash: createHash });
      createTxHash = createHash;

      // Extract the new vault address from the VaultCreated event log
      // VaultCreated(address indexed agent, address indexed vault, …)
      //   topics[0] = selector, topics[1] = agent, topics[2] = vault
      const factoryLog = createReceipt.logs.find(
        (l) => l.address.toLowerCase() === addresses.vaultFactory.toLowerCase()
      );
      if (!factoryLog || (factoryLog.topics?.length ?? 0) < 3) {
        sendError('Could not find VaultCreated event in transaction receipt');
        return;
      }
      const vaultTopic = factoryLog.topics[2];
      if (!vaultTopic) {
        sendError('VaultCreated event missing vault topic in receipt');
        return;
      }
      vaultAddress = `0x${vaultTopic.slice(-40)}` as Address;
    } catch (createErr) {
      const errMsg = createErr instanceof Error ? createErr.message : String(createErr);
      if (!errMsg.includes('VaultAlreadyExists')) {
        sendError(`Vault creation failed: ${errMsg}`);
        return;
      }

      // VaultAlreadyExists — look up the existing vault for this agent
      const existing = await publicClient.readContract({
        address:      addresses.vaultFactory,
        abi:          VaultFactoryABI,
        functionName: 'agentToVault',
        args:         [merchantAddress],
      }) as Address;

      if (!existing || existing === '0x0000000000000000000000000000000000000000') {
        sendError('Vault already exists but could not look up its address');
        return;
      }
      vaultAddress = existing;
    }

    send(1, 'vault_created', {
      vaultAddress,
      txHash: createTxHash,
      txUrl:  createTxHash ? `https://sepolia.basescan.org/tx/${createTxHash}` : null,
      reused: createTxHash === null,
    });
    await sleep(800);

    // ────────────────────────────────────────────────────────────────────────
    // STEP 2 — Fund vault: 60% SeniorPool + 40% GeneralPool
    // ────────────────────────────────────────────────────────────────────────
    send(2, 'step_start', { message: 'Allocating capital from liquidity pools…' });

    const seniorAmt  = (targetWei * 60n) / 100n;
    const generalAmt = targetWei - seniorAmt;

    let fundingTxHash = createTxHash ?? vaultAddress; // fallback

    try {
      const seniorHash = await walletClient.writeContract({
        address:      addresses.seniorPool,
        abi:          LiquidityPoolABI,
        functionName: 'allocateToVault',
        args:         [vaultAddress, seniorAmt],
      });
      await publicClient.waitForTransactionReceipt({ hash: seniorHash });

      const generalHash = await walletClient.writeContract({
        address:      addresses.generalPool,
        abi:          LiquidityPoolABI,
        functionName: 'allocateToVault',
        args:         [vaultAddress, generalAmt],
      });
      await publicClient.waitForTransactionReceipt({ hash: generalHash });

      const completeHash = await walletClient.writeContract({
        address:      vaultAddress,
        abi:          MerchantVaultABI,
        functionName: 'completeFundraisingManual',
      });
      const completeReceipt = await publicClient.waitForTransactionReceipt({ hash: completeHash });
      fundingTxHash = completeHash;

      send(2, 'vault_funded', {
        totalFunded: loanUSDC,
        seniorAmount:  +((loanUSDC * 0.60).toFixed(2)),
        generalAmount: +((loanUSDC * 0.40).toFixed(2)),
        txHash: completeHash,
        txUrl:  `https://sepolia.basescan.org/tx/${completeHash}`,
        status: completeReceipt.status,
      });
    } catch (fundErr) {
      // Pool allocation may fail if oracle lacks admin role — degrade to demo mode
      send(2, 'vault_funded', {
        totalFunded:   loanUSDC,
        seniorAmount:  +((loanUSDC * 0.60).toFixed(2)),
        generalAmount: +((loanUSDC * 0.40).toFixed(2)),
        txHash:  null,
        txUrl:   null,
        mode:    'demo',
        warning: `Pool allocation failed (${fundErr instanceof Error ? fundErr.message : String(fundErr)}); continuing in demo mode`,
      });
    }
    await sleep(800);

    // ────────────────────────────────────────────────────────────────────────
    // STEP 3 — Release tranche (disburse to merchant)
    // ────────────────────────────────────────────────────────────────────────
    send(3, 'step_start', { message: 'Releasing tranche — disbursing funds to merchant…' });

    let releaseTxHash: string | null = null;
    try {
      const releaseHash = await walletClient.writeContract({
        address:      vaultAddress,
        abi:          MerchantVaultABI,
        functionName: 'releaseTranche',
      });
      await publicClient.waitForTransactionReceipt({ hash: releaseHash });
      releaseTxHash = releaseHash;
    } catch {
      // May fail if vault isn't in active state — degrade gracefully
    }

    send(3, 'tranche_released', {
      amount:  loanUSDC,
      txHash:  releaseTxHash,
      txUrl:   releaseTxHash ? `https://sepolia.basescan.org/tx/${releaseTxHash}` : null,
    });
    await sleep(800);

    // ────────────────────────────────────────────────────────────────────────
    // STEP 4 — Process N repayment payments via PaymentRouter
    // ────────────────────────────────────────────────────────────────────────
    send(4, 'step_start', { message: `Sending ${numPay} x402 repayment transactions…` });

    // Total to repay: principal + 12% APY × (3/12) months = 3% interest
    const interestRate   = 0.12 * (3 / 12); // 3%
    const totalToRepay   = +(loanUSDC * (1 + interestRate)).toFixed(2);
    const paymentAmt     = +(totalToRepay / numPay).toFixed(2);
    let   totalRepaid    = 0;
    let   payerIdx       = 0;

    for (let i = 1; i <= numPay; i++) {
      const isLast    = i === numPay;
      const thisAmt   = isLast ? +(totalToRepay - totalRepaid).toFixed(2) : paymentAmt;
      const amountRaw = String(BigInt(Math.round(thisAmt * 100)) * 10_000n); // USDC 6 decimals
      const split     = computeSplit(thisAmt);

      send(4, `payment_${i}_start`, { paymentNumber: i, amount: thisAmt });

      const fromAddr  = DEMO_PAYERS[payerIdx % DEMO_PAYERS.length];
      payerIdx++;

      let txHash:  string | null = null;
      let txUrl:   string | null = null;
      let mode: 'live' | 'demo' = 'demo';

      try {
        const result = await processPayment({
          from:   fromAddr,
          to:     merchantAddress,
          amount: amountRaw,
        });
        if (result.txHash) {
          txHash = result.txHash;
          txUrl  = `https://sepolia.basescan.org/tx/${result.txHash}`;
          mode   = 'live';
        }
      } catch {
        // Fallback: payment is in demo mode (no on-chain tx)
      }

      totalRepaid        = +(totalRepaid + thisAmt).toFixed(2);
      const outstanding  = +(Math.max(totalToRepay - totalRepaid, 0)).toFixed(2);

      send(4, `payment_${i}`, {
        paymentNumber: i,
        amount:        thisAmt,
        totalRepaid,
        outstanding,
        progressPct:   +((totalRepaid / totalToRepay) * 100).toFixed(1),
        waterfall: {
          platformFee: split.platformFee,
          senior:      split.senior,
          pool:        split.pool,
          community:   split.community,
          merchant:    split.merchant,
        },
        txHash,
        txUrl,
        mode,
      });

      if (i < numPay) await sleep(2_500);
    }

    // ────────────────────────────────────────────────────────────────────────
    // STEP 5 — Loan complete
    // ────────────────────────────────────────────────────────────────────────
    await sleep(500);

    const totalInterest    = +(totalToRepay - loanUSDC).toFixed(2);
    const totalNetAfterFee = +(totalToRepay * (1 - 0.025)).toFixed(2);
    const seniorReturns    = +(totalNetAfterFee * 0.20).toFixed(2);
    const generalReturns   = +(totalNetAfterFee * 0.10).toFixed(2);
    const communityReturns = +(totalNetAfterFee * 0.05).toFixed(2);
    const merchantReturns  = +(totalNetAfterFee * 0.65).toFixed(2);
    const platformFeeTotal = +(totalToRepay * 0.025).toFixed(2);

    send(5, 'loan_repaid', {
      status:         'REPAID',
      loanAmount:     loanUSDC,
      totalRepaid:    totalToRepay,
      totalInterest,
      numPayments:    numPay,
      vaultAddress,
      returns: {
        senior:      seniorReturns,
        general:     generalReturns,
        community:   communityReturns,
        merchant:    merchantReturns,
        platformFee: platformFeeTotal,
      },
    });

    res.end();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ step: 0, event: 'error', data: { message: msg } })}\n\n`);
      res.end();
    }
  }
});

export default router;
