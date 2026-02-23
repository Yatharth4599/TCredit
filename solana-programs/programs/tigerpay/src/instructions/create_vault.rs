use anchor_lang::prelude::*;

use crate::state::*;
use crate::errors::TigerPayError;
use crate::CreateVault;
use crate::CompleteFundraisingManual;

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
    let config = &ctx.accounts.platform_config;
    let merchant_profile = &mut ctx.accounts.merchant_profile;
    let vault = &mut ctx.accounts.vault;
    let clock = Clock::get()?;

    require!(!config.paused, TigerPayError::PlatformPaused);
    require!(merchant_profile.can_create_vault(), TigerPayError::MerchantNotVerified);

    // Credit score gating — block tier D merchants (except unscored new merchants)
    if merchant_profile.credit_score > 0 {
        require!(merchant_profile.credit_tier > 0, TigerPayError::CreditScoreTooLow);
        // Ensure score was refreshed within last 90 days
        let score_age = clock.unix_timestamp - merchant_profile.credit_updated_at;
        require!(score_age < 90 * 24 * 60 * 60, TigerPayError::CreditScoreExpired);
    }

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
    vault.max_investors = if max_investors == 0 { 100 } else { max_investors };
    vault.vault_nonce = vault_nonce;
    vault.bump = ctx.bumps.vault;

    // Production fields: Late fees & recovery
    vault.next_payment_due = 0; // set when vault goes Active
    vault.late_fee_bps = late_fee_bps;
    vault.total_late_fees = 0;
    vault.grace_period_days = if grace_period_days == 0 { 7 } else { grace_period_days };
    vault.defaulted_at = 0;
    vault.total_recovered = 0;
    vault.paused = false;
    vault.cancelled = false;
    vault.cancelled_at = 0;

    // Programmable credit fields
    vault.pool_funded = 0;
    vault.user_funded = 0;
    vault.repayment_source = 0;

    merchant_profile.vault_count += 1;

    msg!("Vault created for merchant: {}", vault.merchant);
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
