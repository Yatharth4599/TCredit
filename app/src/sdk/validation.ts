import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { AgentType, CreditLevel, PROTOCOL_CONSTANTS, Tranche } from "./types.js";

const {
  LEVEL_1_MAX_CREDIT,
  LEVEL_2_MAX_CREDIT,
  LEVEL_3_MAX_CREDIT,
  LEVEL_4_MAX_CREDIT,
  USDC_ONE,
  HF_WARNING,
  MAX_PER_TRADE_BPS,
  WITHDRAWAL_BUFFER_BPS,
  BPS_DENOMINATOR,
} = PROTOCOL_CONSTANTS;

// ─────────────────────────────────────────────────────────────────────────────
// Generic helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate that a BN amount satisfies basic constraints.
 *
 * @throws If amount is not positive, or violates min/max bounds.
 */
export function validateAmount(
  amount: BN,
  fieldName: string,
  min?: BN,
  max?: BN,
): void {
  if (amount.lte(new BN(0))) {
    throw new Error(`${fieldName} must be positive, got ${amount.toString()}`);
  }
  if (min && amount.lt(min)) {
    throw new Error(
      `${fieldName} must be >= ${min.toString()}, got ${amount.toString()}`,
    );
  }
  if (max && amount.gt(max)) {
    throw new Error(
      `${fieldName} must be <= ${max.toString()}, got ${amount.toString()}`,
    );
  }
}

/**
 * Validate and parse a base58-encoded public key string.
 *
 * @returns The parsed PublicKey.
 * @throws If the string is not valid base58 or does not decode to 32 bytes.
 */
export function validatePublicKey(value: string, fieldName: string): PublicKey {
  let pk: PublicKey;
  try {
    pk = new PublicKey(value);
  } catch {
    throw new Error(
      `${fieldName} is not a valid base58-encoded public key: "${value}"`,
    );
  }

  // PublicKey constructor already validates 32-byte length, but be explicit.
  if (pk.toBytes().length !== 32) {
    throw new Error(
      `${fieldName} must decode to exactly 32 bytes, got ${pk.toBytes().length}`,
    );
  }

  return pk;
}

// ─────────────────────────────────────────────────────────────────────────────
// Max credit lookup
// ─────────────────────────────────────────────────────────────────────────────

const MAX_CREDIT_BY_LEVEL: Record<number, BN> = {
  [CreditLevel.Starter]: new BN(LEVEL_1_MAX_CREDIT),
  [CreditLevel.Established]: new BN(LEVEL_2_MAX_CREDIT),
  [CreditLevel.Trusted]: new BN(LEVEL_3_MAX_CREDIT),
  [CreditLevel.Elite]: new BN(LEVEL_4_MAX_CREDIT),
};

// ─────────────────────────────────────────────────────────────────────────────
// Credit request
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate parameters for a credit request.
 *
 * @throws Descriptive error if any rule is violated.
 */
export function validateCreditRequest(params: {
  amount: BN;
  creditLevel: number;
  agentType?: number;
  servicePlan?: {
    milestones: Array<{ amount: BN; condition: number }>;
    expectedDailyRevenue: BN;
    expenseWhitelist: PublicKey[];
    maxExpensePerTx: BN;
  };
}): void {
  const { amount, creditLevel, agentType, servicePlan } = params;

  // --- Amount ---
  if (amount.lte(new BN(0))) {
    throw new Error(
      `Credit request amount must be positive, got ${amount.toString()}`,
    );
  }

  // --- Credit level ---
  if (
    creditLevel < CreditLevel.Starter ||
    creditLevel > CreditLevel.Elite
  ) {
    throw new Error(
      `Credit level must be 1-4 (Starter through Elite), got ${creditLevel}`,
    );
  }

  // --- Max credit for level ---
  const maxCredit = MAX_CREDIT_BY_LEVEL[creditLevel];
  if (maxCredit && amount.gt(maxCredit)) {
    throw new Error(
      `Credit request amount ${amount.toString()} exceeds maximum ` +
        `${maxCredit.toString()} for level ${creditLevel}`,
    );
  }

  // --- Service agent rules ---
  if (agentType === AgentType.Service) {
    if (!servicePlan) {
      throw new Error(
        "servicePlan is required for Service (Type B) agents",
      );
    }

    const { milestones, expectedDailyRevenue, expenseWhitelist, maxExpensePerTx } =
      servicePlan;

    // Milestone count
    if (milestones.length < 2) {
      throw new Error(
        `At least 2 milestones required (one immediate + one conditional), got ${milestones.length}`,
      );
    }
    if (milestones.length > 8) {
      throw new Error(
        `Maximum 8 milestones allowed, got ${milestones.length}`,
      );
    }

    // First milestone must be Immediate (condition 0)
    if (milestones[0].condition !== 0) {
      throw new Error(
        `First milestone must have condition 0 (Immediate), got ${milestones[0].condition}`,
      );
    }

    // First milestone cannot exceed 30% of total credit
    const thirtyPercent = amount.mul(new BN(30)).div(new BN(100));
    if (milestones[0].amount.gt(thirtyPercent)) {
      throw new Error(
        `First milestone amount ${milestones[0].amount.toString()} exceeds 30% ` +
          `of total credit (${thirtyPercent.toString()})`,
      );
    }

    // Milestones must sum to total credit amount
    let milestoneSum = new BN(0);
    for (const m of milestones) {
      milestoneSum = milestoneSum.add(m.amount);
    }
    if (!milestoneSum.eq(amount)) {
      throw new Error(
        `Milestones must sum to total credit amount ${amount.toString()}, ` +
          `got ${milestoneSum.toString()}`,
      );
    }

    // expectedDailyRevenue
    if (expectedDailyRevenue.lte(new BN(0))) {
      throw new Error(
        `expectedDailyRevenue must be positive, got ${expectedDailyRevenue.toString()}`,
      );
    }

    // expenseWhitelist
    if (expenseWhitelist.length < 1 || expenseWhitelist.length > 20) {
      throw new Error(
        `expenseWhitelist must have 1-20 entries, got ${expenseWhitelist.length}`,
      );
    }

    // maxExpensePerTx
    if (maxExpensePerTx.lte(new BN(0))) {
      throw new Error(
        `maxExpensePerTx must be positive, got ${maxExpensePerTx.toString()}`,
      );
    }
    if (maxExpensePerTx.gt(amount)) {
      throw new Error(
        `maxExpensePerTx ${maxExpensePerTx.toString()} cannot exceed total credit amount ${amount.toString()}`,
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Deposit
// ─────────────────────────────────────────────────────────────────────────────

const MIN_DEPOSIT = new BN(USDC_ONE); // $1 USDC

/**
 * Validate a deposit amount.
 *
 * @throws If amount is not positive or below minimum ($1 USDC).
 */
export function validateDeposit(amount: BN): void {
  if (amount.lte(new BN(0))) {
    throw new Error(
      `Deposit amount must be positive, got ${amount.toString()}`,
    );
  }
  if (amount.lt(MIN_DEPOSIT)) {
    throw new Error(
      `Minimum deposit is $1 USDC (${MIN_DEPOSIT.toString()} base units), ` +
        `got ${amount.toString()}`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Withdrawal
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate a withdrawal.
 *
 * @throws If amount exceeds balance or would leave insufficient buffer over debt.
 */
export function validateWithdrawal(
  amount: BN,
  walletBalance: BN,
  totalDebt: BN,
): void {
  if (amount.lte(new BN(0))) {
    throw new Error(
      `Withdrawal amount must be positive, got ${amount.toString()}`,
    );
  }
  if (amount.gt(walletBalance)) {
    throw new Error(
      `Withdrawal amount ${amount.toString()} exceeds wallet balance ${walletBalance.toString()}`,
    );
  }

  // After withdrawal, remaining balance must be >= 120% of total debt
  if (!totalDebt.isZero()) {
    const remaining = walletBalance.sub(amount);
    const requiredMin = totalDebt
      .mul(new BN(WITHDRAWAL_BUFFER_BPS))
      .div(new BN(BPS_DENOMINATOR));
    if (remaining.lt(requiredMin)) {
      throw new Error(
        `After withdrawal, remaining balance ${remaining.toString()} would be below ` +
          `required minimum of 120% of total debt (${requiredMin.toString()})`,
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Repayment
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate a repayment amount.
 *
 * @throws If amount is not positive.
 *         Logs a warning (does not throw) if amount exceeds total debt.
 */
export function validateRepayment(amount: BN, totalDebt: BN): void {
  if (amount.lte(new BN(0))) {
    throw new Error(
      `Repayment amount must be positive, got ${amount.toString()}`,
    );
  }
  if (amount.gt(totalDebt)) {
    console.warn(
      `Repayment amount ${amount.toString()} exceeds total debt ${totalDebt.toString()}. ` +
        `Overpayment will be refunded.`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Trade
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate a trade.
 *
 * @throws If amount violates size limits or health factor is in warning zone.
 */
export function validateTrade(
  amount: BN,
  walletBalance: BN,
  totalDebt: BN,
  healthFactorBps: number,
): void {
  if (amount.lte(new BN(0))) {
    throw new Error(
      `Trade amount must be positive, got ${amount.toString()}`,
    );
  }

  // Amount cannot exceed 20% of wallet balance
  const maxTradeAmount = walletBalance
    .mul(new BN(MAX_PER_TRADE_BPS))
    .div(new BN(BPS_DENOMINATOR));
  if (amount.gt(maxTradeAmount)) {
    throw new Error(
      `Trade amount ${amount.toString()} exceeds 20% of wallet balance ` +
        `(max ${maxTradeAmount.toString()})`,
    );
  }

  // Health factor must be >= HF_WARNING (no trades in warning zone)
  if (healthFactorBps < HF_WARNING) {
    throw new Error(
      `Cannot trade when health factor (${healthFactorBps} bps) is below ` +
        `warning threshold (${HF_WARNING} bps)`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LP Deposit
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate an LP deposit.
 *
 * @throws If amount is below minimum, or tranche is invalid / restricted.
 */
export function validateLpDeposit(amount: BN, tranche: number): void {
  if (amount.lte(new BN(0))) {
    throw new Error(
      `LP deposit amount must be positive, got ${amount.toString()}`,
    );
  }
  if (amount.lt(MIN_DEPOSIT)) {
    throw new Error(
      `Minimum LP deposit is $1 USDC (${MIN_DEPOSIT.toString()} base units), ` +
        `got ${amount.toString()}`,
    );
  }

  // Tranche must be valid (0-2)
  if (tranche < Tranche.Senior || tranche > Tranche.Junior) {
    throw new Error(
      `Tranche must be 0 (Senior), 1 (Mezzanine), or 2 (Junior), got ${tranche}`,
    );
  }

  // Junior tranche is restricted to protocol
  if (tranche === Tranche.Junior) {
    throw new Error(
      "Junior tranche (2) is restricted to protocol — only Senior (0) and Mezzanine (1) are available",
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LP Withdrawal
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate an LP share withdrawal.
 *
 * @throws If shares are not positive or exceed held position.
 */
export function validateLpWithdrawal(shares: BN, positionShares: BN): void {
  if (shares.lte(new BN(0))) {
    throw new Error(
      `Withdrawal shares must be positive, got ${shares.toString()}`,
    );
  }
  if (shares.gt(positionShares)) {
    throw new Error(
      `Cannot withdraw ${shares.toString()} shares — only ${positionShares.toString()} held`,
    );
  }
}
