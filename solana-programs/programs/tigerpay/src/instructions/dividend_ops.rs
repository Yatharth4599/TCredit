use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::state::*;
use crate::errors::TigerPayError;
use crate::events::*;
use crate::ClaimDividends;

/// ICM investor claims their pro-rata share of distribted dividends.
/// Dividend share = (investor_shares / total_shares) * available_dividends
pub fn claim_dividends(ctx: Context<ClaimDividends>) -> Result<()> {
    let icm_vault = &ctx.accounts.icm_vault;
    let investor_stake = &mut ctx.accounts.investor_stake_account;
    let clock = Clock::get()?;

    require!(
        icm_vault.state == ICMState::Closed,
        TigerPayError::InvalidVaultState
    );

    // Calculate claimable: (shares_held / total_shares) * vault_balance - already_claimed
    let vault_balance = ctx.accounts.vault_token_account.amount;
    let share_ratio_num = investor_stake.amount_invested; // shares held
    let share_ratio_den = icm_vault.total_shares;

    require!(share_ratio_den > 0 && share_ratio_num > 0, TigerPayError::InsufficientFunds);

    let total_entitled = (vault_balance as u128)
        .checked_mul(share_ratio_num as u128)
        .ok_or(TigerPayError::ArithmeticOverflow)?
        .checked_div(share_ratio_den as u128)
        .ok_or(TigerPayError::ArithmeticOverflow)? as u64;

    let already_claimed = investor_stake.claimed_returns;
    let claimable = total_entitled.saturating_sub(already_claimed);

    require!(claimable > 0, TigerPayError::NoDividendsAvailable);

    let seeds = &[
        b"icm_vault",
        icm_vault.business.as_ref(),
        &[icm_vault.icm_nonce],
        &[icm_vault.bump],
    ];
    let signer_seeds = &[&seeds[..]];

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_token_account.to_account_info(),
                to: ctx.accounts.investor_token_account.to_account_info(),
                authority: ctx.accounts.icm_vault.to_account_info(),
            },
            signer_seeds,
        ),
        claimable,
    )?;

    investor_stake.claimed_returns = investor_stake.claimed_returns
        .checked_add(claimable)
        .ok_or(TigerPayError::ArithmeticOverflow)?;
    investor_stake.last_claim_at = clock.unix_timestamp;

    emit!(DividendsClaimed {
        icm_vault: icm_vault.key(),
        investor: ctx.accounts.investor.key(),
        amount: claimable,
    });

    msg!("Dividends of {} claimed by {}", claimable, ctx.accounts.investor.key());
    Ok(())
}
