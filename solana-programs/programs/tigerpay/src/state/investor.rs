use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct InvestorAccount {
    pub vault: Pubkey,
    pub investor: Pubkey,
    pub amount_invested: u64,
    pub debt_tokens_received: u64,
    pub claimed_returns: u64,
    pub investor_token_account: Pubkey,
    pub invested_at: i64,
    pub last_claim_at: i64,
    pub total_user_repaid_at_last_claim: u64, // Waterfall: retail repaid amount when investor last claimed
    pub bump: u8,
    
    // Production fields
    pub has_refunded: bool,
    pub has_recovered: bool,
    pub recovered_amount: u64,
}

impl InvestorAccount {
    pub const LEN: usize = 8 +  // discriminator
        32 +  // vault
        32 +  // investor
        8 +   // amount_invested
        8 +   // debt_tokens_received
        8 +   // claimed_returns
        32 +  // investor_token_account
        8 +   // invested_at
        8 +   // last_claim_at
        1 +   // bump
        1 +   // has_refunded
        1 +   // has_recovered
        8 +   // recovered_amount
        8;    // total_user_repaid_at_last_claim

    pub fn calculate_claimable(&self, user_funded: u64, total_user_repaid: u64) -> u64 {
        if user_funded == 0 || self.amount_invested == 0 {
            return 0;
        }
        
        // Waterfall check: total_user_repaid is the amount that trickled down to retail
        if total_user_repaid <= self.total_user_repaid_at_last_claim {
            return 0;
        }

        let total_share_ever = (self.amount_invested as u128)
            .checked_mul(total_user_repaid as u128)
            .unwrap_or(0)
            .checked_div(user_funded as u128)
            .unwrap_or(0) as u64;
        
        total_share_ever.saturating_sub(self.claimed_returns)
    }
}

#[account]
#[derive(Default)]
pub struct MerchantProfile {
    pub merchant: Pubkey,
    pub authority: Pubkey,
    pub verified: bool,
    pub verified_at: i64,
    pub verified_by: Pubkey,
    pub vault_count: u32,
    pub max_vaults: u32,
    pub total_raised: u64,
    pub total_repaid: u64,
    pub name_hash: [u8; 32],
    pub bump: u8,

    // Programmable Credit fields
    pub credit_score: u16,       // FairScale score (0-1000)
    pub credit_tier: u8,         // 0=D(restricted), 1=C, 2=B, 3=A
    pub credit_updated_at: i64,  // Last score refresh timestamp
}

impl MerchantProfile {
    pub const LEN: usize = 8 +  // discriminator
        32 +  // merchant
        32 +  // authority
        1 +   // verified
        8 +   // verified_at
        32 +  // verified_by
        4 +   // vault_count
        4 +   // max_vaults
        8 +   // total_raised
        8 +   // total_repaid
        32 +  // name_hash
        1 +   // bump
        2 +   // credit_score
        1 +   // credit_tier
        8;    // credit_updated_at

    pub fn can_create_vault(&self) -> bool {
        self.verified && self.vault_count < self.max_vaults
    }
}

#[account]
#[derive(Default)]
pub struct PlatformConfig {
    pub authority: Pubkey,
    pub fee_recipient: Pubkey,
    pub default_fee_bps: u16,
    pub min_funding_target: u64,
    pub max_funding_target: u64,
    pub min_interest_bps: u16,
    pub max_interest_bps: u16,
    pub max_duration_months: u8,
    pub max_tranches: u8,
    pub required_verifiers: u8,
    pub paused: bool,
    pub bump: u8,
}

impl PlatformConfig {
    pub const LEN: usize = 8 +  // discriminator
        32 +  // authority
        32 +  // fee_recipient
        2 +   // default_fee_bps
        8 +   // min_funding_target
        8 +   // max_funding_target
        2 +   // min_interest_bps
        2 +   // max_interest_bps
        1 +   // max_duration_months
        1 +   // max_tranches
        1 +   // required_verifiers
        1 +   // paused
        1;    // bump
}
