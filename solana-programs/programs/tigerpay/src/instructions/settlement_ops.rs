use anchor_lang::prelude::*;

use crate::state::*;
use crate::errors::TigerPayError;
use crate::events::*;
use crate::CreateSettlement;

pub fn create_settlement(
    ctx: Context<CreateSettlement>,
    repayment_rate_bps: u16,
    min_payment_interval_secs: Option<i64>,
    max_single_payment: Option<u64>,
) -> Result<()> {
    let settlement = &mut ctx.accounts.settlement;
    let vault = &ctx.accounts.vault;
    let clock = Clock::get()?;

    require!(
        repayment_rate_bps > 0 && repayment_rate_bps <= 10_000,
        TigerPayError::InvalidRepaymentRate
    );

    settlement.vault = vault.key();
    settlement.merchant = vault.merchant;
    settlement.oracle_authority = ctx.accounts.oracle_authority.key();
    settlement.repayment_rate_bps = repayment_rate_bps;
    settlement.total_routed = 0;
    settlement.total_payments = 0;
    settlement.active = true;
    settlement.created_at = clock.unix_timestamp;
    settlement.bump = ctx.bumps.settlement;

    settlement.nonce = 0;
    settlement.last_payment_at = 0;
    settlement.min_payment_interval_secs = min_payment_interval_secs
        .unwrap_or(SettlementAccount::DEFAULT_MIN_INTERVAL);
    settlement.max_single_payment = max_single_payment
        .unwrap_or(SettlementAccount::DEFAULT_MAX_SINGLE);
    settlement.used_nonce_count = 0;
    settlement.used_nonces = [[0u8; 32]; 8];

    emit!(SettlementCreated {
        vault: vault.key(),
        oracle_authority: ctx.accounts.oracle_authority.key(),
        repayment_rate_bps,
    });

    msg!("Settlement created for vault {} with {}bps rate", vault.key(), repayment_rate_bps);

    Ok(())
}
