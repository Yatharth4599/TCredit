/**
 * Token price feed — wraps Jupiter Price API v2.
 * For MVP, only USDC is relevant (always $1.00).  SOL and other tokens
 * are fetched for future collateral-pricing support.
 */

const JUPITER_PRICE_API = 'https://api.jup.ag/price/v2';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // mainnet USDC

// Cache prices for 30 s to avoid hammering Jupiter
interface PriceCache {
  usd: number;
  fetchedAt: number;
}

const cache = new Map<string, PriceCache>();
const CACHE_TTL_MS = 30_000;

export async function getTokenPriceUsd(mintAddress: string): Promise<number> {
  const now = Date.now();
  const cached = cache.get(mintAddress);
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.usd;
  }

  // USDC is always $1.00 — never fetch
  if (mintAddress === USDC_MINT) {
    cache.set(mintAddress, { usd: 1.0, fetchedAt: now });
    return 1.0;
  }

  try {
    const url = `${JUPITER_PRICE_API}?ids=${mintAddress}&vsToken=${USDC_MINT}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) throw new Error(`Jupiter API ${resp.status}`);

    const json = await resp.json() as {
      data?: Record<string, { price?: string }>;
    };

    const priceStr = json.data?.[mintAddress]?.price;
    if (!priceStr) throw new Error('price not found in response');

    const price = parseFloat(priceStr);
    cache.set(mintAddress, { usd: price, fetchedAt: now });
    return price;
  } catch (err) {
    console.warn(`[PriceFeed] Failed to fetch price for ${mintAddress}:`, err instanceof Error ? err.message : err);
    // Return cached stale value if available; otherwise 0
    return cached?.usd ?? 0;
  }
}

/** Convert lamports → USD using current SOL price. */
export async function lamportsToUsd(lamports: bigint, solMintAddress: string): Promise<number> {
  const SOL_DECIMALS = 9;
  const sol = Number(lamports) / 10 ** SOL_DECIMALS;
  const price = await getTokenPriceUsd(solMintAddress);
  return sol * price;
}

/** Convert USDC base units (6 decimals) → dollars. */
export function usdcToUsd(baseUnits: bigint): number {
  return Number(baseUnits) / 1_000_000;
}
