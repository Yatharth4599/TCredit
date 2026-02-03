use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct MerchantVault {
    pub authority: Pubkey,
    pub merchant: Pubkey,
    pub funding_token_mint: Pubkey,
    pub debt_token_mint: Pubkey,
    pub vault_token_account: Pubkey,
    
    pub target_amount: u64,
    pub min_investment: u64,
    pub max_investment: u64,
    pub total_raised: u64,
    pub total_repaid: u64,
    pub total_to_repay: u64,
    
    pub interest_rate_bps: u16,
    pub duration_months: u8,
    pub num_tranches: u8,
    pub tranches_released: u8,
    
    pub state: VaultState,
    pub fundraising_deadline: i64,
    pub created_at: i64,
    
    pub platform_fee_bps: u16,
    pub platform_fee_recipient: Pubkey,
    pub platform_fees_collected: u64,
    
    pub investor_count: u32,
    pub vault_nonce: u8,
    pub bump: u8,
}

impl MerchantVault {
    pub const LEN: usize = 8 +  // discriminator
        32 +  // authority
        32 +  // merchant
        32 +  // funding_token_mint
        32 +  // debt_token_mint
        32 +  // vault_token_account
        8 +   // target_amount
        8 +   // min_investment
        8 +   // max_investment
        8 +   // total_raised
        8 +   // total_repaid
        8 +   // total_to_repay
        2 +   // interest_rate_bps
        1 +   // duration_months
        1 +   // num_tranches
        1 +   // tranches_released
        1 +   // state
        8 +   // fundraising_deadline
        8 +   // created_at
        2 +   // platform_fee_bps
        32 +  // platform_fee_recipient
        8 +   // platform_fees_collected
        4 +   // investor_count
        1 +   // vault_nonce
        1;    // bump

    pub fn is_fundraising(&self) -> bool {
        self.state == VaultState::Fundraising
    }

    pub fn is_active(&self) -> bool {
        self.state == VaultState::Active
    }

    pub fn is_repaying(&self) -> bool {
        self.state == VaultState::Repaying
    }

    pub fn can_invest(&self, amount: u64, current_time: i64) -> bool {
        self.is_fundraising() 
            && current_time <= self.fundraising_deadline
            && amount >= self.min_investment
            && self.total_raised + amount <= self.target_amount
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Default)]
pub enum VaultState {
    #[default]
    Fundraising,
    Active,
    Repaying,
    Completed,
    Defaulted,
}
