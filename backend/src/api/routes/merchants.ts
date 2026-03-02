import { Router } from 'express';
import type { Address } from 'viem';
import { getAgent, getCreditTier, isCreditValid } from '../../chain/agentRegistry.js';
import { listAllVaults } from '../../services/vault.service.js';
import { AgentRegistryABI } from '../../config/abis.js';
import { addresses } from '../../config/contracts.js';
import { encodeFunctionData } from 'viem';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

const TIER_NAMES = ['D', 'C', 'B', 'A'] as const;

// GET /api/v1/merchants/:address — merchant profile from chain
router.get('/:address', async (req, res, next) => {
  try {
    const addr = req.params.address as Address;
    const [agentData, tier, creditValid] = await Promise.all([
      getAgent(addr),
      getCreditTier(addr),
      isCreditValid(addr),
    ]);

    const agent = agentData as {
      wallet: Address; metadataURI: string; registeredAt: bigint;
      totalPaymentsReceived: bigint; totalPaymentsSent: bigint;
      hasActiveCreditLine: boolean; vault: Address; active: boolean;
    };

    res.json({
      address: agent.wallet,
      metadataURI: agent.metadataURI,
      registeredAt: new Date(Number(agent.registeredAt) * 1000).toISOString(),
      totalPaymentsReceived: agent.totalPaymentsReceived.toString(),
      totalPaymentsSent: agent.totalPaymentsSent.toString(),
      hasActiveCreditLine: agent.hasActiveCreditLine,
      vault: agent.vault,
      active: agent.active,
      creditTier: TIER_NAMES[tier as number] ?? 'D',
      creditTierNum: tier as number,
      creditValid,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/merchants/:address/vaults — vaults belonging to this agent
router.get('/:address/vaults', async (req, res, next) => {
  try {
    const addr = req.params.address.toLowerCase();
    const vaults = await listAllVaults();
    const agentVaults = vaults.filter((v) => v.agent.toLowerCase() === addr);
    res.json({ vaults: agentVaults, total: agentVaults.length });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/merchants/:address/stats — summary stats for merchant dashboard
router.get('/:address/stats', async (req, res, next) => {
  try {
    const addr = req.params.address as Address;
    const [agentData, tier, creditValid] = await Promise.all([
      getAgent(addr),
      getCreditTier(addr),
      isCreditValid(addr),
    ]);

    const agent = agentData as {
      totalPaymentsReceived: bigint; totalPaymentsSent: bigint;
      hasActiveCreditLine: boolean;
    };

    const vaults = await listAllVaults();
    const agentVaults = vaults.filter((v) => v.agent.toLowerCase() === addr.toLowerCase());
    const activeVaults = agentVaults.filter((v) => v.state === 'active' || v.state === 'repaying');
    const totalBorrowed = agentVaults.reduce((sum, v) => sum + BigInt(v.totalRaised), 0n);
    const totalRepaid = agentVaults.reduce((sum, v) => sum + BigInt(v.totalRepaid), 0n);

    const tierName = TIER_NAMES[tier as number] ?? 'D';
    const tierLabels: Record<string, string> = { A: 'Excellent', B: 'Good', C: 'Fair', D: 'Poor' };

    res.json({
      address: addr,
      creditTier: tierName,
      creditRating: tierLabels[tierName] ?? 'Unknown',
      creditValid,
      activeLoanCount: activeVaults.length,
      totalVaults: agentVaults.length,
      totalBorrowed: totalBorrowed.toString(),
      totalRepaid: totalRepaid.toString(),
      totalPaymentsReceived: agent.totalPaymentsReceived.toString(),
      totalPaymentsSent: agent.totalPaymentsSent.toString(),
      hasActiveCreditLine: agent.hasActiveCreditLine,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/merchants/:address/repayments — from VaultEvents (Phase 5 fills this)
router.get('/:address/repayments', (_req, res) => {
  res.json({ repayments: [], total: 0 });
});

// POST /api/v1/merchants/register — build unsigned registerAgent tx
router.post('/register', async (req, res, next) => {
  try {
    const { metadataURI } = req.body;
    if (!metadataURI) throw new AppError(400, 'metadataURI required');

    const data = encodeFunctionData({
      abi: AgentRegistryABI,
      functionName: 'registerAgent',
      args: [metadataURI as string],
    });

    res.json({
      to: addresses.agentRegistry,
      data,
      description: 'registerAgent — sign and broadcast with your wallet',
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/merchants/:address/credit-score — build unsigned updateCreditScore tx (admin only)
router.post('/:address/credit-score', async (req, res, next) => {
  try {
    const { score } = req.body;
    if (score === undefined) throw new AppError(400, 'score (0-1000) required');
    if (score < 0 || score > 1000) throw new AppError(400, 'score must be 0-1000');

    const data = encodeFunctionData({
      abi: AgentRegistryABI,
      functionName: 'updateCreditScore',
      args: [req.params.address as Address, Number(score)],
    });

    res.json({
      to: addresses.agentRegistry,
      data,
      description: 'updateCreditScore — admin only, sign with admin wallet',
    });
  } catch (err) {
    next(err);
  }
});

export default router;
