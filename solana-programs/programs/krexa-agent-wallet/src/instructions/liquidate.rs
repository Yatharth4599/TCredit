use anchor_lang::prelude::*;
use anchor_spl::token::{self, Transfer};
use crate::{Liquidate, AgentWallet, WalletConfig, WalletError};
use crate::events::Liquidated;
use crate::utils::compute_health;
use krexa_common::constants::{HF_LIQUIDATION, LIQUIDATION_REWARD_BPS, BPS_DENOMINATOR};

pub fn handle(ctx: Context<Liquidate>) -> Result<()> {
    let wallet_usdc_balance = ctx.accounts.wallet_usdc.amount;
    let vault_cfg = &ctx.accounts.vault_config;
    let wallet = &ctx.accounts.agent_wallet;

    let live_hf = compute_health(
        wallet_usdc_balance,
        wallet.collateral_shares,
        vault_cfg.total_deposits,
        vault_cfg.total_shares,
        wallet.total_debt,
    );

    require!(live_hf < HF_LIQUIDATION, WalletError::HealthAboveLiquidation);

    let total_debt = ctx.accounts.agent_wallet.total_debt;
    let keeper_reward = (wallet_usdc_balance as u128
        * LIQUIDATION_REWARD_BPS as u128
        / BPS_DENOMINATOR as u128) as u64;
    let available_for_repay = wallet_usdc_balance.saturating_sub(keeper_reward);
    let repay_amount = available_for_repay.min(total_debt);
    let shortfall = total_debt.saturating_sub(repay_amount);
    let returned_to_owner = wallet_usdc_balance.saturating_sub(keeper_reward).saturating_sub(repay_amount);

    let agent_key = ctx.accounts.agent_wallet.agent;
    let wallet_bump = ctx.accounts.agent_wallet.bump;
    let wallet_seeds: &[&[&[u8]]] = &[&[AgentWallet::SEED, agent_key.as_ref(), &[wallet_bump]]];

    ctx.accounts.agent_wallet.is_liquidating = true;

    if repay_amount > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.wallet_usdc.to_account_info(),
                    to: ctx.accounts.vault_token.to_account_info(),
                    authority: ctx.accounts.agent_wallet.to_account_info(),
                },
                wallet_seeds,
            ),
            repay_amount,
        )?;

        let config_bump = ctx.accounts.config.bump;
        let config_seeds: &[&[&[u8]]] = &[&[WalletConfig::SEED, &[config_bump]]];

        krexa_credit_vault::cpi::receive_repayment(
            CpiContext::new_with_signer(
                ctx.accounts.vault_program.to_account_info(),
                krexa_credit_vault::cpi::accounts::ReceiveRepayment {
                    config: ctx.accounts.vault_config.to_account_info(),
                    vault_token: ctx.accounts.vault_token.to_account_info(),
                    insurance_token: ctx.accounts.insurance_token.to_account_info(),
                    credit_line: ctx.accounts.credit_line.to_account_info(),
                    wallet_program_authority: ctx.accounts.config.to_account_info(),
                    token_program: ctx.accounts.token_program.to_account_info(),
                },
                config_seeds,
            ),
            agent_key,
            repay_amount,
        )?;
    }

    if keeper_reward > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.wallet_usdc.to_account_info(),
                    to: ctx.accounts.keeper_usdc.to_account_info(),
                    authority: ctx.accounts.agent_wallet.to_account_info(),
                },
                wallet_seeds,
            ),
            keeper_reward,
        )?;
    }

    if returned_to_owner > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.wallet_usdc.to_account_info(),
                    to: ctx.accounts.owner_usdc.to_account_info(),
                    authority: ctx.accounts.agent_wallet.to_account_info(),
                },
                wallet_seeds,
            ),
            returned_to_owner,
        )?;
    }

    let config_bump = ctx.accounts.config.bump;
    let config_seeds: &[&[&[u8]]] = &[&[WalletConfig::SEED, &[config_bump]]];

    krexa_agent_registry::cpi::record_liquidation(
        CpiContext::new_with_signer(
            ctx.accounts.registry_program.to_account_info(),
            krexa_agent_registry::cpi::accounts::RecordLiquidation {
                config: ctx.accounts.registry_config.to_account_info(),
                profile: ctx.accounts.agent_profile.to_account_info(),
                wallet_program_authority: ctx.accounts.config.to_account_info(),
            },
            config_seeds,
        ),
    )?;

    let now = Clock::get()?.unix_timestamp;
    let wallet = &mut ctx.accounts.agent_wallet;
    wallet.is_liquidating = false;
    wallet.is_frozen = true;
    wallet.credit_drawn = 0;
    wallet.credit_limit = 0;
    wallet.total_debt = shortfall;
    wallet.health_factor_bps = u16::MAX;
    wallet.last_health_check = now;

    emit!(Liquidated {
        agent: wallet.agent,
        debt_repaid: repay_amount,
        keeper_reward,
        returned_to_owner,
        shortfall,
    });
    Ok(())
}
