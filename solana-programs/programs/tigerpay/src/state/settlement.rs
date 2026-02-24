use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct SettlementAccount {
    pub vault: Pubkey,
    pub merchant: Pubkey,
    pub oracle_authority: Pubkey,
    pub repayment_rate_bps: u16,
    pub total_routed: u64,
    pub total_payments: u64,
    pub active: bool,
    pub created_at: i64,
    pub bump: u8,

    // Security fields
    pub nonce: u64,
    pub last_payment_at: i64,
    pub min_payment_interval_secs: i64,
    pub max_single_payment: u64,
    pub used_nonces: [[u8; 32]; 8], // Last 8 used payment IDs for replay protection
    pub used_nonce_count: u8,
}

impl SettlementAccount {
    pub const LEN: usize = 8 +
        32 + 32 + 32 +
        2 +
        8 + 8 +
        1 +
        8 + 1 +
        8 + 8 + 8 + 8 +
        256 + // 8 * 32 bytes for used_nonces
        1;

    pub const DEFAULT_MIN_INTERVAL: i64 = 60;
    pub const DEFAULT_MAX_SINGLE: u64 = 1_000_000_000_000; // 1M USDC

    pub fn is_active(&self) -> bool {
        self.active
    }

    pub fn check_rate_limit(&self, current_time: i64) -> bool {
        if self.last_payment_at == 0 {
            return true;
        }
        current_time >= self.last_payment_at + self.min_payment_interval_secs
    }

    pub fn check_replay(&self, payment_id: [u8; 32]) -> bool {
        for i in 0..self.used_nonce_count as usize {
            if self.used_nonces[i] == payment_id {
                return false;
            }
        }
        true
    }

    pub fn record_payment(&mut self, payment_id: [u8; 32], current_time: i64) {
        if self.used_nonce_count < 8 {
            self.used_nonces[self.used_nonce_count as usize] = payment_id;
            self.used_nonce_count += 1;
        } else {
            for i in 0..7 {
                self.used_nonces[i] = self.used_nonces[i + 1];
            }
            self.used_nonces[7] = payment_id;
        }
        self.last_payment_at = current_time;
        self.nonce += 1;
    }
}
