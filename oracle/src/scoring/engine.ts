import type { AgentData, ScoreResult } from "./types.js";

/** Cap on event arrays to prevent unbounded iteration (DoS protection). */
const MAX_EVENTS = 1000;

const SCORE_MIN = 200;
const SCORE_MAX = 850;
const SCORE_RANGE = SCORE_MAX - SCORE_MIN;

const WEIGHTS = {
  C1_REPAYMENT: 0.30,
  C2_PROFITABILITY: 0.25,
  C3_BEHAVIORAL: 0.20,
  C4_USAGE: 0.15,
  C5_MATURITY: 0.10,
};

const RECENCY = {
  LAST_30_DAYS: 2.0,
  DAYS_30_90: 1.5,
  DAYS_90_180: 1.0,
  OVER_180_DAYS: 0.5,
};

const SECONDS_PER_DAY = 86400;
const LIQUIDATION_PENALTY = 40;

// ── Helpers ──────────────────────────────────────────────────────────────────

function getRecencyWeight(ageSeconds: number): number {
  const ageDays = ageSeconds / SECONDS_PER_DAY;
  if (ageDays < 30) return RECENCY.LAST_30_DAYS;
  if (ageDays < 90) return RECENCY.DAYS_30_90;
  if (ageDays < 180) return RECENCY.DAYS_90_180;
  return RECENCY.OVER_180_DAYS;
}

function calculateMaxDrawdown(dailyPnl: number[]): number {
  let cumulative = 0;
  let peak = 0;
  let maxDrawdown = 0;
  for (const pnl of dailyPnl) {
    cumulative += pnl;
    peak = Math.max(peak, cumulative);
    const drawdown = peak > 0 ? (peak - cumulative) / peak : 0;
    maxDrawdown = Math.max(maxDrawdown, drawdown);
  }
  return maxDrawdown;
}

function calculateSharpeRatio(dailyPnl: number[]): number {
  if (dailyPnl.length < 2) return 0;
  const mean = dailyPnl.reduce((a, b) => a + b, 0) / dailyPnl.length;
  const variance = dailyPnl.reduce((sum, v) => sum + (v - mean) ** 2, 0) / dailyPnl.length;
  const stddev = Math.sqrt(variance);
  if (stddev === 0) return mean > 0 ? 1.0 : 0;
  return (mean / stddev) * Math.sqrt(365);
}

function aggregateDailyVolumes(transactions: Array<{ timestamp: number; volume: number }>): number[] {
  if (transactions.length === 0) return [];
  const dailyMap = new Map<string, number>();
  for (const tx of transactions) {
    const day = new Date(tx.timestamp * 1000).toISOString().split("T")[0];
    dailyMap.set(day, (dailyMap.get(day) || 0) + tx.volume);
  }
  return Array.from(dailyMap.values());
}

function clamp(value: number, min = 0.0, max = 1.0): number {
  return Math.max(min, Math.min(max, value));
}

// ── C1: Repayment History (30%) ──────────────────────────────────────────────

function computeC1(data: AgentData, now: number): number {
  let score = 0.70;
  if (data.repaymentEvents.length === 0) return score;

  for (const event of data.repaymentEvents.slice(-MAX_EVENTS)) {
    const recency = getRecencyWeight(now - event.timestamp);
    let delta: number;
    switch (event.type) {
      case "on_time": delta = 0.03; break;
      case "early": delta = 0.04; break;
      case "late": delta = -0.10; break;
      case "missed": delta = -0.25; break;
      case "liquidation": delta = -0.40; break;
      case "default": return 0.0;
    }
    score += delta * recency;
  }
  return clamp(score);
}

// ── C2: Profitability (25%) ──────────────────────────────────────────────────

function computeC2(data: AgentData, _now: number): number {
  let pnlRatio: number;
  if (data.agentType === "Trader") {
    if (data.originalCredit === 0) return 0.5;
    pnlRatio = (data.walletValue - data.originalCredit) / data.originalCredit;
  } else {
    const totalInvested = data.cumulativeExpenses || 1;
    pnlRatio = (data.cumulativeRevenue - totalInvested) / totalInvested;
  }

  // Sigmoid centered at 10% return
  let score = 1 / (1 + Math.exp(-10 * (pnlRatio - 0.10)));

  // Trend bonus/penalty
  if (data.dailyPnlHistory.length >= 14) {
    const recent7 = data.dailyPnlHistory.slice(-7);
    const prev7 = data.dailyPnlHistory.slice(-14, -7);
    const recentAvg = recent7.reduce((a, b) => a + b, 0) / 7;
    const prevAvg = prev7.reduce((a, b) => a + b, 0) / 7;
    if (recentAvg > prevAvg * 1.1) score += 0.10;
    else if (recentAvg < prevAvg * 0.9) score -= 0.10;
  }

  // Max drawdown penalty
  if (data.dailyPnlHistory.length >= 7) {
    const maxDrawdown = calculateMaxDrawdown(data.dailyPnlHistory);
    if (maxDrawdown > 0.30) score -= 0.15;
  }

  // Sharpe bonus
  if (data.dailyPnlHistory.length >= 30) {
    const sharpe = calculateSharpeRatio(data.dailyPnlHistory);
    if (sharpe > 1.0) score += 0.05;
  }

  return clamp(score);
}

// ── C3: Behavioral Health (20%) ──────────────────────────────────────────────

function computeC3(data: AgentData, now: number): number {
  const rawHistory = data.agentType === "Trader" ? data.navHistory : data.revenueHealthHistory;
  const history = rawHistory.slice(-MAX_EVENTS);
  if (history.length === 0) return 0.5;

  const cutoff = now - 90 * SECONDS_PER_DAY;
  const recent = history.filter(h => h.timestamp >= cutoff);
  if (recent.length === 0) return 0.5;

  let greenTime = 0, yellowTime = 0, orangeTime = 0, redTime = 0, totalTime = 0;
  for (let i = 0; i < recent.length - 1; i++) {
    const duration = recent[i + 1].timestamp - recent[i].timestamp;
    const zone = (recent[i] as { zone?: string; health?: string }).zone
      || (recent[i] as { zone?: string; health?: string }).health;
    totalTime += duration;
    switch (zone) {
      case "Green": greenTime += duration; break;
      case "Yellow": yellowTime += duration; break;
      case "Orange": orangeTime += duration; break;
      case "Red": redTime += duration; break;
    }
  }

  if (totalTime === 0) return 0.5;

  let score = (greenTime / totalTime) * 1.0
    + (yellowTime / totalTime) * 0.6
    + (orangeTime / totalTime) * 0.2
    + (redTime / totalTime) * 0.0;

  // Self-correction bonus
  const lastFew = recent.slice(-10);
  const wasInDanger = lastFew.some(h => {
    const z = (h as { zone?: string; health?: string }).zone
      || (h as { zone?: string; health?: string }).health;
    return z === "Orange" || z === "Red";
  });
  const lastEntry = lastFew.length > 0 ? lastFew[lastFew.length - 1] : null;
  const lastZone = lastEntry
    ? ((lastEntry as { zone?: string; health?: string }).zone
      || (lastEntry as { zone?: string; health?: string }).health)
    : null;
  if (wasInDanger && lastZone === "Green") score += 0.10;

  return clamp(score);
}

// ── C4: Usage Patterns (15%) ─────────────────────────────────────────────────

function computeC4(data: AgentData, now: number): number {
  if (data.transactions.length === 0) return 0.0;

  const cutoff = now - 90 * SECONDS_PER_DAY;
  const recentTxs = data.transactions.slice(-MAX_EVENTS).filter(t => t.timestamp >= cutoff);
  if (recentTxs.length === 0) return 0.0;

  if (data.agentType === "Trader") {
    // Shannon entropy of venue distribution
    const venueCounts = new Map<string, number>();
    for (const tx of recentTxs) {
      venueCounts.set(tx.venue, (venueCounts.get(tx.venue) || 0) + 1);
    }
    const totalTxs = recentTxs.length;
    const numVenues = venueCounts.size;

    let entropy = 0;
    for (const count of venueCounts.values()) {
      const p = count / totalTxs;
      if (p > 0) entropy -= p * Math.log2(p);
    }
    const maxEntropy = numVenues > 1 ? Math.log2(numVenues) : 1;
    let score = entropy / maxEntropy;

    // Volume consistency bonus
    const dailyVolumes = aggregateDailyVolumes(recentTxs);
    if (dailyVolumes.length >= 7) {
      const mean = dailyVolumes.reduce((a, b) => a + b, 0) / dailyVolumes.length;
      const stddev = Math.sqrt(dailyVolumes.reduce((sum, v) => sum + (v - mean) ** 2, 0) / dailyVolumes.length);
      const cv = mean > 0 ? stddev / mean : 1;
      if (cv < 0.5) score += 0.15;
      else if (cv > 2.0) score -= 0.10;
    }
    return clamp(score);
  } else {
    // Type B: diversity + efficiency + consistency
    const sources = new Set(recentTxs.map(t => t.venue));
    const diversityScore = Math.min(1.0, sources.size / 10);

    const efficiency = data.cumulativeExpenses > 0
      ? data.cumulativeRevenue / data.cumulativeExpenses
      : 0;
    const efficiencyScore = Math.min(1.0, efficiency / 3);

    const dailyRevenues = aggregateDailyVolumes(recentTxs.filter(t => t.volume > 0));
    let consistencyScore = 0.5;
    if (dailyRevenues.length >= 7) {
      const mean = dailyRevenues.reduce((a, b) => a + b, 0) / dailyRevenues.length;
      const stddev = Math.sqrt(dailyRevenues.reduce((sum, v) => sum + (v - mean) ** 2, 0) / dailyRevenues.length);
      const cv = mean > 0 ? stddev / mean : 1;
      consistencyScore = cv < 0.5 ? 0.8 : cv < 1.0 ? 0.6 : cv < 2.0 ? 0.4 : 0.2;
    }

    return 0.35 * diversityScore + 0.35 * efficiencyScore + 0.30 * consistencyScore;
  }
}

// ── C5: Account Maturity (10%) ───────────────────────────────────────────────

function computeC5(data: AgentData, now: number): number {
  const ageDays = (now - data.registeredAt) / SECONDS_PER_DAY;
  const ageScore = Math.min(1.0, Math.log(ageDays + 1) / Math.log(400));
  const volumeScore = Math.min(1.0, Math.log10(data.lifetimeVolume + 1) / 7);
  const cycleScore = Math.min(1.0, data.creditCyclesCompleted / 22);
  return 0.40 * ageScore + 0.30 * volumeScore + 0.30 * cycleScore;
}

// ── Level Determination ──────────────────────────────────────────────────────

function determineLevel(score: number, data: AgentData, now: number): number {
  const ageDays = (now - data.registeredAt) / SECONDS_PER_DAY;
  const ageMonths = ageDays / 30;
  if (score >= 750 && ageMonths >= 6) return 4;
  if (score >= 650 && ageMonths >= 3) return 3;
  if (score >= 500) return 2;
  return 1;
}

// ── Main Computation ─────────────────────────────────────────────────────────

export function computeKrexitScore(data: AgentData): ScoreResult {
  const now = Math.floor(Date.now() / 1000);

  const c1 = computeC1(data, now);
  const c2 = computeC2(data, now);
  const c3 = computeC3(data, now);
  const c4 = computeC4(data, now);
  const c5 = computeC5(data, now);

  const composite =
    WEIGHTS.C1_REPAYMENT * c1 +
    WEIGHTS.C2_PROFITABILITY * c2 +
    WEIGHTS.C3_BEHAVIORAL * c3 +
    WEIGHTS.C4_USAGE * c4 +
    WEIGHTS.C5_MATURITY * c5;

  const score = Math.round(SCORE_MIN + SCORE_RANGE * composite);
  const clampedScore = Math.max(SCORE_MIN, Math.min(SCORE_MAX, score));
  const level = determineLevel(clampedScore, data, now);

  return {
    score: clampedScore,
    level,
    c1: Math.round(c1 * 10000),
    c2: Math.round(c2 * 10000),
    c3: Math.round(c3 * 10000),
    c4: Math.round(c4 * 10000),
    c5: Math.round(c5 * 10000),
  };
}

export { LIQUIDATION_PENALTY, SCORE_MIN, SCORE_MAX };
