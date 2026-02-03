use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::state::*;
use crate::errors::TigerPayError;

pub fn claim_returns(ctx: Context<ClaimReturns>) -> Result<()> {
    let vault = &ctx.accounts.vault;
    let investor_account = &mut ctx.accounts.investor_account;
    let clock = Clock::get()?;

    require!(
        vault.is_repaying() || vault.state == VaultState::Completed,
        TigerPayError::InvalidVaultState
    );

    let claimable = investor_account.calculate_claimable(
        vault.total_raised,
        vault.total_repaid,
    );
    
    require!(claimable > 0, TigerPayError::NoReturnsAvailable);

    // Transfer from vault to investor
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
        claimable,
    )?;

    // Update investor account
    investor_account.claimed_returns = investor_account.claimed_returns
        .checked_add(claimable)
        .ok_or(TigerPayError::ArithmeticOverflow)?;
    investor_account.last_claim_at = clock.unix_timestamp;

    msg!("Returns claimed: {} by investor {}", claimable, ctx.accounts.investor.key());

    Ok(())
}

#[derive(Accounts)]
pub struct ClaimReturns<'info> {
    pub investor: Signer<'info>,
    
    #[account(
        constraint = vault.is_repaying() || vault.state == VaultState::Completed @ TigerPayError::InvalidVaultState,
    )]
    pub vault: Account<'info, MerchantVault>,
    
    #[account(
        mut,
        seeds = [b"investor", vault.key().as_ref(), investor.key().as_ref()],
        bump = investor_account.bump,
        constraint = investor_account.investor == investor.key() @ TigerPayError::Unauthorized,
    )]
    pub investor_account: Account<'info, InvestorAccount>,
    
    #[account(
        mut,
        constraint = vault_token_account.key() == vault.vault_token_account @ TigerPayError::InvalidAccount,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = investor_token_account.owner == investor.key() @ TigerPayError::InvalidAccount,
        constraint = investor_token_account.mint == vault.funding_token_mint @ TigerPayError::InvalidAccount,
    )]
    pub investor_token_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}
