use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::state::*;
use crate::errors::TigerPayError;
use crate::events::*;
use crate::{RegisterPool, DepositToPool, AllocateToVault, WithdrawFromPool};

// ============ Register Pool ============

/// Admin creates a new LiquidityPool PDA.
pub fn register_pool(
    ctx: Context<RegisterPool>,
    max_allocation_per_vault: u64,
    is_alpha: bool,
) -> Result<()> {
    let pool = &mut ctx.accounts.pool;
    let clock = Clock::get()?;

    pool.authority = ctx.accounts.pool_authority.key();
    pool.funding_token_mint = ctx.accounts.funding_token_mint.key();
    pool.pool_token_account = ctx.accounts.pool_token_account.key();
    pool.total_deposited = 0;
    pool.total_allocated = 0;
    pool.total_returned = 0;
    pool.max_allocation_per_vault = max_allocation_per_vault;
    pool.is_alpha = is_alpha;
    pool.paused = false;
    pool.created_at = clock.unix_timestamp;
    pool.bump = ctx.bumps.pool;

    emit!(PoolRegistered {
        pool: pool.key(),
        authority: ctx.accounts.pool_authority.key(),
        is_alpha,
    });

    msg!("Liquidity pool registered: alpha={}", is_alpha);

    Ok(())
}

// ============ Deposit to Pool ============

/// Pool partner deposits USDC into their liquidity pool.
pub fn deposit_to_pool(ctx: Context<DepositToPool>, amount: u64) -> Result<()> {
    let pool = &mut ctx.accounts.pool;

    require!(!pool.paused, TigerPayError::PoolPaused);
    require!(amount > 0, TigerPayError::InsufficientFunds);

    // Transfer from depositor to pool token account
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.depositor_token_account.to_account_info(),
                to: ctx.accounts.pool_token_account.to_account_info(),
                authority: ctx.accounts.depositor.to_account_info(),
            },
        ),
        amount,
    )?;

    pool.total_deposited = pool.total_deposited
        .checked_add(amount)
        .ok_or(TigerPayError::ArithmeticOverflow)?;

    emit!(PoolDeposited {
        pool: pool.key(),
        depositor: ctx.accounts.depositor.key(),
        amount,
    });

    msg!("Deposited {} to pool {}", amount, pool.key());

    Ok(())
}

// ============ Allocate to Vault ============

/// Fill a vault's funding shortfall from a liquidity pool.
/// Creates a PoolAllocation tracking account.
pub fn allocate_to_vault(ctx: Context<AllocateToVault>, amount: u64) -> Result<()> {
    let pool = &mut ctx.accounts.pool;
    let vault = &mut ctx.accounts.vault;
    let allocation = &mut ctx.accounts.allocation;
    let clock = Clock::get()?;

    require!(pool.can_allocate(amount), TigerPayError::PoolInsufficientBalance);
    require!(vault.is_fundraising(), TigerPayError::InvalidVaultState);

    // Check vault shortfall
    let shortfall = vault.target_amount.saturating_sub(vault.total_raised);
    let alloc_amount = amount.min(shortfall);
    require!(alloc_amount > 0, TigerPayError::InvalidRepaymentAmount);

    // Check per-vault cap
    require!(
        alloc_amount <= pool.max_allocation_per_vault,
        TigerPayError::AllocationExceedsCap
    );

    // Transfer from pool to vault
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.pool_token_account.to_account_info(),
                to: ctx.accounts.vault_token_account.to_account_info(),
                authority: ctx.accounts.admin.to_account_info(),
            },
        ),
        alloc_amount,
    )?;

    // Update pool
    pool.total_allocated = pool.total_allocated
        .checked_add(alloc_amount)
        .ok_or(TigerPayError::ArithmeticOverflow)?;

    // Update vault
    vault.total_raised = vault.total_raised
        .checked_add(alloc_amount)
        .ok_or(TigerPayError::ArithmeticOverflow)?;
    vault.pool_funded = vault.pool_funded
        .checked_add(alloc_amount)
        .ok_or(TigerPayError::ArithmeticOverflow)?;

    // Set allocation tracker
    allocation.pool = pool.key();
    allocation.vault = vault.key();
    allocation.amount = alloc_amount;
    allocation.returned = 0;
    allocation.allocated_at = clock.unix_timestamp;
    allocation.fully_returned = false;
    allocation.bump = ctx.bumps.allocation;

    let remaining_shortfall = vault.target_amount.saturating_sub(vault.total_raised);

    emit!(PoolAllocatedToVault {
        pool: pool.key(),
        vault: vault.key(),
        amount: alloc_amount,
        remaining_shortfall,
    });

    msg!("Allocated {} from pool to vault. Remaining shortfall: {}", alloc_amount, remaining_shortfall);

    Ok(())
}

// ============ Withdraw from Pool ============

/// Pool partner withdraws unallocated balance from their pool.
pub fn withdraw_from_pool(ctx: Context<WithdrawFromPool>, amount: u64) -> Result<()> {
    let pool = &mut ctx.accounts.pool;

    let available = pool.available_balance();
    require!(amount > 0 && amount <= available, TigerPayError::PoolInsufficientBalance);

    // Transfer from pool back to partner
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.pool_token_account.to_account_info(),
                to: ctx.accounts.withdrawer_token_account.to_account_info(),
                authority: ctx.accounts.withdrawer.to_account_info(),
            },
        ),
        amount,
    )?;

    // Reduce total deposited by withdrawal amount
    pool.total_deposited = pool.total_deposited
        .saturating_sub(amount);

    emit!(PoolWithdrawn {
        pool: pool.key(),
        withdrawer: ctx.accounts.withdrawer.key(),
        amount,
    });

    msg!("Withdrew {} from pool {}", amount, pool.key());

    Ok(())
}
