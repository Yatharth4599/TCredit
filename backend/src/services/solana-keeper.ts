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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 2_000;          // 2 seconds — tight loop for keepers

// BUG-038: These match on-chain constants from krexa-common/src/constants.rs
// TODO: Read from on-chain VaultConfig PDA at keeper startup for production
// For now, kept in sync manually with on-chain values.
const HF_WARNING_BPS   = 13_000;         // 1.30x  (on-chain: HF_WARNING)
const HF_DANGER_BPS    = 12_000;         // 1.20x  (on-chain: HF_DANGER)
const HF_LIQUIDATION_BPS = 10_500;       // 1.05x  (on-chain: HF_LIQUIDATION)
const USDC_MINT = new PublicKey(env.SOLANA_USDC_MINT);

// ---------------------------------------------------------------------------
// Submit a signed transaction
// ---------------------------------------------------------------------------

async function sendAndConfirm(ix: ReturnType<typeof buildDeleverage>): Promise<string | null> {
  if (!keeperSolanaKeypair) return null;
  try {
    const { blockhash } = await solanaConnection.getLatestBlockhash('confirmed');
    const { Transaction } = await import('@solana/web3.js');
    const tx = new Transaction({ recentBlockhash: blockhash, feePayer: keeperSolanaKeypair.publicKey });
    tx.add(ix);
    tx.sign(keeperSolanaKeypair);
    const sig = await solanaConnection.sendRawTransaction(tx.serialize(), { skipPreflight: false });
    await solanaConnection.confirmTransaction(sig, 'confirmed');
    return sig;
  } catch (err) {
    console.error('[SolanaKeeper] sendAndConfirm error:', err instanceof Error ? err.message : err);
    return null;
  }
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
    // non-fatal
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
        collateralValue: wallet.collateralShares, // shares ≈ USDC for accounting
      },
    });
  } catch {
    // Don't let DB errors block on-chain actions
  }

  if (wallet.isFrozen || wallet.isLiquidating) return;

  if (hf < HF_LIQUIDATION_BPS && wallet.creditDrawn > 0n) {
    console.log(`[SolanaKeeper] LIQUIDATE agent ${agentKey} HF=${hf}`);
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
        console.log(`[SolanaKeeper] Liquidated ${agentKey} — sig: ${sig}`);
        await prisma.solanaAgentWallet.update({
          where: { agentPubkey: agentKey },
          data: { isLiquidating: true, healthFactorBps: hf },
        }).catch(() => {});
      }
    }
    return;
  }

  if (hf < HF_DANGER_BPS && wallet.creditDrawn > 0n) {
    console.log(`[SolanaKeeper] DELEVERAGE agent ${agentKey} HF=${hf}`);
    if (keeperSolanaKeypair) {
      const ixn = buildDeleverage({
        agent: new PublicKey(wallet.agent),
        keeper: keeperSolanaKeypair.publicKey,
      });
      const sig = await sendAndConfirm(ixn);
      if (sig) {
        console.log(`[SolanaKeeper] Deleveraged ${agentKey} — sig: ${sig}`);
        await prisma.solanaAgentWallet.update({
          where: { agentPubkey: agentKey },
          data: { isFrozen: true, healthFactorBps: hf },
        }).catch(() => {});
      }
    }
    return;
  }

  if (hf < HF_WARNING_BPS && wallet.creditDrawn > 0n) {
    console.warn(`[SolanaKeeper] WARNING: agent ${agentKey} HF=${hf} (below 1.30)`);
  }

  // Sync health to DB (no-op create/update)
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
  }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Main Keeper Cycle
// ---------------------------------------------------------------------------

async function runKeeperCycle(): Promise<void> {
  let wallets: Awaited<ReturnType<typeof getAllAgentWallets>>;
  try {
    wallets = await getAllAgentWallets();
  } catch (err) {
    console.error('[SolanaKeeper] Failed to fetch wallets:', err instanceof Error ? err.message : err);
    return;
  }

  if (wallets.length === 0) return;

  // Process wallets with active credit lines sequentially to avoid RPC floods
  for (const { pubkey, wallet } of wallets) {
    try {
      await processWallet(pubkey, wallet);
    } catch (err) {
      console.error(`[SolanaKeeper] Error processing ${pubkey.toBase58()}:`, err instanceof Error ? err.message : err);
    }
  }
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

let keeperInterval: NodeJS.Timeout | null = null;

export function startSolanaKeeper(): void {
  if (keeperInterval) return;

  if (!keeperSolanaKeypair) {
    console.log('[SolanaKeeper] Not started: SOLANA_KEEPER_PRIVATE_KEY not set');
  } else {
    console.log(`[SolanaKeeper] Keeper started (${keeperSolanaKeypair.publicKey.toBase58()})`);
  }

  // Run once immediately
  runKeeperCycle().catch((err) => console.error('[SolanaKeeper] Initial run error:', err));

  keeperInterval = setInterval(() => {
    runKeeperCycle().catch((err) => console.error('[SolanaKeeper] Cycle error:', err));
  }, POLL_INTERVAL_MS);
}

export function stopSolanaKeeper(): void {
  if (keeperInterval) {
    clearInterval(keeperInterval);
    keeperInterval = null;
    console.log('[SolanaKeeper] Stopped');
  }
}

export function getSolanaKeeperHealth() {
  return {
    running: keeperInterval !== null,
    keeperConfigured: !!keeperSolanaKeypair,
    keeperAddress: keeperSolanaKeypair?.publicKey.toBase58() ?? null,
    pollIntervalMs: POLL_INTERVAL_MS,
    thresholds: { warning: HF_WARNING_BPS, deleverage: HF_DANGER_BPS, liquidate: HF_LIQUIDATION_BPS },
  };
}
