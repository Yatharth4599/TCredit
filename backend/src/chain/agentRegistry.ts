import type { Address } from 'viem';
import { publicClient } from './client.js';
import { AgentRegistryABI, addresses } from '../config/contracts.js';

const contract = {
  address: addresses.agentRegistry,
  abi: AgentRegistryABI,
} as const;

export async function getAgent(agent: Address) {
  return publicClient.readContract({
    ...contract,
    functionName: 'getAgent',
    args: [agent],
  });
}

export async function getCreditTier(agent: Address) {
  return publicClient.readContract({
    ...contract,
    functionName: 'getCreditTier',
    args: [agent],
  });
}

export async function isCreditValid(agent: Address) {
  return publicClient.readContract({
    ...contract,
    functionName: 'isCreditValid',
    args: [agent],
  });
}

export async function getAgentCount() {
  return publicClient.readContract({
    ...contract,
    functionName: 'getAgentCount',
  });
}

export async function isRegistered(agent: Address) {
  return publicClient.readContract({
    ...contract,
    functionName: 'isRegistered',
    args: [agent],
  });
}
