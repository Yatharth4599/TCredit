import type { Address } from 'viem';
import { getAllVaults } from '../chain/vaultFactory.js';
import { getVaultSnapshot, getInvestors, getWaterfallState } from '../chain/merchantVault.js';

const STATE_NAMES = ['fundraising', 'active', 'repaying', 'completed', 'defaulted', 'cancelled'] as const;

export function formatVault(snap: Awaited<ReturnType<typeof getVaultSnapshot>>) {
  const targetAmount = snap.targetAmount;
  const totalRaised = snap.totalRaised;
  const percentFunded = targetAmount > 0n
    ? Math.round(Number((totalRaised * 10000n) / targetAmount) / 100)
    : 0;

  return {
    address: snap.address,
    agent: snap.agent,
    state: STATE_NAMES[snap.state] ?? 'fundraising',
    targetAmount: snap.targetAmount.toString(),
    totalRaised: snap.totalRaised.toString(),
    totalRepaid: snap.totalRepaid.toString(),
    totalToRepay: snap.totalToRepay.toString(),
    interestRateBps: Number(snap.interestRateBps),
    interestRate: Number(snap.interestRateBps) / 100,           // BPS → %
    durationSeconds: Number(snap.durationSeconds),
    durationMonths: Math.round(Number(snap.durationSeconds) / (30 * 24 * 3600)),
    numTranches: Number(snap.numTranches),
    tranchesReleased: Number(snap.tranchesReleased),
    activatedAt: snap.activatedAt > 0n ? new Date(Number(snap.activatedAt) * 1000).toISOString() : null,
    lateFeeBps: snap.lateFeeBps,
    percentFunded,
  };
}

export async function listAllVaults() {
  const addrs = await getAllVaults();
  if (addrs.length === 0) return [];

  const snapshots = await Promise.all(addrs.map((a) => getVaultSnapshot(a as Address)));
  return snapshots.map(formatVault);
}

export async function getVaultDetail(vaultAddr: Address) {
  const [snap, investors, waterfall] = await Promise.all([
    getVaultSnapshot(vaultAddr),
    getInvestors(vaultAddr),
    getWaterfallState(vaultAddr),
  ]);

  const base = formatVault(snap);
  const [seniorFunded, poolFunded, userFunded, seniorRepaid, poolRepaid, communityRepaid] =
    waterfall as [bigint, bigint, bigint, bigint, bigint, bigint];

  return {
    ...base,
    investorCount: (investors as Address[]).length,
    waterfall: {
      seniorFunded: seniorFunded.toString(),
      poolFunded: poolFunded.toString(),
      userFunded: userFunded.toString(),
      seniorRepaid: seniorRepaid.toString(),
      poolRepaid: poolRepaid.toString(),
      communityRepaid: communityRepaid.toString(),
    },
  };
}
