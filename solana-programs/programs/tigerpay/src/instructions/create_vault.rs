use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, MintTo};
use anchor_spl::associated_token::AssociatedToken;

use crate::state::*;
use crate::errors::TigerPayError;

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
    require!(
        interest_rate_bps >= config.min_interest_bps && interest_rate_bps <= config.max_interest_bps,
        TigerPayError::InvalidInterestRate
    );
    require!(
        duration_months > 0 && duration_months <= config.max_duration_months,
        TigerPayError::InvalidDuration
    );
    require!(
        num_tranches > 0 && num_tranches <= config.max_tranches,
        TigerPayError::InvalidTranches
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
    msg!("Target: {}, Interest: {}bps, Duration: {} months", target_amount, interest_rate_bps, duration_months);

    Ok(())
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
    
    #[account(
        seeds = [b"config"],
        bump = platform_config.bump,
    )]
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
