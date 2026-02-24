use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer, MintTo};
use anchor_spl::associated_token::AssociatedToken;

declare_id!("5xzKq3bRuxLh4WezvMRHz8nodp4W6gihUvjeB5VcWa8z");

pub mod state;
pub mod errors;
pub mod events;
pub mod instructions;

pub use state::*;
pub use errors::*;
pub use events::*;

// ============ Program Constants ============

/// Seconds in a day (60 * 60 * 24)
pub const SECONDS_PER_DAY: i64 = 86_400;

/// Default repayment interval: 30 days
pub const REPAYMENT_INTERVAL_DAYS: i64 = 30;
pub const REPAYMENT_INTERVAL_SECS: i64 = REPAYMENT_INTERVAL_DAYS * SECONDS_PER_DAY;

/// Credit score maximum age before requiring refresh: 90 days
pub const CREDIT_SCORE_MAX_AGE_SECS: i64 = 90 * SECONDS_PER_DAY;

/// Maximum credit score on FairScale scale
pub const MAX_CREDIT_SCORE: u16 = 1000;

/// Repayment source identifiers
pub const REPAYMENT_SOURCE_MANUAL: u8 = 0;
pub const REPAYMENT_SOURCE_X402: u8 = 1;

/// Minimum fundraising threshold for vault activation (80%)
pub const MIN_FUNDRAISE_PCT: u64 = 80;

/// Maximum age for signed payment messages (5 minutes)
pub const MAX_MESSAGE_AGE_SECS: i64 = 300;

#[program]
pub mod tigerpay {
    use super::*;

    // ============ Admin ============

    pub fn initialize_platform(
        ctx: Context<InitializePlatform>,
        default_fee_bps: u16,
        min_funding_target: u64,
        max_funding_target: u64,
        min_interest_bps: u16,
        max_interest_bps: u16,
        max_duration_months: u8,
        max_tranches: u8,
        required_verifiers: u8,
    ) -> Result<()> {
        instructions::admin::initialize_platform(
            ctx, default_fee_bps, min_funding_target, max_funding_target,
            min_interest_bps, max_interest_bps, max_duration_months,
            max_tranches, required_verifiers,
        )
    }

    pub fn verify_merchant(ctx: Context<VerifyMerchant>, name_hash: [u8; 32]) -> Result<()> {
        instructions::admin::verify_merchant(ctx, name_hash)
    }

    // ============ Vault ============

    pub fn create_vault(
        ctx: Context<CreateVault>,
        vault_nonce: u8,
        target_amount: u64,
        min_investment: u64,
        max_investment: u64,
        interest_rate_bps: u16,
        duration_months: u8,
        num_tranches: u8,
        fundraising_days: u8,
        max_investors: u32,
        late_fee_bps: u16,
        grace_period_days: u8,
    ) -> Result<()> {
        instructions::create_vault::create_vault(
            ctx, vault_nonce, target_amount, min_investment, max_investment,
            interest_rate_bps, duration_months, num_tranches, fundraising_days,
            max_investors, late_fee_bps, grace_period_days,
        )
    }

    pub fn complete_fundraising_manual(ctx: Context<CompleteFundraisingManual>) -> Result<()> {
        instructions::create_vault::complete_fundraising_manual(ctx)
    }

    // ============ Investor ============

    pub fn invest(ctx: Context<Invest>, amount: u64) -> Result<()> {
        instructions::invest::invest(ctx, amount)
    }

    // ============ Repayment ============

    pub fn make_repayment(ctx: Context<MakeRepayment>, amount: u64) -> Result<()> {
        instructions::repayment::make_repayment(ctx, amount)
    }

    pub fn claim_returns(ctx: Context<ClaimReturns>) -> Result<()> {
        instructions::repayment::claim_returns(ctx)
    }

    // ============ Tranche & Milestone ============

    pub fn initialize_tranche(ctx: Context<InitializeTranche>, tranche_index: u8) -> Result<()> {
        instructions::tranche::initialize_tranche(ctx, tranche_index)
    }

    pub fn release_tranche(ctx: Context<ReleaseTranche>, tranche_index: u8) -> Result<()> {
        instructions::tranche::release_tranche(ctx, tranche_index)
    }

    pub fn initialize_milestone(
        ctx: Context<InitializeMilestone>,
        milestone_id: u8,
        description_hash: [u8; 32],
    ) -> Result<()> {
        instructions::milestone_ops::initialize_milestone(ctx, milestone_id, description_hash)
    }

    pub fn submit_milestone(
        ctx: Context<SubmitMilestone>,
        milestone_id: u8,
        evidence_hash: [u8; 32],
    ) -> Result<()> {
        instructions::milestone_ops::submit_milestone(ctx, milestone_id, evidence_hash)
    }

    pub fn vote_milestone(
        ctx: Context<VoteMilestone>,
        milestone_id: u8,
        approve: bool,
        comment_hash: [u8; 32],
    ) -> Result<()> {
        instructions::milestone_ops::vote_milestone(ctx, milestone_id, approve, comment_hash)
    }

    // ============ ICM (Equity) ============

    pub fn create_icm_vault(
        ctx: Context<CreateICMVault>,
        icm_nonce: u8,
        total_shares: u64,
        price_per_share: u64,
        min_buy: u64,
        max_buy: u64,
        offering_days: u8,
    ) -> Result<()> {
        instructions::icm_ops::create_icm_vault(
            ctx, icm_nonce, total_shares, price_per_share,
            min_buy, max_buy, offering_days,
        )
    }

    pub fn buy_stake(ctx: Context<BuyStake>, share_amount: u64) -> Result<()> {
        instructions::icm_ops::buy_stake(ctx, share_amount)
    }

    pub fn distribute_dividends(ctx: Context<DistributeDividends>, amount: u64) -> Result<()> {
        instructions::icm_ops::distribute_dividends(ctx, amount)
    }

    // ============ Programmable Credit: x402 Settlement ============

    pub fn route_repayment(
        ctx: Context<RouteRepayment>,
        amount: u64,
        proof: Option<instructions::route_repayment::X402PaymentProof>,
    ) -> Result<()> {
        instructions::route_repayment::route_repayment(ctx, amount, proof)
    }

    pub fn create_settlement(ctx: Context<CreateSettlement>, repayment_rate_bps: u16) -> Result<()> {
        instructions::settlement_ops::create_settlement(ctx, repayment_rate_bps)
    }

    // ============ Programmable Credit: Liquidity Pools ============

    pub fn register_pool(
        ctx: Context<RegisterPool>,
        max_allocation_per_vault: u64,
        is_alpha: bool,
    ) -> Result<()> {
        instructions::pool_ops::register_pool(ctx, max_allocation_per_vault, is_alpha)
    }

    pub fn deposit_to_pool(ctx: Context<DepositToPool>, amount: u64) -> Result<()> {
        instructions::pool_ops::deposit_to_pool(ctx, amount)
    }

    pub fn allocate_to_vault(ctx: Context<AllocateToVault>, amount: u64) -> Result<()> {
        instructions::pool_ops::allocate_to_vault(ctx, amount)
    }

    pub fn withdraw_from_pool(ctx: Context<WithdrawFromPool>, amount: u64) -> Result<()> {
        instructions::pool_ops::withdraw_from_pool(ctx, amount)
    }

    // ============ Default & Recovery ============

    pub fn mark_default(ctx: Context<MarkDefault>) -> Result<()> {
        instructions::default_ops::mark_default(ctx)
    }

    pub fn recover_funds(ctx: Context<RecoverFunds>) -> Result<()> {
        instructions::default_ops::recover_funds(ctx)
    }

    // ============ Cancel & Refund ============

    pub fn cancel_vault(ctx: Context<CancelVault>) -> Result<()> {
        instructions::cancel_ops::cancel_vault(ctx)
    }

    pub fn claim_refund(ctx: Context<ClaimRefund>) -> Result<()> {
        instructions::cancel_ops::claim_refund(ctx)
    }

    // ============ Pause ============

    pub fn pause_vault(ctx: Context<PauseVault>) -> Result<()> {
        instructions::pause_ops::pause_vault(ctx)
    }

    pub fn unpause_vault(ctx: Context<UnpauseVault>) -> Result<()> {
        instructions::pause_ops::unpause_vault(ctx)
    }

    // ============ ICM Dividends ============

    pub fn claim_dividends(ctx: Context<ClaimDividends>) -> Result<()> {
        instructions::dividend_ops::claim_dividends(ctx)
    }

    // ============ Credit Score ============

    pub fn update_credit_score(ctx: Context<UpdateCreditScore>, new_score: u16) -> Result<()> {
        instructions::credit_ops::update_credit_score(ctx, new_score)
    }

    // ============ Keeper / Crank ============

    pub fn auto_cancel_expired(ctx: Context<AutoCancelExpired>) -> Result<()> {
        instructions::keeper_ops::auto_cancel_expired(ctx)
    }

    pub fn return_pool_allocation(ctx: Context<ReturnPoolAllocation>, amount: u64) -> Result<()> {
        instructions::keeper_ops::return_pool_allocation(ctx, amount)
    }
}

// ============================================================================
// ACCOUNT STRUCTS — Must live in lib.rs for Anchor #[program] macro
// ============================================================================

// --- Admin ---

#[derive(Accounts)]
pub struct InitializePlatform<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    /// CHECK: Fee recipient is stored on PlatformConfig and verified off-chain during platform setup. Not validated here because it's only used as a destination for fee transfers.
    pub fee_recipient: UncheckedAccount<'info>,
    
    #[account(
        init,
        payer = authority,
        space = PlatformConfig::LEN,
        seeds = [b"config"],
        bump,
    )]
    pub platform_config: Account<'info, PlatformConfig>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct VerifyMerchant<'info> {
    #[account(
        mut,
        constraint = authority.key() == platform_config.authority @ TigerPayError::Unauthorized,
    )]
    pub authority: Signer<'info>,
    
    /// CHECK: Merchant wallet used as a PDA seed for the merchant_profile account. Safety is ensured by the merchant_profile PDA derivation and the authority check.
    pub merchant: UncheckedAccount<'info>,
    
    #[account(seeds = [b"config"], bump = platform_config.bump)]
    pub platform_config: Account<'info, PlatformConfig>,
    
    #[account(
        init,
        payer = authority,
        space = MerchantProfile::LEN,
        seeds = [b"merchant", merchant.key().as_ref()],
        bump,
    )]
    pub merchant_profile: Account<'info, MerchantProfile>,
    
    pub system_program: Program<'info, System>,
}

// --- Vault ---

#[derive(Accounts)]
#[instruction(vault_nonce: u8)]
pub struct CreateVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    /// CHECK: Merchant wallet used as a primary seed for the vault PDA. Validated to be a verified merchant via the merchant_profile account constraint.
    pub merchant: UncheckedAccount<'info>,
    
    #[account(
        mut,
        seeds = [b"merchant", merchant.key().as_ref()],
        bump = merchant_profile.bump,
        constraint = merchant_profile.verified @ TigerPayError::MerchantNotVerified,
    )]
    pub merchant_profile: Account<'info, MerchantProfile>,
    
    #[account(seeds = [b"config"], bump = platform_config.bump)]
    pub platform_config: Account<'info, PlatformConfig>,
    
    #[account(
        init,
        payer = authority,
        space = MerchantVault::LEN,
        seeds = [b"vault", merchant.key().as_ref(), &[vault_nonce]],
        bump,
    )]
    pub vault: Account<'info, MerchantVault>,
    
    pub funding_token_mint: Account<'info, Mint>,
    
    #[account(
        init,
        payer = authority,
        mint::decimals = funding_token_mint.decimals,
        mint::authority = vault,
        seeds = [b"debt_mint", vault.key().as_ref()],
        bump,
    )]
    pub debt_token_mint: Account<'info, Mint>,
    
    #[account(
        init,
        payer = authority,
        associated_token::mint = funding_token_mint,
        associated_token::authority = vault,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct CompleteFundraisingManual<'info> {
    #[account(constraint = authority.key() == vault.authority @ TigerPayError::Unauthorized)]
    pub authority: Signer<'info>,
    
    #[account(mut, constraint = vault.is_fundraising() @ TigerPayError::InvalidVaultState)]
    pub vault: Account<'info, MerchantVault>,
}

// --- Investor ---

#[derive(Accounts)]
pub struct Invest<'info> {
    #[account(mut)]
    pub investor: Signer<'info>,
    
    #[account(mut, constraint = vault.is_fundraising() @ TigerPayError::InvalidVaultState)]
    pub vault: Account<'info, MerchantVault>,
    
    #[account(
        init_if_needed,
        payer = investor,
        space = InvestorAccount::LEN,
        seeds = [b"investor", vault.key().as_ref(), investor.key().as_ref()],
        bump,
    )]
    pub investor_account: Account<'info, InvestorAccount>,
    
    #[account(
        mut,
        constraint = investor_token_account.mint == vault.funding_token_mint @ TigerPayError::InvalidAccount,
        constraint = investor_token_account.owner == investor.key() @ TigerPayError::InvalidAccount,
    )]
    pub investor_token_account: Account<'info, TokenAccount>,
    
    #[account(mut, constraint = vault_token_account.key() == vault.vault_token_account @ TigerPayError::InvalidAccount)]
    pub vault_token_account: Account<'info, TokenAccount>,
    
    #[account(mut, constraint = debt_token_mint.key() == vault.debt_token_mint @ TigerPayError::InvalidAccount)]
    pub debt_token_mint: Account<'info, Mint>,
    
    #[account(
        init_if_needed,
        payer = investor,
        associated_token::mint = debt_token_mint,
        associated_token::authority = investor,
    )]
    pub investor_debt_token_account: Account<'info, TokenAccount>,
    
    #[account(seeds = [b"config"], bump = platform_config.bump)]
    pub platform_config: Account<'info, PlatformConfig>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

// --- Repayment & Claims ---

#[derive(Accounts)]
pub struct MakeRepayment<'info> {
    #[account(constraint = merchant.key() == vault.merchant @ TigerPayError::Unauthorized)]
    pub merchant: Signer<'info>,
    
    #[account(mut, constraint = vault.is_active() || vault.is_repaying() @ TigerPayError::InvalidVaultState)]
    pub vault: Account<'info, MerchantVault>,
    
    #[account(
        mut,
        constraint = merchant_token_account.owner == merchant.key() @ TigerPayError::InvalidAccount,
        constraint = merchant_token_account.mint == vault.funding_token_mint @ TigerPayError::InvalidAccount,
    )]
    pub merchant_token_account: Account<'info, TokenAccount>,
    
    #[account(mut, constraint = vault_token_account.key() == vault.vault_token_account @ TigerPayError::InvalidAccount)]
    pub vault_token_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ClaimReturns<'info> {
    pub investor: Signer<'info>,
    
    #[account(constraint = vault.is_repaying() || vault.state == VaultState::Completed @ TigerPayError::InvalidVaultState)]
    pub vault: Account<'info, MerchantVault>,
    
    #[account(
        mut,
        seeds = [b"investor", vault.key().as_ref(), investor.key().as_ref()],
        bump = investor_account.bump,
        constraint = investor_account.investor == investor.key() @ TigerPayError::Unauthorized,
    )]
    pub investor_account: Account<'info, InvestorAccount>,
    
    #[account(mut, constraint = vault_token_account.key() == vault.vault_token_account @ TigerPayError::InvalidAccount)]
    pub vault_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = investor_token_account.owner == investor.key() @ TigerPayError::InvalidAccount,
        constraint = investor_token_account.mint == vault.funding_token_mint @ TigerPayError::InvalidAccount,
    )]
    pub investor_token_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

// --- Tranche ---

#[derive(Accounts)]
#[instruction(tranche_index: u8)]
pub struct InitializeTranche<'info> {
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
#[instruction(tranche_index: u8)]
pub struct ReleaseTranche<'info> {
    #[account(constraint = authority.key() == vault.authority @ TigerPayError::Unauthorized)]
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
        constraint = milestone.status == MilestoneStatus::Approved @ TigerPayError::MilestoneNotApproved,
    )]
    pub milestone: Account<'info, Milestone>,
    
    #[account(mut, constraint = vault_token_account.key() == vault.vault_token_account @ TigerPayError::InvalidAccount)]
    pub vault_token_account: Account<'info, TokenAccount>,
    
    #[account(mut, constraint = merchant_token_account.owner == vault.merchant @ TigerPayError::InvalidAccount)]
    pub merchant_token_account: Account<'info, TokenAccount>,
    
    #[account(mut, constraint = platform_fee_account.owner == vault.platform_fee_recipient @ TigerPayError::InvalidAccount)]
    pub platform_fee_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

// --- Milestone ---

#[derive(Accounts)]
#[instruction(milestone_id: u8)]
pub struct InitializeMilestone<'info> {
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

#[derive(Accounts)]
#[instruction(milestone_id: u8)]
pub struct SubmitMilestone<'info> {
    #[account(constraint = merchant.key() == vault.merchant @ TigerPayError::Unauthorized)]
    pub merchant: Signer<'info>,
    
    #[account(constraint = vault.is_active() || vault.is_repaying() @ TigerPayError::InvalidVaultState)]
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

// --- x402 Settlement (Programmable Credit) ---

#[derive(Accounts)]
pub struct RouteRepayment<'info> {
    #[account(
        constraint = oracle_authority.key() == settlement.oracle_authority @ TigerPayError::InvalidOracleAuthority,
    )]
    pub oracle_authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"settlement", vault.key().as_ref()],
        bump = settlement.bump,
        constraint = settlement.vault == vault.key() @ TigerPayError::InvalidAccount,
    )]
    pub settlement: Account<'info, SettlementAccount>,

    #[account(
        mut,
        constraint = vault.is_active() || vault.is_repaying() @ TigerPayError::InvalidVaultState,
    )]
    pub vault: Account<'info, MerchantVault>,

    #[account(
        mut,
        constraint = oracle_token_account.owner == oracle_authority.key() @ TigerPayError::InvalidAccount,
        constraint = oracle_token_account.mint == vault.funding_token_mint @ TigerPayError::InvalidAccount,
    )]
    pub oracle_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = vault_token_account.key() == vault.vault_token_account @ TigerPayError::InvalidAccount,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CreateSettlement<'info> {
    #[account(
        mut,
        constraint = authority.key() == platform_config.authority @ TigerPayError::Unauthorized,
    )]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = SettlementAccount::LEN,
        seeds = [b"settlement", vault.key().as_ref()],
        bump,
    )]
    pub settlement: Account<'info, SettlementAccount>,

    #[account(
        constraint = vault.is_active() || vault.is_repaying() @ TigerPayError::InvalidVaultState,
    )]
    pub vault: Account<'info, MerchantVault>,

    /// CHECK: Oracle authority is validated against the settlement account's stored oracle_authority field. Only the registered oracle can sign route_repayment transactions.
    pub oracle_authority: UncheckedAccount<'info>,

    pub platform_config: Account<'info, PlatformConfig>,

    pub system_program: Program<'info, System>,
}

// --- Liquidity Pools (Programmable Credit) ---

#[derive(Accounts)]
pub struct RegisterPool<'info> {
    #[account(
        mut,
        constraint = admin.key() == platform_config.authority @ TigerPayError::Unauthorized,
    )]
    pub admin: Signer<'info>,

    /// CHECK: Pool owner identity used as PDA seed for the pool account. Safety ensured by the pool PDA derivation constraint below.
    pub pool_authority: UncheckedAccount<'info>,

    #[account(
        init,
        payer = admin,
        space = LiquidityPool::LEN,
        seeds = [b"liquidity_pool", pool_authority.key().as_ref()],
        bump,
    )]
    pub pool: Account<'info, LiquidityPool>,

    /// CHECK: SPL mint account validated by the associated_token::mint constraint on pool_token_account. Anchor enforces mint existence via the ATA derivation.
    pub funding_token_mint: UncheckedAccount<'info>,

    pub pool_token_account: Account<'info, TokenAccount>,

    pub platform_config: Account<'info, PlatformConfig>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositToPool<'info> {
    #[account(
        constraint = depositor.key() == pool.authority @ TigerPayError::Unauthorized,
    )]
    pub depositor: Signer<'info>,

    #[account(mut)]
    pub pool: Account<'info, LiquidityPool>,

    #[account(
        mut,
        constraint = depositor_token_account.owner == depositor.key() @ TigerPayError::InvalidAccount,
        constraint = depositor_token_account.mint == pool.funding_token_mint @ TigerPayError::InvalidAccount,
    )]
    pub depositor_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = pool_token_account.key() == pool.pool_token_account @ TigerPayError::InvalidAccount,
    )]
    pub pool_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct AllocateToVault<'info> {
    #[account(
        mut,
        constraint = admin.key() == platform_config.authority @ TigerPayError::Unauthorized,
    )]
    pub admin: Signer<'info>,

    #[account(mut)]
    pub pool: Account<'info, LiquidityPool>,

    /// CHECK: Pool authority pubkey used for PDA seed derivation in the pool signer seeds. Validated by constraint pool.authority == pool_authority.key().
    pub pool_authority: UncheckedAccount<'info>,

    #[account(
        mut,
        constraint = vault.is_fundraising() @ TigerPayError::InvalidVaultState,
    )]
    pub vault: Account<'info, MerchantVault>,

    #[account(
        init,
        payer = admin,
        space = PoolAllocation::LEN,
        seeds = [b"pool_allocation", pool.key().as_ref(), vault.key().as_ref()],
        bump,
    )]
    pub allocation: Account<'info, PoolAllocation>,

    #[account(
        mut,
        constraint = pool_token_account.key() == pool.pool_token_account @ TigerPayError::InvalidAccount,
    )]
    pub pool_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = vault_token_account.key() == vault.vault_token_account @ TigerPayError::InvalidAccount,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    pub platform_config: Account<'info, PlatformConfig>,

    pub token_program: Program<'info, Token>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WithdrawFromPool<'info> {
    #[account(
        constraint = withdrawer.key() == pool.authority @ TigerPayError::Unauthorized,
    )]
    pub withdrawer: Signer<'info>,

    #[account(mut)]
    pub pool: Account<'info, LiquidityPool>,

    #[account(
        mut,
        constraint = pool_token_account.key() == pool.pool_token_account @ TigerPayError::InvalidAccount,
    )]
    pub pool_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = withdrawer_token_account.owner == withdrawer.key() @ TigerPayError::InvalidAccount,
        constraint = withdrawer_token_account.mint == pool.funding_token_mint @ TigerPayError::InvalidAccount,
    )]
    pub withdrawer_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

// --- Default & Recovery ---

#[derive(Accounts)]
pub struct MarkDefault<'info> {
    #[account(
        constraint = authority.key() == vault.authority || authority.key() == platform_config.authority @ TigerPayError::Unauthorized,
    )]
    pub authority: Signer<'info>,

    #[account(
        mut,
        constraint = vault.state == VaultState::Repaying @ TigerPayError::InvalidVaultState,
    )]
    pub vault: Account<'info, MerchantVault>,

    #[account(seeds = [b"config"], bump = platform_config.bump)]
    pub platform_config: Account<'info, PlatformConfig>,
}

#[derive(Accounts)]
pub struct RecoverFunds<'info> {
    #[account(
        constraint = authority.key() == platform_config.authority @ TigerPayError::Unauthorized,
    )]
    pub authority: Signer<'info>,

    #[account(
        mut,
        constraint = vault.state == VaultState::Defaulted @ TigerPayError::InvalidVaultState,
    )]
    pub vault: Account<'info, MerchantVault>,

    #[account(
        mut,
        constraint = vault_token_account.key() == vault.vault_token_account @ TigerPayError::InvalidAccount,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    /// CHECK: Recovery destination is a platform-controlled token account. Authority validation done via the platform_config.authority signer check. Only platform admin can trigger recovery.
    #[account(mut)]
    pub recovery_token_account: Account<'info, TokenAccount>,

    pub platform_config: Account<'info, PlatformConfig>,

    pub token_program: Program<'info, Token>,
}

// --- Cancel & Refund ---

#[derive(Accounts)]
pub struct CancelVault<'info> {
    #[account(
        constraint = authority.key() == vault.authority @ TigerPayError::Unauthorized,
    )]
    pub authority: Signer<'info>,

    #[account(
        mut,
        constraint = vault.state == VaultState::Fundraising @ TigerPayError::InvalidVaultState,
    )]
    pub vault: Account<'info, MerchantVault>,
}

#[derive(Accounts)]
pub struct ClaimRefund<'info> {
    pub investor: Signer<'info>,

    #[account(constraint = vault.is_cancelled() @ TigerPayError::VaultNotCancelled)]
    pub vault: Account<'info, MerchantVault>,

    #[account(
        mut,
        seeds = [b"investor", vault.key().as_ref(), investor.key().as_ref()],
        bump = investor_account.bump,
        constraint = investor_account.investor == investor.key() @ TigerPayError::Unauthorized,
    )]
    pub investor_account: Account<'info, InvestorAccount>,

    #[account(
        mut,
        constraint = vault_token_account.key() == vault.vault_token_account @ TigerPayError::InvalidAccount,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = investor_token_account.owner == investor.key() @ TigerPayError::InvalidAccount,
        constraint = investor_token_account.mint == vault.funding_token_mint @ TigerPayError::InvalidAccount,
    )]
    pub investor_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

// --- Pause ---

#[derive(Accounts)]
pub struct PauseVault<'info> {
    #[account(
        constraint = authority.key() == vault.authority @ TigerPayError::Unauthorized,
    )]
    pub authority: Signer<'info>,

    #[account(mut)]
    pub vault: Account<'info, MerchantVault>,
}

#[derive(Accounts)]
pub struct UnpauseVault<'info> {
    #[account(
        constraint = authority.key() == vault.authority @ TigerPayError::Unauthorized,
    )]
    pub authority: Signer<'info>,

    #[account(mut)]
    pub vault: Account<'info, MerchantVault>,
}

// --- ICM Dividends ---

#[derive(Accounts)]
pub struct ClaimDividends<'info> {
    pub investor: Signer<'info>,

    #[account(constraint = icm_vault.state == ICMState::Closed @ TigerPayError::InvalidVaultState)]
    pub icm_vault: Account<'info, ICMVault>,

    #[account(
        mut,
        seeds = [b"investor", icm_vault.key().as_ref(), investor.key().as_ref()],
        bump = investor_stake_account.bump,
        constraint = investor_stake_account.investor == investor.key() @ TigerPayError::Unauthorized,
    )]
    pub investor_stake_account: Account<'info, InvestorAccount>,

    #[account(
        mut,
        constraint = vault_token_account.key() == icm_vault.vault_token_account @ TigerPayError::InvalidAccount,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = investor_token_account.owner == investor.key() @ TigerPayError::InvalidAccount,
        constraint = investor_token_account.mint == icm_vault.funding_token_mint @ TigerPayError::InvalidAccount,
    )]
    pub investor_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

// --- Credit Score ---

#[derive(Accounts)]
pub struct UpdateCreditScore<'info> {
    #[account(
        constraint = authority.key() == platform_config.authority @ TigerPayError::Unauthorized,
    )]
    pub authority: Signer<'info>,

    /// CHECK: Merchant wallet pubkey used as PDA seed. Safety ensured by merchant_profile PDA derivation constraint using this key.
    pub merchant: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"merchant", merchant.key().as_ref()],
        bump = merchant_profile.bump,
    )]
    pub merchant_profile: Account<'info, MerchantProfile>,

    #[account(seeds = [b"config"], bump = platform_config.bump)]
    pub platform_config: Account<'info, PlatformConfig>,
}

// --- Keeper / Crank ---

#[derive(Accounts)]
pub struct AutoCancelExpired<'info> {
    /// Anyone can call this — permissionless keeper
    pub caller: Signer<'info>,

    #[account(
        mut,
        constraint = vault.state == VaultState::Fundraising @ TigerPayError::InvalidVaultState,
    )]
    pub vault: Account<'info, MerchantVault>,
}

#[derive(Accounts)]
pub struct ReturnPoolAllocation<'info> {
    #[account(
        constraint = authority.key() == platform_config.authority @ TigerPayError::Unauthorized,
    )]
    pub authority: Signer<'info>,

    #[account(mut)]
    pub pool: Account<'info, LiquidityPool>,

    #[account(
        mut,
        constraint = allocation.pool == pool.key() @ TigerPayError::InvalidAccount,
        constraint = allocation.vault == vault.key() @ TigerPayError::InvalidAccount,
    )]
    pub allocation: Account<'info, PoolAllocation>,

    #[account(
        constraint = vault.state == VaultState::Repaying || vault.state == VaultState::Completed @ TigerPayError::InvalidVaultState,
    )]
    pub vault: Account<'info, MerchantVault>,

    #[account(
        mut,
        constraint = vault_token_account.key() == vault.vault_token_account @ TigerPayError::InvalidAccount,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = pool_token_account.key() == pool.pool_token_account @ TigerPayError::InvalidAccount,
    )]
    pub pool_token_account: Account<'info, TokenAccount>,

    pub platform_config: Account<'info, PlatformConfig>,

    pub token_program: Program<'info, Token>,
}
