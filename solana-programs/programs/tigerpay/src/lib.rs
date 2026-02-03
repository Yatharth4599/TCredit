use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer, MintTo};
use anchor_spl::associated_token::AssociatedToken;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

pub mod state;
pub mod errors;

pub use state::*;
pub use errors::*;

#[program]
pub mod tigerpay {
    use super::*;

    // ============ Admin Instructions ============
    
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
        let config = &mut ctx.accounts.platform_config;
        
        config.authority = ctx.accounts.authority.key();
        config.fee_recipient = ctx.accounts.fee_recipient.key();
        config.default_fee_bps = default_fee_bps;
        config.min_funding_target = min_funding_target;
        config.max_funding_target = max_funding_target;
        config.min_interest_bps = min_interest_bps;
        config.max_interest_bps = max_interest_bps;
        config.max_duration_months = max_duration_months;
        config.max_tranches = max_tranches;
        config.required_verifiers = required_verifiers;
        config.paused = false;
        config.bump = ctx.bumps.platform_config;

        msg!("Platform initialized with fee: {}bps", default_fee_bps);
        Ok(())
    }

    pub fn verify_merchant(ctx: Context<VerifyMerchant>, name_hash: [u8; 32]) -> Result<()> {
        let merchant_profile = &mut ctx.accounts.merchant_profile;
        let clock = Clock::get()?;

        merchant_profile.merchant = ctx.accounts.merchant.key();
        merchant_profile.authority = ctx.accounts.authority.key();
        merchant_profile.verified = true;
        merchant_profile.verified_at = clock.unix_timestamp;
        merchant_profile.verified_by = ctx.accounts.authority.key();
        merchant_profile.vault_count = 0;
        merchant_profile.max_vaults = 10;
        merchant_profile.total_raised = 0;
        merchant_profile.total_repaid = 0;
        merchant_profile.name_hash = name_hash;
        merchant_profile.bump = ctx.bumps.merchant_profile;

        msg!("Merchant {} verified", ctx.accounts.merchant.key());
        Ok(())
    }

    // ============ Vault Instructions ============

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
    ) -> Result<()> {
        let config = &ctx.accounts.platform_config;
        let merchant_profile = &mut ctx.accounts.merchant_profile;
        let vault = &mut ctx.accounts.vault;
        let clock = Clock::get()?;

        require!(!config.paused, TigerPayError::PlatformPaused);
        require!(merchant_profile.can_create_vault(), TigerPayError::MerchantNotVerified);
        require!(
            target_amount >= config.min_funding_target && target_amount <= config.max_funding_target,
            TigerPayError::InvalidFundingTarget
        );

        vault.authority = ctx.accounts.authority.key();
        vault.merchant = ctx.accounts.merchant.key();
        vault.funding_token_mint = ctx.accounts.funding_token_mint.key();
        vault.debt_token_mint = ctx.accounts.debt_token_mint.key();
        vault.vault_token_account = ctx.accounts.vault_token_account.key();
        
        vault.target_amount = target_amount;
        vault.min_investment = min_investment;
        vault.max_investment = max_investment;
        vault.total_raised = 0;
        vault.total_repaid = 0;
        vault.total_to_repay = 0;
        
        vault.interest_rate_bps = interest_rate_bps;
        vault.duration_months = duration_months;
        vault.num_tranches = num_tranches;
        vault.tranches_released = 0;
        
        vault.state = VaultState::Fundraising;
        vault.fundraising_deadline = clock.unix_timestamp + (fundraising_days as i64 * 24 * 60 * 60);
        vault.created_at = clock.unix_timestamp;
        
        vault.platform_fee_bps = config.default_fee_bps;
        vault.platform_fee_recipient = config.fee_recipient;
        vault.platform_fees_collected = 0;
        
        vault.investor_count = 0;
        vault.vault_nonce = vault_nonce;
        vault.bump = ctx.bumps.vault;

        merchant_profile.vault_count += 1;

        msg!("Vault created for merchant: {}", vault.merchant);
        Ok(())
    }

    // ============ Investor Instructions ============

    pub fn invest(ctx: Context<Invest>, amount: u64) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        let investor_account = &mut ctx.accounts.investor_account;
        let clock = Clock::get()?;

        require!(vault.is_fundraising(), TigerPayError::InvalidVaultState);
        require!(clock.unix_timestamp <= vault.fundraising_deadline, TigerPayError::FundraisingDeadlinePassed);
        require!(amount >= vault.min_investment, TigerPayError::InvestmentTooLow);
        
        let new_total = vault.total_raised.checked_add(amount).ok_or(TigerPayError::ArithmeticOverflow)?;
        require!(new_total <= vault.target_amount, TigerPayError::InvestmentExceedsTarget);
        
        let investor_total = investor_account.amount_invested.checked_add(amount).ok_or(TigerPayError::ArithmeticOverflow)?;
        require!(investor_total <= vault.max_investment, TigerPayError::InvestmentTooHigh);

        // Transfer funding tokens from investor to vault
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.investor_token_account.to_account_info(),
                    to: ctx.accounts.vault_token_account.to_account_info(),
                    authority: ctx.accounts.investor.to_account_info(),
                },
            ),
            amount,
        )?;

        // Mint debt tokens to investor
        let seeds = &[b"vault", vault.merchant.as_ref(), &[vault.vault_nonce], &[vault.bump]];
        let signer_seeds = &[&seeds[..]];

        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.debt_token_mint.to_account_info(),
                    to: ctx.accounts.investor_debt_token_account.to_account_info(),
                    authority: vault.to_account_info(),
                },
                signer_seeds,
            ),
            amount,
        )?;

        // Update investor account
        if investor_account.amount_invested == 0 {
            investor_account.vault = vault.key();
            investor_account.investor = ctx.accounts.investor.key();
            investor_account.investor_token_account = ctx.accounts.investor_token_account.key();
            investor_account.invested_at = clock.unix_timestamp;
            investor_account.bump = ctx.bumps.investor_account;
            vault.investor_count += 1;
        }
        
        investor_account.amount_invested = investor_total;
        investor_account.debt_tokens_received = investor_account.debt_tokens_received.checked_add(amount).ok_or(TigerPayError::ArithmeticOverflow)?;
        vault.total_raised = new_total;

        msg!("Investment received: {} from {}", amount, ctx.accounts.investor.key());

        // Check if target reached
        if vault.total_raised >= vault.target_amount {
            vault.state = VaultState::Active;
            let interest = (vault.total_raised as u128).checked_mul(vault.interest_rate_bps as u128).unwrap().checked_mul(vault.duration_months as u128).unwrap().checked_div(10000 * 12).unwrap() as u64;
            vault.total_to_repay = vault.total_raised.checked_add(interest).unwrap();
            msg!("Fundraising complete! Total to repay: {}", vault.total_to_repay);
        }

        Ok(())
    }

    // ============ Merchant Instructions ============

    pub fn make_repayment(ctx: Context<MakeRepayment>, amount: u64) -> Result<()> {
        let vault = &mut ctx.accounts.vault;

        require!(vault.is_active() || vault.is_repaying(), TigerPayError::InvalidVaultState);
        require!(amount > 0, TigerPayError::InvalidRepaymentAmount);

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.merchant_token_account.to_account_info(),
                    to: ctx.accounts.vault_token_account.to_account_info(),
                    authority: ctx.accounts.merchant.to_account_info(),
                },
            ),
            amount,
        )?;

        vault.total_repaid = vault.total_repaid.checked_add(amount).ok_or(TigerPayError::ArithmeticOverflow)?;
        msg!("Repayment received: {} from merchant {}", amount, ctx.accounts.merchant.key());

        if vault.total_repaid >= vault.total_to_repay {
            vault.state = VaultState::Completed;
            msg!("Vault fully repaid!");
        }

        Ok(())
    }

    // ============ Claim Instructions ============

    pub fn claim_returns(ctx: Context<ClaimReturns>) -> Result<()> {
        let vault = &ctx.accounts.vault;
        let investor_account = &mut ctx.accounts.investor_account;

        require!(vault.is_repaying() || vault.state == VaultState::Completed, TigerPayError::InvalidVaultState);

        let claimable = investor_account.calculate_claimable(vault.total_raised, vault.total_repaid);
        require!(claimable > 0, TigerPayError::NoReturnsAvailable);

        let seeds = &[b"vault", vault.merchant.as_ref(), &[vault.vault_nonce], &[vault.bump]];
        let signer_seeds = &[&seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault_token_account.to_account_info(),
                    to: ctx.accounts.investor_token_account.to_account_info(),
                    authority: ctx.accounts.vault.to_account_info(),
                },
                signer_seeds,
            ),
            claimable,
        )?;

        investor_account.claimed_returns = investor_account.claimed_returns.checked_add(claimable).ok_or(TigerPayError::ArithmeticOverflow)?;
        investor_account.last_claim_at = Clock::get()?.unix_timestamp;

        msg!("Returns claimed: {} by investor {}", claimable, ctx.accounts.investor.key());
        Ok(())
    }

    // ============ Tranche & Milestone Instructions ============

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

    pub fn complete_fundraising_manual(ctx: Context<CompleteFundraisingManual>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;

        require!(vault.is_fundraising(), TigerPayError::InvalidVaultState);
        
        let min_required = vault.target_amount * 80 / 100;
        require!(vault.total_raised >= min_required, TigerPayError::FundraisingNotComplete);

        vault.state = VaultState::Active;
        let interest = (vault.total_raised as u128) * (vault.interest_rate_bps as u128) * (vault.duration_months as u128) / (10000 * 12);
        vault.total_to_repay = vault.total_raised + interest as u64;

        msg!("Fundraising completed, total to repay: {}", vault.total_to_repay);
        Ok(())
    }
}

// ============ Account Structs ============

#[derive(Accounts)]
pub struct InitializePlatform<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    /// CHECK: Fee recipient account
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
    
    /// CHECK: Merchant wallet
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

#[derive(Accounts)]
#[instruction(vault_nonce: u8)]
pub struct CreateVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    /// CHECK: Merchant wallet
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
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

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

#[derive(Accounts)]
pub struct CompleteFundraisingManual<'info> {
    #[account(constraint = authority.key() == vault.authority @ TigerPayError::Unauthorized)]
    pub authority: Signer<'info>,
    
    #[account(mut, constraint = vault.is_fundraising() @ TigerPayError::InvalidVaultState)]
    pub vault: Account<'info, MerchantVault>,
}

