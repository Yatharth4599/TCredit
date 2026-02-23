use anchor_lang::prelude::*;

// ============ Settlement Account ============
// Links a vault to the x402 payment routing layer.
// The oracle_authority is the backend crank that watches x402 events
// and calls route_repayment on-chain.

#[account]
#[derive(Default)]
pub struct SettlementAccount {
    pub vault: Pubkey,              // Linked merchant vault
    pub merchant: Pubkey,           // Merchant wallet
    pub oracle_authority: Pubkey,   // Crank/oracle that can call route_repayment
    pub repayment_rate_bps: u16,    // % of each inflow split for repayment (e.g. 2000 = 20%)
    pub total_routed: u64,          // Cumulative amount routed to vault repayment
    pub total_payments: u64,        // Total number of payment events processed
    pub active: bool,               // Can be disabled by admin
    pub created_at: i64,
    pub bump: u8,
}

impl SettlementAccount {
    pub const LEN: usize = 8 +  // discriminator
        32 +  // vault
        32 +  // merchant
        32 +  // oracle_authority
        2 +   // repayment_rate_bps
        8 +   // total_routed
        8 +   // total_payments
        1 +   // active
        8 +   // created_at
        1;    // bump

    pub fn is_active(&self) -> bool {
        self.active
    }
}
