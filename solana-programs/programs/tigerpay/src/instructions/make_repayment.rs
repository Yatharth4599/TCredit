use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::state::*;
use crate::errors::TigerPayError;

pub fn make_repayment(ctx: Context<MakeRepayment>, amount: u64) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let clock = Clock::get()?;

    require!(
        vault.is_active() || vault.is_repaying(),
        TigerPayError::InvalidVaultState
    );
    require!(amount > 0, TigerPayError::InvalidRepaymentAmount);

    // Transfer from merchant to vault
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

    // Update vault
    vault.total_repaid = vault.total_repaid
        .checked_add(amount)
        .ok_or(TigerPayError::ArithmeticOverflow)?;

    msg!("Repayment received: {} from merchant {}", amount, ctx.accounts.merchant.key());
    msg!("Total repaid: {} / {}", vault.total_repaid, vault.total_to_repay);

    // Check if fully repaid
    if vault.total_repaid >= vault.total_to_repay {
        vault.state = VaultState::Completed;
        msg!("Vault fully repaid, now in COMPLETED state");
    }

    Ok(())
}

#[derive(Accounts)]
pub struct MakeRepayment<'info> {
    #[account(
        constraint = merchant.key() == vault.merchant @ TigerPayError::Unauthorized,
    )]
    pub merchant: Signer<'info>,
    
    #[account(
        mut,
        constraint = vault.is_active() || vault.is_repaying() @ TigerPayError::InvalidVaultState,
    )]
    pub vault: Account<'info, MerchantVault>,
    
    #[account(
        mut,
        constraint = merchant_token_account.owner == merchant.key() @ TigerPayError::InvalidAccount,
        constraint = merchant_token_account.mint == vault.funding_token_mint @ TigerPayError::InvalidAccount,
    )]
    pub merchant_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = vault_token_account.key() == vault.vault_token_account @ TigerPayError::InvalidAccount,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}
