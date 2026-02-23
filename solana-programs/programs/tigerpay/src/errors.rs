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

    // Production error codes
    #[msg("Vault is paused")]
    VaultPaused,

    #[msg("Vault is not paused")]
    VaultNotPaused,

    #[msg("Vault already paused")]
    VaultAlreadyPaused,

    #[msg("Vault is cancelled")]
    VaultCancelled,

    #[msg("Vault is not cancelled")]
    VaultNotCancelled,

    #[msg("Vault already cancelled")]
    VaultAlreadyCancelled,

    #[msg("Grace period has not expired")]
    GracePeriodNotExpired,

    #[msg("Already claimed or refunded")]
    AlreadyClaimed,

    #[msg("No dividends available")]
    NoDividendsAvailable,

    #[msg("Maximum investors reached")]
    MaxInvestorsReached,

    #[msg("Late payment - fees applied")]
    LatePayment,

    // Programmable Credit error codes
    #[msg("Invalid oracle authority")]
    InvalidOracleAuthority,

    #[msg("Settlement account not active")]
    SettlementNotActive,

    #[msg("Liquidity pool is paused")]
    PoolPaused,

    #[msg("Insufficient pool balance")]
    PoolInsufficientBalance,

    #[msg("Allocation exceeds per-vault cap")]
    AllocationExceedsCap,

    #[msg("Merchant credit score too low")]
    CreditScoreTooLow,

    #[msg("Credit score expired - refresh required")]
    CreditScoreExpired,
}
