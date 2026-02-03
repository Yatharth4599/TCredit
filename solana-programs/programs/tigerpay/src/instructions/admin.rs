use anchor_lang::prelude::*;

use crate::state::*;
use crate::errors::TigerPayError;

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

pub fn complete_fundraising_manual(ctx: Context<CompleteFundraisingManual>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;

    require!(vault.is_fundraising(), TigerPayError::InvalidVaultState);
    
    // Require at least 80% of target
    let min_required = vault.target_amount
        .checked_mul(80)
        .ok_or(TigerPayError::ArithmeticOverflow)?
        .checked_div(100)
        .ok_or(TigerPayError::ArithmeticOverflow)?;
    
    require!(
        vault.total_raised >= min_required,
        TigerPayError::FundraisingNotComplete
    );

    vault.state = VaultState::Active;
    
    // Calculate total to repay
    let interest = (vault.total_raised as u128)
        .checked_mul(vault.interest_rate_bps as u128)
        .ok_or(TigerPayError::ArithmeticOverflow)?
        .checked_mul(vault.duration_months as u128)
        .ok_or(TigerPayError::ArithmeticOverflow)?
        .checked_div(10000 * 12)
        .ok_or(TigerPayError::ArithmeticOverflow)? as u64;
    
    vault.total_to_repay = vault.total_raised
        .checked_add(interest)
        .ok_or(TigerPayError::ArithmeticOverflow)?;

    msg!("Fundraising manually completed. Total to repay: {}", vault.total_to_repay);

    Ok(())
}

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
pub struct CompleteFundraisingManual<'info> {
    #[account(
        constraint = authority.key() == vault.authority @ TigerPayError::Unauthorized,
    )]
    pub authority: Signer<'info>,
    
    #[account(
        mut,
        constraint = vault.is_fundraising() @ TigerPayError::InvalidVaultState,
    )]
    pub vault: Account<'info, MerchantVault>,
}
