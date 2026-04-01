import { Router } from 'express';
import type { Address } from 'viem';
import { encodeFunctionData } from 'viem';
import { publicClient } from '../../chain/client.js';
import { addresses, AgentRegistryABI } from '../../config/contracts.js';
import { env } from '../../config/env.js';
import { AppError } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validate.js';
import { TraderRegisterSchema, TraderDrawSchema, TraderRepaySchema } from '../schemas.js';
import { getTraderStats } from '../../services/polymarket.service.js';

const router = Router();

const CHAIN_ID = Number(env.CHAIN_ID);

// Minimal ABI for TraderVaultFactory
const TraderVaultFactoryABI = [
  {
    type: 'function', name: 'createVault',
    inputs: [], outputs: [{ name: 'vault', type: 'address' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function', name: 'traderToVault',
    inputs: [{ name: '', type: 'address' }], outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function', name: 'allVaultsLength',
    inputs: [], outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

// Minimal ABI for TraderVault
const TraderVaultABI = [
  {
    type: 'function', name: 'draw',
    inputs: [{ name: 'amount', type: 'uint256' }], outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function', name: 'repay',
    inputs: [{ name: 'amount', type: 'uint256' }], outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function', name: 'trader',
    inputs: [], outputs: [{ name: '', type: 'address' }], stateMutability: 'view',
  },
  {
    type: 'function', name: 'creditLimit',
    inputs: [], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view',
  },
  {
    type: 'function', name: 'drawn',
    inputs: [], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view',
  },
  {
    type: 'function', name: 'totalRepaid',
    inputs: [], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view',
  },
  {
    type: 'function', name: 'totalDrawn',
    inputs: [], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view',
  },
  {
    type: 'function', name: 'interestRateBps',
    inputs: [], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view',
  },
  {
    type: 'function', name: 'frozen',
    inputs: [], outputs: [{ name: '', type: 'bool' }], stateMutability: 'view',
  },
  {
    type: 'function', name: 'activatedAt',
    inputs: [], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view',
  },
  {
    type: 'function', name: 'getUtilization',
    inputs: [], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view',
  },
  {
    type: 'function', name: 'available',
    inputs: [], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view',
  },
  {
    type: 'function', name: 'accruedInterest',
    inputs: [], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view',
  },
] as const;

function getTraderVaultFactoryAddress(): Address {
  const addr = env.TRADER_VAULT_FACTORY_ADDRESS;
  if (!addr) throw new AppError(503, 'TraderVaultFactory not deployed yet');
  return addr as Address;
}

// ─── GET /api/v1/traders/:address ─────────────────────────────────────────────
// Trader profile: registration status, credit tier, vault address
router.get('/:address', async (req, res, next) => {
  try {
    const traderAddr = req.params.address as Address;

    const [agent, creditProfile] = await Promise.all([
      publicClient.readContract({
        address: addresses.agentRegistry,
        abi: AgentRegistryABI,
        functionName: 'getAgent',
        args: [traderAddr],
      }),
      publicClient.readContract({
        address: addresses.agentRegistry,
        abi: AgentRegistryABI,
        functionName: 'getCreditProfile',
        args: [traderAddr],
      }),
    ]) as [
      { wallet: string; metadataURI: string; registeredAt: bigint; totalPaymentsReceived: bigint; totalPaymentsSent: bigint; hasActiveCreditLine: boolean; vault: string; active: boolean },
      { score: number; tier: number; updatedAt: bigint },
    ];

    const tierLabels = ['D', 'C', 'B', 'A'];
    const tierLabel = tierLabels[creditProfile.tier] ?? 'D';
    const isRegistered = Number(agent.registeredAt) > 0;

    let vaultAddress: string | null = null;
    if (isRegistered) {
      try {
        const factoryAddr = getTraderVaultFactoryAddress();
        const v = await publicClient.readContract({
          address: factoryAddr,
          abi: TraderVaultFactoryABI,
          functionName: 'traderToVault',
          args: [traderAddr],
        }) as Address;
        vaultAddress = v !== '0x0000000000000000000000000000000000000000' ? v : null;
      } catch { /* factory not deployed */ }
    }

    res.json({
      address: traderAddr,
      isRegistered,
      active: agent.active,
      creditScore: Number(creditProfile.score),
      creditTier: tierLabel,
      creditUpdatedAt: Number(creditProfile.updatedAt),
      vault: vaultAddress,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/v1/traders/:address/stats ────────────────────────────────────────
// Polymarket trading history and suggested credit score
router.get('/:address/stats', async (req, res, next) => {
  try {
    const traderAddr = req.params.address;
    const stats = await getTraderStats(traderAddr);
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/v1/traders/:address/vault ────────────────────────────────────────
// TraderVault state: drawn, limit, utilization
router.get('/:address/vault', async (req, res, next) => {
  try {
    const traderAddr = req.params.address as Address;
    const factoryAddr = getTraderVaultFactoryAddress();

    const vaultAddr = await publicClient.readContract({
      address: factoryAddr,
      abi: TraderVaultFactoryABI,
      functionName: 'traderToVault',
      args: [traderAddr],
    }) as Address;

    if (vaultAddr === '0x0000000000000000000000000000000000000000') {
      return res.json({ vault: null, message: 'No vault created yet' });
    }

    const [creditLimit, drawn, totalRepaid, totalDrawn, interestRateBps, frozen, activatedAt, utilization, availableAmount, accruedInterest] = await Promise.all([
      publicClient.readContract({ address: vaultAddr, abi: TraderVaultABI, functionName: 'creditLimit' }),
      publicClient.readContract({ address: vaultAddr, abi: TraderVaultABI, functionName: 'drawn' }),
      publicClient.readContract({ address: vaultAddr, abi: TraderVaultABI, functionName: 'totalRepaid' }),
      publicClient.readContract({ address: vaultAddr, abi: TraderVaultABI, functionName: 'totalDrawn' }),
      publicClient.readContract({ address: vaultAddr, abi: TraderVaultABI, functionName: 'interestRateBps' }),
      publicClient.readContract({ address: vaultAddr, abi: TraderVaultABI, functionName: 'frozen' }),
      publicClient.readContract({ address: vaultAddr, abi: TraderVaultABI, functionName: 'activatedAt' }),
      publicClient.readContract({ address: vaultAddr, abi: TraderVaultABI, functionName: 'getUtilization' }),
      publicClient.readContract({ address: vaultAddr, abi: TraderVaultABI, functionName: 'available' }),
      publicClient.readContract({ address: vaultAddr, abi: TraderVaultABI, functionName: 'accruedInterest' }),
    ]) as [bigint, bigint, bigint, bigint, bigint, boolean, bigint, bigint, bigint, bigint];

    return res.json({
      vault: vaultAddr,
      creditLimit:      creditLimit.toString(),
      drawn:            drawn.toString(),
      totalRepaid:      totalRepaid.toString(),
      totalDrawn:       totalDrawn.toString(),
      interestRateBps:  Number(interestRateBps),
      frozen,
      activatedAt:      Number(activatedAt),
      utilizationBps:   Number(utilization),
      utilizationPct:   Number(utilization) / 100,
      available:        availableAmount.toString(),
      accruedInterest:  accruedInterest.toString(),
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/v1/traders/register ─────────────────────────────────────────────
// Build unsigned registerAgent tx (same as merchants — reuse AgentRegistry)
router.post('/register', validate(TraderRegisterSchema), async (req, res, next) => {
  try {
    const { metadataURI = 'ipfs://krexa-trader' } = req.body;

    const data = encodeFunctionData({
      abi: AgentRegistryABI,
      functionName: 'registerAgent',
      args: [metadataURI],
    });

    res.json({
      to: addresses.agentRegistry,
      data,
      chainId: CHAIN_ID,
      description: 'Register as a trader on Krexa',
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/v1/traders/create-vault ─────────────────────────────────────────
// Build unsigned createVault tx for msg.sender on TraderVaultFactory
router.post('/create-vault', async (req, res, next) => {
  try {
    const factoryAddr = getTraderVaultFactoryAddress();
    const data = encodeFunctionData({
      abi: TraderVaultFactoryABI,
      functionName: 'createVault',
    });

    res.json({
      to: factoryAddr,
      data,
      chainId: CHAIN_ID,
      description: 'Create your Krexa trader credit vault',
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/v1/traders/:address/draw ────────────────────────────────────────
// Build unsigned draw tx on TraderVault
router.post('/:address/draw', validate(TraderDrawSchema), async (req, res, next) => {
  try {
    const vaultAddr = req.params.address as Address;
    const { amount } = req.body;

    const data = encodeFunctionData({
      abi: TraderVaultABI,
      functionName: 'draw',
      args: [BigInt(amount)],
    });

    res.json({
      to: vaultAddr,
      data,
      chainId: CHAIN_ID,
      description: `Draw ${Number(amount) / 1e6} USDC from your credit vault`,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/v1/traders/:address/repay ───────────────────────────────────────
// Build unsigned repay tx on TraderVault
router.post('/:address/repay', validate(TraderRepaySchema), async (req, res, next) => {
  try {
    const vaultAddr = req.params.address as Address;
    const { amount } = req.body;

    const data = encodeFunctionData({
      abi: TraderVaultABI,
      functionName: 'repay',
      args: [BigInt(amount)],
    });

    res.json({
      to: vaultAddr,
      data,
      chainId: CHAIN_ID,
      description: `Repay ${Number(amount) / 1e6} USDC to your credit vault`,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/v1/traders/:address/score ───────────────────────────────────────
// Admin: fetch Polymarket stats and set credit score on AgentRegistry
router.post('/:address/score', async (req, res, next) => {
  try {
    const traderAddr = req.params.address as Address;

    // Fetch Polymarket stats to compute suggested score
    const stats = await getTraderStats(traderAddr);

    // Build unsigned updateCreditScore tx (admin must sign)
    const data = encodeFunctionData({
      abi: AgentRegistryABI,
      functionName: 'updateCreditScore',
      args: [traderAddr, stats.suggestedScore],
    });

    res.json({
      to: addresses.agentRegistry,
      data,
      chainId: CHAIN_ID,
      description: `Set credit score ${stats.suggestedScore} for trader ${traderAddr}`,
      polymarketStats: stats,
      suggestedScore: stats.suggestedScore,
      note: 'This tx must be signed by the AgentRegistry admin wallet',
    });
  } catch (err) {
    next(err);
  }
});

export default router;
