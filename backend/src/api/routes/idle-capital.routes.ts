/**
 * Idle Capital Routes
 *
 * Exposes the current idle-capital allocation and Meteora yield data.
 * Mounted under /solana/vault so paths become:
 *   GET /solana/vault/idle-capital
 *   GET /solana/vault/meteora-yield
 */

import { Router, type Request, type Response } from 'express';
import { getIdleCapitalManager } from '../../services/idle-capital-manager.js';
import { env } from '../../config/env.js';
import { createLogger } from '../../utils/logger.js';

const log = createLogger('IdleCapitalRoutes');
const router = Router();

// ---------------------------------------------------------------------------
// GET /idle-capital — current allocation snapshot
// ---------------------------------------------------------------------------

router.get('/idle-capital', async (_req: Request, res: Response) => {
  try {
    const mgr = getIdleCapitalManager();
    if (!mgr) {
      return res.json({
        totalDeposits: 0,
        deployedCredit: 0,
        idleInVault: 0,
        inMeteora: 0,
        meteoraYieldApy: 0,
        lastRebalance: null,
        status: 'disabled',
      });
    }

    const stats = await mgr.getStats();
    const meteoraYieldApy = await fetchMeteoraApy();

    return res.json({
      ...stats,
      meteoraYieldApy,
    });
  } catch (err) {
    log.error('Failed to fetch idle-capital stats', {
      error: err instanceof Error ? err.message : String(err),
    });
    return res.status(500).json({ error: 'Failed to fetch idle-capital stats' });
  }
});

// ---------------------------------------------------------------------------
// GET /meteora-yield — Meteora vault details
// ---------------------------------------------------------------------------

router.get('/meteora-yield', async (_req: Request, res: Response) => {
  try {
    const vaultData = await fetchMeteoraVaultDetails();
    return res.json(vaultData);
  } catch (err) {
    log.error('Failed to fetch Meteora yield data', {
      error: err instanceof Error ? err.message : String(err),
    });
    return res.status(500).json({ error: 'Failed to fetch Meteora yield data' });
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchMeteoraApy(): Promise<number> {
  try {
    const response = await fetch('https://app.meteora.ag/vault/api/vaults');
    if (!response.ok) return 0;
    const vaults = (await response.json()) as any[];
    const usdcVault = vaults.find(
      (v: any) => v.token_address === env.SOLANA_USDC_MINT,
    );
    return usdcVault?.closest_apy ?? 0;
  } catch {
    return 0;
  }
}

async function fetchMeteoraVaultDetails(): Promise<{
  currentApy: number;
  strategyAllocation: any[];
  totalDeposited: number;
}> {
  try {
    const response = await fetch('https://app.meteora.ag/vault/api/vaults');
    if (!response.ok) {
      return { currentApy: 0, strategyAllocation: [], totalDeposited: 0 };
    }
    const vaults = (await response.json()) as any[];
    const usdcVault = vaults.find(
      (v: any) => v.token_address === env.SOLANA_USDC_MINT,
    );

    if (!usdcVault) {
      return { currentApy: 0, strategyAllocation: [], totalDeposited: 0 };
    }

    return {
      currentApy: usdcVault.closest_apy ?? 0,
      strategyAllocation: usdcVault.strategies ?? [],
      totalDeposited: Number(usdcVault.total_amount ?? 0) / 1e6,
    };
  } catch {
    return { currentApy: 0, strategyAllocation: [], totalDeposited: 0 };
  }
}

export default router;
