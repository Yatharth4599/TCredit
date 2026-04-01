import type { Address } from 'viem';
import { publicClient, walletClient, oracleAccount } from '../chain/client.js';
import { MerchantVaultABI, addresses, PaymentRouterABI } from '../config/contracts.js';
import { getAllVaults } from '../chain/vaultFactory.js';
import { prisma } from '../config/prisma.js';

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getVaultState(vault: Address): Promise<string> {
  const raw = await publicClient.readContract({
    address: vault,
    abi: MerchantVaultABI,
    functionName: 'state',
  }) as number;
  const STATES: Record<number, string> = {
    0: 'fundraising', 1: 'active', 2: 'repaying',
    3: 'completed', 4: 'defaulted', 5: 'cancelled',
  };
  return STATES[raw] ?? 'unknown';
}

async function callVaultFunction(vault: Address, functionName: 'autoCancelExpired' | 'markDefault'): Promise<string | null> {
  if (!walletClient || !oracleAccount) return null;
  try {
    // Simulate first
    await publicClient.simulateContract({
      address: vault,
      abi: MerchantVaultABI,
      functionName,
      account: oracleAccount,
    });
    const txHash = await walletClient.writeContract({
      address: vault,
      abi: MerchantVaultABI,
      functionName,
    });
    await publicClient.waitForTransactionReceipt({ hash: txHash, confirmations: 1 });
    return txHash;
  } catch {
    // Vault not eligible — simulation reverted, skip silently
    return null;
  }
}

// ---------------------------------------------------------------------------
// Keeper Tasks
// ---------------------------------------------------------------------------

async function cancelExpiredVaults(vaults: Address[]): Promise<void> {
  // Check all vaults; autoCancelExpired() will revert on-chain if not eligible.
  // Note: async functions must not be used inside .filter() — they always return a truthy
  // Promise. State filtering happens inside the loop below via getVaultState().
  const fundraising = vaults;

  for (const vault of fundraising) {
    const state = await getVaultState(vault);
    if (state !== 'fundraising') continue;

    const txHash = await callVaultFunction(vault, 'autoCancelExpired');
    if (txHash) {
      console.log(`[Keeper] autoCancelExpired: vault ${vault} cancelled — tx ${txHash}`);
    }
  }
}

async function markDefaultedVaults(vaults: Address[]): Promise<void> {
  for (const vault of vaults) {
    const state = await getVaultState(vault);
    if (state !== 'repaying') continue;

    // Check shouldDefault view
    const should = await publicClient.readContract({
      address: vault,
      abi: MerchantVaultABI,
      functionName: 'shouldDefault',
    }) as boolean;

    if (!should) continue;

    const txHash = await callVaultFunction(vault, 'markDefault');
    if (txHash) {
      console.log(`[Keeper] markDefault: vault ${vault} defaulted — tx ${txHash}`);
      // Deactivate settlement on PaymentRouter so x402 payments bypass the defaulted vault
      await deactivateSettlement(vault);
    }
  }
}

async function deactivateSettlement(vault: Address): Promise<void> {
  if (!walletClient || !oracleAccount) return;
  try {
    // Get the agent address from the vault
    const agent = await publicClient.readContract({
      address: vault,
      abi: MerchantVaultABI,
      functionName: 'agent',
    }) as Address;

    await publicClient.simulateContract({
      address: addresses.paymentRouter,
      abi: PaymentRouterABI,
      functionName: 'deactivateSettlement',
      args: [agent],
      account: oracleAccount,
    });
    const txHash = await walletClient.writeContract({
      address: addresses.paymentRouter,
      abi: PaymentRouterABI,
      functionName: 'deactivateSettlement',
      args: [agent],
    });
    console.log(`[Keeper] deactivateSettlement: agent ${agent} — tx ${txHash}`);
  } catch (err) {
    // Settlement may not be active — log and continue
    console.warn(`[Keeper] deactivateSettlement failed for vault ${vault}: ${err instanceof Error ? err.message : err}`);
  }
}

// ---------------------------------------------------------------------------
// Main Keeper Cycle
// ---------------------------------------------------------------------------

async function runKeeperCycle(): Promise<void> {
  let vaults: Address[];
  try {
    vaults = (await getAllVaults()) as Address[];
  } catch (err) {
    console.error('[Keeper] Failed to get vault list:', err);
    return;
  }

  if (vaults.length === 0) return;

  await Promise.allSettled([
    cancelExpiredVaults(vaults),
    markDefaultedVaults(vaults),
  ]);
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export async function getKeeperHealth() {
  return {
    running: keeperInterval !== null,
    walletConfigured: !!walletClient,
    pollIntervalMs: POLL_INTERVAL_MS,
    nextRunIn: keeperInterval
      ? `${Math.round(POLL_INTERVAL_MS / 60000)} min`
      : 'not running',
  };
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

let keeperInterval: NodeJS.Timeout | null = null;

export function startKeeper(): void {
  if (!walletClient) {
    console.log('[Keeper] Not started: ORACLE_PRIVATE_KEY not set (keeper needs wallet to submit txs)');
    return;
  }

  console.log('[Keeper] Keeper service started (interval: 5 min)');

  // Run once immediately, then on interval
  runKeeperCycle().catch((err) => console.error('[Keeper] Initial run error:', err));

  keeperInterval = setInterval(() => {
    runKeeperCycle().catch((err) => console.error('[Keeper] Cycle error:', err));
  }, POLL_INTERVAL_MS);
}

export function stopKeeper(): void {
  if (keeperInterval) {
    clearInterval(keeperInterval);
    keeperInterval = null;
    console.log('[Keeper] Keeper service stopped');
  }
}
