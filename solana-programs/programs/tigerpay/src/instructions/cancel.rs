use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::state::*;
use crate::errors::TigerPayError;

/// Cancel a vault during fundraising phase (authority only)
pub fn cancel_vault(ctx: Context<CancelVault>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let clock = Clock::get()?;

    require!(vault.state == VaultState::Fundraising, TigerPayError::InvalidVaultState);
    require!(!vault.cancelled, TigerPayError::VaultAlreadyCancelled);

    vault.cancelled = true;
    vault.cancelled_at = clock.unix_timestamp;
    vault.state = VaultState::Cancelled;

    msg!("Vault {} cancelled by authority", vault.key());
    emit!(VaultCancelled {
        vault: vault.key(),
        merchant: vault.merchant,
        total_raised: vault.total_raised,
        investor_count: vault.investor_count,
        cancelled_at: clock.unix_timestamp,
    });

    Ok(())
}

/// Investor claims refund from a cancelled vault
pub fn claim_refund(ctx: Context<ClaimRefund>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let investor_account = &mut ctx.accounts.investor_account;

    require!(vault.is_cancelled(), TigerPayError::VaultNotCancelled);
    require!(!investor_account.has_refunded, TigerPayError::AlreadyClaimed);
    require!(investor_account.amount_invested > 0, TigerPayError::NoReturnsAvailable);

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
                authority: vault.to_account_info(),
            },
            signer_seeds,
        ),
        refund_amount,
    )?;

    investor_account.has_refunded = true;

    msg!("Refunded {} to investor {} from cancelled vault", refund_amount, ctx.accounts.investor.key());
    emit!(RefundClaimed {
        vault: vault.key(),
        investor: ctx.accounts.investor.key(),
        amount: refund_amount,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct CancelVault<'info> {
    #[account(constraint = authority.key() == vault.authority @ TigerPayError::Unauthorized)]
    pub authority: Signer<'info>,

    #[account(mut)]
    pub vault: Account<'info, MerchantVault>,
}

#[derive(Accounts)]
pub struct ClaimRefund<'info> {
    pub investor: Signer<'info>,

    #[account(mut, constraint = vault.is_cancelled() @ TigerPayError::VaultNotCancelled)]
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
pub struct VaultCancelled {
    pub vault: Pubkey,
    pub merchant: Pubkey,
    pub total_raised: u64,
    pub investor_count: u32,
    pub cancelled_at: i64,
}

#[event]
pub struct RefundClaimed {
    pub vault: Pubkey,
    pub investor: Pubkey,
    pub amount: u64,
}
