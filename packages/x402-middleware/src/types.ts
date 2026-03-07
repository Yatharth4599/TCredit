export interface X402Config {
  /** Krexa backend API URL (e.g. https://api.krexa.xyz/api/v1) */
  kresxaApiUrl: string;
  /** Resource hash (keccak256 of URL) — identifies this endpoint */
  resourceHash: string;
  /** Price per call in USDC (human readable, e.g. "0.01") */
  priceUsdc: string;
  /** Merchant wallet address */
  merchantAddress: string;
}

export interface X402PaymentHeader {
  txHash: string;
  resourceHash: string;
  payer: string;
}

export interface X402PaymentRequirements {
  x402Version: 1;
  accepts: Array<{
    scheme: 'exact';
    network: 'base-sepolia';
    token: string;
    amount: string;
    resourceHash: string;
    facilitatorAddress: string;
    merchantAddress: string;
  }>;
}
