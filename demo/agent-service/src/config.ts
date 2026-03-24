import 'dotenv/config';

function require(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

// BUG-086 fix: don't store API key in config object (leak risk if serialized)
export function getAnthropicApiKey(): string { return require('ANTHROPIC_API_KEY'); }

export const config = {
  port: parseInt(process.env.PORT ?? '3001', 10),
  solanaRpcUrl: process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com',
  merchantWallet: require('MERCHANT_WALLET'),
  krexaApiUrl: process.env.KREXA_API_URL ?? 'https://api.krexa.xyz',

  // x402 prices in USDC base units (6 decimals)
  prices: {
    analyze: 250_000,   // $0.25
    trending: 500_000,  // $0.50
  },

  // Payment receipt header
  receiptHeader: 'x-payment-receipt',
  // Max age of a valid payment tx (seconds)
  paymentMaxAgeSecs: 300,
} as const;
