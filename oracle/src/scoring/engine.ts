import type { AgentData, ScoreResult } from "./types.js";
import type { FairScaleReport } from "./fairscale.js";

const SCORE_MIN = 200;
const SCORE_MAX = 850;
const SCORE_RANGE = SCORE_MAX - SCORE_MIN; // 650
const DEFAULT_BASE = 400;
const LIQUIDATION_PENALTY = 40;
const SECONDS_PER_DAY = 86400;

// ── Recency Weighting ────────────────────────────────────────────────────────

const RECENCY = {
  LAST_30_DAYS: 2.0,
  DAYS_30_90: 1.5,
  DAYS_90_180: 1.0,
  OVER_180_DAYS: 0.5,
};

function getRecencyWeight(ageSeconds: number): number {
  const ageDays = ageSeconds / SECONDS_PER_DAY;
  if (ageDays < 30) return RECENCY.LAST_30_DAYS;
  if (ageDays < 90) return RECENCY.DAYS_30_90;
  if (ageDays < 180) return RECENCY.DAYS_90_180;
  return RECENCY.OVER_180_DAYS;
}

// ── Base Score (from FairScale) ──────────────────────────────────────────────

function computeBase(report: FairScaleReport | null): number {
  if (!report || typeof report.credit_score !== "number") return DEFAULT_BASE;
  // FairScale 0-100 → Krexit 200-850
  return SCORE_MIN + (report.credit_score / 100) * SCORE_RANGE;
}

// ── On-Chain Modifiers (Krexa-specific behavior) ─────────────────────────────

function computeModifiers(data: AgentData, report: FairScaleReport | null): number {
  const now = Math.floor(Date.now() / 1000);
  let mod = 0;

  // Repayment history (cap at 1000 events for DoS protection)
  for (const event of data.repaymentEvents.slice(-1000)) {
    const recency = getRecencyWeight(now - event.timestamp);
    switch (event.type) {
      case "on_time":     mod += 8 * recency; break;
      case "early":       mod += 10 * recency; break;
      case "late":        mod -= 15 * recency; break;
      case "missed":      mod -= 30 * recency; break;
      case "liquidation": mod -= LIQUIDATION_PENALTY * recency; break;
      case "default":     mod -= 100; break;
    }
  }

  // Account age: +5 per month, cap +60
  const ageMonths = (now - data.registeredAt) / (SECONDS_PER_DAY * 30);
  mod += Math.min(60, Math.floor(ageMonths) * 5);

  // Credit cycles: +3 each, cap +30
  mod += Math.min(30, data.creditCyclesCompleted * 3);

  // Lifetime volume: +2 per $10K, cap +20
  mod += Math.min(20, Math.floor(data.lifetimeVolume / 10_000) * 2);

  // Debt stress: -10 if using >80% of credit limit
  if (data.originalCredit > 0 && data.currentDebt / data.originalCredit > 0.80) {
    mod -= 10;
  }

  // FairScale decline penalty (extra -50 on top of already-low base)
  if (report?.risk_band === "decline") {
    mod -= 50;
  }

  return mod;
}

// ── Level Determination ──────────────────────────────────────────────────────

function determineLevel(
  score: number,
  data: AgentData,
  report: FairScaleReport | null,
): number {
  const now = Math.floor(Date.now() / 1000);
  const ageMonths = (now - data.registeredAt) / (SECONDS_PER_DAY * 30);
  const maxCredit = report?.underwriting?.lending_terms?.max_credit_line;

  if (score >= 750 && ageMonths >= 6) {
    if (maxCredit !== undefined && maxCredit < 100_000) return 3;
    return 4;
  }
  if (score >= 650 && ageMonths >= 3) {
    if (maxCredit !== undefined && maxCredit < 25_000) return 2;
    return 3;
  }
  if (score >= 500) {
    if (report?.risk_band === "decline") return 1;
    return 2;
  }
  return 1;
}

// ── Main Computation ─────────────────────────────────────────────────────────

export function computeKrexitScore(
  data: AgentData,
  report: FairScaleReport | null,
): ScoreResult {
  const base = computeBase(report);
  const modifiers = computeModifiers(data, report);
  const raw = base + modifiers;
  const score = Math.max(SCORE_MIN, Math.min(SCORE_MAX, Math.round(raw)));
  const level = determineLevel(score, data, report);

  return {
    score,
    level,
    fairscaleBase: Math.round(base),
    modifierTotal: Math.round(modifiers),
    attestationHash: report?.attestation?.payload_hash ?? "",
  };
}

export { LIQUIDATION_PENALTY, SCORE_MIN, SCORE_MAX };
