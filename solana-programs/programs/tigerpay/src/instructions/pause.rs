use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::state::*;
use crate::errors::TigerPayError;

/// Pause a vault (authority only)
pub fn pause_vault(ctx: Context<PauseVault>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    
    require!(!vault.paused, TigerPayError::VaultAlreadyPaused);
    vault.paused = true;

    msg!("Vault {} paused", vault.key());
    emit!(VaultPaused {
        vault: vault.key(),
        paused_by: ctx.accounts.authority.key(),
    });

    Ok(())
}

/// Unpause a vault (authority only)
pub fn unpause_vault(ctx: Context<UnpauseVault>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    
    require!(vault.paused, TigerPayError::VaultNotPaused);
    vault.paused = false;

    msg!("Vault {} unpaused", vault.key());
    emit!(VaultUnpaused {
        vault: vault.key(),
        unpaused_by: ctx.accounts.authority.key(),
    });

    Ok(())
}

#[derive(Accounts)]
pub struct PauseVault<'info> {
    #[account(constraint = authority.key() == vault.authority @ TigerPayError::Unauthorized)]
    pub authority: Signer<'info>,

    #[account(mut)]
    pub vault: Account<'info, MerchantVault>,
}

#[derive(Accounts)]
pub struct UnpauseVault<'info> {
    #[account(constraint = authority.key() == vault.authority @ TigerPayError::Unauthorized)]
    pub authority: Signer<'info>,

    #[account(mut)]
    pub vault: Account<'info, MerchantVault>,
}

#[event]
pub struct VaultPaused {
    pub vault: Pubkey,
    pub paused_by: Pubkey,
}

#[event]
pub struct VaultUnpaused {
    pub vault: Pubkey,
    pub unpaused_by: Pubkey,
}
