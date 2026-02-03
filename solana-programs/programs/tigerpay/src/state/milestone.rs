use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct Milestone {
    pub vault: Pubkey,
    pub milestone_id: u8,
    pub evidence_hash: [u8; 32],
    pub description_hash: [u8; 32],
    pub status: MilestoneStatus,
    pub submitted_at: i64,
    pub approved_at: i64,
    pub approval_count: u8,
    pub rejection_count: u8,
    pub required_approvals: u8,
    pub bump: u8,
}

impl Milestone {
    pub const LEN: usize = 8 +  // discriminator
        32 +  // vault
        1 +   // milestone_id
        32 +  // evidence_hash
        32 +  // description_hash
        1 +   // status
        8 +   // submitted_at
        8 +   // approved_at
        1 +   // approval_count
        1 +   // rejection_count
        1 +   // required_approvals
        1;    // bump

    pub fn is_approved(&self) -> bool {
        self.status == MilestoneStatus::Approved
    }

    pub fn can_approve(&self) -> bool {
        self.status == MilestoneStatus::Submitted 
            && self.approval_count + 1 >= self.required_approvals
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Default)]
pub enum MilestoneStatus {
    #[default]
    Pending,
    Submitted,
    Approved,
    Rejected,
    Disputed,
}

#[account]
#[derive(Default)]
pub struct Tranche {
    pub vault: Pubkey,
    pub tranche_index: u8,
    pub amount: u64,
    pub release_time: i64,
    pub released: bool,
    pub released_at: i64,
    pub milestone_id: u8,
    pub bump: u8,
}

impl Tranche {
    pub const LEN: usize = 8 +  // discriminator
        32 +  // vault
        1 +   // tranche_index
        8 +   // amount
        8 +   // release_time
        1 +   // released
        8 +   // released_at
        1 +   // milestone_id
        1;    // bump

    pub fn can_release(&self, current_time: i64) -> bool {
        !self.released && current_time >= self.release_time
    }
}

#[account]
#[derive(Default)]
pub struct VerifierVote {
    pub milestone: Pubkey,
    pub verifier: Pubkey,
    pub approved: bool,
    pub comment_hash: [u8; 32],
    pub voted_at: i64,
    pub bump: u8,
}

impl VerifierVote {
    pub const LEN: usize = 8 +  // discriminator
        32 +  // milestone
        32 +  // verifier
        1 +   // approved
        32 +  // comment_hash
        8 +   // voted_at
        1;    // bump
}
