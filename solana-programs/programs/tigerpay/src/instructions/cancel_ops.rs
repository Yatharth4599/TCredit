use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::state::*;
use crate::errors::TigerPayError;
use crate::events::*;
use crate::{CancelVault, ClaimRefund};

/// Cancels a vault that failed to raise enough funds before deadline.
/// Authority or platform admin can cancel.
pub fn cancel_vault(ctx: Context<CancelVault>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let clock = Clock::get()?;

    require!(!vault.cancelled, TigerPayError::VaultAlreadyCancelled);
    require!(
        vault.state == VaultState::Fundraising,
        TigerPayError::InvalidVaultState
    );

    // Can cancel if: deadline passed, or authority decides to cancel early
    // (authority check is in the account constraint)

    vault.cancelled = true;
    vault.cancelled_at = clock.unix_timestamp;
    vault.state = VaultState::Cancelled;

    emit!(VaultCancelled {
        vault: vault.key(),
        total_raised: vault.total_raised,
        cancelled_at: clock.unix_timestamp,
    });

    msg!("Vault {} cancelled. {} to be refunded.", vault.key(), vault.total_raised);
    Ok(())
}

/// Investor claims refund from a cancelled vault.
/// Returns their pro-rata share of whatever was raised.
pub fn claim_refund(ctx: Context<ClaimRefund>) -> Result<()> {
    let vault = &ctx.accounts.vault;
    let investor_account = &mut ctx.accounts.investor_account;

    require!(vault.is_cancelled(), TigerPayError::VaultNotCancelled);
    require!(!investor_account.has_refunded, TigerPayError::AlreadyClaimed);
    require!(investor_account.amount_invested > 0, TigerPayError::InsufficientFunds);

    let refund_amount = investor_account.amount_invested;

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
                to: ctx.accounts.investor_token_account.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
            },
            signer_seeds,
        ),
        refund_amount,
    )?;

    investor_account.has_refunded = true;

    emit!(RefundClaimed {
        vault: vault.key(),
        investor: ctx.accounts.investor.key(),
        amount: refund_amount,
    });

    msg!("Refund of {} claimed by {}", refund_amount, ctx.accounts.investor.key());
    Ok(())
}
