use anchor_lang::prelude::*;

use crate::state::*;
use crate::errors::TigerPayError;
use crate::InitializePlatform;
use crate::VerifyMerchant;

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
    merchant_profile.credit_score = 0;
    merchant_profile.credit_tier = 0;
    merchant_profile.credit_updated_at = 0;
    merchant_profile.bump = ctx.bumps.merchant_profile;

    msg!("Merchant {} verified", ctx.accounts.merchant.key());
    Ok(())
}
