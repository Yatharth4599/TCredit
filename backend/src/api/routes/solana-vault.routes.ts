/**
 * Solana Vault routes — credit vault stats and LP operations
 *
 * GET  /api/v1/solana/vault/stats            — vault health + utilisation
 * GET  /api/v1/solana/vault/lp/:depositor    — LP position for a depositor
 * POST /api/v1/solana/vault/deposit          — unsigned deposit_collateral tx
 * GET  /api/v1/solana/vault/health           — indexer + keeper health
 */

import { Router } from 'express';
import { PublicKey } from '@solana/web3.js';
import { readVaultConfig, readDepositPosition, readCollateralPosition } from '../../chain/solana/reader.js';
import { cacheGet, cacheSet } from '../../config/redis.js';
import { getSolanaKeeperHealth } from '../../services/solana-keeper.js';
import { getSolanaIndexerHealth } from '../../indexer/solana-indexer.js';
import { getSolanaOracleHealth } from '../../services/solana-oracle.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// BUG-071: In-memory cache for wallet count queries (30s TTL)
interface WalletCountCache {
  walletCount: number;
  criticalWallets: number;
  frozenWallets: number;
  cachedAt: number;
}
const WALLET_COUNT_CACHE_TTL_MS = 30_000;
let walletCountCache: WalletCountCache | null = null;

async function getCachedWalletCounts(): Promise<WalletCountCache> {
  const now = Date.now();
  if (walletCountCache && (now - walletCountCache.cachedAt) < WALLET_COUNT_CACHE_TTL_MS) {
    return walletCountCache;
  }

  const [walletCount, criticalWallets, frozenWallets] = await Promise.all([
    prisma.solanaAgentWallet.count().catch(() => 0),
    prisma.solanaAgentWallet.count({ where: { healthFactorBps: { lt: 10_500 } } }).catch(() => 0),
    prisma.solanaAgentWallet.count({ where: { isFrozen: true } }).catch(() => 0),
  ]);

  walletCountCache = { walletCount, criticalWallets, frozenWallets, cachedAt: now };
  return walletCountCache;
}

function parsePubkey(raw: string): PublicKey {
  try { return new PublicKey(raw); }
  catch { throw new AppError(400, `Invalid Solana public key: ${raw}`); }
}

// GET /solana/vault/stats
router.get('/stats', async (req, res, next) => {
  try {
    const cached = await cacheGet('vault:stats');
    if (cached) return res.json(cached);

    const vault = await readVaultConfig();
    if (!vault) {
      return res.json({ initialized: false });
    }

    const utilizationBps = vault.totalDeposits > 0n
      ? Number(vault.totalDeployed * 10_000n / vault.totalDeposits)
      : 0;

    const availableLiquidity = vault.totalDeposits - vault.totalDeployed;

    const data = {
      initialized: true,
      totalDeposits:        vault.totalDeposits.toString(),
      totalDepositsUsdc:    (Number(vault.totalDeposits) / 1_000_000).toFixed(2),
      totalShares:          vault.totalShares.toString(),
      totalDeployed:        vault.totalDeployed.toString(),
      totalDeployedUsdc:    (Number(vault.totalDeployed) / 1_000_000).toFixed(2),
      availableLiquidity:   availableLiquidity.toString(),
      availableLiquidityUsdc: (Number(availableLiquidity) / 1_000_000).toFixed(2),
      utilizationBps,
      utilizationPct:       (utilizationBps / 100).toFixed(2),
      utilizationCapBps:    vault.utilizationCapBps,
      baseInterestRateBps:  vault.baseInterestRateBps,
      totalInterestEarned:  vault.totalInterestEarned.toString(),
      totalDefaults:        vault.totalDefaults.toString(),
      insuranceBalance:     vault.insuranceBalance.toString(),
      insuranceBalanceUsdc: (Number(vault.insuranceBalance) / 1_000_000).toFixed(2),
      isPaused:             vault.isPaused,
      lockupSeconds:        vault.lockupSeconds.toString(),
    };
    await cacheSet('vault:stats', data, 60);
    res.json(data);
  } catch (err) { next(err); }
});

// GET /solana/vault/lp/:depositor
router.get('/lp/:depositor', async (req, res, next) => {
  try {
    const depositorPk = parsePubkey(req.params.depositor);
    const [lpPosition, vault] = await Promise.all([
      readDepositPosition(depositorPk),
      readVaultConfig(),
    ]);

    if (!lpPosition) {
      return res.json({
        depositor: req.params.depositor,
        hasPosition: false,
        shares: '0',
        depositedAmount: '0',
        currentValue: '0',
      });
    }

    // Current value = shares / totalShares * totalDeposits
    let currentValue = 0n;
    if (vault && vault.totalShares > 0n) {
      currentValue = lpPosition.shares * vault.totalDeposits / vault.totalShares;
    }

    const yieldEarned = currentValue > lpPosition.depositedAmount
      ? currentValue - lpPosition.depositedAmount
      : 0n;

    res.json({
      depositor:       req.params.depositor,
      hasPosition:     true,
      shares:          lpPosition.shares.toString(),
      depositedAmount: lpPosition.depositedAmount.toString(),
      depositedUsdc:   (Number(lpPosition.depositedAmount) / 1_000_000).toFixed(2),
      currentValue:    currentValue.toString(),
      currentValueUsdc: (Number(currentValue) / 1_000_000).toFixed(2),
      yieldEarned:     yieldEarned.toString(),
      yieldEarnedUsdc: (Number(yieldEarned) / 1_000_000).toFixed(2),
      depositTimestamp: new Date(Number(lpPosition.depositTimestamp) * 1000).toISOString(),
      isCollateral:    lpPosition.isCollateral,
    });
  } catch (err) { next(err); }
});

// GET /solana/vault/collateral/:agent
router.get('/collateral/:agent', async (req, res, next) => {
  try {
    const agentPk = parsePubkey(req.params.agent);
    const [collateral, vault] = await Promise.all([
      readCollateralPosition(agentPk),
      readVaultConfig(),
    ]);

    if (!collateral) {
      return res.json({ agent: req.params.agent, hasCollateral: false, shares: '0', value: '0' });
    }

    let currentValue = 0n;
    if (vault && vault.totalShares > 0n) {
      currentValue = collateral.shares * vault.totalDeposits / vault.totalShares;
    }

    res.json({
      agent:           req.params.agent,
      hasCollateral:   true,
      shares:          collateral.shares.toString(),
      depositedAmount: collateral.depositedAmount.toString(),
      currentValue:    currentValue.toString(),
      currentValueUsdc: (Number(currentValue) / 1_000_000).toFixed(2),
      depositTimestamp: new Date(Number(collateral.depositTimestamp) * 1000).toISOString(),
    });
  } catch (err) { next(err); }
});

// GET /solana/vault/health — combined service health
// BUG-071: wallet counts now use 30s in-memory cache to avoid hammering DB on every request
router.get('/health', async (req, res, next) => {
  try {
    const [keeperHealth, indexerHealth, walletCounts] = await Promise.all([
      getSolanaKeeperHealth(),
      getSolanaIndexerHealth(),
      getCachedWalletCounts(),
    ]);

    res.json({
      keeper: keeperHealth,
      indexer: indexerHealth,
      oracle: getSolanaOracleHealth(),
      portfolio: {
        totalWallets: walletCounts.walletCount,
        criticalWallets: walletCounts.criticalWallets,
        frozenWallets: walletCounts.frozenWallets,
      },
    });
  } catch (err) { next(err); }
});

export default router;
