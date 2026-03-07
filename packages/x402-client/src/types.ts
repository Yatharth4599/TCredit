export interface X402ClientConfig {
  /** Krexa backend API URL */
  kresxaApiUrl: string;
  /** Payer wallet address */
  payerAddress: string;
  /** Function to sign and submit transactions (wallet-dependent) */
  sendTransaction: (tx: { to: string; data: string; value?: string }) => Promise<string>;
}

export interface X402PaymentRequirements {
  x402Version: number;
  accepts: Array<{
    scheme: string;
    network: string;
    token: string;
    amount: string;
    resourceHash: string;
    facilitatorAddress: string;
    merchantAddress: string;
  }>;
}

export interface X402FetchOptions extends RequestInit {
  /** If true, do not auto-pay on 402 response */
  skipAutoPayment?: boolean;
}
