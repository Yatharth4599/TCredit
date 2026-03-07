import { publicClient } from './client.js';
import type { Address } from 'viem';

const AgentIdentityABI = [
  { inputs: [{ name: 'agent', type: 'address' }], name: 'hasIdentity', outputs: [{ type: 'bool' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'agent', type: 'address' }], name: 'tokenOfAgent', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'agent', type: 'address' }], name: 'computeReputationScore', outputs: [{ type: 'uint16' }], stateMutability: 'view', type: 'function' },
  {
    inputs: [{ name: 'agent', type: 'address' }],
    name: 'getReputation',
    outputs: [{
      components: [
        { name: 'totalTransactions', type: 'uint256' },
        { name: 'totalVolumeUsdc', type: 'uint256' },
        { name: 'successfulRepayments', type: 'uint256' },
        { name: 'defaultCount', type: 'uint256' },
        { name: 'firstActiveAt', type: 'uint256' },
        { name: 'metadataURI', type: 'string' },
      ],
      type: 'tuple',
    }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export async function getAgentIdentity(identityAddr: Address, agent: Address) {
  const [hasId, tokenId, score, reputation] = await Promise.all([
    publicClient.readContract({ address: identityAddr, abi: AgentIdentityABI, functionName: 'hasIdentity', args: [agent] }),
    publicClient.readContract({ address: identityAddr, abi: AgentIdentityABI, functionName: 'tokenOfAgent', args: [agent] }).catch(() => 0n),
    publicClient.readContract({ address: identityAddr, abi: AgentIdentityABI, functionName: 'computeReputationScore', args: [agent] }),
    publicClient.readContract({ address: identityAddr, abi: AgentIdentityABI, functionName: 'getReputation', args: [agent] }),
  ]);

  return {
    hasIdentity: hasId as boolean,
    tokenId: (tokenId as bigint).toString(),
    reputationScore: Number(score),
    reputation: {
      totalTransactions: (reputation.totalTransactions).toString(),
      totalVolumeUsdc: (reputation.totalVolumeUsdc).toString(),
      successfulRepayments: (reputation.successfulRepayments).toString(),
      defaultCount: (reputation.defaultCount).toString(),
      firstActiveAt: (reputation.firstActiveAt).toString(),
      metadataURI: reputation.metadataURI,
    },
  };
}
