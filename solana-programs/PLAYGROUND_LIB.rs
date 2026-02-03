use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer, MintTo};
use anchor_spl::associated_token::AssociatedToken;

declare_id!("5xzKq3bRuxLh4WezvMRHz8nodp4W6gihUvjeB5VcWa8z");

#[program]
pub mod tigerpay {
    use super::*;

    // ============ Platform Admin ============
    
    pub fn initialize_platform(
        ctx: Context<InitializePlatform>,
        default_fee_bps: u16,
        min_funding_target: u64,
        max_funding_target: u64,
    ) -> Result<()> {
        let config = &mut ctx.accounts.platform_config;
        config.authority = ctx.accounts.authority.key();
        config.fee_recipient = ctx.accounts.fee_recipient.key();
        config.default_fee_bps = default_fee_bps;
        config.min_funding_target = min_funding_target;
        config.max_funding_target = max_funding_target;
        config.paused = false;
        config.bump = ctx.bumps.platform_config;
        emit!(PlatformInitialized { authority: config.authority, fee_recipient: config.fee_recipient, default_fee_bps });
        Ok(())
    }

    pub fn verify_merchant(ctx: Context<VerifyMerchant>, name_hash: [u8; 32]) -> Result<()> {
        let profile = &mut ctx.accounts.merchant_profile;
        let clock = Clock::get()?;
        profile.merchant = ctx.accounts.merchant.key();
        profile.authority = ctx.accounts.authority.key();
        profile.verified = true;
        profile.verified_at = clock.unix_timestamp;
        profile.vault_count = 0;
        profile.max_vaults = 10;
        profile.name_hash = name_hash;
        profile.bump = ctx.bumps.merchant_profile;
        emit!(MerchantVerified { merchant: profile.merchant, verified_by: profile.authority });
        Ok(())
    }

    // ============ Debt Vault ============

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
        let profile = &mut ctx.accounts.merchant_profile;
        let vault = &mut ctx.accounts.vault;
        let clock = Clock::get()?;

        require!(!config.paused, TigerPayError::PlatformPaused);
        require!(profile.can_create_vault(), TigerPayError::MerchantNotVerified);

        vault.authority = ctx.accounts.authority.key();
        vault.merchant = ctx.accounts.merchant.key();
        vault.funding_token_mint = ctx.accounts.funding_token_mint.key();
        vault.debt_token_mint = ctx.accounts.debt_token_mint.key();
        vault.vault_token_account = ctx.accounts.vault_token_account.key();
        vault.target_amount = target_amount;
        vault.min_investment = min_investment;
        vault.max_investment = max_investment;
        vault.interest_rate_bps = interest_rate_bps;
        vault.duration_months = duration_months;
        vault.num_tranches = num_tranches;
        vault.max_investors = max_investors;
        vault.late_fee_bps = late_fee_bps;
        vault.grace_period_days = grace_period_days;
        vault.state = VaultState::Fundraising;
        vault.fundraising_deadline = clock.unix_timestamp + (fundraising_days as i64 * 86400);
        vault.created_at = clock.unix_timestamp;
        vault.platform_fee_bps = config.default_fee_bps;
        vault.platform_fee_recipient = config.fee_recipient;
        vault.vault_nonce = vault_nonce;
        vault.bump = ctx.bumps.vault;

        profile.vault_count += 1;
        emit!(VaultCreated { vault: vault.key(), merchant: vault.merchant, target_amount, interest_rate_bps, duration_months, num_tranches });
        Ok(())
    }

    pub fn invest(ctx: Context<Invest>, amount: u64) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        let investor = &mut ctx.accounts.investor_account;
        let clock = Clock::get()?;

        require!(vault.is_fundraising(), TigerPayError::InvalidVaultState);
        require!(clock.unix_timestamp <= vault.fundraising_deadline, TigerPayError::FundraisingDeadlinePassed);
        require!(amount >= vault.min_investment, TigerPayError::InvestmentTooLow);
        
        let new_total = vault.total_raised.checked_add(amount).ok_or(TigerPayError::ArithmeticOverflow)?;
        require!(new_total <= vault.target_amount, TigerPayError::InvestmentExceedsTarget);
        
        if investor.amount_invested == 0 {
            require!(vault.investor_count < vault.max_investors, TigerPayError::MaxInvestorsReached);
        }

        token::transfer(CpiContext::new(ctx.accounts.token_program.to_account_info(), Transfer {
            from: ctx.accounts.investor_token_account.to_account_info(),
            to: ctx.accounts.vault_token_account.to_account_info(),
            authority: ctx.accounts.investor.to_account_info(),
        }), amount)?;

        let seeds = &[b"vault", vault.merchant.as_ref(), &[vault.vault_nonce], &[vault.bump]];
        token::mint_to(CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), MintTo {
            mint: ctx.accounts.debt_token_mint.to_account_info(),
            to: ctx.accounts.investor_debt_token_account.to_account_info(),
            authority: vault.to_account_info(),
        }, &[seeds]), amount)?;

        if investor.amount_invested == 0 {
            investor.vault = vault.key();
            investor.investor = ctx.accounts.investor.key();
            investor.invested_at = clock.unix_timestamp;
            investor.bump = ctx.bumps.investor_account;
            vault.investor_count += 1;
        }
        investor.amount_invested = investor.amount_invested.checked_add(amount).ok_or(TigerPayError::ArithmeticOverflow)?;
        investor.debt_tokens_received = investor.debt_tokens_received.checked_add(amount).ok_or(TigerPayError::ArithmeticOverflow)?;
        vault.total_raised = new_total;

        emit!(InvestmentReceived { vault: vault.key(), investor: ctx.accounts.investor.key(), amount, total_raised: new_total });

        if vault.total_raised >= vault.target_amount {
            vault.state = VaultState::Active;
            let interest = (vault.total_raised as u128 * vault.interest_rate_bps as u128 * vault.duration_months as u128 / (10000 * 12)) as u64;
            vault.total_to_repay = vault.total_raised.checked_add(interest).unwrap();
            vault.next_payment_due = clock.unix_timestamp + 30 * 86400;
        }
        Ok(())
    }

    pub fn make_repayment(ctx: Context<MakeRepayment>, amount: u64) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        let clock = Clock::get()?;
        require!(vault.is_active() || vault.is_repaying(), TigerPayError::InvalidVaultState);
        require!(amount > 0, TigerPayError::InvalidRepaymentAmount);

        let late_fee = vault.calculate_late_fee(clock.unix_timestamp);
        vault.total_late_fees = vault.total_late_fees.checked_add(late_fee).ok_or(TigerPayError::ArithmeticOverflow)?;

        token::transfer(CpiContext::new(ctx.accounts.token_program.to_account_info(), Transfer {
            from: ctx.accounts.merchant_token_account.to_account_info(),
            to: ctx.accounts.vault_token_account.to_account_info(),
            authority: ctx.accounts.merchant.to_account_info(),
        }), amount)?;

        vault.total_repaid = vault.total_repaid.checked_add(amount).ok_or(TigerPayError::ArithmeticOverflow)?;
        vault.next_payment_due = clock.unix_timestamp + 30 * 86400;

        emit!(RepaymentReceived { vault: vault.key(), merchant: vault.merchant, amount, late_fee, total_repaid: vault.total_repaid });

        if vault.total_repaid >= vault.total_to_repay + vault.total_late_fees {
            vault.state = VaultState::Completed;
        }
        Ok(())
    }

    pub fn claim_returns(ctx: Context<ClaimReturns>) -> Result<()> {
        let vault = &ctx.accounts.vault;
        let investor = &mut ctx.accounts.investor_account;
        require!(vault.is_repaying() || vault.state == VaultState::Completed, TigerPayError::InvalidVaultState);

        let claimable = investor.calculate_claimable(vault.total_raised, vault.total_repaid);
        require!(claimable > 0, TigerPayError::NoReturnsAvailable);

        let seeds = &[b"vault", vault.merchant.as_ref(), &[vault.vault_nonce], &[vault.bump]];
        token::transfer(CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), Transfer {
            from: ctx.accounts.vault_token_account.to_account_info(),
            to: ctx.accounts.investor_token_account.to_account_info(),
            authority: vault.to_account_info(),
        }, &[seeds]), claimable)?;

        investor.claimed_returns = investor.claimed_returns.checked_add(claimable).ok_or(TigerPayError::ArithmeticOverflow)?;
        investor.last_claim_at = Clock::get()?.unix_timestamp;
        emit!(ReturnsClaimed { vault: vault.key(), investor: ctx.accounts.investor.key(), amount: claimable });
        Ok(())
    }

    // ============ Default & Recovery ============

    pub fn mark_default(ctx: Context<MarkDefault>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        let clock = Clock::get()?;
        require!(vault.state == VaultState::Repaying, TigerPayError::InvalidVaultState);
        require!(vault.should_default(clock.unix_timestamp), TigerPayError::GracePeriodNotExpired);

        vault.state = VaultState::Defaulted;
        vault.defaulted_at = clock.unix_timestamp;
        emit!(VaultDefaulted { vault: vault.key(), merchant: vault.merchant, total_raised: vault.total_raised, total_repaid: vault.total_repaid, defaulted_at: clock.unix_timestamp });
        Ok(())
    }

    pub fn recover_funds(ctx: Context<RecoverFunds>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        let investor = &mut ctx.accounts.investor_account;
        require!(vault.is_defaulted(), TigerPayError::InvalidVaultState);
        require!(!investor.has_recovered, TigerPayError::AlreadyClaimed);

        let balance = ctx.accounts.vault_token_account.amount;
        let share = (investor.amount_invested as u128 * balance as u128 / vault.total_raised as u128) as u64;
        require!(share > 0, TigerPayError::NoReturnsAvailable);

        let seeds = &[b"vault", vault.merchant.as_ref(), &[vault.vault_nonce], &[vault.bump]];
        token::transfer(CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), Transfer {
            from: ctx.accounts.vault_token_account.to_account_info(),
            to: ctx.accounts.investor_token_account.to_account_info(),
            authority: vault.to_account_info(),
        }, &[seeds]), share)?;

        investor.has_recovered = true;
        investor.recovered_amount = share;
        vault.total_recovered = vault.total_recovered.checked_add(share).ok_or(TigerPayError::ArithmeticOverflow)?;
        emit!(FundsRecovered { vault: vault.key(), investor: ctx.accounts.investor.key(), amount: share });
        Ok(())
    }

    // ============ Cancellation & Refund ============

    pub fn cancel_vault(ctx: Context<CancelVault>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        let clock = Clock::get()?;
        require!(vault.state == VaultState::Fundraising, TigerPayError::InvalidVaultState);

        vault.cancelled = true;
        vault.cancelled_at = clock.unix_timestamp;
        vault.state = VaultState::Cancelled;
        emit!(VaultCancelled { vault: vault.key(), merchant: vault.merchant, total_raised: vault.total_raised, investor_count: vault.investor_count, cancelled_at: clock.unix_timestamp });
        Ok(())
    }

    pub fn claim_refund(ctx: Context<ClaimRefund>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        let investor = &mut ctx.accounts.investor_account;
        require!(vault.is_cancelled(), TigerPayError::VaultNotCancelled);
        require!(!investor.has_refunded, TigerPayError::AlreadyClaimed);

        let refund = investor.amount_invested;
        let seeds = &[b"vault", vault.merchant.as_ref(), &[vault.vault_nonce], &[vault.bump]];
        token::transfer(CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), Transfer {
            from: ctx.accounts.vault_token_account.to_account_info(),
            to: ctx.accounts.investor_token_account.to_account_info(),
            authority: vault.to_account_info(),
        }, &[seeds]), refund)?;

        investor.has_refunded = true;
        emit!(RefundClaimed { vault: vault.key(), investor: ctx.accounts.investor.key(), amount: refund });
        Ok(())
    }

    // ============ Pause Controls ============

    pub fn pause_vault(ctx: Context<PauseVault>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        require!(!vault.paused, TigerPayError::VaultAlreadyPaused);
        vault.paused = true;
        emit!(VaultPaused { vault: vault.key(), paused_by: ctx.accounts.authority.key() });
        Ok(())
    }

    pub fn unpause_vault(ctx: Context<UnpauseVault>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        require!(vault.paused, TigerPayError::VaultNotPaused);
        vault.paused = false;
        emit!(VaultUnpaused { vault: vault.key(), unpaused_by: ctx.accounts.authority.key() });
        Ok(())
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
        let config = &ctx.accounts.platform_config;
        let profile = &mut ctx.accounts.merchant_profile;
        let icm = &mut ctx.accounts.icm_vault;
        let clock = Clock::get()?;

        require!(!config.paused, TigerPayError::PlatformPaused);
        icm.authority = ctx.accounts.authority.key();
        icm.business = ctx.accounts.business.key();
        icm.funding_token_mint = ctx.accounts.funding_token_mint.key();
        icm.stake_token_mint = ctx.accounts.stake_token_mint.key();
        icm.vault_token_account = ctx.accounts.vault_token_account.key();
        icm.total_shares = total_shares;
        icm.price_per_share = price_per_share;
        icm.min_buy = min_buy;
        icm.max_buy = max_buy;
        icm.target_raised = total_shares.checked_mul(price_per_share).ok_or(TigerPayError::ArithmeticOverflow)?;
        icm.state = ICMState::Offered;
        icm.offering_deadline = clock.unix_timestamp + (offering_days as i64 * 86400);
        icm.created_at = clock.unix_timestamp;
        icm.platform_fee_bps = config.default_fee_bps;
        icm.platform_fee_recipient = config.fee_recipient;
        icm.icm_nonce = icm_nonce;
        icm.bump = ctx.bumps.icm_vault;

        profile.vault_count += 1;
        emit!(ICMVaultCreated { icm_vault: icm.key(), business: icm.business, total_shares, price_per_share });
        Ok(())
    }

    pub fn buy_stake(ctx: Context<BuyStake>, shares: u64) -> Result<()> {
        let icm = &mut ctx.accounts.icm_vault;
        let clock = Clock::get()?;

        require!(icm.state == ICMState::Offered || icm.state == ICMState::Active, TigerPayError::InvalidVaultState);
        require!(clock.unix_timestamp <= icm.offering_deadline, TigerPayError::FundraisingDeadlinePassed);
        require!(shares >= icm.min_buy, TigerPayError::InvestmentTooLow);

        let new_sold = icm.shares_sold.checked_add(shares).ok_or(TigerPayError::ArithmeticOverflow)?;
        require!(new_sold <= icm.total_shares, TigerPayError::InvestmentExceedsTarget);

        let cost = shares.checked_mul(icm.price_per_share).ok_or(TigerPayError::ArithmeticOverflow)?;

        token::transfer(CpiContext::new(ctx.accounts.token_program.to_account_info(), Transfer {
            from: ctx.accounts.investor_token_account.to_account_info(),
            to: ctx.accounts.vault_token_account.to_account_info(),
            authority: ctx.accounts.investor.to_account_info(),
        }), cost)?;

        let seeds = &[b"icm_vault", icm.business.as_ref(), &[icm.icm_nonce], &[icm.bump]];
        token::mint_to(CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), MintTo {
            mint: ctx.accounts.stake_token_mint.to_account_info(),
            to: ctx.accounts.investor_stake_token_account.to_account_info(),
            authority: icm.to_account_info(),
        }, &[seeds]), shares)?;

        icm.shares_sold = new_sold;
        icm.total_raised = icm.total_raised.checked_add(cost).ok_or(TigerPayError::ArithmeticOverflow)?;
        if icm.state == ICMState::Offered { icm.state = ICMState::Active; }
        if icm.shares_sold == icm.total_shares { icm.state = ICMState::Closed; }

        emit!(StakePurchased { icm_vault: icm.key(), investor: ctx.accounts.investor.key(), shares, amount_paid: cost });
        Ok(())
    }

    pub fn distribute_dividends(ctx: Context<DistributeDividends>, amount: u64) -> Result<()> {
        let icm = &mut ctx.accounts.icm_vault;
        let clock = Clock::get()?;
        require!(icm.state == ICMState::Closed, TigerPayError::InvalidVaultState);

        token::transfer(CpiContext::new(ctx.accounts.token_program.to_account_info(), Transfer {
            from: ctx.accounts.business_token_account.to_account_info(),
            to: ctx.accounts.vault_token_account.to_account_info(),
            authority: ctx.accounts.business.to_account_info(),
        }), amount)?;

        icm.total_dividends_distributed = icm.total_dividends_distributed.checked_add(amount).ok_or(TigerPayError::ArithmeticOverflow)?;
        icm.last_dividend_at = clock.unix_timestamp;
        emit!(DividendsDistributed { icm_vault: icm.key(), business: icm.business, amount, total_distributed: icm.total_dividends_distributed });
        Ok(())
    }

    pub fn claim_dividends(ctx: Context<ClaimDividends>) -> Result<()> {
        let icm = &mut ctx.accounts.icm_vault;
        let investor = &mut ctx.accounts.investor_account;
        require!(icm.is_closed(), TigerPayError::InvalidVaultState);

        let claimable = investor.calculate_claimable_dividends(icm.shares_sold, icm.total_dividends_distributed);
        require!(claimable > 0, TigerPayError::NoDividendsAvailable);

        let seeds = &[b"icm_vault", icm.business.as_ref(), &[icm.icm_nonce], &[icm.bump]];
        token::transfer(CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), Transfer {
            from: ctx.accounts.vault_token_account.to_account_info(),
            to: ctx.accounts.investor_token_account.to_account_info(),
            authority: icm.to_account_info(),
        }, &[seeds]), claimable)?;

        investor.dividends_claimed = investor.dividends_claimed.checked_add(claimable).ok_or(TigerPayError::ArithmeticOverflow)?;
        investor.last_claim_at = Clock::get()?.unix_timestamp;
        icm.total_dividends_claimed = icm.total_dividends_claimed.checked_add(claimable).ok_or(TigerPayError::ArithmeticOverflow)?;
        emit!(DividendsClaimed { icm_vault: icm.key(), investor: ctx.accounts.investor.key(), amount: claimable });
        Ok(())
    }
}

// ============ Accounts ============

#[derive(Accounts)]
pub struct InitializePlatform<'info> {
    #[account(mut)] pub authority: Signer<'info>,
    /// CHECK: Fee recipient
    pub fee_recipient: UncheckedAccount<'info>,
    #[account(init, payer = authority, space = PlatformConfig::LEN, seeds = [b"config"], bump)]
    pub platform_config: Account<'info, PlatformConfig>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct VerifyMerchant<'info> {
    #[account(mut, constraint = authority.key() == platform_config.authority @ TigerPayError::Unauthorized)]
    pub authority: Signer<'info>,
    /// CHECK: Merchant
    pub merchant: UncheckedAccount<'info>,
    #[account(seeds = [b"config"], bump = platform_config.bump)]
    pub platform_config: Account<'info, PlatformConfig>,
    #[account(init, payer = authority, space = MerchantProfile::LEN, seeds = [b"merchant", merchant.key().as_ref()], bump)]
    pub merchant_profile: Account<'info, MerchantProfile>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(vault_nonce: u8)]
pub struct CreateVault<'info> {
    #[account(mut)] pub authority: Signer<'info>,
    /// CHECK: Merchant
    pub merchant: UncheckedAccount<'info>,
    #[account(mut, seeds = [b"merchant", merchant.key().as_ref()], bump = merchant_profile.bump)]
    pub merchant_profile: Account<'info, MerchantProfile>,
    #[account(seeds = [b"config"], bump = platform_config.bump)]
    pub platform_config: Account<'info, PlatformConfig>,
    #[account(init, payer = authority, space = MerchantVault::LEN, seeds = [b"vault", merchant.key().as_ref(), &[vault_nonce]], bump)]
    pub vault: Account<'info, MerchantVault>,
    pub funding_token_mint: Account<'info, Mint>,
    #[account(init, payer = authority, mint::decimals = funding_token_mint.decimals, mint::authority = vault, seeds = [b"debt_mint", vault.key().as_ref()], bump)]
    pub debt_token_mint: Account<'info, Mint>,
    #[account(init, payer = authority, associated_token::mint = funding_token_mint, associated_token::authority = vault)]
    pub vault_token_account: Account<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Invest<'info> {
    #[account(mut)] pub investor: Signer<'info>,
    #[account(mut)] pub vault: Account<'info, MerchantVault>,
    #[account(init_if_needed, payer = investor, space = InvestorAccount::LEN, seeds = [b"investor", vault.key().as_ref(), investor.key().as_ref()], bump)]
    pub investor_account: Account<'info, InvestorAccount>,
    #[account(mut, constraint = investor_token_account.mint == vault.funding_token_mint @ TigerPayError::InvalidAccount)]
    pub investor_token_account: Account<'info, TokenAccount>,
    #[account(mut, constraint = vault_token_account.key() == vault.vault_token_account @ TigerPayError::InvalidAccount)]
    pub vault_token_account: Account<'info, TokenAccount>,
    #[account(mut, constraint = debt_token_mint.key() == vault.debt_token_mint @ TigerPayError::InvalidAccount)]
    pub debt_token_mint: Account<'info, Mint>,
    #[account(init_if_needed, payer = investor, associated_token::mint = debt_token_mint, associated_token::authority = investor)]
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
    #[account(mut)] pub vault: Account<'info, MerchantVault>,
    #[account(mut, constraint = merchant_token_account.mint == vault.funding_token_mint @ TigerPayError::InvalidAccount)]
    pub merchant_token_account: Account<'info, TokenAccount>,
    #[account(mut, constraint = vault_token_account.key() == vault.vault_token_account @ TigerPayError::InvalidAccount)]
    pub vault_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ClaimReturns<'info> {
    pub investor: Signer<'info>,
    pub vault: Account<'info, MerchantVault>,
    #[account(mut, seeds = [b"investor", vault.key().as_ref(), investor.key().as_ref()], bump = investor_account.bump)]
    pub investor_account: Account<'info, InvestorAccount>,
    #[account(mut, constraint = vault_token_account.key() == vault.vault_token_account @ TigerPayError::InvalidAccount)]
    pub vault_token_account: Account<'info, TokenAccount>,
    #[account(mut, constraint = investor_token_account.mint == vault.funding_token_mint @ TigerPayError::InvalidAccount)]
    pub investor_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct MarkDefault<'info> {
    #[account(constraint = authority.key() == platform_config.authority @ TigerPayError::Unauthorized)]
    pub authority: Signer<'info>,
    #[account(seeds = [b"config"], bump = platform_config.bump)]
    pub platform_config: Account<'info, PlatformConfig>,
    #[account(mut)] pub vault: Account<'info, MerchantVault>,
}

#[derive(Accounts)]
pub struct RecoverFunds<'info> {
    pub investor: Signer<'info>,
    pub vault: Account<'info, MerchantVault>,
    #[account(mut, seeds = [b"investor", vault.key().as_ref(), investor.key().as_ref()], bump = investor_account.bump)]
    pub investor_account: Account<'info, InvestorAccount>,
    #[account(mut, constraint = vault_token_account.key() == vault.vault_token_account @ TigerPayError::InvalidAccount)]
    pub vault_token_account: Account<'info, TokenAccount>,
    #[account(mut, constraint = investor_token_account.mint == vault.funding_token_mint @ TigerPayError::InvalidAccount)]
    pub investor_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CancelVault<'info> {
    #[account(constraint = authority.key() == vault.authority @ TigerPayError::Unauthorized)]
    pub authority: Signer<'info>,
    #[account(mut)] pub vault: Account<'info, MerchantVault>,
}

#[derive(Accounts)]
pub struct ClaimRefund<'info> {
    pub investor: Signer<'info>,
    #[account(mut)] pub vault: Account<'info, MerchantVault>,
    #[account(mut, seeds = [b"investor", vault.key().as_ref(), investor.key().as_ref()], bump = investor_account.bump)]
    pub investor_account: Account<'info, InvestorAccount>,
    #[account(mut, constraint = vault_token_account.key() == vault.vault_token_account @ TigerPayError::InvalidAccount)]
    pub vault_token_account: Account<'info, TokenAccount>,
    #[account(mut, constraint = investor_token_account.mint == vault.funding_token_mint @ TigerPayError::InvalidAccount)]
    pub investor_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct PauseVault<'info> {
    #[account(constraint = authority.key() == vault.authority @ TigerPayError::Unauthorized)]
    pub authority: Signer<'info>,
    #[account(mut)] pub vault: Account<'info, MerchantVault>,
}

#[derive(Accounts)]
pub struct UnpauseVault<'info> {
    #[account(constraint = authority.key() == vault.authority @ TigerPayError::Unauthorized)]
    pub authority: Signer<'info>,
    #[account(mut)] pub vault: Account<'info, MerchantVault>,
}

#[derive(Accounts)]
#[instruction(icm_nonce: u8)]
pub struct CreateICMVault<'info> {
    #[account(mut)] pub authority: Signer<'info>,
    /// CHECK: Business
    pub business: UncheckedAccount<'info>,
    #[account(mut, seeds = [b"merchant", business.key().as_ref()], bump = merchant_profile.bump)]
    pub merchant_profile: Account<'info, MerchantProfile>,
    #[account(seeds = [b"config"], bump = platform_config.bump)]
    pub platform_config: Account<'info, PlatformConfig>,
    #[account(init, payer = authority, space = ICMVault::LEN, seeds = [b"icm_vault", business.key().as_ref(), &[icm_nonce]], bump)]
    pub icm_vault: Account<'info, ICMVault>,
    pub funding_token_mint: Account<'info, Mint>,
    #[account(init, payer = authority, mint::decimals = 6, mint::authority = icm_vault, seeds = [b"stake_mint", icm_vault.key().as_ref()], bump)]
    pub stake_token_mint: Account<'info, Mint>,
    #[account(init, payer = authority, associated_token::mint = funding_token_mint, associated_token::authority = icm_vault)]
    pub vault_token_account: Account<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct BuyStake<'info> {
    #[account(mut)] pub investor: Signer<'info>,
    #[account(mut)] pub icm_vault: Account<'info, ICMVault>,
    #[account(mut, constraint = investor_token_account.mint == icm_vault.funding_token_mint @ TigerPayError::InvalidAccount)]
    pub investor_token_account: Account<'info, TokenAccount>,
    #[account(mut, constraint = vault_token_account.key() == icm_vault.vault_token_account @ TigerPayError::InvalidAccount)]
    pub vault_token_account: Account<'info, TokenAccount>,
    #[account(mut, constraint = stake_token_mint.key() == icm_vault.stake_token_mint @ TigerPayError::InvalidAccount)]
    pub stake_token_mint: Account<'info, Mint>,
    #[account(init_if_needed, payer = investor, associated_token::mint = stake_token_mint, associated_token::authority = investor)]
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
    #[account(mut)] pub icm_vault: Account<'info, ICMVault>,
    #[account(mut, constraint = business_token_account.mint == icm_vault.funding_token_mint @ TigerPayError::InvalidAccount)]
    pub business_token_account: Account<'info, TokenAccount>,
    #[account(mut, constraint = vault_token_account.key() == icm_vault.vault_token_account @ TigerPayError::InvalidAccount)]
    pub vault_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ClaimDividends<'info> {
    pub investor: Signer<'info>,
    #[account(mut)] pub icm_vault: Account<'info, ICMVault>,
    #[account(mut, seeds = [b"icm_investor", icm_vault.key().as_ref(), investor.key().as_ref()], bump = investor_account.bump)]
    pub investor_account: Account<'info, ICMInvestorAccount>,
    #[account(mut, constraint = vault_token_account.key() == icm_vault.vault_token_account @ TigerPayError::InvalidAccount)]
    pub vault_token_account: Account<'info, TokenAccount>,
    #[account(mut, constraint = investor_token_account.mint == icm_vault.funding_token_mint @ TigerPayError::InvalidAccount)]
    pub investor_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

// ============ State ============

#[account]
#[derive(Default)]
pub struct PlatformConfig {
    pub authority: Pubkey,
    pub fee_recipient: Pubkey,
    pub default_fee_bps: u16,
    pub min_funding_target: u64,
    pub max_funding_target: u64,
    pub paused: bool,
    pub bump: u8,
}
impl PlatformConfig { pub const LEN: usize = 8 + 32 + 32 + 2 + 8 + 8 + 1 + 1; }

#[account]
#[derive(Default)]
pub struct MerchantProfile {
    pub merchant: Pubkey,
    pub authority: Pubkey,
    pub verified: bool,
    pub verified_at: i64,
    pub vault_count: u32,
    pub max_vaults: u32,
    pub name_hash: [u8; 32],
    pub bump: u8,
}
impl MerchantProfile { 
    pub const LEN: usize = 8 + 32 + 32 + 1 + 8 + 4 + 4 + 32 + 1; 
    pub fn can_create_vault(&self) -> bool { self.verified && self.vault_count < self.max_vaults }
}

#[account]
#[derive(Default)]
pub struct MerchantVault {
    pub authority: Pubkey, pub merchant: Pubkey, pub funding_token_mint: Pubkey, pub debt_token_mint: Pubkey, pub vault_token_account: Pubkey,
    pub target_amount: u64, pub min_investment: u64, pub max_investment: u64, pub total_raised: u64, pub total_repaid: u64, pub total_to_repay: u64,
    pub interest_rate_bps: u16, pub duration_months: u8, pub num_tranches: u8, pub tranches_released: u8,
    pub state: VaultState, pub fundraising_deadline: i64, pub created_at: i64,
    pub platform_fee_bps: u16, pub platform_fee_recipient: Pubkey, pub platform_fees_collected: u64,
    pub investor_count: u32, pub max_investors: u32, pub vault_nonce: u8, pub bump: u8,
    pub next_payment_due: i64, pub late_fee_bps: u16, pub total_late_fees: u64, pub grace_period_days: u8,
    pub defaulted_at: i64, pub total_recovered: u64, pub paused: bool, pub cancelled: bool, pub cancelled_at: i64,
}
impl MerchantVault {
    pub const LEN: usize = 8 + 32*5 + 8*6 + 2 + 1*3 + 1 + 8*2 + 2 + 32 + 8 + 4*2 + 1*2 + 8 + 2 + 8 + 1 + 8*2 + 1*2 + 8;
    pub fn is_fundraising(&self) -> bool { self.state == VaultState::Fundraising && !self.cancelled && !self.paused }
    pub fn is_active(&self) -> bool { self.state == VaultState::Active && !self.paused }
    pub fn is_repaying(&self) -> bool { self.state == VaultState::Repaying && !self.paused }
    pub fn is_defaulted(&self) -> bool { self.state == VaultState::Defaulted }
    pub fn is_cancelled(&self) -> bool { self.cancelled }
    pub fn calculate_late_fee(&self, now: i64) -> u64 {
        if now <= self.next_payment_due || self.next_payment_due == 0 { return 0; }
        let days = ((now - self.next_payment_due) / 86400) as u64;
        self.total_to_repay.saturating_sub(self.total_repaid).saturating_mul(self.late_fee_bps as u64).saturating_mul(days) / 10000
    }
    pub fn should_default(&self, now: i64) -> bool {
        self.next_payment_due > 0 && self.state == VaultState::Repaying && now > self.next_payment_due + (self.grace_period_days as i64 * 86400)
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Default)]
pub enum VaultState { #[default] Fundraising, Active, Repaying, Completed, Defaulted, Cancelled }

#[account]
#[derive(Default)]
pub struct InvestorAccount {
    pub vault: Pubkey, pub investor: Pubkey, pub amount_invested: u64, pub debt_tokens_received: u64, pub claimed_returns: u64,
    pub invested_at: i64, pub last_claim_at: i64, pub bump: u8,
    pub has_refunded: bool, pub has_recovered: bool, pub recovered_amount: u64,
}
impl InvestorAccount {
    pub const LEN: usize = 8 + 32*2 + 8*3 + 8*2 + 1 + 1*2 + 8;
    pub fn calculate_claimable(&self, raised: u64, repaid: u64) -> u64 {
        if raised == 0 { return 0; }
        ((self.amount_invested as u128 * repaid as u128 / raised as u128) as u64).saturating_sub(self.claimed_returns)
    }
}

#[account]
#[derive(Default)]
pub struct ICMVault {
    pub authority: Pubkey, pub business: Pubkey, pub funding_token_mint: Pubkey, pub stake_token_mint: Pubkey, pub vault_token_account: Pubkey,
    pub total_shares: u64, pub shares_sold: u64, pub price_per_share: u64, pub min_buy: u64, pub max_buy: u64,
    pub target_raised: u64, pub total_raised: u64, pub state: ICMState, pub offering_deadline: i64, pub created_at: i64,
    pub platform_fee_bps: u16, pub platform_fee_recipient: Pubkey, pub investor_count: u32, pub icm_nonce: u8, pub bump: u8,
    pub total_dividends_distributed: u64, pub total_dividends_claimed: u64, pub last_dividend_at: i64, pub paused: bool,
}
impl ICMVault { 
    pub const LEN: usize = 8 + 32*5 + 8*5 + 8*2 + 1 + 8*2 + 2 + 32 + 4 + 1*2 + 8*3 + 1;
    pub fn is_closed(&self) -> bool { self.state == ICMState::Closed }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Default)]
pub enum ICMState { #[default] Offered, Active, Closed, Cancelled }

#[account]
#[derive(Default)]
pub struct ICMInvestorAccount {
    pub icm_vault: Pubkey, pub investor: Pubkey, pub shares_owned: u64, pub total_invested: u64,
    pub dividends_claimed: u64, pub last_claim_at: i64, pub bump: u8,
}
impl ICMInvestorAccount {
    pub const LEN: usize = 8 + 32*2 + 8*4 + 1;
    pub fn calculate_claimable_dividends(&self, total_shares: u64, total_dividends: u64) -> u64 {
        if total_shares == 0 { return 0; }
        ((self.shares_owned as u128 * total_dividends as u128 / total_shares as u128) as u64).saturating_sub(self.dividends_claimed)
    }
}

// ============ Events ============
#[event] pub struct PlatformInitialized { pub authority: Pubkey, pub fee_recipient: Pubkey, pub default_fee_bps: u16 }
#[event] pub struct MerchantVerified { pub merchant: Pubkey, pub verified_by: Pubkey }
#[event] pub struct VaultCreated { pub vault: Pubkey, pub merchant: Pubkey, pub target_amount: u64, pub interest_rate_bps: u16, pub duration_months: u8, pub num_tranches: u8 }
#[event] pub struct InvestmentReceived { pub vault: Pubkey, pub investor: Pubkey, pub amount: u64, pub total_raised: u64 }
#[event] pub struct RepaymentReceived { pub vault: Pubkey, pub merchant: Pubkey, pub amount: u64, pub late_fee: u64, pub total_repaid: u64 }
#[event] pub struct ReturnsClaimed { pub vault: Pubkey, pub investor: Pubkey, pub amount: u64 }
#[event] pub struct VaultDefaulted { pub vault: Pubkey, pub merchant: Pubkey, pub total_raised: u64, pub total_repaid: u64, pub defaulted_at: i64 }
#[event] pub struct FundsRecovered { pub vault: Pubkey, pub investor: Pubkey, pub amount: u64 }
#[event] pub struct VaultCancelled { pub vault: Pubkey, pub merchant: Pubkey, pub total_raised: u64, pub investor_count: u32, pub cancelled_at: i64 }
#[event] pub struct RefundClaimed { pub vault: Pubkey, pub investor: Pubkey, pub amount: u64 }
#[event] pub struct VaultPaused { pub vault: Pubkey, pub paused_by: Pubkey }
#[event] pub struct VaultUnpaused { pub vault: Pubkey, pub unpaused_by: Pubkey }
#[event] pub struct ICMVaultCreated { pub icm_vault: Pubkey, pub business: Pubkey, pub total_shares: u64, pub price_per_share: u64 }
#[event] pub struct StakePurchased { pub icm_vault: Pubkey, pub investor: Pubkey, pub shares: u64, pub amount_paid: u64 }
#[event] pub struct DividendsDistributed { pub icm_vault: Pubkey, pub business: Pubkey, pub amount: u64, pub total_distributed: u64 }
#[event] pub struct DividendsClaimed { pub icm_vault: Pubkey, pub investor: Pubkey, pub amount: u64 }

// ============ Errors ============
#[error_code]
pub enum TigerPayError {
    #[msg("Platform paused")] PlatformPaused,
    #[msg("Merchant not verified")] MerchantNotVerified,
    #[msg("Invalid funding target")] InvalidFundingTarget,
    #[msg("Investment too low")] InvestmentTooLow,
    #[msg("Investment too high")] InvestmentTooHigh,
    #[msg("Investment exceeds target")] InvestmentExceedsTarget,
    #[msg("Fundraising deadline passed")] FundraisingDeadlinePassed,
    #[msg("Invalid vault state")] InvalidVaultState,
    #[msg("Invalid repayment amount")] InvalidRepaymentAmount,
    #[msg("No returns available")] NoReturnsAvailable,
    #[msg("Unauthorized")] Unauthorized,
    #[msg("Invalid account")] InvalidAccount,
    #[msg("Arithmetic overflow")] ArithmeticOverflow,
    #[msg("Vault paused")] VaultPaused,
    #[msg("Vault not paused")] VaultNotPaused,
    #[msg("Vault already paused")] VaultAlreadyPaused,
    #[msg("Vault not cancelled")] VaultNotCancelled,
    #[msg("Grace period not expired")] GracePeriodNotExpired,
    #[msg("Already claimed")] AlreadyClaimed,
    #[msg("No dividends available")] NoDividendsAvailable,
    #[msg("Max investors reached")] MaxInvestorsReached,
}
