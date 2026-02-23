use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::state::*;
use crate::errors::TigerPayError;
use crate::events::*;
use crate::{AutoCancelExpired, ReturnPoolAllocation, MIN_FUNDRAISE_PCT};

/// Keeper/crank instruction: cancels vaults that missed their fundraising deadline
/// without reaching the 80% threshold. Anyone can call this.
pub fn auto_cancel_expired(ctx: Context<AutoCancelExpired>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let clock = Clock::get()?;

    require!(
        vault.state == VaultState::Fundraising,
        TigerPayError::InvalidVaultState
    );
    require!(!vault.cancelled, TigerPayError::VaultAlreadyCancelled);

    // Must be past deadline
    require!(
        clock.unix_timestamp > vault.fundraising_deadline,
        TigerPayError::FundraisingDeadlinePassed
    );

    // Must be under 80% funded
    let min_required = vault.target_amount * MIN_FUNDRAISE_PCT / 100;
    require!(
        vault.total_raised < min_required,
        TigerPayError::FundraisingNotComplete
    );

    vault.cancelled = true;
    vault.cancelled_at = clock.unix_timestamp;
    vault.state = VaultState::Cancelled;

    emit!(VaultCancelled {
        vault: vault.key(),
        total_raised: vault.total_raised,
        cancelled_at: clock.unix_timestamp,
    });

    msg!(
        "Auto-cancelled expired vault {}. Raised {} / {} (min {})",
        vault.key(), vault.total_raised, vault.target_amount, min_required
    );
    Ok(())
}

/// Tracks pool allocation returns when a vault makes repayment.
/// Called by keeper after a vault repays — credits the pool's return tracking.
pub fn return_pool_allocation(ctx: Context<ReturnPoolAllocation>, amount: u64) -> Result<()> {
    let pool = &mut ctx.accounts.pool;
    let allocation = &mut ctx.accounts.allocation;
    let vault = &ctx.accounts.vault;

    require!(!allocation.fully_returned, TigerPayError::AlreadyClaimed);
    require!(amount > 0, TigerPayError::InvalidRepaymentAmount);

    // Cap return to outstanding allocation
    let outstanding = allocation.outstanding();
    let return_amount = amount.min(outstanding);
    require!(return_amount > 0, TigerPayError::InsufficientFunds);

    // Transfer from vault back to pool
    let seeds = &[
        b"vault",
        vault.merchant.as_ref(),
        &[vault.vault_nonce],
        &[vault.bump],
    ];
    let signer_seeds = &[&seeds[..]];

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_token_account.to_account_info(),
                to: ctx.accounts.pool_token_account.to_account_info(),
                authority: vault.to_account_info(),
            },
            signer_seeds,
        ),
        return_amount,
    )?;

    // Update allocation tracker
    allocation.returned = allocation.returned
        .checked_add(return_amount)
        .ok_or(TigerPayError::ArithmeticOverflow)?;
    if allocation.returned >= allocation.amount {
        allocation.fully_returned = true;
    }

    // Update pool totals
    pool.total_returned = pool.total_returned
        .checked_add(return_amount)
        .ok_or(TigerPayError::ArithmeticOverflow)?;

    // Update vault waterfall
    let vault_mut = &mut ctx.accounts.vault;
    vault_mut.total_pool_repaid = vault_mut.total_pool_repaid
        .checked_add(return_amount)
        .ok_or(TigerPayError::ArithmeticOverflow)?;

    msg!(
        "Returned {} to pool from vault. Allocation: {}/{}",
        return_amount, allocation.returned, allocation.amount
    );
    Ok(())
}
