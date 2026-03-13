// ─────────────────────────────────────────────────────────────────────────────
// Credit scoring
// ─────────────────────────────────────────────────────────────────────────────

pub const MAX_CREDIT_SCORE: u16 = 850;
pub const MIN_CREDIT_SCORE: u16 = 200;
pub const DEFAULT_CREDIT_SCORE: u16 = 400;

// ─────────────────────────────────────────────────────────────────────────────
// Health factor (basis points — 10000 = 1.0x)
// ─────────────────────────────────────────────────────────────────────────────

/// 1.5x — fully healthy, all operations allowed
pub const HF_HEALTHY: u16 = 15_000;
/// 1.3x — warn; restrict opening new positions
pub const HF_WARNING: u16 = 13_000;
/// 1.2x — auto-deleverage begins
pub const HF_DANGER: u16 = 12_000;
/// 1.05x — full liquidation triggered
pub const HF_LIQUIDATION: u16 = 10_500;
/// Baseline denominator (1.0x)
pub const HF_DECIMALS: u16 = 10_000;

// ─────────────────────────────────────────────────────────────────────────────
// Position limits (basis points of wallet balance)
// ─────────────────────────────────────────────────────────────────────────────

/// 20% of total wallet value per single trade
pub const MAX_PER_TRADE_BPS: u16 = 2_000;
/// 50% of total wallet value allocated to a single venue
pub const MAX_PER_VENUE_BPS: u16 = 5_000;
/// Vault balance must remain ≥ 120% of outstanding debt after any withdrawal
pub const WITHDRAWAL_BUFFER_BPS: u16 = 12_000;

// ─────────────────────────────────────────────────────────────────────────────
// Fee rates (basis points)
// ─────────────────────────────────────────────────────────────────────────────

/// 5% of all interest collected → insurance fund
pub const INSURANCE_FEE_BPS: u16 = 500;
/// 0.5% of liquidated collateral → keeper reward
pub const LIQUIDATION_REWARD_BPS: u16 = 50;
/// 2.5% fee on outbound x402 payments
pub const PLATFORM_FEE_BPS: u16 = 250;
/// Denominator for all BPS calculations
pub const BPS_DENOMINATOR: u16 = 10_000;

// ─────────────────────────────────────────────────────────────────────────────
// Time constants
// ─────────────────────────────────────────────────────────────────────────────

pub const SECONDS_PER_YEAR: u64 = 31_536_000;
/// Credit scores older than 90 days require re-verification
pub const SCORE_EXPIRY_SECONDS: i64 = 90 * 24 * 60 * 60;

// ─────────────────────────────────────────────────────────────────────────────
// Credit level — maximum credit line (USDC, 6 decimals)
// ─────────────────────────────────────────────────────────────────────────────

pub const LEVEL_0_MAX_CREDIT: u64 = 0;                   // Level 0: KYA only, no wallet
pub const LEVEL_1_MAX_CREDIT: u64 = 500_000_000;         // Level 1: $500 micro
pub const LEVEL_2_MAX_CREDIT: u64 = 10_000_000_000;      // Level 2: $10,000
pub const LEVEL_3_MAX_CREDIT: u64 = 100_000_000_000;     // Level 3: $100,000
pub const LEVEL_4_MAX_CREDIT: u64 = 500_000_000_000;     // Level 4: $500,000

// ─────────────────────────────────────────────────────────────────────────────
// Credit level — leverage ratios (credit = collateral * NUM / DEN)
//
// Level 1: no collateral required (micro credit)
// Level 2: 1:1  — deposit $1 → borrow $1 → $2 total purchasing power
// Level 3: 1:2  — deposit $1 → borrow $2 → $3 total
// Level 4: 1:5+ — deposit $1 → borrow $5 → $6 total (or zero collateral)
// ─────────────────────────────────────────────────────────────────────────────

pub const LEVEL_2_LEVERAGE_NUM: u64 = 1;
pub const LEVEL_2_LEVERAGE_DEN: u64 = 1;
pub const LEVEL_3_LEVERAGE_NUM: u64 = 2;
pub const LEVEL_3_LEVERAGE_DEN: u64 = 1;
pub const LEVEL_4_LEVERAGE_NUM: u64 = 5;
pub const LEVEL_4_LEVERAGE_DEN: u64 = 1;

// ─────────────────────────────────────────────────────────────────────────────
// USDC
// ─────────────────────────────────────────────────────────────────────────────

/// Devnet: use a custom SPL mint. Mainnet: the real USDC mint.
pub const USDC_MAINNET: &str = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
pub const USDC_DECIMALS: u8 = 6;
pub const USDC_ONE: u64 = 1_000_000; // 1 USDC in base units
