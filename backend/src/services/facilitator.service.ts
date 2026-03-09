import { keccak256, toHex, encodeAbiParameters, parseAbiParameters, encodeFunctionData, decodeFunctionData, type Address, type Hex } from 'viem';
import { publicClient } from '../chain/client.js';
import { getResource } from '../chain/facilitator.js';

// Minimal ABI for facilitator writes
const Krexa402FacilitatorABI = [
  {
    inputs: [
      { name: 'resourceHash', type: 'bytes32' },
      { name: 'pricePerCall', type: 'uint256' },
    ],
    name: 'registerResource',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'resourceHash', type: 'bytes32' },
      {
        components: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'amount', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
          { name: 'paymentId', type: 'bytes32' },
        ],
        name: 'payment',
        type: 'tuple',
      },
      { name: 'signature', type: 'bytes' },
    ],
    name: 'executeX402Payment',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

export function hashResourceUrl(url: string): Hex {
  return keccak256(toHex(url));
}

/// Compute the storage key for a resource (matches Krexa402Facilitator.resourceKey)
export function computeResourceKey(resourceHash: Hex, owner: Address): Hex {
  return keccak256(
    encodeAbiParameters(parseAbiParameters('bytes32, address'), [resourceHash, owner]),
  );
}

export async function registerResourceTx(
  facilitatorAddr: Address,
  url: string,
  pricePerCall: bigint,
) {
  const resourceHash = hashResourceUrl(url);
  const data = encodeFunctionData({
    abi: Krexa402FacilitatorABI,
    functionName: 'registerResource',
    args: [resourceHash, pricePerCall],
  });
  return { to: facilitatorAddr, data, resourceHash };
}

export async function verifyPaymentReceipt(
  facilitatorAddr: Address,
  resourceHash: Hex,
  txHash: Hex,
) {
  const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
  if (receipt.status === 'reverted') {
    return { valid: false, reason: 'Transaction reverted' };
  }

  // Check that the tx was sent to the facilitator
  const tx = await publicClient.getTransaction({ hash: txHash });
  if (tx.to?.toLowerCase() !== facilitatorAddr.toLowerCase()) {
    return { valid: false, reason: 'Transaction not directed to facilitator' };
  }

  // Decode calldata to verify it called executeX402Payment with the correct resourceHash
  try {
    const decoded = decodeFunctionData({
      abi: Krexa402FacilitatorABI,
      data: tx.input,
    });
    if (decoded.functionName !== 'executeX402Payment') {
      return { valid: false, reason: 'Transaction did not call executeX402Payment' };
    }
    const [calledResourceHash] = decoded.args as [Hex, unknown, unknown];
    if (calledResourceHash.toLowerCase() !== resourceHash.toLowerCase()) {
      return { valid: false, reason: 'Resource hash mismatch in calldata' };
    }
  } catch {
    return { valid: false, reason: 'Could not decode transaction calldata' };
  }

  // Verify the resource is valid
  const resource = await getResource(facilitatorAddr, resourceHash);
  if (!resource.active) {
    return { valid: false, reason: 'Resource not active' };
  }

  return {
    valid: true,
    blockNumber: receipt.blockNumber.toString(),
    from: tx.from,
    resourceOwner: resource.owner,
  };
}
