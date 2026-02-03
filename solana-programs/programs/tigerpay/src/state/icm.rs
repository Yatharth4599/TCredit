use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct ICMVault {
    pub authority: Pubkey,
    pub business: Pubkey,
    pub funding_token_mint: Pubkey,
    pub stake_token_mint: Pubkey,
    pub vault_token_account: Pubkey,
    
    pub total_shares: u64,
    pub shares_sold: u64,
    pub price_per_share: u64,
    pub min_buy: u64,
    pub max_buy: u64,
    
    pub target_raised: u64,
    pub total_raised: u64,
    
    pub state: ICMState,
    pub offering_deadline: i64,
    pub created_at: i64,
    
    pub platform_fee_bps: u16,
    pub platform_fee_recipient: Pubkey,
    
    pub investor_count: u32,
    pub icm_nonce: u8,
    pub bump: u8,

    // Dividend tracking
    pub total_dividends_distributed: u64,
    pub total_dividends_claimed: u64,
    pub last_dividend_at: i64,
    
    // Controls
    pub paused: bool,
}

impl ICMVault {
    pub const LEN: usize = 8 +  // discriminator
        32 +  // authority
        32 +  // business
        32 +  // funding_token_mint
        32 +  // stake_token_mint
        32 +  // vault_token_account
        8 +   // total_shares
        8 +   // shares_sold
        8 +   // price_per_share
        8 +   // min_buy
        8 +   // max_buy
        8 +   // target_raised
        8 +   // total_raised
        1 +   // state
        8 +   // offering_deadline
        8 +   // created_at
        2 +   // platform_fee_bps
        32 +  // platform_fee_recipient
        4 +   // investor_count
        1 +   // icm_nonce
        1 +   // bump
        8 +   // total_dividends_distributed
        8 +   // total_dividends_claimed
        8 +   // last_dividend_at
        1;    // paused

    pub fn is_closed(&self) -> bool {
        self.state == ICMState::Closed
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Default)]
pub enum ICMState {
    #[default]
    Offered,
    Active,
    Closed,
    Cancelled,
}

// ICM Investor Account (for tracking dividend claims)
#[account]
#[derive(Default)]
pub struct ICMInvestorAccount {
    pub icm_vault: Pubkey,
    pub investor: Pubkey,
    pub shares_owned: u64,
    pub total_invested: u64,
    pub dividends_claimed: u64,
    pub last_claim_at: i64,
    pub bump: u8,
}

impl ICMInvestorAccount {
    pub const LEN: usize = 8 +  // discriminator
        32 +  // icm_vault
        32 +  // investor
        8 +   // shares_owned
        8 +   // total_invested
        8 +   // dividends_claimed
        8 +   // last_claim_at
        1;    // bump

    pub fn calculate_claimable_dividends(&self, total_shares: u64, total_dividends: u64) -> u64 {
        if total_shares == 0 || self.shares_owned == 0 {
            return 0;
        }
        
        let share = (self.shares_owned as u128)
            .checked_mul(total_dividends as u128)
            .unwrap_or(0)
            .checked_div(total_shares as u128)
            .unwrap_or(0) as u64;
        
        share.saturating_sub(self.dividends_claimed)
    }
}
