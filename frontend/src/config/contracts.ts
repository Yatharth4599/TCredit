// Deployed contract addresses — Base Sepolia (chainId: 84532)
// Source: base-contracts/deployments/base-sepolia.json

export const CONTRACTS = {
  agentRegistry: '0xAEa7C5CCACebB1423b163b765d3214752f1496A4',
  paymentRouter: '0xf8A5ED433222dFfb9514637243C3599cCE87f977',
  vaultFactory: '0xf8fDa17F877dEFFCD80784E0465F33d585644360',
  seniorPool: '0xDf980d0734b00888e4Ac350027515B4D6E473bBa',
  generalPool: '0x7E7D8082572C0AD2f51074D272A501180Db06Fb2',
  milestoneRegistry: '0x48a471eEB88f84a867bEBC0f6DFF848660BC8c84',
  usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
} as const;

export const USDC_DECIMALS = 6;

export const CHAIN_ID = 84532;

export const BASESCAN_URL = 'https://sepolia.basescan.org';

export function txUrl(txHash: string): string {
  return `${BASESCAN_URL}/tx/${txHash}`;
}

export function addressUrl(address: string): string {
  return `${BASESCAN_URL}/address/${address}`;
}
