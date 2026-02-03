use anchor_lang::prelude::*;

use crate::state::*;
use crate::errors::TigerPayError;

pub fn initialize_tranches(ctx: Context<InitializeTranches>, tranche_index: u8) -> Result<()> {
    let vault = &ctx.accounts.vault;
    let tranche = &mut ctx.accounts.tranche;
    let clock = Clock::get()?;

    require!(
        tranche_index < vault.num_tranches,
        TigerPayError::InvalidTranches
    );

    let tranche_interval = 30 * 24 * 60 * 60i64; // 30 days

    tranche.vault = vault.key();
    tranche.tranche_index = tranche_index;
    tranche.amount = 0; // Set when fundraising completes
    tranche.release_time = clock.unix_timestamp + ((tranche_index as i64 + 1) * tranche_interval);
    tranche.released = false;
    tranche.released_at = 0;
    tranche.milestone_id = tranche_index + 1;
    tranche.bump = ctx.bumps.tranche;

    msg!("Tranche {} initialized for vault", tranche_index);

    Ok(())
}

pub fn initialize_milestone(
    ctx: Context<InitializeMilestoneAccount>,
    milestone_id: u8,
    description_hash: [u8; 32],
) -> Result<()> {
    let milestone = &mut ctx.accounts.milestone;
    let config = &ctx.accounts.platform_config;

    milestone.vault = ctx.accounts.vault.key();
    milestone.milestone_id = milestone_id;
    milestone.evidence_hash = [0u8; 32];
    milestone.description_hash = description_hash;
    milestone.status = MilestoneStatus::Pending;
    milestone.submitted_at = 0;
    milestone.approved_at = 0;
    milestone.approval_count = 0;
    milestone.rejection_count = 0;
    milestone.required_approvals = config.required_verifiers;
    milestone.bump = ctx.bumps.milestone;

    msg!("Milestone {} initialized for vault", milestone_id);

    Ok(())
}

#[derive(Accounts)]
#[instruction(tranche_index: u8)]
pub struct InitializeTranches<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub vault: Account<'info, MerchantVault>,
    
    #[account(
        init,
        payer = authority,
        space = Tranche::LEN,
        seeds = [b"tranche", vault.key().as_ref(), &[tranche_index]],
        bump,
    )]
    pub tranche: Account<'info, Tranche>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(milestone_id: u8)]
pub struct InitializeMilestoneAccount<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub vault: Account<'info, MerchantVault>,
    
    #[account(seeds = [b"config"], bump = platform_config.bump)]
    pub platform_config: Account<'info, PlatformConfig>,
    
    #[account(
        init,
        payer = authority,
        space = Milestone::LEN,
        seeds = [b"milestone", vault.key().as_ref(), &[milestone_id]],
        bump,
    )]
    pub milestone: Account<'info, Milestone>,
    
    pub system_program: Program<'info, System>,
}
