use anchor_lang::prelude::*;

use crate::state::*;
use crate::errors::TigerPayError;
use crate::InitializeMilestone;
use crate::SubmitMilestone;
use crate::VoteMilestone;

pub fn initialize_milestone(
    ctx: Context<InitializeMilestone>,
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

    msg!("Milestone {} initialized", milestone_id);
    Ok(())
}

pub fn submit_milestone(
    ctx: Context<SubmitMilestone>,
    _milestone_id: u8,
    evidence_hash: [u8; 32],
) -> Result<()> {
    let milestone = &mut ctx.accounts.milestone;
    let clock = Clock::get()?;

    require!(milestone.status == MilestoneStatus::Pending, TigerPayError::MilestoneAlreadySubmitted);

    milestone.evidence_hash = evidence_hash;
    milestone.status = MilestoneStatus::Submitted;
    milestone.submitted_at = clock.unix_timestamp;

    msg!("Milestone {} submitted", milestone.milestone_id);
    Ok(())
}

pub fn vote_milestone(
    ctx: Context<VoteMilestone>,
    _milestone_id: u8,
    approve: bool,
    comment_hash: [u8; 32],
) -> Result<()> {
    let milestone = &mut ctx.accounts.milestone;
    let vote = &mut ctx.accounts.verifier_vote;
    let clock = Clock::get()?;

    require!(milestone.status == MilestoneStatus::Submitted, TigerPayError::MilestoneNotSubmitted);

    vote.milestone = milestone.key();
    vote.verifier = ctx.accounts.verifier.key();
    vote.approved = approve;
    vote.comment_hash = comment_hash;
    vote.voted_at = clock.unix_timestamp;
    vote.bump = ctx.bumps.verifier_vote;

    if approve {
        milestone.approval_count += 1;
        if milestone.approval_count >= milestone.required_approvals {
            milestone.status = MilestoneStatus::Approved;
            milestone.approved_at = clock.unix_timestamp;
            msg!("Milestone {} approved!", milestone.milestone_id);
        }
    } else {
        milestone.rejection_count += 1;
        if milestone.rejection_count >= milestone.required_approvals {
            milestone.status = MilestoneStatus::Rejected;
        }
    }

    Ok(())
}
