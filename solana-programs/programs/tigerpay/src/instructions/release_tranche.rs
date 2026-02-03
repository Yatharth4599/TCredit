use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::state::*;
use crate::errors::TigerPayError;

pub fn release_tranche(ctx: Context<ReleaseTranche>, tranche_index: u8) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let tranche = &mut ctx.accounts.tranche;
    let milestone = &ctx.accounts.milestone;
    let clock = Clock::get()?;

    require!(
        vault.is_active() || vault.is_repaying(),
        TigerPayError::InvalidVaultState
    );
    require!(!tranche.released, TigerPayError::TrancheAlreadyReleased);
    require!(
        clock.unix_timestamp >= tranche.release_time,
        TigerPayError::TrancheNotReady
    );
    require!(
        milestone.is_approved(),
        TigerPayError::MilestoneNotApproved
    );

    // Calculate amounts
    let tranche_amount = vault.total_raised
        .checked_div(vault.num_tranches as u64)
        .ok_or(TigerPayError::ArithmeticOverflow)?;
    
    let platform_fee = tranche_amount
        .checked_mul(vault.platform_fee_bps as u64)
        .ok_or(TigerPayError::ArithmeticOverflow)?
        .checked_div(10000)
        .ok_or(TigerPayError::ArithmeticOverflow)?;
    
    let merchant_amount = tranche_amount
        .checked_sub(platform_fee)
        .ok_or(TigerPayError::ArithmeticOverflow)?;

    // Transfer to merchant
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

    // Update tranche
    tranche.released = true;
    tranche.released_at = clock.unix_timestamp;
    tranche.amount = tranche_amount;

    // Update vault
    vault.tranches_released += 1;
    vault.platform_fees_collected = vault.platform_fees_collected
        .checked_add(platform_fee)
        .ok_or(TigerPayError::ArithmeticOverflow)?;

    msg!("Tranche {} released: {} to merchant, {} fee", 
         tranche_index, merchant_amount, platform_fee);

    // If all tranches released, move to repaying
    if vault.tranches_released >= vault.num_tranches && vault.is_active() {
        vault.state = VaultState::Repaying;
        msg!("All tranches released, vault now in REPAYING state");
    }

    Ok(())
}

#[derive(Accounts)]
#[instruction(tranche_index: u8)]
pub struct ReleaseTranche<'info> {
    #[account(
        constraint = authority.key() == vault.authority @ TigerPayError::Unauthorized,
    )]
    pub authority: Signer<'info>,
    
    #[account(mut)]
    pub vault: Account<'info, MerchantVault>,
    
    #[account(
        mut,
        seeds = [b"tranche", vault.key().as_ref(), &[tranche_index]],
        bump = tranche.bump,
        constraint = tranche.vault == vault.key() @ TigerPayError::InvalidAccount,
        constraint = !tranche.released @ TigerPayError::TrancheAlreadyReleased,
    )]
    pub tranche: Account<'info, Tranche>,
    
    #[account(
        seeds = [b"milestone", vault.key().as_ref(), &[tranche.milestone_id]],
        bump = milestone.bump,
        constraint = milestone.is_approved() @ TigerPayError::MilestoneNotApproved,
    )]
    pub milestone: Account<'info, Milestone>,
    
    #[account(
        mut,
        constraint = vault_token_account.key() == vault.vault_token_account @ TigerPayError::InvalidAccount,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = merchant_token_account.owner == vault.merchant @ TigerPayError::InvalidAccount,
    )]
    pub merchant_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = platform_fee_account.owner == vault.platform_fee_recipient @ TigerPayError::InvalidAccount,
    )]
    pub platform_fee_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}
