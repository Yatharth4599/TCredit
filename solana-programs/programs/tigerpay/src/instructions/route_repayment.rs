use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::state::*;
use crate::errors::TigerPayError;
use crate::events::*;
use crate::RouteRepayment;

/// Primary automated repayment path.
/// Called by the settlement oracle/crank — NOT the merchant.
/// This is the core of "programmable credit": repayment is structural.
pub fn route_repayment(ctx: Context<RouteRepayment>, amount: u64) -> Result<()> {
    let settlement = &mut ctx.accounts.settlement;
    let vault = &mut ctx.accounts.vault;
    let clock = Clock::get()?;

    require!(settlement.is_active(), TigerPayError::SettlementNotActive);
    require!(
        vault.is_active() || vault.is_repaying(),
        TigerPayError::InvalidVaultState
    );
    require!(amount > 0, TigerPayError::InvalidRepaymentAmount);

    // Transfer from oracle's token account to vault
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.oracle_token_account.to_account_info(),
                to: ctx.accounts.vault_token_account.to_account_info(),
                authority: ctx.accounts.oracle_authority.to_account_info(),
            },
        ),
        amount,
    )?;

    // Update vault repayment tracking
    vault.total_repaid = vault.total_repaid
        .checked_add(amount)
        .ok_or(TigerPayError::ArithmeticOverflow)?;
    vault.repayment_source = 1; // x402 routed

    // Update settlement tracking
    settlement.total_routed = settlement.total_routed
        .checked_add(amount)
        .ok_or(TigerPayError::ArithmeticOverflow)?;
    settlement.total_payments = settlement.total_payments
        .checked_add(1)
        .ok_or(TigerPayError::ArithmeticOverflow)?;

    // Late fee calculation
    let late_fee = vault.calculate_late_fee(clock.unix_timestamp);
    if late_fee > 0 {
        vault.total_late_fees = vault.total_late_fees
            .checked_add(late_fee)
            .ok_or(TigerPayError::ArithmeticOverflow)?;
    }

    msg!("Route repayment: {} via x402 oracle for vault {}", amount, vault.key());
    msg!("Total repaid: {} / {}", vault.total_repaid, vault.total_to_repay);

    // Check if fully repaid
    if vault.total_repaid >= vault.total_to_repay {
        vault.state = VaultState::Completed;
        msg!("Vault fully repaid via x402 routing, now COMPLETED");
    } else if vault.state == VaultState::Active {
        vault.state = VaultState::Repaying;
    }

    emit!(RepaymentRouted {
        vault: vault.key(),
        amount,
        source: 1,
        total_repaid: vault.total_repaid,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
