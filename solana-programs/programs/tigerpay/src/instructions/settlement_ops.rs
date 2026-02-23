use anchor_lang::prelude::*;

use crate::state::*;
use crate::errors::TigerPayError;
use crate::events::*;
use crate::CreateSettlement;

/// Creates a SettlementAccount PDA linking a vault to the x402 oracle.
/// Called by platform authority after vault enters Active state.
pub fn create_settlement(
    ctx: Context<CreateSettlement>,
    repayment_rate_bps: u16,
) -> Result<()> {
    let settlement = &mut ctx.accounts.settlement;
    let vault = &ctx.accounts.vault;
    let clock = Clock::get()?;

    require!(
        repayment_rate_bps > 0 && repayment_rate_bps <= 10_000,
        TigerPayError::InvalidRepaymentAmount
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

    emit!(SettlementCreated {
        vault: vault.key(),
        oracle_authority: ctx.accounts.oracle_authority.key(),
        repayment_rate_bps,
    });

    msg!("Settlement account created for vault {} with {}bps rate", vault.key(), repayment_rate_bps);

    Ok(())
}
