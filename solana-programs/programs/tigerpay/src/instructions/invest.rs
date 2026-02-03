use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer, MintTo};
use anchor_spl::associated_token::AssociatedToken;

use crate::state::*;
use crate::errors::TigerPayError;

pub fn invest(ctx: Context<Invest>, amount: u64) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let investor_account = &mut ctx.accounts.investor_account;
    let clock = Clock::get()?;

    require!(
        vault.is_fundraising(),
        TigerPayError::InvalidVaultState
    );
    require!(
        clock.unix_timestamp <= vault.fundraising_deadline,
        TigerPayError::FundraisingDeadlinePassed
    );
    require!(
        amount >= vault.min_investment,
        TigerPayError::InvestmentTooLow
    );
    
    let new_total = vault.total_raised.checked_add(amount)
        .ok_or(TigerPayError::ArithmeticOverflow)?;
    require!(
        new_total <= vault.target_amount,
        TigerPayError::InvestmentExceedsTarget
    );
    
    let investor_total = investor_account.amount_invested.checked_add(amount)
        .ok_or(TigerPayError::ArithmeticOverflow)?;
    require!(
        investor_total <= vault.max_investment,
        TigerPayError::InvestmentTooHigh
    );

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

    // Mint debt tokens to investor (1:1 ratio)
    let vault_key = vault.key();
    let seeds = &[
        b"vault",
        vault.merchant.as_ref(),
        &[vault.vault_nonce],
        &[vault.bump],
    ];
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
    investor_account.debt_tokens_received = investor_account.debt_tokens_received
        .checked_add(amount)
        .ok_or(TigerPayError::ArithmeticOverflow)?;

    // Update vault
    vault.total_raised = new_total;

    msg!("Investment received: {} from {}", amount, ctx.accounts.investor.key());

    // Check if target reached
    if vault.total_raised >= vault.target_amount {
        complete_fundraising(vault)?;
    }

    Ok(())
}

fn complete_fundraising(vault: &mut Account<MerchantVault>) -> Result<()> {
    vault.state = VaultState::Active;
    
    // Calculate total to repay (principal + interest)
    let interest = (vault.total_raised as u128)
        .checked_mul(vault.interest_rate_bps as u128)
        .ok_or(TigerPayError::ArithmeticOverflow)?
        .checked_mul(vault.duration_months as u128)
        .ok_or(TigerPayError::ArithmeticOverflow)?
        .checked_div(10000 * 12)
        .ok_or(TigerPayError::ArithmeticOverflow)? as u64;
    
    vault.total_to_repay = vault.total_raised
        .checked_add(interest)
        .ok_or(TigerPayError::ArithmeticOverflow)?;

    msg!("Fundraising complete! Total raised: {}, Total to repay: {}", 
         vault.total_raised, vault.total_to_repay);

    Ok(())
}

#[derive(Accounts)]
pub struct Invest<'info> {
    #[account(mut)]
    pub investor: Signer<'info>,
    
    #[account(
        mut,
        constraint = vault.is_fundraising() @ TigerPayError::InvalidVaultState,
    )]
    pub vault: Account<'info, MerchantVault>,
    
    #[account(
        init_if_needed,
        payer = investor,
        space = InvestorAccount::LEN,
        seeds = [b"investor", vault.key().as_ref(), investor.key().as_ref()],
        bump,
    )]
    pub investor_account: Account<'info, InvestorAccount>,
    
    #[account(
        mut,
        constraint = investor_token_account.mint == vault.funding_token_mint @ TigerPayError::InvalidAccount,
        constraint = investor_token_account.owner == investor.key() @ TigerPayError::InvalidAccount,
    )]
    pub investor_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = vault_token_account.key() == vault.vault_token_account @ TigerPayError::InvalidAccount,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = debt_token_mint.key() == vault.debt_token_mint @ TigerPayError::InvalidAccount,
    )]
    pub debt_token_mint: Account<'info, Mint>,
    
    #[account(
        init_if_needed,
        payer = investor,
        associated_token::mint = debt_token_mint,
        associated_token::authority = investor,
    )]
    pub investor_debt_token_account: Account<'info, TokenAccount>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}
