import { publicClient } from './client.js';
import type { Address, Hex } from 'viem';

// Minimal ABI for Krexa402Facilitator reads
const Krexa402FacilitatorABI = [
  {
    inputs: [{ name: 'resourceHash', type: 'bytes32' }],
    name: 'getResource',
    outputs: [{
      components: [
        { name: 'owner', type: 'address' },
        { name: 'pricePerCall', type: 'uint256' },
        { name: 'active', type: 'bool' },
      ],
      name: '',
      type: 'tuple',
    }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'resourceHash', type: 'bytes32' },
      { name: 'owner', type: 'address' },
    ],
    name: 'resourceKey',
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'pure',
    type: 'function',
  },
  {
    inputs: [],
    name: 'facilitatorFeeBps',
    outputs: [{ name: '', type: 'uint16' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export async function getResource(
  facilitatorAddr: Address,
  resourceKey: Hex,
) {
  const res = await publicClient.readContract({
    address: facilitatorAddr,
    abi: Krexa402FacilitatorABI,
    functionName: 'getResource',
    args: [resourceKey],
  });
  return {
    owner: res.owner,
    pricePerCall: res.pricePerCall.toString(),
    active: res.active,
  };
}

export async function getResourceKey(
  facilitatorAddr: Address,
  rawResourceHash: Hex,
  owner: Address,
): Promise<Hex> {
  return publicClient.readContract({
    address: facilitatorAddr,
    abi: Krexa402FacilitatorABI,
    functionName: 'resourceKey',
    args: [rawResourceHash, owner],
  }) as Promise<Hex>;
}

export async function getFacilitatorFeeBps(facilitatorAddr: Address) {
  const fee = await publicClient.readContract({
    address: facilitatorAddr,
    abi: Krexa402FacilitatorABI,
    functionName: 'facilitatorFeeBps',
  });
  return Number(fee);
}
