use anchor_lang::prelude::*;
use crate::CheckHealth;
use crate::events::HealthChecked;
use crate::utils::{compute_health, collateral_value_usdc};
use krexa_common::constants::HF_DANGER;

pub fn handle(ctx: Context<CheckHealth>) -> Result<()> {
    let wallet_usdc_balance = ctx.accounts.wallet_usdc.amount;
    let vault_cfg = &ctx.accounts.vault_config;

    let collateral_val = collateral_value_usdc(
        ctx.accounts.agent_wallet.collateral_shares,
        vault_cfg.total_deposits,
        vault_cfg.total_shares,
    );
    let total_debt = ctx.accounts.agent_wallet.total_debt;
    let hf = compute_health(
        wallet_usdc_balance,
        ctx.accounts.agent_wallet.collateral_shares,
        vault_cfg.total_deposits,
        vault_cfg.total_shares,
        total_debt,
    );

    let now = Clock::get()?.unix_timestamp;
    let wallet = &mut ctx.accounts.agent_wallet;
    wallet.health_factor_bps = hf;
    wallet.last_health_check = now;

    if hf < HF_DANGER && !wallet.is_frozen && wallet.total_debt > 0 {
        wallet.is_frozen = true;
    }

    emit!(HealthChecked {
        agent: wallet.agent,
        health_factor_bps: hf,
        wallet_usdc: wallet_usdc_balance,
        collateral_value: collateral_val,
        total_debt,
    });
    Ok(())
}
