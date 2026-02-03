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
        1;    // bump
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Default)]
pub enum ICMState {
    #[default]
    Offered,
    Active,
    Closed,
    Cancelled,
}
