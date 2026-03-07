import { Router } from 'express';
import type { Address } from 'viem';
import { parseUnits, encodeFunctionData } from 'viem';
import { publicClient } from '../../chain/client.js';
import { addresses, VaultFactoryABI, MerchantVaultABI } from '../../config/contracts.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// POST /api/v1/credit/agent-line — create platform credit line (wraps VaultFactory.createVault)
router.post('/agent-line', async (req, res, next) => {
  try {
    const {
      agent,
      targetAmountUsdc,
      interestRateBps,
      durationDays,
      numTranches,
      repaymentRateBps,
    } = req.body;

    if (!agent || !targetAmountUsdc) {
      throw new AppError(400, 'agent and targetAmountUsdc required');
    }

    const target = parseUnits(String(targetAmountUsdc), 6);
    const duration = BigInt((durationDays ?? 180) * 86400);
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 30 * 86400);

    const data = encodeFunctionData({
      abi: VaultFactoryABI,
      functionName: 'createVault',
      args: [
        agent as Address,
        target,
        BigInt(interestRateBps ?? 1200),
        duration,
        BigInt(numTranches ?? 3),
        Number(repaymentRateBps ?? 2000),
        0n,  // minPaymentInterval
        0n,  // maxSinglePayment
        100, // lateFeeBps 1%
        7n * 86400n, // gracePeriod 7 days
        deadline,
      ],
    });

    res.json({
      to: addresses.vaultFactory,
      data,
      description: `Create agent credit line for ${agent}: $${targetAmountUsdc} USDC`,
      vaultType: 'AgentCreditLine',
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/credit/vendor — create vendor credit between agents
router.post('/vendor', async (req, res, next) => {
  try {
    const {
      vendorAgent,
      targetAmountUsdc,
      interestRateBps,
      durationDays,
      repaymentRateBps,
    } = req.body;

    if (!vendorAgent || !targetAmountUsdc) {
      throw new AppError(400, 'vendorAgent and targetAmountUsdc required');
    }

    const target = parseUnits(String(targetAmountUsdc), 6);
    const duration = BigInt((durationDays ?? 90) * 86400);
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 14 * 86400);

    const data = encodeFunctionData({
      abi: VaultFactoryABI,
      functionName: 'createVault',
      args: [
        vendorAgent as Address,
        target,
        BigInt(interestRateBps ?? 800),
        duration,
        1n,  // single tranche for vendor credit
        Number(repaymentRateBps ?? 5000), // 50% repayment rate
        0n,
        0n,
        200, // 2% late fee
        3n * 86400n, // 3 day grace
        deadline,
      ],
    });

    res.json({
      to: addresses.vaultFactory,
      data,
      description: `Create vendor credit for ${vendorAgent}: $${targetAmountUsdc} USDC`,
      vaultType: 'VendorCredit',
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/credit/:address/lines — all credit lines for an agent
router.get('/:address/lines', async (req, res, next) => {
  try {
    const agentAddr = req.params.address as Address;

    // Get all vaults then filter by agent
    const allVaultsRaw = await publicClient.readContract({
      address: addresses.vaultFactory,
      abi: VaultFactoryABI,
      functionName: 'getAllVaults',
    }) as Address[];

    // Filter vaults owned by this agent
    const agentVaults = await Promise.all(
      allVaultsRaw.map(async (v) => {
        const vaultAgent = await publicClient.readContract({
          address: v,
          abi: MerchantVaultABI,
          functionName: 'agent',
        });
        return { address: v, agent: vaultAgent as Address };
      })
    );
    const allVaults = agentVaults.filter(v => v.agent.toLowerCase() === agentAddr.toLowerCase()).map(v => v.address);

    // Get details for each vault
    const lines = await Promise.all(
      allVaults.map(async (vaultAddr) => {
        const [state, targetAmount, totalRepaid, totalToRepay, tranchesReleased, numTranches, interestRateBps] =
          await Promise.all([
            publicClient.readContract({ address: vaultAddr, abi: MerchantVaultABI, functionName: 'state' }),
            publicClient.readContract({ address: vaultAddr, abi: MerchantVaultABI, functionName: 'targetAmount' }),
            publicClient.readContract({ address: vaultAddr, abi: MerchantVaultABI, functionName: 'totalRepaid' }),
            publicClient.readContract({ address: vaultAddr, abi: MerchantVaultABI, functionName: 'totalToRepay' }),
            publicClient.readContract({ address: vaultAddr, abi: MerchantVaultABI, functionName: 'tranchesReleased' }),
            publicClient.readContract({ address: vaultAddr, abi: MerchantVaultABI, functionName: 'numTranches' }),
            publicClient.readContract({ address: vaultAddr, abi: MerchantVaultABI, functionName: 'interestRateBps' }),
          ]);

        const stateNames = ['fundraising', 'active', 'repaying', 'completed', 'defaulted', 'cancelled'];
        return {
          address: vaultAddr,
          state: stateNames[Number(state)] ?? 'unknown',
          targetAmount: (targetAmount as bigint).toString(),
          totalRepaid: (totalRepaid as bigint).toString(),
          totalToRepay: (totalToRepay as bigint).toString(),
          tranchesReleased: Number(tranchesReleased),
          numTranches: Number(numTranches),
          interestRateBps: Number(interestRateBps),
        };
      })
    );

    res.json({ lines, total: lines.length });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/credit/:address/draw — draw from credit line (release tranche)
router.post('/:address/draw', async (req, res, next) => {
  try {
    const vaultAddr = req.params.address as Address;
    const data = encodeFunctionData({
      abi: MerchantVaultABI,
      functionName: 'releaseTranche',
    });
    res.json({
      to: vaultAddr,
      data,
      description: 'Draw from credit line (release next tranche)',
    });
  } catch (err) {
    next(err);
  }
});

export default router;
