/**
 * Yield Scanner Service
 *
 * Fetches top yield opportunities on Solana from DeFi Llama.
 * Results are cached in-memory for 5 minutes.
 */

export interface YieldOpportunity {
  protocol: string;
  pool: string;
  apy: number;
  tvlUsd: number;
  token: string;
  category: string;
  chain: string;
}

interface DefiLlamaPool {
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apy: number | null;
  pool: string;
  stablecoin: boolean;
  ilRisk: string;
  exposure: string;
  poolMeta: string | null;
}

// ---------------------------------------------------------------------------
// In-memory cache (5 minutes)
// ---------------------------------------------------------------------------

let cache: YieldOpportunity[] | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface YieldFilters {
  limit?: number;
  minTvl?: number;
  token?: string;
}

export async function scanYields(filters?: YieldFilters): Promise<YieldOpportunity[]> {
  const now = Date.now();
  if (!cache || now - cacheTime > CACHE_TTL_MS) {
    cache = await fetchFromDefiLlama();
    cacheTime = now;
  }

  let results = cache;

  if (filters?.minTvl) {
    results = results.filter(y => y.tvlUsd >= filters.minTvl!);
  }

  if (filters?.token) {
    const t = filters.token.toUpperCase();
    results = results.filter(y => y.token.toUpperCase().includes(t));
  }

  const limit = filters?.limit ?? 20;
  return results.slice(0, limit);
}

// ---------------------------------------------------------------------------
// DeFi Llama fetch
// ---------------------------------------------------------------------------

async function fetchFromDefiLlama(): Promise<YieldOpportunity[]> {
  try {
    const res = await fetch('https://yields.llama.fi/pools');
    if (!res.ok) return [];

    const data = await res.json() as { data: DefiLlamaPool[] };
    const pools = data.data ?? [];

    return pools
      .filter(p => p.chain === 'Solana' && p.apy != null && p.apy > 0 && p.tvlUsd > 10_000)
      .sort((a, b) => (b.apy ?? 0) - (a.apy ?? 0))
      .slice(0, 100)
      .map(p => ({
        protocol: p.project,
        pool: p.symbol,
        apy: Math.round((p.apy ?? 0) * 100) / 100,
        tvlUsd: Math.round(p.tvlUsd),
        token: p.symbol.split('-')[0] ?? p.symbol,
        category: p.stablecoin ? 'Stablecoin' : p.exposure ?? 'Single',
        chain: p.chain,
      }));
  } catch {
    return [];
  }
}
