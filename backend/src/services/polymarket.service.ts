// Polymarket Data API — no auth required
// Traders are identified by their EVM wallet address (same on Polygon + Base)

const POLYMARKET_DATA_API = 'https://data-api.polymarket.com';

// 5-minute cache
const cache = new Map<string, { data: PolymarketStats; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export interface PolymarketPosition {
  market:         string;
  outcome:        string;
  size:           number;
  avgPrice:       number;
  currentValue:   number;
  realizedPnl:    number;
  unrealizedPnl:  number;
}

export interface PolymarketActivity {
  id:          string;
  type:        string;   // "trade", "redeem", etc.
  market:      string;
  outcome:     string;
  size:        number;
  price:       number;
  timestamp:   number;
}

export interface PolymarketStats {
  address:          string;
  totalVolume:      number;   // USDC
  realizedPnl:      number;   // USDC, can be negative
  unrealizedPnl:    number;
  winRate:          number;   // 0-1 (fraction of profitable closed positions)
  totalTrades:      number;
  openPositions:    number;
  accountAgedays:   number;
  firstTradeAt:     number | null;
  suggestedScore:   number;   // 0-1000 credit score suggestion
  scoreBreakdown: {
    winRate:       number;   // points contribution
    volume:        number;
    realizedPnl:   number;
    accountAge:    number;
  };
}

export async function getTraderStats(address: string): Promise<PolymarketStats> {
  const cacheKey = address.toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const [positionsRes, activityRes] = await Promise.allSettled([
    fetch(`${POLYMARKET_DATA_API}/positions?user=${address}&sizeThreshold=.1`),
    fetch(`${POLYMARKET_DATA_API}/activity?user=${address}&limit=500`),
  ]);

  let positions: PolymarketPosition[] = [];
  let activities: PolymarketActivity[] = [];

  if (positionsRes.status === 'fulfilled' && positionsRes.value.ok) {
    try {
      const raw = await positionsRes.value.json() as unknown[];
      positions = (raw || []).map((p: unknown) => {
        const pos = p as Record<string, unknown>;
        return {
          market:        String(pos.market || pos.conditionId || ''),
          outcome:       String(pos.outcome || pos.title || ''),
          size:          Number(pos.size || pos.currentTokens || 0),
          avgPrice:      Number(pos.avgPrice || pos.avgCost || 0),
          currentValue:  Number(pos.currentValue || pos.value || 0),
          realizedPnl:   Number(pos.realizedPnl || pos.realizedProfit || 0),
          unrealizedPnl: Number(pos.unrealizedPnl || pos.unrealizedProfit || 0),
        };
      });
    } catch { /* ignore parse errors */ }
  }

  if (activityRes.status === 'fulfilled' && activityRes.value.ok) {
    try {
      const raw = await activityRes.value.json() as unknown[];
      activities = (raw || []).map((a: unknown) => {
        const act = a as Record<string, unknown>;
        return {
          id:        String(act.id || ''),
          type:      String(act.type || act.action || 'trade'),
          market:    String(act.market || act.conditionId || ''),
          outcome:   String(act.outcome || ''),
          size:      Number(act.size || act.amount || 0),
          price:     Number(act.price || act.usdcSize || 0),
          timestamp: Number(act.timestamp || act.createdAt || 0),
        };
      });
    } catch { /* ignore parse errors */ }
  }

  // Compute stats
  const totalVolume   = activities.reduce((s, a) => s + a.price, 0);
  const realizedPnl   = positions.reduce((s, p) => s + p.realizedPnl, 0);
  const unrealizedPnl = positions.reduce((s, p) => s + p.unrealizedPnl, 0);
  const openPositions = positions.filter(p => p.size > 0).length;
  const totalTrades   = activities.filter(a => a.type === 'trade' || a.type === 'BUY' || a.type === 'SELL').length;

  // Win rate: fraction of closed positions with positive realized PnL
  const closedPositions = positions.filter(p => p.realizedPnl !== 0);
  const winningPositions = closedPositions.filter(p => p.realizedPnl > 0);
  const winRate = closedPositions.length > 0 ? winningPositions.length / closedPositions.length : 0;

  // Account age
  const timestamps = activities.map(a => a.timestamp).filter(t => t > 0);
  const firstTradeAt = timestamps.length > 0 ? Math.min(...timestamps) : null;
  const accountAgeDays = firstTradeAt
    ? Math.floor((Date.now() / 1000 - firstTradeAt) / 86400)
    : 0;

  // Credit score suggestion (0-1000)
  const winRatePts    = winRate >= 0.6 ? 300 : winRate >= 0.5 ? 150 : winRate >= 0.4 ? 75 : 0;
  const volumePts     = totalVolume >= 10_000 ? 200 : totalVolume >= 1_000 ? 100 : totalVolume >= 100 ? 50 : 0;
  const pnlPts        = realizedPnl > 0 ? 200 : 0;
  const accountAgePts = accountAgeDays >= 90 ? 100 : accountAgeDays >= 30 ? 50 : 0;
  // No liquidations proxy: if we have activity but no negative outliers, give points
  const noLiquidationPts = totalTrades > 0 && realizedPnl > -100 ? 200 : 0;

  const suggestedScore = Math.min(1000, winRatePts + volumePts + pnlPts + accountAgePts + noLiquidationPts);

  const stats: PolymarketStats = {
    address,
    totalVolume,
    realizedPnl,
    unrealizedPnl,
    winRate,
    totalTrades,
    openPositions,
    accountAgedays: accountAgeDays,
    firstTradeAt,
    suggestedScore,
    scoreBreakdown: {
      winRate:    winRatePts,
      volume:     volumePts,
      realizedPnl: pnlPts,
      accountAge: accountAgePts,
    },
  };

  cache.set(cacheKey, { data: stats, ts: Date.now() });
  setTimeout(() => cache.delete(cacheKey), CACHE_TTL);

  return stats;
}
