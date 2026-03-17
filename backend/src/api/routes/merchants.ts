import { Router } from 'express';
import type { Address } from 'viem';
import { getAgent, getCreditTier, isCreditValid } from '../../chain/agentRegistry.js';
import { listAllVaults } from '../../services/vault.service.js';
import { AgentRegistryABI } from '../../config/abis.js';
import { addresses } from '../../config/contracts.js';
import { encodeFunctionData } from 'viem';
import { AppError } from '../middleware/errorHandler.js';
import { requireApiKey, type AuthenticatedRequest } from '../middleware/apiKeyAuth.js';
import { getSettlement } from '../../chain/paymentRouter.js';
import { processPayment } from '../../services/oracle.service.js';
import { env } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';

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

    if (!agent.active && agent.registeredAt === 0n) {
      return res.status(404).json({ error: 'Merchant not registered' });
    }

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
      hasActiveCreditLine: boolean; active: boolean; registeredAt: bigint;
    };

    if (!agent.active && agent.registeredAt === 0n) {
      return res.status(404).json({ error: 'Merchant not registered' });
    }

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

// GET /api/v1/merchants/:address/settlement — on-chain settlement data
router.get('/:address/settlement', async (req, res, next) => {
  try {
    const addr = req.params.address as Address;
    const settlement = await getSettlement(addr);

    res.json({
      vault: settlement.vault,
      repaymentRateBps: Number(settlement.repaymentRateBps),
      totalRouted: settlement.totalRouted.toString(),
      totalPayments: Number(settlement.totalPayments),
      active: settlement.active,
      lastPaymentAt: settlement.lastPaymentAt > 0n
        ? new Date(Number(settlement.lastPaymentAt) * 1000).toISOString()
        : null,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/merchants/:address/repayments — query real OraclePayment records (BUG-035 fix: auth required)
router.get('/:address/repayments', requireApiKey as never, async (req, res, next) => {
  try {
    const addr = req.params.address.toLowerCase();
    const payments = await prisma.oraclePayment.findMany({
      where: {
        OR: [{ from: addr }, { to: addr }],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({
      repayments: payments.map((p) => ({
        id: p.id,
        from: p.from,
        to: p.to,
        vault: p.vault,
        amount: p.amount.toString(),
        nonce: p.nonce.toString(),
        deadline: p.deadline.toString(),
        paymentId: p.paymentId,
        status: p.status,
        txHash: p.txHash,
        error: p.error,
        attempts: p.attempts,
        nextRetryAt: p.nextRetryAt?.toISOString() ?? null,
        createdAt: p.createdAt.toISOString(),
        processedAt: p.processedAt?.toISOString() ?? null,
      })),
      total: payments.length,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/merchants/:address/repay — submit a repayment via oracle (BUG-026: auth required)
router.post('/:address/repay', requireApiKey as never, async (req: AuthenticatedRequest, res, next) => {
  try {
    const addr = req.params.address as Address;
    const { repaymentAmount } = req.body;
    if (!repaymentAmount) throw new AppError(400, 'repaymentAmount (wei string) required');

    const repayBigInt = BigInt(repaymentAmount);
    if (repayBigInt <= 0n) throw new AppError(400, 'repaymentAmount must be positive');

    // Get settlement to calculate gross amount
    const settlement = await getSettlement(addr);
    if (!settlement.active) {
      throw new AppError(400, `No active settlement for ${addr}`);
    }

    const rateBps = BigInt(settlement.repaymentRateBps);
    if (rateBps === 0n) throw new AppError(400, 'Settlement has 0 repaymentRateBps');

    // grossAmount = ceil(repaymentAmount * 10000 / repaymentRateBps)
    const grossAmount = (repayBigInt * 10000n + rateBps - 1n) / rateBps;
    const netReturned = grossAmount - repayBigInt;

    // Submit via oracle (from=merchant, to=merchant, amount=grossAmount)
    const result = await processPayment({
      from: addr,
      to: addr,
      amount: grossAmount.toString(),
    });

    res.json({
      status: result.status,
      txHash: result.txHash,
      repaymentAmount: repayBigInt.toString(),
      grossAmount: grossAmount.toString(),
      netReturned: netReturned.toString(),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/merchants/register — build unsigned registerAgent tx
router.post('/register', async (req, res, next) => {
  try {
    const { metadataURI = '' } = req.body;

    const data = encodeFunctionData({
      abi: AgentRegistryABI,
      functionName: 'registerAgent',
      args: [metadataURI as string],
    });

    res.json({
      to: addresses.agentRegistry,
      data,
      chainId: Number(env.CHAIN_ID),
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
