use anchor_lang::prelude::*;

use crate::state::*;
use crate::errors::TigerPayError;

pub fn submit_milestone(
    ctx: Context<SubmitMilestone>,
    milestone_id: u8,
    evidence_hash: [u8; 32],
) -> Result<()> {
    let milestone = &mut ctx.accounts.milestone;
    let clock = Clock::get()?;

    require!(
        milestone.status == MilestoneStatus::Pending,
        TigerPayError::MilestoneAlreadySubmitted
    );

    milestone.evidence_hash = evidence_hash;
    milestone.status = MilestoneStatus::Submitted;
    milestone.submitted_at = clock.unix_timestamp;

    msg!("Milestone {} submitted with evidence", milestone_id);

    Ok(())
}

pub fn vote_milestone(
    ctx: Context<VoteMilestone>,
    milestone_id: u8,
    approve: bool,
    comment_hash: [u8; 32],
) -> Result<()> {
    let milestone = &mut ctx.accounts.milestone;
    let vote = &mut ctx.accounts.verifier_vote;
    let clock = Clock::get()?;

    require!(
        milestone.status == MilestoneStatus::Submitted,
        TigerPayError::MilestoneNotSubmitted
    );

    // Record vote
    vote.milestone = milestone.key();
    vote.verifier = ctx.accounts.verifier.key();
    vote.approved = approve;
    vote.comment_hash = comment_hash;
    vote.voted_at = clock.unix_timestamp;
    vote.bump = ctx.bumps.verifier_vote;

    // Update milestone counts
    if approve {
        milestone.approval_count += 1;
        
        if milestone.approval_count >= milestone.required_approvals {
            milestone.status = MilestoneStatus::Approved;
            milestone.approved_at = clock.unix_timestamp;
            msg!("Milestone {} approved!", milestone_id);
        }
    } else {
        milestone.rejection_count += 1;
        
        if milestone.rejection_count >= milestone.required_approvals {
            milestone.status = MilestoneStatus::Rejected;
            msg!("Milestone {} rejected", milestone_id);
        }
    }

    msg!("Vote recorded: {} by verifier {}", 
         if approve { "approve" } else { "reject" },
         ctx.accounts.verifier.key());

    Ok(())
}

#[derive(Accounts)]
#[instruction(milestone_id: u8)]
pub struct SubmitMilestone<'info> {
    #[account(
        constraint = merchant.key() == vault.merchant @ TigerPayError::Unauthorized,
    )]
    pub merchant: Signer<'info>,
    
    #[account(
        constraint = vault.is_active() || vault.is_repaying() @ TigerPayError::InvalidVaultState,
    )]
    pub vault: Account<'info, MerchantVault>,
    
    #[account(
        mut,
        seeds = [b"milestone", vault.key().as_ref(), &[milestone_id]],
        bump = milestone.bump,
        constraint = milestone.vault == vault.key() @ TigerPayError::InvalidAccount,
    )]
    pub milestone: Account<'info, Milestone>,
}

#[derive(Accounts)]
#[instruction(milestone_id: u8)]
pub struct VoteMilestone<'info> {
    #[account(mut)]
    pub verifier: Signer<'info>,
    
    pub vault: Account<'info, MerchantVault>,
    
    #[account(
        mut,
        seeds = [b"milestone", vault.key().as_ref(), &[milestone_id]],
        bump = milestone.bump,
    )]
    pub milestone: Account<'info, Milestone>,
    
    #[account(
        init,
        payer = verifier,
        space = VerifierVote::LEN,
        seeds = [b"vote", milestone.key().as_ref(), verifier.key().as_ref()],
        bump,
    )]
    pub verifier_vote: Account<'info, VerifierVote>,
    
    pub system_program: Program<'info, System>,
}
