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
    pub max_investors: u32,
    pub vault_nonce: u8,
    pub bump: u8,

    // Production fields: Late Fees
    pub next_payment_due: i64,
    pub late_fee_bps: u16,
    pub total_late_fees: u64,
    pub grace_period_days: u8,

    // Production fields: Default & Recovery
    pub defaulted_at: i64,
    pub total_recovered: u64,

    // Production fields: Pause & Cancellation
    pub paused: bool,
    pub cancelled: bool,
    pub cancelled_at: i64,
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
        4 +   // max_investors
        1 +   // vault_nonce
        1 +   // bump
        8 +   // next_payment_due
        2 +   // late_fee_bps
        8 +   // total_late_fees
        1 +   // grace_period_days
        8 +   // defaulted_at
        8 +   // total_recovered
        1 +   // paused
        1 +   // cancelled
        8;    // cancelled_at

    pub fn is_fundraising(&self) -> bool {
        self.state == VaultState::Fundraising && !self.cancelled && !self.paused
    }

    pub fn is_active(&self) -> bool {
        self.state == VaultState::Active && !self.paused
    }

    pub fn is_repaying(&self) -> bool {
        self.state == VaultState::Repaying && !self.paused
    }

    pub fn is_defaulted(&self) -> bool {
        self.state == VaultState::Defaulted
    }

    pub fn is_cancelled(&self) -> bool {
        self.cancelled
    }

    pub fn can_invest(&self, amount: u64, current_time: i64) -> bool {
        self.is_fundraising() 
            && current_time <= self.fundraising_deadline
            && amount >= self.min_investment
            && self.total_raised + amount <= self.target_amount
            && self.investor_count < self.max_investors
    }

    pub fn calculate_late_fee(&self, current_time: i64) -> u64 {
        if current_time <= self.next_payment_due || self.next_payment_due == 0 {
            return 0;
        }
        let days_late = ((current_time - self.next_payment_due) / 86400) as u64;
        let remaining = self.total_to_repay.saturating_sub(self.total_repaid);
        // Late fee = remaining * late_fee_bps * days_late / 10000
        remaining.saturating_mul(self.late_fee_bps as u64).saturating_mul(days_late) / 10000
    }

    pub fn should_default(&self, current_time: i64) -> bool {
        if self.next_payment_due == 0 || self.state != VaultState::Repaying {
            return false;
        }
        let grace_seconds = self.grace_period_days as i64 * 86400;
        current_time > self.next_payment_due + grace_seconds
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
    Cancelled,
}
