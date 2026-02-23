use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::state::*;
use crate::errors::TigerPayError;
use crate::events::*;
use crate::{MarkDefault, RecoverFunds};

/// Marks a vault as defaulted when merchant fails to repay within grace period.
/// Can be called by platform authority or any keeper/crank.
pub fn mark_default(ctx: Context<MarkDefault>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let clock = Clock::get()?;

    require!(
        vault.state == VaultState::Repaying,
        TigerPayError::InvalidVaultState
    );
    require!(
        vault.should_default(clock.unix_timestamp),
        TigerPayError::GracePeriodNotExpired
    );

    vault.state = VaultState::Defaulted;
    vault.defaulted_at = clock.unix_timestamp;

    // Apply outstanding late fees
    let late_fee = vault.calculate_late_fee(clock.unix_timestamp);
    if late_fee > 0 {
        vault.total_late_fees = vault.total_late_fees
            .checked_add(late_fee)
            .ok_or(TigerPayError::ArithmeticOverflow)?;
    }

    emit!(VaultDefaulted {
        vault: vault.key(),
        total_repaid: vault.total_repaid,
        total_to_repay: vault.total_to_repay,
        defaulted_at: clock.unix_timestamp,
    });

    msg!("Vault {} marked as DEFAULTED. Repaid {}/{}", 
        vault.key(), vault.total_repaid, vault.total_to_repay);
    Ok(())
}

/// Recovers remaining funds from a defaulted vault back to investors.
/// Platform authority triggers this after default is marked.
pub fn recover_funds(ctx: Context<RecoverFunds>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;

    require!(vault.is_defaulted(), TigerPayError::InvalidVaultState);

    // Transfer whatever is left in the vault back to platform recovery account
    let available = ctx.accounts.vault_token_account.amount;
    require!(available > 0, TigerPayError::InsufficientFunds);

    let seeds = &[
        b"vault", 
        vault.merchant.as_ref(), 
        &[vault.vault_nonce], 
        &[vault.bump]
    ];
    let signer_seeds = &[&seeds[..]];

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_token_account.to_account_info(),
                to: ctx.accounts.recovery_token_account.to_account_info(),
                authority: vault.to_account_info(),
            },
            signer_seeds,
        ),
        available,
    )?;

    vault.total_recovered = vault.total_recovered
        .checked_add(available)
        .ok_or(TigerPayError::ArithmeticOverflow)?;

    emit!(FundsRecovered {
        vault: vault.key(),
        amount: available,
        recovered_to: ctx.accounts.recovery_token_account.key(),
    });

    msg!("Recovered {} from defaulted vault {}", available, vault.key());
    Ok(())
}
