import { publicClient } from '../chain/client.js';
import { addresses } from '../config/contracts.js';
import { PaymentRouterABI } from '../config/abis.js';
import type { Address } from 'viem';
import { formatUnits, erc20Abi } from 'viem';
import { prisma } from '../config/prisma.js';

export interface GatewaySummary {
  totalRevenue: string;
  totalPayments: number;
  sources: {
    crypto: { volume: string; count: number };
    x402: { volume: string; count: number };
    fiat: { volume: string; count: number };
  };
  recentPayments: Array<{
    id: string;
    source: string;
    amount: string;
    from: string;
    to: string;
    status: string;
    timestamp: string;
    txHash: string | null;
  }>;
}

export async function getGatewaySummary(agentAddr: Address): Promise<GatewaySummary> {
  // Fetch on-chain settlement data
  const settlement = await publicClient.readContract({
    address: addresses.paymentRouter,
    abi: PaymentRouterABI,
    functionName: 'getSettlement',
    args: [agentAddr],
  }) as {
    vault: Address;
    repaymentRateBps: number;
    totalRouted: bigint;
    totalPayments: bigint;
    lastPaymentAt: bigint;
    active: boolean;
  };

  // Fetch USDC balance
  const balance = await publicClient.readContract({
    address: addresses.usdc,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [agentAddr],
  }) as bigint;

  // Fetch oracle payments from DB
  const oraclePayments = await prisma.oraclePayment.findMany({
    where: {
      OR: [
        { from: agentAddr.toLowerCase() },
        { to: agentAddr.toLowerCase() },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  // Calculate crypto volumes (from oracle payments)
  const cryptoPayments = oraclePayments.filter(p => p.status === 'confirmed');
  const cryptoVolume = cryptoPayments.reduce((sum, p) => sum + BigInt(p.amount), 0n);

  return {
    totalRevenue: formatUnits(settlement.totalRouted + cryptoVolume, 6),
    totalPayments: cryptoPayments.length + Number(settlement.totalPayments),
    sources: {
      crypto: {
        volume: formatUnits(cryptoVolume, 6),
        count: cryptoPayments.length,
      },
      x402: {
        volume: formatUnits(settlement.totalRouted, 6),
        count: Number(settlement.totalPayments),
      },
      fiat: {
        volume: '0',
        count: 0, // Populated when Stripe/PayPal webhooks are active
      },
    },
    recentPayments: oraclePayments.map(p => ({
      id: p.id,
      source: 'crypto',
      amount: formatUnits(BigInt(p.amount), 6),
      from: p.from,
      to: p.to,
      status: p.status,
      timestamp: p.createdAt.toISOString(),
      txHash: p.txHash,
    })),
  };
}
