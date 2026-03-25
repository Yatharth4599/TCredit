import { Router } from 'express';
import type { Address } from 'viem';
import { listAllVaults } from '../../services/vault.service.js';
import { getInvestors, getClaimable } from '../../chain/merchantVault.js';
import { MerchantVaultABI } from '../../config/abis.js';
import { encodeFunctionData } from 'viem';
import { publicClient } from '../../chain/client.js';
import { AppError } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validate.js';
import { InvestSchema, ClaimSchema, RefundSchema } from '../schemas.js';

const router = Router();

// GET /api/v1/portfolio/:address — all investments for a wallet
router.get('/portfolio/:address', async (req, res, next) => {
  try {
    const investorAddr = req.params.address as Address;
    const vaults = await listAllVaults();

    const investments = await Promise.all(
      vaults.map(async (vault) => {
        try {
          const balance = await publicClient.readContract({
            address: vault.address as Address,
            abi: MerchantVaultABI,
            functionName: 'investorBalances',
            args: [investorAddr],
          }) as bigint;

          if (balance === 0n) return null;

          const claimable = await getClaimable(vault.address as Address, investorAddr) as bigint;

          return {
            vaultAddress: vault.address,
            agent: vault.agent,
            state: vault.state,
            amountInvested: balance.toString(),
            claimable: claimable.toString(),
            interestRate: vault.interestRate,
            durationMonths: vault.durationMonths,
          };
        } catch {
          return null;
        }
      })
    );

    const active = investments.filter(Boolean);
    const totalInvested = active.reduce((s, i) => s + BigInt(i!.amountInvested), 0n);
    const totalClaimable = active.reduce((s, i) => s + BigInt(i!.claimable), 0n);

    res.json({
      investments: active,
      total: active.length,
      summary: {
        totalInvested: totalInvested.toString(),
        totalClaimable: totalClaimable.toString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/invest — build unsigned invest tx
router.post('/invest', validate(InvestSchema), async (req, res, next) => {
  try {
    const { vaultAddress, amount } = req.body;

    const data = encodeFunctionData({
      abi: MerchantVaultABI,
      functionName: 'invest',
      args: [BigInt(amount)],
    });

    res.json({
      to: vaultAddress as Address,
      data,
      description: 'invest — approve USDC first, then sign with your wallet',
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/claim — build unsigned claimReturns tx
router.post('/claim', validate(ClaimSchema), async (req, res, next) => {
  try {
    const { vaultAddress } = req.body;

    const data = encodeFunctionData({
      abi: MerchantVaultABI,
      functionName: 'claimReturns',
    });

    res.json({ to: vaultAddress as Address, data, description: 'claimReturns' });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/refund — build unsigned claimRefund tx (cancelled vaults)
router.post('/refund', validate(RefundSchema), async (req, res, next) => {
  try {
    const { vaultAddress } = req.body;

    const data = encodeFunctionData({
      abi: MerchantVaultABI,
      functionName: 'claimRefund',
    });

    res.json({ to: vaultAddress as Address, data, description: 'claimRefund' });
  } catch (err) {
    next(err);
  }
});

export default router;
