use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer, MintTo};
use anchor_spl::associated_token::AssociatedToken;

use crate::state::*;
use crate::errors::TigerPayError;

pub fn create_icm_vault(
    ctx: Context<CreateICMVault>,
    icm_nonce: u8,
    total_shares: u64,
    price_per_share: u64,
    min_buy: u64,
    max_buy: u64,
    offering_days: u8,
) -> Result<()> {
    let icm_vault = &mut ctx.accounts.icm_vault;
    let clock = Clock::get()?;
    let config = &ctx.accounts.platform_config;
    let merchant_profile = &mut ctx.accounts.merchant_profile;

    require!(!config.paused, TigerPayError::PlatformPaused);
    require!(merchant_profile.can_create_vault(), TigerPayError::MerchantNotVerified);

    icm_vault.authority = ctx.accounts.authority.key();
    icm_vault.business = ctx.accounts.business.key();
    icm_vault.funding_token_mint = ctx.accounts.funding_token_mint.key();
    icm_vault.stake_token_mint = ctx.accounts.stake_token_mint.key();
    icm_vault.vault_token_account = ctx.accounts.vault_token_account.key();

    icm_vault.total_shares = total_shares;
    icm_vault.shares_sold = 0;
    icm_vault.price_per_share = price_per_share;
    icm_vault.min_buy = min_buy;
    icm_vault.max_buy = max_buy;
    
    icm_vault.target_raised = total_shares.checked_mul(price_per_share).ok_or(TigerPayError::ArithmeticOverflow)?;
    icm_vault.total_raised = 0;

    icm_vault.state = ICMState::Offered;
    icm_vault.offering_deadline = clock.unix_timestamp + (offering_days as i64 * 24 * 60 * 60);
    icm_vault.created_at = clock.unix_timestamp;

    icm_vault.platform_fee_bps = config.default_fee_bps;
    icm_vault.platform_fee_recipient = config.fee_recipient;

    icm_vault.investor_count = 0;
    icm_vault.icm_nonce = icm_nonce;
    icm_vault.bump = ctx.bumps.icm_vault;

    merchant_profile.vault_count += 1;

    msg!("ICM Vault created for business: {}", icm_vault.business);
    Ok(())
}

pub fn buy_stake(ctx: Context<BuyStake>, share_amount: u64) -> Result<()> {
    let icm_vault = &mut ctx.accounts.icm_vault;
    let clock = Clock::get()?;

    require!(icm_vault.state == ICMState::Offered || icm_vault.state == ICMState::Active, TigerPayError::InvalidVaultState);
    require!(clock.unix_timestamp <= icm_vault.offering_deadline, TigerPayError::FundraisingDeadlinePassed);
    require!(share_amount >= icm_vault.min_buy, TigerPayError::InvestmentTooLow);
    
    let new_shares_sold = icm_vault.shares_sold.checked_add(share_amount).ok_or(TigerPayError::ArithmeticOverflow)?;
    require!(new_shares_sold <= icm_vault.total_shares, TigerPayError::InvestmentExceedsTarget);

    let funding_amount = share_amount.checked_mul(icm_vault.price_per_share).ok_or(TigerPayError::ArithmeticOverflow)?;

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
        funding_amount,
    )?;

    // Mint Stake Tokens to investor
    let seeds = &[
        b"icm_vault", 
        icm_vault.business.as_ref(), 
        &[icm_vault.icm_nonce], 
        &[icm_vault.bump]
    ];
    let signer_seeds = &[&seeds[..]];

    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.stake_token_mint.to_account_info(),
                to: ctx.accounts.investor_stake_token_account.to_account_info(),
                authority: icm_vault.to_account_info(),
            },
            signer_seeds,
        ),
        share_amount,
    )?;

    icm_vault.shares_sold = new_shares_sold;
    icm_vault.total_raised = icm_vault.total_raised.checked_add(funding_amount).ok_or(TigerPayError::ArithmeticOverflow)?;

    if icm_vault.state == ICMState::Offered {
        icm_vault.state = ICMState::Active;
    }

    if icm_vault.shares_sold == icm_vault.total_shares {
        icm_vault.state = ICMState::Closed;
        msg!("ICM Completed! All shares sold.");
    }

    msg!("Bought {} stakes for {} tokens", share_amount, funding_amount);
    Ok(())
}

pub fn distribute_dividends(ctx: Context<DistributeDividends>, amount: u64) -> Result<()> {
    let icm_vault = &mut ctx.accounts.icm_vault;

    require!(icm_vault.state == ICMState::Closed, TigerPayError::InvalidVaultState);
    require!(amount > 0, TigerPayError::InvalidRepaymentAmount);

    // Transfer dividend tokens from business to vault for distribution
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.business_token_account.to_account_info(),
                to: ctx.accounts.vault_token_account.to_account_info(),
                authority: ctx.accounts.business.to_account_info(),
            },
        ),
        amount,
    )?;

    // Note: In a real implementation, we would track claimable dividends per user 
    // similar to how claim_returns works for debt. For simplicity, we'll message the event.
    // In production, users would call a 'claim_dividends' function.

    msg!("Dividends of {} distributed for ICM vault {}", amount, icm_vault.key());
    Ok(())
}

#[derive(Accounts)]
#[instruction(icm_nonce: u8)]
pub struct CreateICMVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: Business wallet
    pub business: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"merchant", business.key().as_ref()],
        bump = merchant_profile.bump,
        constraint = merchant_profile.verified @ TigerPayError::MerchantNotVerified,
    )]
    pub merchant_profile: Account<'info, MerchantProfile>,

    #[account(seeds = [b"config"], bump = platform_config.bump)]
    pub platform_config: Account<'info, PlatformConfig>,

    #[account(
        init,
        payer = authority,
        space = ICMVault::LEN,
        seeds = [b"icm_vault", business.key().as_ref(), &[icm_nonce]],
        bump,
    )]
    pub icm_vault: Account<'info, ICMVault>,

    pub funding_token_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = authority,
        mint::decimals = 6, // Equity usually has fewer decimals or match funding
        mint::authority = icm_vault,
        seeds = [b"stake_mint", icm_vault.key().as_ref()],
        bump,
    )]
    pub stake_token_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = authority,
        associated_token::mint = funding_token_mint,
        associated_token::authority = icm_vault,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct BuyStake<'info> {
    #[account(mut)]
    pub investor: Signer<'info>,

    #[account(mut)]
    pub icm_vault: Account<'info, ICMVault>,

    #[account(
        mut,
        constraint = investor_token_account.mint == icm_vault.funding_token_mint @ TigerPayError::InvalidAccount,
    )]
    pub investor_token_account: Account<'info, TokenAccount>,

    #[account(mut, constraint = vault_token_account.key() == icm_vault.vault_token_account @ TigerPayError::InvalidAccount)]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(mut, constraint = stake_token_mint.key() == icm_vault.stake_token_mint @ TigerPayError::InvalidAccount)]
    pub stake_token_mint: Account<'info, Mint>,

    #[account(
        init_if_needed,
        payer = investor,
        associated_token::mint = stake_token_mint,
        associated_token::authority = investor,
    )]
    pub investor_stake_token_account: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct DistributeDividends<'info> {
    #[account(mut, constraint = business.key() == icm_vault.business @ TigerPayError::Unauthorized)]
    pub business: Signer<'info>,

    #[account(mut)]
    pub icm_vault: Account<'info, ICMVault>,

    #[account(
        mut,
        constraint = business_token_account.owner == business.key() @ TigerPayError::InvalidAccount,
        constraint = business_token_account.mint == icm_vault.funding_token_mint @ TigerPayError::InvalidAccount,
    )]
    pub business_token_account: Account<'info, TokenAccount>,

    #[account(mut, constraint = vault_token_account.key() == icm_vault.vault_token_account @ TigerPayError::InvalidAccount)]
    pub vault_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}
