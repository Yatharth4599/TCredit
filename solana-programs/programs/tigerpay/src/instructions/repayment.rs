use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::state::*;
use crate::errors::TigerPayError;
use crate::MakeRepayment;
use crate::ClaimReturns;

/// Manual repayment — merchant signs and sends payment.
/// This is the FALLBACK path; route_repayment (x402) is the primary path.
pub fn make_repayment(ctx: Context<MakeRepayment>, amount: u64) -> Result<()> {
    let vault = &mut ctx.accounts.vault;

    require!(vault.is_active() || vault.is_repaying(), TigerPayError::InvalidVaultState);
    require!(amount > 0, TigerPayError::InvalidRepaymentAmount);

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
    vault.repayment_source = 0; // manual

    msg!("Manual repayment received: {} from merchant {}", amount, ctx.accounts.merchant.key());

    if vault.total_repaid >= vault.total_to_repay {
        vault.state = VaultState::Completed;
        msg!("Vault fully repaid!");
    } else if vault.state == VaultState::Active {
        vault.state = VaultState::Repaying;
    }

    Ok(())
}

/// Investor claims their pro-rata share of repayments.
pub fn claim_returns(ctx: Context<ClaimReturns>) -> Result<()> {
    let vault = &ctx.accounts.vault;
    let investor_account = &mut ctx.accounts.investor_account;

    require!(vault.is_repaying() || vault.state == VaultState::Completed, TigerPayError::InvalidVaultState);

    let claimable = investor_account.calculate_claimable(vault.total_raised, vault.total_repaid);
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
    investor_account.last_claim_at = Clock::get()?.unix_timestamp;

    msg!("Returns claimed: {} by investor {}", claimable, ctx.accounts.investor.key());
    Ok(())
}
