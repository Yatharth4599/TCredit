use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::state::*;
use crate::errors::TigerPayError;
use crate::MakeRepayment;
use crate::ClaimReturns;
use crate::{REPAYMENT_SOURCE_MANUAL, REPAYMENT_INTERVAL_SECS};

/// Manual repayment — merchant signs and sends payment.
/// This is the FALLBACK path; route_repayment (x402) is the primary path.
pub fn make_repayment(ctx: Context<MakeRepayment>, amount: u64) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let clock = Clock::get()?;

    require!(vault.is_active() || vault.is_repaying(), TigerPayError::InvalidVaultState);
    require!(amount > 0, TigerPayError::InvalidRepaymentAmount);

    // Calculate and apply late fees if overdue
    let late_fee = vault.calculate_late_fee(clock.unix_timestamp);
    if late_fee > 0 {
        vault.total_late_fees = vault.total_late_fees
            .checked_add(late_fee)
            .ok_or(TigerPayError::ArithmeticOverflow)?;
        vault.total_to_repay = vault.total_to_repay
            .checked_add(late_fee)
            .ok_or(TigerPayError::ArithmeticOverflow)?;
        msg!("Late fee applied: {}", late_fee);
    }

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.merchant_token_account.to_account_info(),
                to: ctx.accounts.vault_token_account.to_account_info(),
                authority: ctx.accounts.merchant.to_account_info(),
            },
        ),
        amount,
    )?;

    vault.total_repaid = vault.total_repaid.checked_add(amount).ok_or(TigerPayError::ArithmeticOverflow)?;
    vault.repayment_source = REPAYMENT_SOURCE_MANUAL;

    // Advance payment schedule (30-day intervals)
    if vault.next_payment_due > 0 && clock.unix_timestamp >= vault.next_payment_due {
        vault.next_payment_due = clock.unix_timestamp + REPAYMENT_INTERVAL_SECS;
    }

    msg!("Manual repayment received: {} from merchant {}", amount, ctx.accounts.merchant.key());

    if vault.total_repaid >= vault.total_to_repay {
        vault.state = VaultState::Completed;
        vault.next_payment_due = 0;
        msg!("Vault fully repaid!");
    } else if vault.state == VaultState::Active {
        vault.state = VaultState::Repaying;
        // Set first payment due 30 days from now if not already set
        if vault.next_payment_due == 0 {
            vault.next_payment_due = clock.unix_timestamp + REPAYMENT_INTERVAL_SECS;
        }
    }

    Ok(())
}

/// Investor claims their pro-rata share of repayments.
pub fn claim_returns(ctx: Context<ClaimReturns>) -> Result<()> {
    let vault = &ctx.accounts.vault;
    let investor_account = &mut ctx.accounts.investor_account;

    require!(vault.is_repaying() || vault.state == VaultState::Completed, TigerPayError::InvalidVaultState);
    let clock = Clock::get()?;

    // Waterfall derived available pool for retail
    let total_user_repaid = vault.total_repaid
        .saturating_sub(vault.total_senior_repaid)
        .saturating_sub(vault.total_pool_repaid);

    let claimable = investor_account.calculate_claimable(vault.user_funded, total_user_repaid);
    require!(claimable > 0, TigerPayError::NoReturnsAvailable);

    let seeds = &[b"vault", vault.merchant.as_ref(), &[vault.vault_nonce], &[vault.bump]];
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
        claimable,
    )?;

    investor_account.claimed_returns = investor_account.claimed_returns.checked_add(claimable).ok_or(TigerPayError::ArithmeticOverflow)?;
    investor_account.last_claim_at = clock.unix_timestamp;
    investor_account.total_user_repaid_at_last_claim = total_user_repaid;

    msg!("Returns claimed: {} by investor {}", claimable, ctx.accounts.investor.key());
    Ok(())
}
