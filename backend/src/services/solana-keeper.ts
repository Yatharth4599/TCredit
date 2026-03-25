/**
 * Solana Keeper Service
 *
 * Runs every 2 s.  For each active AgentWallet:
 *  - Reads on-chain health_factor_bps
 *  - HF < 1.05  (10500 bps): liquidate
 *  - HF < 1.20  (12000 bps): deleverage (freeze + flag)
 *  - HF < 1.30  (13000 bps): log warning
 *  - Stores a HealthSnapshot to DB for every wallet monitored
 */

import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { solanaConnection, keeperSolanaKeypair } from '../chain/solana/connection.js';
import { getAllAgentWallets, readTokenBalance, AgentWallet } from '../chain/solana/reader.js';
import { buildCheckHealth, buildDeleverage, buildLiquidate } from '../chain/solana/builder.js';
import { walletUsdcPda } from '../chain/solana/programs.js';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { withRetry } from '../utils/retry.js';
import { CircuitBreaker, CircuitOpenError } from '../utils/circuit-breaker.js';
import { createLogger } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 2_000;          // 2 seconds — tight loop for keepers
const HF_WARNING_BPS   = 13_000;         // 1.30x
const HF_DANGER_BPS    = 12_000;         // 1.20x — deleverage
const HF_LIQUIDATION_BPS = 10_500;       // 1.05x — liquidate
const USDC_MINT = new PublicKey(env.SOLANA_USDC_MINT);

const log = createLogger('SolanaKeeper');

// Circuit breaker for RPC calls — opens after 5 consecutive failures, resets after 60s
const rpcBreaker = new CircuitBreaker({
  threshold: 5,
  resetMs: 60_000,
  label: 'solana-keeper-rpc',
  onStateChange: (from, to, label) => {
    log.warn(`Circuit breaker state change`, { label, from, to });
  },
});

// Track metrics
let cycleCount = 0;
let lastCycleAt = 0;
let lastCycleDurationMs = 0;
let consecutiveErrors = 0;

// ---------------------------------------------------------------------------
// Submit a signed transaction with retry
// ---------------------------------------------------------------------------

async function sendAndConfirm(ix: ReturnType<typeof buildDeleverage>): Promise<string | null> {
  if (!keeperSolanaKeypair) return null;

  return withRetry(
    async () => {
      return rpcBreaker.exec(async () => {
        const { blockhash } = await solanaConnection.getLatestBlockhash('confirmed');
        const { Transaction } = await import('@solana/web3.js');
        const tx = new Transaction({ recentBlockhash: blockhash, feePayer: keeperSolanaKeypair!.publicKey });
        tx.add(ix);
        tx.sign(keeperSolanaKeypair!);
        const sig = await solanaConnection.sendRawTransaction(tx.serialize(), { skipPreflight: false });
        await solanaConnection.confirmTransaction(sig, 'confirmed');
        return sig;
      });
    },
    {
      maxAttempts: 3,
      baseMs: 2_000,
      maxMs: 15_000,
      onRetry: (attempt, error, delayMs) => {
        log.warn('Transaction retry', { attempt, error: error.message, delayMs });
      },
    },
  ).catch((err) => {
    if (err instanceof CircuitOpenError) {
      log.warn('RPC circuit open, skipping transaction', { retryAfterMs: err.retryAfterMs });
    } else {
      log.error('sendAndConfirm failed after retries', { error: err instanceof Error ? err.message : String(err) });
    }
    return null;
  });
}

// ---------------------------------------------------------------------------
// Process a single wallet
// ---------------------------------------------------------------------------

async function processWallet(agentPubkey: PublicKey, wallet: AgentWallet): Promise<void> {
  const hf = wallet.healthFactorBps;
  const agentKey = agentPubkey.toBase58();

  // Read live USDC balance
  let walletUsdcBalance = 0n;
  try {
    walletUsdcBalance = await readTokenBalance(wallet.walletUsdc);
  } catch {
    // non-fatal — balance read can fail if account doesn't exist yet
  }

  // Persist snapshot
  try {
    await prisma.healthSnapshot.create({
      data: {
        agentPubkey: agentKey,
        healthFactorBps: hf,
        creditDrawn: wallet.creditDrawn,
        totalDebt: wallet.totalDebt,
        walletUsdc: walletUsdcBalance,
        collateralValue: wallet.collateralShares,
      },
    });
  } catch (err) {
    log.warn('Failed to persist health snapshot', { agent: agentKey, error: err instanceof Error ? err.message : String(err) });
  }

  if (wallet.isFrozen || wallet.isLiquidating) return;

  if (hf < HF_LIQUIDATION_BPS && wallet.creditDrawn > 0n) {
    log.info('LIQUIDATE triggered', { agent: agentKey, healthFactorBps: hf });
    if (keeperSolanaKeypair) {
      const keeperUsdc = getAssociatedTokenAddressSync(USDC_MINT, keeperSolanaKeypair.publicKey);
      const ixn = buildLiquidate({
        agent: new PublicKey(wallet.agent),
        agentOwner: new PublicKey(wallet.owner),
        keeper: keeperSolanaKeypair.publicKey,
        keeperUsdc,
      });
      const sig = await sendAndConfirm(ixn);
      if (sig) {
        log.info('Liquidation submitted', { agent: agentKey, txSignature: sig });
        await prisma.solanaAgentWallet.update({
          where: { agentPubkey: agentKey },
          data: { isLiquidating: true, healthFactorBps: hf },
        }).catch((err) => {
          log.warn('Failed to update liquidation state in DB', { agent: agentKey, error: err instanceof Error ? err.message : String(err) });
        });
      }
    }
    return;
  }

  if (hf < HF_DANGER_BPS && wallet.creditDrawn > 0n) {
    log.info('DELEVERAGE triggered', { agent: agentKey, healthFactorBps: hf });
    if (keeperSolanaKeypair) {
      const ixn = buildDeleverage({
        agent: new PublicKey(wallet.agent),
        keeper: keeperSolanaKeypair.publicKey,
      });
      const sig = await sendAndConfirm(ixn);
      if (sig) {
        log.info('Deleverage submitted', { agent: agentKey, txSignature: sig });
        await prisma.solanaAgentWallet.update({
          where: { agentPubkey: agentKey },
          data: { isFrozen: true, healthFactorBps: hf },
        }).catch((err) => {
          log.warn('Failed to update deleverage state in DB', { agent: agentKey, error: err instanceof Error ? err.message : String(err) });
        });
      }
    }
    return;
  }

  if (hf < HF_WARNING_BPS && wallet.creditDrawn > 0n) {
    log.warn('Health factor below warning threshold', { agent: agentKey, healthFactorBps: hf });
  }

  // Sync health to DB
  await prisma.solanaAgentWallet.upsert({
    where: { agentPubkey: agentKey },
    create: {
      agentPubkey: agentKey,
      ownerPubkey: wallet.owner.toBase58(),
      ownerType: wallet.ownerType === 1 ? 'multisig' : 'eoa',
      creditLevel: wallet.creditLevel,
      creditDrawn: wallet.creditDrawn,
      creditLimit: wallet.creditLimit,
      totalDebt: wallet.totalDebt,
      collateralShares: wallet.collateralShares,
      healthFactorBps: hf,
      dailySpendLimit: wallet.dailySpendLimit,
      isFrozen: wallet.isFrozen,
      isLiquidating: wallet.isLiquidating,
      totalTrades: wallet.totalTrades,
      totalVolume: wallet.totalVolume,
      totalRepaid: wallet.totalRepaid,
      lastHealthCheck: new Date(Number(wallet.lastHealthCheck) * 1000),
    },
    update: {
      ownerPubkey: wallet.owner.toBase58(),
      ownerType: wallet.ownerType === 1 ? 'multisig' : 'eoa',
      healthFactorBps: hf,
      creditDrawn: wallet.creditDrawn,
      totalDebt: wallet.totalDebt,
      isFrozen: wallet.isFrozen,
      isLiquidating: wallet.isLiquidating,
      lastHealthCheck: new Date(Number(wallet.lastHealthCheck) * 1000),
    },
  }).catch((err) => {
    log.warn('Failed to upsert wallet state', { agent: agentKey, error: err instanceof Error ? err.message : String(err) });
  });
}

// ---------------------------------------------------------------------------
// Main Keeper Cycle
// ---------------------------------------------------------------------------

async function runKeeperCycle(): Promise<void> {
  const startMs = Date.now();
  cycleCount++;

  let wallets: Awaited<ReturnType<typeof getAllAgentWallets>>;
  try {
    wallets = await rpcBreaker.exec(() => getAllAgentWallets());
  } catch (err) {
    if (err instanceof CircuitOpenError) {
      log.warn('RPC circuit open, skipping keeper cycle', { retryAfterMs: err.retryAfterMs });
    } else {
      log.error('Failed to fetch wallets', { error: err instanceof Error ? err.message : String(err) });
      consecutiveErrors++;
    }
    return;
  }

  if (wallets.length === 0) return;

  consecutiveErrors = 0;

  // Process wallets with active credit lines sequentially to avoid RPC floods
  for (const { pubkey, wallet } of wallets) {
    try {
      await processWallet(pubkey, wallet);
    } catch (err) {
      log.error('Error processing wallet', {
        agent: pubkey.toBase58(),
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  lastCycleAt = Date.now();
  lastCycleDurationMs = lastCycleAt - startMs;

  if (cycleCount % 30 === 0) {
    // Log stats every ~60s
    log.info('Keeper cycle stats', {
      cycle: cycleCount,
      walletsProcessed: wallets.length,
      durationMs: lastCycleDurationMs,
      rpcBreaker: rpcBreaker.getStatus().state,
    });
  }
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

let keeperInterval: NodeJS.Timeout | null = null;

export function startSolanaKeeper(): void {
  if (keeperInterval) return;

  if (!keeperSolanaKeypair) {
    log.info('Not started: SOLANA_KEEPER_PRIVATE_KEY not set');
  } else {
    log.info('Keeper started', { address: keeperSolanaKeypair.publicKey.toBase58() });
  }

  // Run once immediately
  runKeeperCycle().catch((err) => log.error('Initial run error', { error: err instanceof Error ? err.message : String(err) }));

  keeperInterval = setInterval(() => {
    runKeeperCycle().catch((err) => log.error('Cycle error', { error: err instanceof Error ? err.message : String(err) }));
  }, POLL_INTERVAL_MS);
}

export function stopSolanaKeeper(): void {
  if (keeperInterval) {
    clearInterval(keeperInterval);
    keeperInterval = null;
    log.info('Stopped');
  }
}

export function getSolanaKeeperHealth() {
  return {
    running: keeperInterval !== null,
    keeperConfigured: !!keeperSolanaKeypair,
    keeperAddress: keeperSolanaKeypair?.publicKey.toBase58() ?? null,
    pollIntervalMs: POLL_INTERVAL_MS,
    thresholds: { warning: HF_WARNING_BPS, deleverage: HF_DANGER_BPS, liquidate: HF_LIQUIDATION_BPS },
    cycleCount,
    lastCycleAt: lastCycleAt ? new Date(lastCycleAt).toISOString() : null,
    lastCycleDurationMs,
    consecutiveErrors,
    circuitBreaker: rpcBreaker.getStatus(),
  };
}
