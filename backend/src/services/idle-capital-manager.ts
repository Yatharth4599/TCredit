/**
 * Idle Capital Manager
 *
 * Routes idle vault USDC (the ~20% utilization buffer) into Meteora Dynamic
 * Vaults for yield.  Runs as a background service that periodically rebalances
 * capital between the Krexa vault and Meteora.
 *
 * Resilient by design — if the Meteora SDK is not installed or the vault
 * address is not configured, the manager gracefully degrades to a no-op.
 */

import {
  Connection,
  Keypair,
  PublicKey,
  type TransactionSignature,
} from '@solana/web3.js';
import { getAccount, getAssociatedTokenAddress } from '@solana/spl-token';
import { createLogger } from '../utils/logger.js';
import { env } from '../config/env.js';

const log = createLogger('IdleCapital');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IdleCapitalConfig {
  connection: Connection;
  vaultAuthority: Keypair;
  usdcMint: PublicKey;
  krexaVaultToken: PublicKey;
  meteoraVaultAddress: PublicKey;
  utilizationCapBps: number;   // e.g. 8000 = 80%
  minIdleBuffer: number;       // minimum USDC kept liquid (human units)
  pollIntervalMs: number;
}

interface AllocationResult {
  totalDeposits: number;
  deployedCredit: number;
  currentIdle: number;
  optimalInMeteora: number;
  currentInMeteora: number;
  action: 'deposit' | 'withdraw' | 'none';
  amount: number;
}

// ---------------------------------------------------------------------------
// Class
// ---------------------------------------------------------------------------

export class IdleCapitalManager {
  private config: IdleCapitalConfig;
  private meteoraVault: any | null = null;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private lastRebalance: Date | null = null;

  constructor(config: IdleCapitalConfig) {
    this.config = config;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    try {
      // Dynamic import — allows graceful failure when SDK is not installed
      const { default: VaultImpl } = await import('@meteora-ag/vault-sdk' as any);
      this.meteoraVault = await VaultImpl.create(
        this.config.connection,
        this.config.meteoraVaultAddress,
      );
      log.info('Meteora vault initialised', {
        vault: this.config.meteoraVaultAddress.toBase58(),
      });
    } catch (err) {
      log.warn('Meteora SDK unavailable — idle capital routing disabled', {
        error: err instanceof Error ? err.message : String(err),
      });
      this.meteoraVault = null;
    }
  }

  start(): void {
    if (!this.meteoraVault) {
      log.info('Skipping idle-capital polling (Meteora vault not initialised)');
      return;
    }

    // Initial rebalance
    this.rebalance().catch((err) =>
      log.error('Initial rebalance failed', {
        error: err instanceof Error ? err.message : String(err),
      }),
    );

    this.intervalHandle = setInterval(() => {
      this.rebalance().catch((err) =>
        log.error('Rebalance cycle failed', {
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }, this.config.pollIntervalMs);

    log.info('Idle-capital polling started', {
      intervalMs: this.config.pollIntervalMs,
    });
  }

  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      log.info('Idle-capital polling stopped');
    }
  }

  // ── Core Logic ────────────────────────────────────────────────────────

  async calculateOptimalAllocation(): Promise<AllocationResult> {
    const totalDeposits = await this.getVaultUsdcBalance();
    const deployedCredit = await this.getDeployedCredit();
    const currentIdle = totalDeposits - deployedCredit;
    const currentInMeteora = await this.getMeteoraBalance();

    // Keep at least max(5% of total deposits, minIdleBuffer) as liquid
    const minLiquid = Math.max(totalDeposits * 0.05, this.config.minIdleBuffer);

    // The amount that can go to Meteora is whatever idle capital exceeds the
    // minimum liquid buffer.
    const availableForMeteora = Math.max(0, currentIdle - minLiquid);
    const optimalInMeteora = availableForMeteora;

    const delta = optimalInMeteora - currentInMeteora;

    let action: 'deposit' | 'withdraw' | 'none' = 'none';
    let amount = 0;

    if (delta > 1) {
      action = 'deposit';
      amount = delta;
    } else if (delta < -1) {
      action = 'withdraw';
      amount = Math.abs(delta);
    }

    return {
      totalDeposits,
      deployedCredit,
      currentIdle,
      optimalInMeteora,
      currentInMeteora,
      action,
      amount,
    };
  }

  async depositToMeteora(amount: number): Promise<TransactionSignature> {
    if (!this.meteoraVault) throw new Error('Meteora vault not initialised');

    const lamports = BigInt(Math.floor(amount * 1e6)); // USDC has 6 decimals
    const tx = await this.meteoraVault.deposit(
      this.config.vaultAuthority.publicKey,
      lamports,
    );
    const sig = await this.config.connection.sendTransaction(tx, [
      this.config.vaultAuthority,
    ]);
    await this.config.connection.confirmTransaction(sig, 'confirmed');

    log.info('Deposited to Meteora', { amount, sig });
    return sig;
  }

  async withdrawFromMeteora(amount: number): Promise<TransactionSignature> {
    if (!this.meteoraVault) throw new Error('Meteora vault not initialised');

    const lamports = BigInt(Math.floor(amount * 1e6));
    const tx = await this.meteoraVault.withdraw(
      this.config.vaultAuthority.publicKey,
      lamports,
    );
    const sig = await this.config.connection.sendTransaction(tx, [
      this.config.vaultAuthority,
    ]);
    await this.config.connection.confirmTransaction(sig, 'confirmed');

    log.info('Withdrew from Meteora', { amount, sig });
    return sig;
  }

  async rebalance(): Promise<void> {
    const allocation = await this.calculateOptimalAllocation();

    log.info('Allocation snapshot', {
      totalDeposits: allocation.totalDeposits,
      deployedCredit: allocation.deployedCredit,
      idle: allocation.currentIdle,
      inMeteora: allocation.currentInMeteora,
      optimalMeteora: allocation.optimalInMeteora,
      action: allocation.action,
      amount: allocation.amount,
    });

    if (allocation.action === 'deposit' && allocation.amount > 1) {
      await this.depositToMeteora(allocation.amount);
    } else if (allocation.action === 'withdraw' && allocation.amount > 1) {
      await this.withdrawFromMeteora(allocation.amount);
    }

    this.lastRebalance = new Date();
  }

  async emergencyWithdrawAll(): Promise<TransactionSignature | null> {
    const balance = await this.getMeteoraBalance();
    if (balance <= 0) {
      log.info('Emergency withdraw: nothing in Meteora');
      return null;
    }
    log.warn('Emergency withdraw initiated', { balance });
    return this.withdrawFromMeteora(balance);
  }

  async getStats(): Promise<{
    totalDeposits: number;
    deployedCredit: number;
    idleInVault: number;
    inMeteora: number;
    lastRebalance: string | null;
  }> {
    const totalDeposits = await this.getVaultUsdcBalance();
    const deployedCredit = await this.getDeployedCredit();
    const inMeteora = await this.getMeteoraBalance();

    return {
      totalDeposits,
      deployedCredit,
      idleInVault: totalDeposits - deployedCredit - inMeteora,
      inMeteora,
      lastRebalance: this.lastRebalance?.toISOString() ?? null,
    };
  }

  // ── Private Helpers ───────────────────────────────────────────────────

  private async getVaultUsdcBalance(): Promise<number> {
    try {
      const ata = await getAssociatedTokenAddress(
        this.config.usdcMint,
        this.config.krexaVaultToken,
        true, // allowOwnerOffCurve — PDAs
      );
      const account = await getAccount(this.config.connection, ata);
      return Number(account.amount) / 1e6;
    } catch {
      return 0;
    }
  }

  private async getDeployedCredit(): Promise<number> {
    try {
      const res = await fetch(
        `http://localhost:${env.PORT}/api/solana/vault/stats`,
      );
      if (!res.ok) return 0;
      const data = (await res.json()) as any;
      return Number(data.totalDeployed ?? data.deployed ?? 0);
    } catch {
      return 0;
    }
  }

  private async getMeteoraBalance(): Promise<number> {
    if (!this.meteoraVault) return 0;
    try {
      const balance = await this.meteoraVault.getUserBalance(
        this.config.vaultAuthority.publicKey,
      );
      return Number(balance) / 1e6;
    } catch {
      return 0;
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton management
// ---------------------------------------------------------------------------

let _instance: IdleCapitalManager | null = null;

export function getIdleCapitalManager(): IdleCapitalManager | null {
  return _instance;
}

/**
 * Initialise the singleton.  Requires METEORA_VAULT_ADDRESS and
 * SOLANA_KEEPER_PRIVATE_KEY in env.  Safe to call even when the SDK is not
 * installed — the manager will gracefully degrade.
 */
export async function initIdleCapitalManager(): Promise<void> {
  if (_instance) return;

  if (!env.METEORA_VAULT_ADDRESS) {
    log.info('METEORA_VAULT_ADDRESS not set — idle capital manager disabled');
    return;
  }

  if (!env.SOLANA_KEEPER_PRIVATE_KEY) {
    log.warn('SOLANA_KEEPER_PRIVATE_KEY not set — cannot sign Meteora txs');
    return;
  }

  const connection = new Connection(env.SOLANA_RPC_URL, 'confirmed');

  // Decode base58 secret key
  const bs58 = await import('bs58');
  const secretKey = bs58.default.decode(env.SOLANA_KEEPER_PRIVATE_KEY);
  const vaultAuthority = Keypair.fromSecretKey(secretKey);

  const config: IdleCapitalConfig = {
    connection,
    vaultAuthority,
    usdcMint: new PublicKey(env.SOLANA_USDC_MINT),
    krexaVaultToken: new PublicKey(env.SOLANA_VAULT_PROGRAM_ID),
    meteoraVaultAddress: new PublicKey(env.METEORA_VAULT_ADDRESS),
    utilizationCapBps: 8000,
    minIdleBuffer: env.IDLE_CAPITAL_MIN_BUFFER,
    pollIntervalMs: env.IDLE_CAPITAL_REBALANCE_MS,
  };

  _instance = new IdleCapitalManager(config);
  await _instance.initialize();
}

export function stopIdleCapitalManager(): void {
  if (_instance) {
    _instance.stop();
    _instance = null;
  }
}

/**
 * Convenience factory for ad-hoc usage (e.g. scripts).  Prefer the singleton
 * in the main server process.
 */
export function createIdleCapitalManager(
  connection: Connection,
  vaultAuthority: Keypair,
): IdleCapitalManager {
  return new IdleCapitalManager({
    connection,
    vaultAuthority,
    usdcMint: new PublicKey(env.SOLANA_USDC_MINT),
    krexaVaultToken: new PublicKey(env.SOLANA_VAULT_PROGRAM_ID),
    meteoraVaultAddress: new PublicKey(env.METEORA_VAULT_ADDRESS || PublicKey.default.toBase58()),
    utilizationCapBps: 8000,
    minIdleBuffer: env.IDLE_CAPITAL_MIN_BUFFER,
    pollIntervalMs: env.IDLE_CAPITAL_REBALANCE_MS,
  });
}
