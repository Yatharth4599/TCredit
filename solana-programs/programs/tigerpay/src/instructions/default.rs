use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::state::*;
use crate::errors::TigerPayError;

/// Mark a vault as defaulted after grace period expires
pub fn mark_default(ctx: Context<MarkDefault>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let clock = Clock::get()?;

    require!(vault.state == VaultState::Repaying, TigerPayError::InvalidVaultState);
    require!(!vault.paused, TigerPayError::VaultPaused);
    require!(vault.should_default(clock.unix_timestamp), TigerPayError::GracePeriodNotExpired);

    vault.state = VaultState::Defaulted;
    vault.defaulted_at = clock.unix_timestamp;

    msg!("Vault {} marked as DEFAULTED", vault.key());
    emit!(VaultDefaulted {
        vault: vault.key(),
        merchant: vault.merchant,
        total_raised: vault.total_raised,
        total_repaid: vault.total_repaid,
        defaulted_at: clock.unix_timestamp,
    });

    Ok(())
}

/// Investor recovers funds from a defaulted vault (proportional share of remaining balance)
pub fn recover_funds(ctx: Context<RecoverFunds>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let investor_account = &mut ctx.accounts.investor_account;

    require!(vault.is_defaulted(), TigerPayError::InvalidVaultState);
    require!(!investor_account.has_recovered, TigerPayError::AlreadyClaimed);

    let vault_balance = ctx.accounts.vault_token_account.amount;
    if vault_balance == 0 {
        return err!(TigerPayError::InsufficientFunds);
    }

    // Calculate proportional share: (investor_amount / total_raised) * vault_balance
    let share = (investor_account.amount_invested as u128)
        .checked_mul(vault_balance as u128)
        .ok_or(TigerPayError::ArithmeticOverflow)?
        .checked_div(vault.total_raised as u128)
        .ok_or(TigerPayError::ArithmeticOverflow)? as u64;

    if share == 0 {
        return err!(TigerPayError::NoReturnsAvailable);
    }

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
                authority: vault.to_account_info(),
            },
            signer_seeds,
        ),
        share,
    )?;

    investor_account.has_recovered = true;
    investor_account.recovered_amount = share;
    vault.total_recovered = vault.total_recovered.checked_add(share).ok_or(TigerPayError::ArithmeticOverflow)?;

    msg!("Recovered {} for investor {} from defaulted vault", share, ctx.accounts.investor.key());
    Ok(())
}

#[derive(Accounts)]
pub struct MarkDefault<'info> {
    #[account(constraint = authority.key() == platform_config.authority @ TigerPayError::Unauthorized)]
    pub authority: Signer<'info>,

    #[account(seeds = [b"config"], bump = platform_config.bump)]
    pub platform_config: Account<'info, PlatformConfig>,

    #[account(mut)]
    pub vault: Account<'info, MerchantVault>,
}

#[derive(Accounts)]
pub struct RecoverFunds<'info> {
    pub investor: Signer<'info>,

    #[account(constraint = vault.is_defaulted() @ TigerPayError::InvalidVaultState)]
    pub vault: Account<'info, MerchantVault>,

    #[account(
        mut,
        seeds = [b"investor", vault.key().as_ref(), investor.key().as_ref()],
        bump = investor_account.bump,
        constraint = investor_account.investor == investor.key() @ TigerPayError::Unauthorized,
    )]
    pub investor_account: Account<'info, InvestorAccount>,

    #[account(mut, constraint = vault_token_account.key() == vault.vault_token_account @ TigerPayError::InvalidAccount)]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = investor_token_account.owner == investor.key() @ TigerPayError::InvalidAccount,
        constraint = investor_token_account.mint == vault.funding_token_mint @ TigerPayError::InvalidAccount,
    )]
    pub investor_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

// Events
#[event]
pub struct VaultDefaulted {
    pub vault: Pubkey,
    pub merchant: Pubkey,
    pub total_raised: u64,
    pub total_repaid: u64,
    pub defaulted_at: i64,
}
