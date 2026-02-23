use anchor_lang::prelude::*;

use crate::state::*;
use crate::errors::TigerPayError;
use crate::events::*;
use crate::{PauseVault, UnpauseVault};

/// Pauses a vault — freezes all operations (invest, repay, release, claim).
/// Only vault authority or platform authority can pause.
pub fn pause_vault(ctx: Context<PauseVault>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let clock = Clock::get()?;

    require!(!vault.paused, TigerPayError::VaultAlreadyPaused);
    require!(!vault.cancelled, TigerPayError::VaultCancelled);
    require!(
        vault.state != VaultState::Completed && vault.state != VaultState::Defaulted,
        TigerPayError::InvalidVaultState
    );

    vault.paused = true;

    emit!(VaultPaused {
        vault: vault.key(),
        paused_by: ctx.accounts.authority.key(),
        timestamp: clock.unix_timestamp,
    });

    msg!("Vault {} paused by {}", vault.key(), ctx.accounts.authority.key());
    Ok(())
}

/// Unpauses a vault — resumes all operations.
pub fn unpause_vault(ctx: Context<UnpauseVault>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let clock = Clock::get()?;

    require!(vault.paused, TigerPayError::VaultNotPaused);

    vault.paused = false;

    emit!(VaultUnpaused {
        vault: vault.key(),
        unpaused_by: ctx.accounts.authority.key(),
        timestamp: clock.unix_timestamp,
    });

    msg!("Vault {} unpaused by {}", vault.key(), ctx.accounts.authority.key());
    Ok(())
}
