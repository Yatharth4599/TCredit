import type { Address } from 'viem';
import { publicClient } from './client.js';
import { MerchantVaultABI } from '../config/contracts.js';

function contract(vaultAddr: Address) {
  return { address: vaultAddr, abi: MerchantVaultABI } as const;
}

export async function getAgent(vaultAddr: Address) {
  return publicClient.readContract({ ...contract(vaultAddr), functionName: 'agent' });
}

export async function getState(vaultAddr: Address) {
  return publicClient.readContract({ ...contract(vaultAddr), functionName: 'state' });
}

export async function getTargetAmount(vaultAddr: Address) {
  return publicClient.readContract({ ...contract(vaultAddr), functionName: 'targetAmount' });
}

export async function getTotalRaised(vaultAddr: Address) {
  return publicClient.readContract({ ...contract(vaultAddr), functionName: 'totalRaised' });
}

export async function getTotalRepaid(vaultAddr: Address) {
  return publicClient.readContract({ ...contract(vaultAddr), functionName: 'totalRepaid' });
}

export async function getTotalToRepay(vaultAddr: Address) {
  return publicClient.readContract({ ...contract(vaultAddr), functionName: 'totalToRepay' });
}

export async function getInterestRateBps(vaultAddr: Address) {
  return publicClient.readContract({ ...contract(vaultAddr), functionName: 'interestRateBps' });
}

export async function getDurationSeconds(vaultAddr: Address) {
  return publicClient.readContract({ ...contract(vaultAddr), functionName: 'durationSeconds' });
}

export async function getNumTranches(vaultAddr: Address) {
  return publicClient.readContract({ ...contract(vaultAddr), functionName: 'numTranches' });
}

export async function getTranchesReleased(vaultAddr: Address) {
  return publicClient.readContract({ ...contract(vaultAddr), functionName: 'tranchesReleased' });
}

export async function getInvestors(vaultAddr: Address) {
  return publicClient.readContract({ ...contract(vaultAddr), functionName: 'getInvestors' });
}

export async function getInvestorBalance(vaultAddr: Address, investor: Address) {
  return publicClient.readContract({ ...contract(vaultAddr), functionName: 'investorBalances', args: [investor] });
}

export async function getClaimable(vaultAddr: Address, investor: Address) {
  return publicClient.readContract({ ...contract(vaultAddr), functionName: 'getClaimable', args: [investor] });
}

export async function getWaterfallState(vaultAddr: Address) {
  return publicClient.readContract({ ...contract(vaultAddr), functionName: 'getWaterfallState' });
}

export async function calculateLateFee(vaultAddr: Address) {
  return publicClient.readContract({ ...contract(vaultAddr), functionName: 'calculateLateFee' });
}

export async function shouldDefault(vaultAddr: Address) {
  return publicClient.readContract({ ...contract(vaultAddr), functionName: 'shouldDefault' });
}

export async function getNextPaymentDue(vaultAddr: Address) {
  return publicClient.readContract({ ...contract(vaultAddr), functionName: 'nextPaymentDue' });
}

export async function getActivatedAt(vaultAddr: Address) {
  return publicClient.readContract({ ...contract(vaultAddr), functionName: 'activatedAt' });
}

export async function getLateFeeBps(vaultAddr: Address) {
  return publicClient.readContract({ ...contract(vaultAddr), functionName: 'lateFeeBps' });
}

export async function getTotalSeniorRepaid(vaultAddr: Address) {
  return publicClient.readContract({ ...contract(vaultAddr), functionName: 'totalSeniorRepaid' });
}

export async function getTotalPoolRepaid(vaultAddr: Address) {
  return publicClient.readContract({ ...contract(vaultAddr), functionName: 'totalPoolRepaid' });
}

// Reads all core vault fields in parallel (used by list + detail endpoints)
export async function getVaultSnapshot(vaultAddr: Address) {
  const [
    agentAddr, state, targetAmount, totalRaised, totalRepaid, totalToRepay,
    interestRateBps, durationSeconds, numTranches, tranchesReleased,
    activatedAt, lateFeeBps,
  ] = await Promise.all([
    getAgent(vaultAddr),
    getState(vaultAddr),
    getTargetAmount(vaultAddr),
    getTotalRaised(vaultAddr),
    getTotalRepaid(vaultAddr),
    getTotalToRepay(vaultAddr),
    getInterestRateBps(vaultAddr),
    getDurationSeconds(vaultAddr),
    getNumTranches(vaultAddr),
    getTranchesReleased(vaultAddr),
    getActivatedAt(vaultAddr),
    getLateFeeBps(vaultAddr),
  ]);

  return {
    address: vaultAddr,
    agent: agentAddr as Address,
    state: state as number,
    targetAmount: targetAmount as bigint,
    totalRaised: totalRaised as bigint,
    totalRepaid: totalRepaid as bigint,
    totalToRepay: totalToRepay as bigint,
    interestRateBps: interestRateBps as bigint,
    durationSeconds: durationSeconds as bigint,
    numTranches: numTranches as bigint,
    tranchesReleased: tranchesReleased as bigint,
    activatedAt: activatedAt as bigint,
    lateFeeBps: lateFeeBps as number,
  };
}
