use anchor_lang::prelude::*;

// ============ Liquidity Pool Account ============

#[account]
#[derive(Default)]
pub struct LiquidityPool {
    pub authority: Pubkey,              // Pool owner (TigerPay or partner)
    pub funding_token_mint: Pubkey,     // USDC mint
    pub pool_token_account: Pubkey,     // Pool's token holding account
    pub total_deposited: u64,           // Cumulative deposits
    pub total_allocated: u64,           // Currently allocated to vaults
    pub total_returned: u64,            // Returned from vault repayments
    pub max_allocation_per_vault: u64,  // Cap per individual vault
    pub is_alpha: bool,                 // TigerPay's own pool flag
    pub paused: bool,
    pub created_at: i64,
    pub bump: u8,
}

impl LiquidityPool {
    pub const LEN: usize = 8 +  // discriminator
        32 +  // authority
        32 +  // funding_token_mint
        32 +  // pool_token_account
        8 +   // total_deposited
        8 +   // total_allocated
        8 +   // total_returned
        8 +   // max_allocation_per_vault
        1 +   // is_alpha
        1 +   // paused
        8 +   // created_at
        1;    // bump

    pub fn available_balance(&self) -> u64 {
        self.total_deposited
            .saturating_add(self.total_returned)
            .saturating_sub(self.total_allocated)
    }

    pub fn can_allocate(&self, amount: u64) -> bool {
        !self.paused
            && amount > 0
            && amount <= self.available_balance()
            && amount <= self.max_allocation_per_vault
    }
}

// ============ Pool Allocation Tracker ============

#[account]
#[derive(Default)]
pub struct PoolAllocation {
    pub pool: Pubkey,        // Source liquidity pool
    pub vault: Pubkey,       // Target merchant vault
    pub amount: u64,         // Amount allocated
    pub returned: u64,       // Amount returned from repayment
    pub allocated_at: i64,
    pub fully_returned: bool,
    pub bump: u8,
}

impl PoolAllocation {
    pub const LEN: usize = 8 +  // discriminator
        32 +  // pool
        32 +  // vault
        8 +   // amount
        8 +   // returned
        8 +   // allocated_at
        1 +   // fully_returned
        1;    // bump

    pub fn outstanding(&self) -> u64 {
        self.amount.saturating_sub(self.returned)
    }
}
