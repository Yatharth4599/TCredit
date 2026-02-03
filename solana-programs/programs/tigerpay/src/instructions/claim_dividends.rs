use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::state::*;
use crate::errors::TigerPayError;

/// Investor claims their proportional share of distributed dividends
pub fn claim_dividends(ctx: Context<ClaimDividends>) -> Result<()> {
    let icm_vault = &mut ctx.accounts.icm_vault;
    let investor_account = &mut ctx.accounts.investor_account;
    let clock = Clock::get()?;

    require!(icm_vault.is_closed(), TigerPayError::InvalidVaultState);
    require!(!icm_vault.paused, TigerPayError::VaultPaused);
    require!(icm_vault.total_dividends_distributed > 0, TigerPayError::NoDividendsAvailable);

    let claimable = investor_account.calculate_claimable_dividends(
        icm_vault.shares_sold,
        icm_vault.total_dividends_distributed,
    );
    
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
                authority: icm_vault.to_account_info(),
            },
            signer_seeds,
        ),
        claimable,
    )?;

    investor_account.dividends_claimed = investor_account.dividends_claimed
        .checked_add(claimable)
        .ok_or(TigerPayError::ArithmeticOverflow)?;
    investor_account.last_claim_at = clock.unix_timestamp;
    
    icm_vault.total_dividends_claimed = icm_vault.total_dividends_claimed
        .checked_add(claimable)
        .ok_or(TigerPayError::ArithmeticOverflow)?;

    msg!("Dividends claimed: {} by investor {}", claimable, ctx.accounts.investor.key());
    emit!(DividendsClaimed {
        icm_vault: icm_vault.key(),
        investor: ctx.accounts.investor.key(),
        amount: claimable,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct ClaimDividends<'info> {
    pub investor: Signer<'info>,

    #[account(mut, constraint = icm_vault.is_closed() @ TigerPayError::InvalidVaultState)]
    pub icm_vault: Account<'info, ICMVault>,

    #[account(
        mut,
        seeds = [b"icm_investor", icm_vault.key().as_ref(), investor.key().as_ref()],
        bump = investor_account.bump,
        constraint = investor_account.investor == investor.key() @ TigerPayError::Unauthorized,
    )]
    pub investor_account: Account<'info, ICMInvestorAccount>,

    #[account(mut, constraint = vault_token_account.key() == icm_vault.vault_token_account @ TigerPayError::InvalidAccount)]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = investor_token_account.owner == investor.key() @ TigerPayError::InvalidAccount,
        constraint = investor_token_account.mint == icm_vault.funding_token_mint @ TigerPayError::InvalidAccount,
    )]
    pub investor_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[event]
pub struct DividendsClaimed {
    pub icm_vault: Pubkey,
    pub investor: Pubkey,
    pub amount: u64,
}
