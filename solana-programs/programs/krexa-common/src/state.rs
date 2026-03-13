use anchor_lang::prelude::*;

// ─────────────────────────────────────────────────────────────────────────────
// Credit level
// ─────────────────────────────────────────────────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum CreditLevel {
    /// Level 0: KYA verified identity only — no wallet, no credit
    KyaOnly,
    /// Level 1: Micro-credit $500, no collateral required
    Starter,
    /// Level 2: 1:1 leverage — deposit $X → borrow $X → $2X total
    /// Collateral earns LP yield simultaneously
    Established,
    /// Level 3: 1:2 leverage — deposit $X → borrow $2X → $3X total
    /// Collateral earns LP yield simultaneously
    Trusted,
    /// Level 4: 1:5+ leverage — deposit $X → borrow $5X → $6X total
    /// Or zero collateral for elite agents with proven track record
    Elite,
}

impl CreditLevel {
    pub fn as_u8(self) -> u8 {
        match self {
            CreditLevel::KyaOnly => 0,
            CreditLevel::Starter => 1,
            CreditLevel::Established => 2,
            CreditLevel::Trusted => 3,
            CreditLevel::Elite => 4,
        }
    }

    pub fn from_u8(v: u8) -> Option<Self> {
        match v {
            0 => Some(CreditLevel::KyaOnly),
            1 => Some(CreditLevel::Starter),
            2 => Some(CreditLevel::Established),
            3 => Some(CreditLevel::Trusted),
            4 => Some(CreditLevel::Elite),
            _ => None,
        }
    }

    /// Maximum credit line in USDC base units (6 decimals) for this level.
    pub fn max_credit_usdc(&self) -> u64 {
        use crate::constants::*;
        match self {
            CreditLevel::KyaOnly     => LEVEL_0_MAX_CREDIT,
            CreditLevel::Starter     => LEVEL_1_MAX_CREDIT,
            CreditLevel::Established => LEVEL_2_MAX_CREDIT,
            CreditLevel::Trusted     => LEVEL_3_MAX_CREDIT,
            CreditLevel::Elite       => LEVEL_4_MAX_CREDIT,
        }
    }

    /// Credit multiplier numerator (credit = collateral × num / den).
    pub fn leverage_numerator(&self) -> u64 {
        use crate::constants::*;
        match self {
            CreditLevel::KyaOnly     => 0,
            CreditLevel::Starter     => 0, // no collateral path
            CreditLevel::Established => LEVEL_2_LEVERAGE_NUM,
            CreditLevel::Trusted     => LEVEL_3_LEVERAGE_NUM,
            CreditLevel::Elite       => LEVEL_4_LEVERAGE_NUM,
        }
    }

    pub fn leverage_denominator(&self) -> u64 {
        use crate::constants::*;
        match self {
            CreditLevel::KyaOnly     => 1,
            CreditLevel::Starter     => 1,
            CreditLevel::Established => LEVEL_2_LEVERAGE_DEN,
            CreditLevel::Trusted     => LEVEL_3_LEVERAGE_DEN,
            CreditLevel::Elite       => LEVEL_4_LEVERAGE_DEN,
        }
    }
}

impl Default for CreditLevel {
    fn default() -> Self {
        CreditLevel::KyaOnly
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// KYA tier
// ─────────────────────────────────────────────────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum KyaTier {
    /// Not yet verified
    None,
    /// Automated code scan + owner wallet signature
    Basic,
    /// + Human KYC review + 3-month on-chain behavioural analysis
    Enhanced,
    /// + Full business / legal entity verification + 12-month history
    Institutional,
}

impl KyaTier {
    pub fn as_u8(self) -> u8 {
        match self {
            KyaTier::None         => 0,
            KyaTier::Basic        => 1,
            KyaTier::Enhanced     => 2,
            KyaTier::Institutional => 3,
        }
    }

    pub fn from_u8(v: u8) -> Option<Self> {
        match v {
            0 => Some(KyaTier::None),
            1 => Some(KyaTier::Basic),
            2 => Some(KyaTier::Enhanced),
            3 => Some(KyaTier::Institutional),
            _ => None,
        }
    }

    /// Minimum KYA tier required to access a given credit level.
    pub fn required_for(level: CreditLevel) -> KyaTier {
        match level {
            CreditLevel::KyaOnly     => KyaTier::None,
            CreditLevel::Starter     => KyaTier::Basic,
            CreditLevel::Established => KyaTier::Basic,
            CreditLevel::Trusted     => KyaTier::Enhanced,
            CreditLevel::Elite       => KyaTier::Enhanced,
        }
    }

    pub fn meets(&self, required: KyaTier) -> bool {
        self.as_u8() >= required.as_u8()
    }
}

impl Default for KyaTier {
    fn default() -> Self {
        KyaTier::None
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Wallet / credit line status
// ─────────────────────────────────────────────────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum WalletStatus {
    /// Normal operations — draw, pay, repay all permitted
    Active,
    /// Health 1.3–1.2x — no new borrows; repay and close positions only
    Warning,
    /// Health 1.2–1.05x — auto-deleverage in progress
    Deleveraging,
    /// Health < 1.05x — full liquidation triggered
    Liquidating,
    /// Fully closed / liquidated
    Closed,
}

impl Default for WalletStatus {
    fn default() -> Self {
        WalletStatus::Active
    }
}
