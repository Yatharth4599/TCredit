/**
 * DEX Aggregator Service
 *
 * Abstracts swap quote + transaction building via Jupiter V6 API.
 * No API key required. Solana-native.
 */

import { env } from '../config/env.js';

// ---------------------------------------------------------------------------
// Token registry — maps common symbols to Solana mint addresses
// ---------------------------------------------------------------------------

const MAINNET_TOKENS: Record<string, { mint: string; decimals: number }> = {
  SOL:  { mint: 'So11111111111111111111111111111111111111112', decimals: 9 },
  USDC: { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6 },
  USDT: { mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimals: 6 },
  BONK: { mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', decimals: 5 },
  JUP:  { mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',  decimals: 6 },
  RAY:  { mint: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', decimals: 6 },
  ORCA: { mint: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',  decimals: 6 },
};

// Devnet has different mints — use the env USDC mint
const DEVNET_TOKENS: Record<string, { mint: string; decimals: number }> = {
  SOL:  { mint: 'So11111111111111111111111111111111111111112', decimals: 9 },
  USDC: { mint: env.SOLANA_USDC_MINT, decimals: 6 },
};

const isDevnet = env.SOLANA_RPC_URL.includes('devnet');
const TOKEN_MAP = isDevnet ? DEVNET_TOKENS : MAINNET_TOKENS;

export interface ResolvedToken {
  mint: string;
  symbol: string;
  decimals: number;
}

/**
 * Resolve a token symbol or mint address to its mint + decimals.
 * Accepts "SOL", "USDC", or a raw base58 mint address.
 */
export function resolveToken(input: string): ResolvedToken {
  const upper = input.toUpperCase();
  const entry = TOKEN_MAP[upper];
  if (entry) {
    return { mint: entry.mint, symbol: upper, decimals: entry.decimals };
  }

  // Also check mainnet tokens as fallback (user might pass "BONK" on devnet)
  const mainnetEntry = MAINNET_TOKENS[upper];
  if (mainnetEntry) {
    return { mint: mainnetEntry.mint, symbol: upper, decimals: mainnetEntry.decimals };
  }

  // Treat as raw mint address — assume 6 decimals (USDC standard)
  // Caller should handle decimals properly for non-standard tokens
  return { mint: input, symbol: input.slice(0, 6) + '...', decimals: 6 };
}

// ---------------------------------------------------------------------------
// Jupiter V6 Quote API
// ---------------------------------------------------------------------------

export interface QuoteParams {
  inputMint: string;
  outputMint: string;
  amount: string;        // base units (lamports / smallest unit)
  slippageBps?: number;  // default 50 (0.5%)
}

export interface JupiterRoute {
  inAmount: string;
  outAmount: string;
  priceImpactPct: string;
  routePlan: unknown[];
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  inputMint: string;
  outputMint: string;
}

/**
 * Get the best swap route from Jupiter V6.
 */
export async function getQuote(params: QuoteParams): Promise<JupiterRoute> {
  const slippage = params.slippageBps ?? 50;
  const url = `${env.JUPITER_API_URL}/quote?inputMint=${params.inputMint}&outputMint=${params.outputMint}&amount=${params.amount}&slippageBps=${slippage}`;

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Jupiter quote failed (${res.status}): ${body}`);
  }

  return res.json() as Promise<JupiterRoute>;
}

// ---------------------------------------------------------------------------
// Jupiter V6 Swap API — builds unsigned transaction
// ---------------------------------------------------------------------------

export interface SwapResult {
  swapTransaction: string;  // base64-encoded versioned transaction
  lastValidBlockHeight: number;
  prioritizationFeeLamports: number;
}

/**
 * Build an unsigned swap transaction from a Jupiter quote.
 * Returns a base64-encoded VersionedTransaction ready for signing.
 */
export async function buildSwapTx(
  quoteResponse: JupiterRoute,
  userPublicKey: string,
): Promise<SwapResult> {
  const url = `${env.JUPITER_API_URL}/swap`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quoteResponse,
      userPublicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: 'auto',
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Jupiter swap tx build failed (${res.status}): ${body}`);
  }

  return res.json() as Promise<SwapResult>;
}

// ---------------------------------------------------------------------------
// Jupiter Price API — for portfolio valuation
// ---------------------------------------------------------------------------

export interface TokenPrice {
  id: string;
  mintSymbol?: string;
  vsToken?: string;
  vsTokenSymbol?: string;
  price: number;
}

/**
 * Get USD prices for a list of token mints.
 */
export async function getTokenPrices(mints: string[]): Promise<Record<string, TokenPrice>> {
  if (mints.length === 0) return {};

  const ids = mints.join(',');
  const url = `https://api.jup.ag/price/v2?ids=${ids}`;

  const res = await fetch(url);
  if (!res.ok) return {};

  const data = await res.json() as { data: Record<string, TokenPrice> };
  return data.data ?? {};
}
