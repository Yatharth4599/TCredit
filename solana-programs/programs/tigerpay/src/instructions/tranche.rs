use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::state::*;
use crate::errors::TigerPayError;
use crate::InitializeTranche;
use crate::ReleaseTranche;

pub fn initialize_tranche(
    ctx: Context<InitializeTranche>,
    tranche_index: u8,
) -> Result<()> {
    let vault = &ctx.accounts.vault;
    let tranche = &mut ctx.accounts.tranche;
    let clock = Clock::get()?;

    require!(tranche_index < vault.num_tranches, TigerPayError::InvalidTranches);

    let tranche_interval = 30 * 24 * 60 * 60i64; // 30 days

    tranche.vault = vault.key();
    tranche.tranche_index = tranche_index;
    tranche.amount = vault.target_amount / vault.num_tranches as u64;
    tranche.release_time = clock.unix_timestamp + ((tranche_index as i64 + 1) * tranche_interval);
    tranche.released = false;
    tranche.released_at = 0;
    tranche.milestone_id = tranche_index + 1;
    tranche.bump = ctx.bumps.tranche;

    msg!("Tranche {} initialized", tranche_index);
    Ok(())
}

pub fn release_tranche(ctx: Context<ReleaseTranche>, tranche_index: u8) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let tranche = &mut ctx.accounts.tranche;
    let milestone = &ctx.accounts.milestone;
    let clock = Clock::get()?;

    require!(vault.is_active() || vault.is_repaying(), TigerPayError::InvalidVaultState);
    require!(!tranche.released, TigerPayError::TrancheAlreadyReleased);
    require!(clock.unix_timestamp >= tranche.release_time, TigerPayError::TrancheNotReady);
    require!(milestone.status == MilestoneStatus::Approved, TigerPayError::MilestoneNotApproved);

    let tranche_amount = vault.total_raised / vault.num_tranches as u64;
    let platform_fee = tranche_amount * vault.platform_fee_bps as u64 / 10000;
    let merchant_amount = tranche_amount - platform_fee;

    let seeds = &[b"vault", vault.merchant.as_ref(), &[vault.vault_nonce], &[vault.bump]];
    let signer_seeds = &[&seeds[..]];

    // Transfer to merchant
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_token_account.to_account_info(),
                to: ctx.accounts.merchant_token_account.to_account_info(),
                authority: vault.to_account_info(),
            },
            signer_seeds,
        ),
        merchant_amount,
    )?;

    // Transfer platform fee
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_token_account.to_account_info(),
                to: ctx.accounts.platform_fee_account.to_account_info(),
                authority: vault.to_account_info(),
            },
            signer_seeds,
        ),
        platform_fee,
    )?;

    tranche.released = true;
    tranche.released_at = clock.unix_timestamp;
    tranche.amount = tranche_amount;

    vault.tranches_released += 1;
    vault.platform_fees_collected += platform_fee;

    msg!("Tranche {} released: {} to merchant", tranche_index, merchant_amount);

    if vault.tranches_released >= vault.num_tranches && vault.is_active() {
        vault.state = VaultState::Repaying;
        msg!("All tranches released, vault now REPAYING");
    }

    Ok(())
}
