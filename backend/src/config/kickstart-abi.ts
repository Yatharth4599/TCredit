export const KickstartFactoryABI = [
  {
    name: 'createToken',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'symbol', type: 'string' },
      { name: 'uri', type: 'string' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ name: 'token', type: 'address' }],
  },
  {
    name: 'getCurves',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'start', type: 'uint256' },
      { name: 'count', type: 'uint256' },
    ],
    outputs: [{ name: 'curves', type: 'address[]' }],
  },
  {
    name: 'getBondingCurveConfig',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'virtualEth', type: 'uint256' },
      { name: 'virtualToken', type: 'uint256' },
      { name: 'targetEth', type: 'uint256' },
    ],
  },
] as const;

// Generic bonding curve buy function — tokens on Kickstart accept ETH directly
export const BondingCurveABI = [
  {
    name: 'buy',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'minTokensOut', type: 'uint256' },
    ],
    outputs: [{ name: 'tokensOut', type: 'uint256' }],
  },
  {
    name: 'token',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;
