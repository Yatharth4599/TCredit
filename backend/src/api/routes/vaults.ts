import { Router } from 'express';
import type { Address } from 'viem';
import { listAllVaults, getVaultDetail } from '../../services/vault.service.js';
import { getInvestors, getClaimable, getWaterfallState } from '../../chain/merchantVault.js';
import { getMilestone } from '../../chain/milestoneRegistry.js';
import { AppError } from '../middleware/errorHandler.js';
import { addresses } from '../../config/contracts.js';
import { VaultFactoryABI, MerchantVaultABI } from '../../config/abis.js';
import { encodeFunctionData } from 'viem';
import { publicClient } from '../../chain/client.js';

const router = Router();

// GET /api/v1/vaults — list all vaults with optional filters
router.get('/', async (req, res, next) => {
  try {
    const vaults = await listAllVaults();
    const { state, agent } = req.query;

    const filtered = vaults.filter((v) => {
      if (state && v.state !== state) return false;
      if (agent && v.agent.toLowerCase() !== (agent as string).toLowerCase()) return false;
      return true;
    });

    res.json({ vaults: filtered, total: filtered.length });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/vaults/:address — vault detail
router.get('/:address', async (req, res, next) => {
  try {
    const vaultAddr = req.params.address as Address;
    const detail = await getVaultDetail(vaultAddr);
    res.json(detail);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/vaults/:address/investors — investor list with balances
router.get('/:address/investors', async (req, res, next) => {
  try {
    const vaultAddr = req.params.address as Address;
    const investors = await getInvestors(vaultAddr) as Address[];
    const balances = await Promise.all(
      investors.map(async (inv) => {
        const [balance, claimable] = await Promise.all([
          publicClient.readContract({
            address: vaultAddr,
            abi: MerchantVaultABI,
            functionName: 'investorBalances',
            args: [inv],
          }),
          getClaimable(vaultAddr, inv),
        ]);
        return {
          investor: inv,
          balance: (balance as bigint).toString(),
          claimable: (claimable as bigint).toString(),
        };
      })
    );
    res.json({ investors: balances, total: balances.length });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/vaults/:address/waterfall
router.get('/:address/waterfall', async (req, res, next) => {
  try {
    const vaultAddr = req.params.address as Address;
    const w = await getWaterfallState(vaultAddr) as [bigint, bigint, bigint, bigint, bigint, bigint];
    res.json({
      seniorFunded: w[0].toString(),
      poolFunded: w[1].toString(),
      userFunded: w[2].toString(),
      seniorRepaid: w[3].toString(),
      poolRepaid: w[4].toString(),
      communityRepaid: w[5].toString(),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/vaults/:address/milestones
router.get('/:address/milestones', async (req, res, next) => {
  try {
    const vaultAddr = req.params.address as Address;
    const numTranchesRaw = await publicClient.readContract({
      address: vaultAddr,
      abi: MerchantVaultABI,
      functionName: 'numTranches',
    });
    const numTranches = Number(numTranchesRaw as bigint);

    const milestones = await Promise.all(
      Array.from({ length: numTranches }, (_, i) =>
        getMilestone(vaultAddr, BigInt(i)).catch(() => null)
      )
    );

    res.json({ milestones, total: numTranches });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/vaults/:address/repayments — from VaultEvent in DB (Phase 5 fills this)
router.get('/:address/repayments', async (_req, res) => {
  res.json({ repayments: [], total: 0 });
});

// GET /api/v1/vaults/:address/tranches
router.get('/:address/tranches', async (req, res, next) => {
  try {
    const vaultAddr = req.params.address as Address;
    const [numTranchesRaw, releasedRaw] = await Promise.all([
      publicClient.readContract({ address: vaultAddr, abi: MerchantVaultABI, functionName: 'numTranches' }),
      publicClient.readContract({ address: vaultAddr, abi: MerchantVaultABI, functionName: 'tranchesReleased' }),
    ]);
    const numTranches = Number(numTranchesRaw as bigint);
    const released = Number(releasedRaw as bigint);

    res.json({
      numTranches,
      tranchesReleased: released,
      tranches: Array.from({ length: numTranches }, (_, i) => ({
        index: i,
        released: i < released,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/vaults/create — build unsigned createVault tx
router.post('/create', async (req, res, next) => {
  try {
    const {
      agent, targetAmount, interestRateBps, durationSeconds, numTranches,
      repaymentRateBps, minPaymentInterval, maxSinglePayment, lateFeeBps,
      gracePeriodSeconds, fundraisingDeadline,
    } = req.body;

    if (!agent) throw new AppError(400, 'agent address required');

    const data = encodeFunctionData({
      abi: VaultFactoryABI,
      functionName: 'createVault',
      args: [
        agent as Address,
        BigInt(targetAmount ?? 0),
        BigInt(interestRateBps ?? 1200),
        BigInt(durationSeconds ?? 180 * 24 * 3600),
        BigInt(numTranches ?? 3),
        Number(repaymentRateBps ?? 2000),
        BigInt(minPaymentInterval ?? 86400),
        BigInt(maxSinglePayment ?? 0),
        Number(lateFeeBps ?? 100),
        BigInt(gracePeriodSeconds ?? 7 * 24 * 3600),
        BigInt(fundraisingDeadline ?? Math.floor(Date.now() / 1000) + 30 * 24 * 3600),
      ],
    });

    res.json({
      to: addresses.vaultFactory,
      data,
      description: 'createVault — sign and broadcast with your wallet',
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/vaults/:address/milestone/submit — build unsigned submitMilestone tx
router.post('/:address/milestone/submit', async (req, res, next) => {
  try {
    const { trancheIndex, evidenceHash } = req.body;
    if (trancheIndex === undefined || !evidenceHash) {
      throw new AppError(400, 'trancheIndex and evidenceHash required');
    }
    const { MilestoneRegistryABI } = await import('../../config/abis.js');
    const data = encodeFunctionData({
      abi: MilestoneRegistryABI,
      functionName: 'submitMilestone',
      args: [req.params.address as Address, BigInt(trancheIndex), evidenceHash as `0x${string}`],
    });
    res.json({ to: addresses.milestoneRegistry, data });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/vaults/:address/milestone/vote — build unsigned voteMilestone tx
router.post('/:address/milestone/vote', async (req, res, next) => {
  try {
    const { trancheIndex, approve } = req.body;
    if (trancheIndex === undefined || approve === undefined) {
      throw new AppError(400, 'trancheIndex and approve (bool) required');
    }
    const { MilestoneRegistryABI } = await import('../../config/abis.js');
    const data = encodeFunctionData({
      abi: MilestoneRegistryABI,
      functionName: 'voteMilestone',
      args: [req.params.address as Address, BigInt(trancheIndex), Boolean(approve)],
    });
    res.json({ to: addresses.milestoneRegistry, data });
  } catch (err) {
    next(err);
  }
});

export default router;
