use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer, MintTo, Mint};

use crate::state::*;
use crate::errors::TigerPayError;
use crate::Invest;

pub fn invest(ctx: Context<Invest>, amount: u64) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let investor_account = &mut ctx.accounts.investor_account;
    let clock = Clock::get()?;

    require!(vault.is_fundraising(), TigerPayError::InvalidVaultState);
    require!(!ctx.accounts.platform_config.paused, TigerPayError::PlatformPaused);
    require!(clock.unix_timestamp <= vault.fundraising_deadline, TigerPayError::FundraisingDeadlinePassed);
    require!(amount >= vault.min_investment, TigerPayError::InvestmentTooLow);
    require!(
        vault.investor_count < vault.max_investors,
        TigerPayError::MaxInvestorsReached
    );
    
    let new_total = vault.total_raised.checked_add(amount).ok_or(TigerPayError::ArithmeticOverflow)?;
    require!(new_total <= vault.target_amount, TigerPayError::InvestmentExceedsTarget);
    
    let investor_total = investor_account.amount_invested.checked_add(amount).ok_or(TigerPayError::ArithmeticOverflow)?;
    require!(investor_total <= vault.max_investment, TigerPayError::InvestmentTooHigh);

    // Transfer funding tokens from investor to vault
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.investor_token_account.to_account_info(),
                to: ctx.accounts.vault_token_account.to_account_info(),
                authority: ctx.accounts.investor.to_account_info(),
            },
        ),
        amount,
    )?;

    // Mint debt tokens to investor
    let seeds = &[b"vault", vault.merchant.as_ref(), &[vault.vault_nonce], &[vault.bump]];
    let signer_seeds = &[&seeds[..]];

    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.debt_token_mint.to_account_info(),
                to: ctx.accounts.investor_debt_token_account.to_account_info(),
                authority: vault.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
    )?;

    // Update investor account
    if investor_account.amount_invested == 0 {
        investor_account.vault = vault.key();
        investor_account.investor = ctx.accounts.investor.key();
        investor_account.investor_token_account = ctx.accounts.investor_token_account.key();
        investor_account.invested_at = clock.unix_timestamp;
        investor_account.bump = ctx.bumps.investor_account;
        vault.investor_count += 1;
    }
    
    investor_account.amount_invested = investor_total;
    investor_account.debt_tokens_received = investor_account.debt_tokens_received.checked_add(amount).ok_or(TigerPayError::ArithmeticOverflow)?;
    vault.total_raised = new_total;
    vault.user_funded = vault.user_funded.checked_add(amount).ok_or(TigerPayError::ArithmeticOverflow)?;

    msg!("Investment received: {} from {}", amount, ctx.accounts.investor.key());

    // Check if target reached
    if vault.total_raised >= vault.target_amount {
        vault.state = VaultState::Active;
        let interest = (vault.total_raised as u128).checked_mul(vault.interest_rate_bps as u128).unwrap().checked_mul(vault.duration_months as u128).unwrap().checked_div(10000 * 12).unwrap() as u64;
        vault.total_to_repay = vault.total_raised.checked_add(interest).unwrap();
        msg!("Fundraising complete! Total to repay: {}", vault.total_to_repay);
    }

    Ok(())
}
