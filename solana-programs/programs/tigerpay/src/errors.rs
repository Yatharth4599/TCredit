use anchor_lang::prelude::*;

#[error_code]
pub enum TigerPayError {
    #[msg("Platform is paused")]
    PlatformPaused,
    
    #[msg("Merchant not verified")]
    MerchantNotVerified,
    
    #[msg("Maximum vaults exceeded for merchant")]
    MaxVaultsExceeded,
    
    #[msg("Invalid funding target")]
    InvalidFundingTarget,
    
    #[msg("Invalid interest rate")]
    InvalidInterestRate,
    
    #[msg("Invalid duration")]
    InvalidDuration,
    
    #[msg("Invalid number of tranches")]
    InvalidTranches,
    
    #[msg("Investment amount too low")]
    InvestmentTooLow,
    
    #[msg("Investment amount too high")]
    InvestmentTooHigh,
    
    #[msg("Investment would exceed target")]
    InvestmentExceedsTarget,
    
    #[msg("Fundraising deadline passed")]
    FundraisingDeadlinePassed,
    
    #[msg("Fundraising not complete")]
    FundraisingNotComplete,
    
    #[msg("Invalid vault state")]
    InvalidVaultState,
    
    #[msg("Milestone not approved")]
    MilestoneNotApproved,
    
    #[msg("Milestone already submitted")]
    MilestoneAlreadySubmitted,
    
    #[msg("Milestone not submitted")]
    MilestoneNotSubmitted,
    
    #[msg("Already voted on this milestone")]
    AlreadyVoted,
    
    #[msg("Tranche not ready for release")]
    TrancheNotReady,
    
    #[msg("Tranche already released")]
    TrancheAlreadyReleased,
    
    #[msg("Invalid repayment amount")]
    InvalidRepaymentAmount,
    
    #[msg("No returns available to claim")]
    NoReturnsAvailable,
    
    #[msg("Unauthorized")]
    Unauthorized,
    
    #[msg("Invalid account")]
    InvalidAccount,
    
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
    
    #[msg("Insufficient funds")]
    InsufficientFunds,
}
