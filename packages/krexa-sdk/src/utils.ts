import BN from "bn.js";
import { PROTOCOL_CONSTANTS } from "./types.js";

const { USDC_DECIMALS, BPS_DENOMINATOR, SECONDS_PER_YEAR } = PROTOCOL_CONSTANTS;

/** Convert USDC human amount (e.g. 500) to base units (500_000_000). */
export function usdcToLamports(usdc: number): BN {
  return new BN(Math.round(usdc * 10 ** USDC_DECIMALS));
}

/** Convert USDC base units to human-readable string. */
export function lamportsToUsdc(lamports: BN): string {
  const str = lamports.toString().padStart(USDC_DECIMALS + 1, "0");
  const whole = str.slice(0, -USDC_DECIMALS) || "0";
  const frac = str.slice(-USDC_DECIMALS);
  return `${whole}.${frac}`;
}

/** Format USDC with $ sign. */
export function formatUsdc(lamports: BN): string {
  return `$${lamportsToUsdc(lamports)}`;
}

/** Convert BPS to percentage string. */
export function bpsToPercent(bps: number): string {
  return (bps / 100).toFixed(2) + "%";
}

/** Convert BPS to decimal. */
export function bpsToDecimal(bps: number): number {
  return bps / BPS_DENOMINATOR;
}

/** Calculate simple interest: principal * rate_bps / 10000 * seconds / SECONDS_PER_YEAR. */
export function calculateSimpleInterest(
  principal: BN,
  rateBps: number,
  seconds: number
): BN {
  return principal
    .mul(new BN(rateBps))
    .mul(new BN(seconds))
    .div(new BN(BPS_DENOMINATOR))
    .div(new BN(SECONDS_PER_YEAR));
}

/** Calculate health factor: (walletBalance + collateralValue) * 10000 / totalDebt. */
export function calculateHealthFactor(
  walletBalance: BN,
  collateralValue: BN,
  totalDebt: BN
): number {
  if (totalDebt.isZero()) return PROTOCOL_CONSTANTS.HF_HEALTHY;
  return walletBalance
    .add(collateralValue)
    .mul(new BN(PROTOCOL_CONSTANTS.HF_DECIMALS))
    .div(totalDebt)
    .toNumber();
}

/** Get credit terms for a given level. */
export function getCreditTerms(level: number) {
  const c = PROTOCOL_CONSTANTS;
  const maxCredits = [c.LEVEL_0_MAX_CREDIT, c.LEVEL_1_MAX_CREDIT, c.LEVEL_2_MAX_CREDIT, c.LEVEL_3_MAX_CREDIT, c.LEVEL_4_MAX_CREDIT];
  const rates = [0, c.LEVEL_1_RATE_BPS, c.LEVEL_2_RATE_BPS, c.LEVEL_3_RATE_BPS, c.LEVEL_4_RATE_BPS];
  const navTriggers = [0, c.LEVEL_1_NAV_TRIGGER_BPS, c.LEVEL_2_NAV_TRIGGER_BPS, c.LEVEL_3_NAV_TRIGGER_BPS, c.LEVEL_4_NAV_TRIGGER_BPS];

  return {
    maxCredit: new BN(maxCredits[level] ?? 0),
    interestRateBps: rates[level] ?? 0,
    interestRateDaily: bpsToPercent(Math.round((rates[level] ?? 0) / 365)),
    interestRateAnnual: bpsToPercent(rates[level] ?? 0),
    navTriggerBps: navTriggers[level] ?? 0,
    collateralRequired: level >= 2,
    leverageRatio: level === 0 ? "N/A" : level === 1 ? "No collateral" : level === 2 ? "1:1" : level === 3 ? "1:2" : "1:5",
  };
}

/** Decode a [u8; 32] name to string (null-terminated). */
export function decodeName(nameBytes: number[]): string {
  const end = nameBytes.indexOf(0);
  const bytes = end === -1 ? nameBytes : nameBytes.slice(0, end);
  return Buffer.from(bytes).toString("utf-8");
}

/** Encode a string to [u8; 32] name (null-padded). */
export function encodeName(name: string): number[] {
  const buf = Buffer.alloc(32);
  Buffer.from(name, "utf-8").copy(buf, 0, 0, 32);
  return Array.from(buf);
}
