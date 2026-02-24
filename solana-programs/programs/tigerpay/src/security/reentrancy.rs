use anchor_lang::prelude::*;

/// Reentrancy guard storage - stored in a PDA to track execution state
#[account]
pub struct ReentrancyGuard {
    pub status: u8,  // 0 = not entered, 1 = entered
    pub bump: u8,
}

impl ReentrancyGuard {
    pub const LEN: usize = 8 +  // discriminator
        1 +   // status
        1;    // bump

    pub const STATUS_NOT_ENTERED: u8 = 0;
    pub const STATUS_ENTERED: u8 = 1;
}

/// Error for reentrancy protection
#[error_code]
pub enum ReentrancyError {
    #[msg("Reentrant call detected")]
    ReentrantCall,
    #[msg("Guard is in inconsistent state")]
    GuardInconsistentState,
}

/// Check and set reentrancy guard (call at start of instruction)
pub fn enter_guard(guard: &mut Account<ReentrancyGuard>) -> Result<()> {
    require!(
        guard.status == ReentrancyGuard::STATUS_NOT_ENTERED,
        ReentrancyError::ReentrantCall
    );
    guard.status = ReentrancyGuard::STATUS_ENTERED;
    Ok(())
}

/// Reset reentrancy guard (call at end of instruction)
pub fn exit_guard(guard: &mut Account<ReentrancyGuard>) -> Result<()> {
    require!(
        guard.status == ReentrancyGuard::STATUS_ENTERED,
        ReentrancyError::GuardInconsistentState
    );
    guard.status = ReentrancyGuard::STATUS_NOT_ENTERED;
    Ok(())
}

/// Macro to automatically handle reentrancy guard lifecycle
#[macro_export]
macro_rules! reentrancy_guard {
    ($guard:expr, $body:block) => {{
        $crate::security::reentrancy::enter_guard(&mut $guard)?;
        let result = { $body };
        $crate::security::reentrancy::exit_guard(&mut $guard)?;
        result
    }};
}