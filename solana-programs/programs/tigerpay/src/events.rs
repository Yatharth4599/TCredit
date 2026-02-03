use anchor_lang::prelude::*;

// ============ Vault Events ============

#[event]
pub struct VaultCreated {
    pub vault: Pubkey,
    pub merchant: Pubkey,
    pub target_amount: u64,
    pub interest_rate_bps: u16,
    pub duration_months: u8,
    pub num_tranches: u8,
}

#[event]
pub struct InvestmentReceived {
    pub vault: Pubkey,
    pub investor: Pubkey,
    pub amount: u64,
    pub total_raised: u64,
}

#[event]
pub struct TrancheReleased {
    pub vault: Pubkey,
    pub tranche_index: u8,
    pub merchant_amount: u64,
    pub platform_fee: u64,
}

#[event]
pub struct RepaymentReceived {
    pub vault: Pubkey,
    pub merchant: Pubkey,
    pub amount: u64,
    pub late_fee: u64,
    pub total_repaid: u64,
}

#[event]
pub struct ReturnsClaimed {
    pub vault: Pubkey,
    pub investor: Pubkey,
    pub amount: u64,
}

#[event]
pub struct VaultDefaulted {
    pub vault: Pubkey,
    pub merchant: Pubkey,
    pub total_raised: u64,
    pub total_repaid: u64,
    pub defaulted_at: i64,
}

#[event]
pub struct VaultCancelled {
    pub vault: Pubkey,
    pub merchant: Pubkey,
    pub total_raised: u64,
    pub investor_count: u32,
    pub cancelled_at: i64,
}

#[event]
pub struct RefundClaimed {
    pub vault: Pubkey,
    pub investor: Pubkey,
    pub amount: u64,
}

#[event]
pub struct VaultPaused {
    pub vault: Pubkey,
    pub paused_by: Pubkey,
}

#[event]
pub struct VaultUnpaused {
    pub vault: Pubkey,
    pub unpaused_by: Pubkey,
}

#[event]
pub struct FundsRecovered {
    pub vault: Pubkey,
    pub investor: Pubkey,
    pub amount: u64,
}

// ============ ICM Events ============

#[event]
pub struct ICMVaultCreated {
    pub icm_vault: Pubkey,
    pub business: Pubkey,
    pub total_shares: u64,
    pub price_per_share: u64,
}

#[event]
pub struct StakePurchased {
    pub icm_vault: Pubkey,
    pub investor: Pubkey,
    pub shares: u64,
    pub amount_paid: u64,
}

#[event]
pub struct DividendsDistributed {
    pub icm_vault: Pubkey,
    pub business: Pubkey,
    pub amount: u64,
    pub total_distributed: u64,
}

#[event]
pub struct DividendsClaimed {
    pub icm_vault: Pubkey,
    pub investor: Pubkey,
    pub amount: u64,
}

// ============ Milestone Events ============

#[event]
pub struct MilestoneSubmitted {
    pub vault: Pubkey,
    pub milestone_id: u8,
    pub evidence_hash: [u8; 32],
}

#[event]
pub struct MilestoneApproved {
    pub vault: Pubkey,
    pub milestone_id: u8,
    pub approval_count: u8,
}

#[event]
pub struct MilestoneRejected {
    pub vault: Pubkey,
    pub milestone_id: u8,
    pub rejection_count: u8,
}

// ============ Platform Events ============

#[event]
pub struct PlatformInitialized {
    pub authority: Pubkey,
    pub fee_recipient: Pubkey,
    pub default_fee_bps: u16,
}

#[event]
pub struct MerchantVerified {
    pub merchant: Pubkey,
    pub verified_by: Pubkey,
}

#[event]
pub struct PlatformPaused {
    pub paused_by: Pubkey,
}

#[event]
pub struct PlatformUnpaused {
    pub unpaused_by: Pubkey,
}
