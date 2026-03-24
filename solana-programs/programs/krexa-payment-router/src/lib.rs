//! # krexa-payment-router
//!
//! **Program 5 — x402 Revenue Routing for Earning Agents**
//!
//! When an agent sells services via x402, buyers pay through this router.
//! The router splits incoming revenue across three destinations atomically:
//!
//!   1. Platform fee  → Krexa treasury
//!   2. Repayment cut → krexa-credit-vault (CPI `receive_repayment`)
//!   3. Net amount    → merchant (agent's wallet or agent wallet PDA)
//!
//! This enables the **Revenue Router model** for Level 3-4 agents who
//! have revenue streams and want under-collateralised credit: outstanding
//! debt is continuously paid down from earned revenue automatically.
//!
//! ## PDA layout
//! - `RouterConfig`         [`router_config`]
//! - `MerchantSettlement`   [`settlement`, merchant]
//!
//! ## Security
//! - `oracle` must sign every `execute_payment` call (prevents spoofed payments).
//! - Nonce monotonicity guards against transaction replay.
//! - `split_bps` is capped at 5000 (50%) to protect merchant liquidity.

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use krexa_common::constants::BPS_DENOMINATOR;

declare_id!("2Zy3d7C28Z9dfazdysKVBQUXnvvWNshxtDEFKftG83u8");

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/// Maximum repayment split a merchant can configure (50 %).
pub const MAX_SPLIT_BPS: u16 = 5_000;

// ─────────────────────────────────────────────────────────────────────────────
// Accounts
// ─────────────────────────────────────────────────────────────────────────────

#[account]
pub struct RouterConfig {
    pub admin: Pubkey,
    pub oracle: Pubkey,            // signs every execute_payment
    pub usdc_mint: Pubkey,
    pub platform_treasury: Pubkey, // receives platform fees
    pub platform_fee_bps: u16,
    pub is_paused: bool,
    pub bump: u8,
}

impl RouterConfig {
    // 8 + 4*32 + 2 + 1 + 1 + 9 pad
    pub const LEN: usize = 8 + 128 + 2 + 1 + 1 + 9;
    pub const SEED: &'static [u8] = b"router_config";
}

#[account]
pub struct MerchantSettlement {
    pub merchant: Pubkey,              // the agent/merchant earning payments
    pub agent_wallet_pda: Pubkey,      // linked AgentWallet PDA (default if none)
    pub has_active_credit: bool,       // if true → apply split_bps to repayment
    pub split_bps: u16,               // % of remainder sent to vault (0–5000)
    pub total_routed: u64,             // gross amount processed
    pub total_repaid: u64,             // cumulative vault repayments
    pub total_merchant_received: u64,  // cumulative net to merchant
    pub nonce: u64,                    // replay guard — must strictly increase
    pub is_active: bool,
    pub bump: u8,
}

impl MerchantSettlement {
    // 8 + 2*32 + 1 + 2 + 3*8 + 8 + 1 + 1 + 6 pad
    pub const LEN: usize = 8 + 64 + 1 + 2 + 24 + 8 + 1 + 1 + 6;
    pub const SEED: &'static [u8] = b"settlement";
}

// ─────────────────────────────────────────────────────────────────────────────
// Events
// ─────────────────────────────────────────────────────────────────────────────

#[event]
pub struct RouterInitialized {
    pub admin: Pubkey,
    pub oracle: Pubkey,
    pub platform_fee_bps: u16,
}

#[event]
pub struct SettlementActivated {
    pub merchant: Pubkey,
    pub split_bps: u16,
    pub has_active_credit: bool,
    pub agent_wallet_pda: Pubkey,
}

#[event]
pub struct PaymentRouted {
    pub merchant: Pubkey,
    pub total: u64,
    pub platform_fee: u64,
    pub repayment: u64,
    pub merchant_received: u64,
    pub nonce: u64,
}

#[event]
pub struct SplitUpdated {
    pub merchant: Pubkey,
    pub old_bps: u16,
    pub new_bps: u16,
}

#[event]
pub struct SettlementDeactivated {
    pub merchant: Pubkey,
}

// ─────────────────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────────────────

#[error_code]
pub enum RouterError {
    #[msg("Not admin")]
    NotAdmin,
    #[msg("Not oracle")]
    NotOracle,
    #[msg("Router is paused")]
    Paused,
    #[msg("Settlement is not active")]
    SettlementInactive,
    #[msg("Settlement is already active")]
    SettlementAlreadyActive,
    #[msg("Nonce must be strictly greater than the last recorded nonce")]
    InvalidNonce,
    #[msg("Split bps exceeds maximum of 5000 (50%)")]
    SplitTooHigh,
    #[msg("Amount must be > 0")]
    ZeroAmount,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Merchant USDC account does not belong to the settlement merchant")]
    InvalidMerchantAccount,
    #[msg("Vault config account is not owned by the vault program")]
    InvalidVaultConfig,
    #[msg("Payer USDC account does not belong to the oracle")]
    InvalidPayerAccount,
}

// ─────────────────────────────────────────────────────────────────────────────
// Program
// ─────────────────────────────────────────────────────────────────────────────

#[program]
pub mod krexa_payment_router {
    use super::*;

    // ── 1. initialize ──────────────────────────────────────────────────────

    pub fn initialize(ctx: Context<Initialize>, platform_fee_bps: u16) -> Result<()> {
        let cfg = &mut ctx.accounts.config;
        cfg.admin = ctx.accounts.admin.key();
        cfg.oracle = ctx.accounts.oracle.key();
        cfg.usdc_mint = ctx.accounts.usdc_mint.key();
        cfg.platform_treasury = ctx.accounts.platform_treasury.key();
        cfg.platform_fee_bps = platform_fee_bps;
        cfg.is_paused = false;
        cfg.bump = ctx.bumps.config;

        emit!(RouterInitialized {
            admin: cfg.admin,
            oracle: cfg.oracle,
            platform_fee_bps,
        });
        Ok(())
    }

    // ── 2. activate_settlement ─────────────────────────────────────────────
    // Oracle creates a MerchantSettlement PDA for a merchant/agent.
    // `agent_wallet_pda` = Pubkey::default() if the agent has no wallet yet.

    pub fn activate_settlement(
        ctx: Context<ActivateSettlement>,
        merchant: Pubkey,
        split_bps: u16,
        agent_wallet_pda: Pubkey,
    ) -> Result<()> {
        require!(!ctx.accounts.config.is_paused, RouterError::Paused);
        require!(split_bps <= MAX_SPLIT_BPS, RouterError::SplitTooHigh);

        let has_active_credit = agent_wallet_pda != Pubkey::default();

        let s = &mut ctx.accounts.settlement;
        s.merchant = merchant;
        s.agent_wallet_pda = agent_wallet_pda;
        s.has_active_credit = has_active_credit;
        s.split_bps = split_bps;
        s.total_routed = 0;
        s.total_repaid = 0;
        s.total_merchant_received = 0;
        s.nonce = 0;
        s.is_active = true;
        s.bump = ctx.bumps.settlement;

        emit!(SettlementActivated {
            merchant,
            split_bps,
            has_active_credit,
            agent_wallet_pda,
        });
        Ok(())
    }

    // ── 3. execute_payment ─────────────────────────────────────────────────
    //
    // Oracle-signed. Buyer has pre-approved `payer_usdc` via SPL token delegation
    // (or the oracle holds the payer's funds in escrow). The instruction atomically:
    //
    //   a) Validates nonce > settlement.nonce (replay protection).
    //   b) If has_active_credit && split_bps > 0:
    //        platform_fee = amount * platform_fee_bps / BPS_DENOMINATOR
    //        remainder    = amount - platform_fee
    //        repayment    = remainder * split_bps / BPS_DENOMINATOR
    //        merchant_amt = remainder - repayment
    //        Transfer platform_fee  → platform_treasury (payer signs)
    //        Transfer repayment     → vault token account, then CPI receive_repayment
    //        Transfer merchant_amt  → merchant_usdc (payer signs)
    //   c) Else (no credit or split_bps == 0):
    //        platform_fee = amount * platform_fee_bps / BPS_DENOMINATOR
    //        merchant_amt = amount - platform_fee
    //        Transfer platform_fee  → platform_treasury
    //        Transfer merchant_amt  → merchant_usdc
    //   d) Update nonce, totals.
    //   e) Emit PaymentRouted.

    pub fn execute_payment(
        ctx: Context<ExecutePayment>,
        merchant: Pubkey,
        amount: u64,
        nonce: u64,
    ) -> Result<()> {
        require!(!ctx.accounts.config.is_paused, RouterError::Paused);
        require!(amount > 0, RouterError::ZeroAmount);
        require!(ctx.accounts.settlement.is_active, RouterError::SettlementInactive);
        require!(nonce > ctx.accounts.settlement.nonce, RouterError::InvalidNonce);

        let cfg = &ctx.accounts.config;
        let split = &ctx.accounts.settlement;

        // ── fee maths ─────────────────────────────────────────────────────
        let platform_fee = (amount as u128)
            .checked_mul(cfg.platform_fee_bps as u128)
            .ok_or(RouterError::Overflow)?
            .checked_div(BPS_DENOMINATOR as u128)
            .ok_or(RouterError::Overflow)? as u64;

        let remainder = amount.saturating_sub(platform_fee);

        let (repayment, merchant_amount) =
            if split.has_active_credit && split.split_bps > 0 {
                let r = (remainder as u128)
                    .checked_mul(split.split_bps as u128)
                    .ok_or(RouterError::Overflow)?
                    .checked_div(BPS_DENOMINATOR as u128)
                    .ok_or(RouterError::Overflow)? as u64;
                (r, remainder.saturating_sub(r))
            } else {
                (0u64, remainder)
            };

        // ── a) platform fee → treasury ────────────────────────────────────
        if platform_fee > 0 {
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.payer_usdc.to_account_info(),
                        to: ctx.accounts.platform_treasury_token.to_account_info(),
                        authority: ctx.accounts.oracle.to_account_info(),
                    },
                ),
                platform_fee,
            )?;
        }

        // ── b) repayment → vault + CPI receive_repayment ─────────────────
        if repayment > 0 {
            // Move USDC from payer → vault token account first.
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.payer_usdc.to_account_info(),
                        to: ctx.accounts.vault_token.to_account_info(),
                        authority: ctx.accounts.oracle.to_account_info(),
                    },
                ),
                repayment,
            )?;

            // Notify vault of the repayment so it updates its accounting.
            // The router config PDA acts as `wallet_program_authority`
            // (vault was initialised with `wallet_program = routerConfigPda`
            //  OR we pass the config PDA and sign with its seeds).
            let bump = ctx.accounts.config.bump;
            let config_seeds: &[&[&[u8]]] = &[&[RouterConfig::SEED, &[bump]]];

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
                merchant, // agent key used as credit_line seed
                repayment,
            )?;
        }

        // ── c) net → merchant ─────────────────────────────────────────────
        if merchant_amount > 0 {
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.payer_usdc.to_account_info(),
                        to: ctx.accounts.merchant_usdc.to_account_info(),
                        authority: ctx.accounts.oracle.to_account_info(),
                    },
                ),
                merchant_amount,
            )?;
        }

        // ── d) update state ───────────────────────────────────────────────
        let s = &mut ctx.accounts.settlement;
        s.nonce = nonce;
        s.total_routed = s.total_routed.saturating_add(amount);
        s.total_repaid = s.total_repaid.saturating_add(repayment);
        s.total_merchant_received = s.total_merchant_received.saturating_add(merchant_amount);

        // ── e) event ──────────────────────────────────────────────────────
        emit!(PaymentRouted {
            merchant,
            total: amount,
            platform_fee,
            repayment,
            merchant_received: merchant_amount,
            nonce,
        });
        Ok(())
    }

    // ── 4. update_split ────────────────────────────────────────────────────
    // Oracle can dynamically adjust repayment split (e.g. as credit risk changes).

    pub fn update_split(
        ctx: Context<OracleAction>,
        merchant: Pubkey,
        new_split_bps: u16,
    ) -> Result<()> {
        require!(new_split_bps <= MAX_SPLIT_BPS, RouterError::SplitTooHigh);
        let s = &mut ctx.accounts.settlement;
        let old_bps = s.split_bps;
        s.split_bps = new_split_bps;
        // If split goes to 0, effectively pause credit repayment.
        s.has_active_credit = s.agent_wallet_pda != Pubkey::default() && new_split_bps > 0;
        emit!(SplitUpdated { merchant, old_bps, new_bps: new_split_bps });
        Ok(())
    }

    // ── 5. deactivate_settlement ───────────────────────────────────────────

    pub fn deactivate_settlement(
        ctx: Context<AdminAction>,
        merchant: Pubkey,
    ) -> Result<()> {
        require!(ctx.accounts.settlement.is_active, RouterError::SettlementInactive);
        ctx.accounts.settlement.is_active = false;
        emit!(SettlementDeactivated { merchant });
        Ok(())
    }

    // ── 5b. reactivate_settlement ───────────────────────────────────────────
    // SOL-033 fix: Allow reactivating previously deactivated settlements.

    pub fn reactivate_settlement(
        ctx: Context<OracleAction>,
        _merchant: Pubkey,
    ) -> Result<()> {
        require!(!ctx.accounts.config.is_paused, RouterError::Paused);
        require!(!ctx.accounts.settlement.is_active, RouterError::SettlementAlreadyActive);
        ctx.accounts.settlement.is_active = true;
        Ok(())
    }

    // ── 6. set_paused ──────────────────────────────────────────────────────

    pub fn set_paused(ctx: Context<AdminConfig>, paused: bool) -> Result<()> {
        ctx.accounts.config.is_paused = paused;
        Ok(())
    }

    // ── 7. update_config ─────────────────────────────────────────────────
    // Admin can rotate oracle, treasury, and fee params.

    pub fn update_config(
        ctx: Context<AdminConfig>,
        new_admin: Option<Pubkey>,
        new_oracle: Option<Pubkey>,
        new_platform_treasury: Option<Pubkey>,
        new_platform_fee_bps: Option<u16>,
    ) -> Result<()> {
        let cfg = &mut ctx.accounts.config;
        if let Some(admin) = new_admin {
            cfg.admin = admin;
        }
        if let Some(oracle) = new_oracle {
            cfg.oracle = oracle;
        }
        if let Some(treasury) = new_platform_treasury {
            cfg.platform_treasury = treasury;
        }
        if let Some(fee) = new_platform_fee_bps {
            cfg.platform_fee_bps = fee;
        }
        Ok(())
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Contexts
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = admin,
        space = RouterConfig::LEN,
        seeds = [RouterConfig::SEED],
        bump,
    )]
    pub config: Account<'info, RouterConfig>,

    pub usdc_mint: Account<'info, Mint>,

    /// Krexa treasury — pre-existing account, admin-controlled externally.
    #[account(token::mint = usdc_mint)]
    pub platform_treasury: Account<'info, TokenAccount>,

    /// The oracle pubkey that will sign payments. Stored in config; not required to sign init.
    /// CHECK: pubkey only stored, no signature needed at init time.
    pub oracle: UncheckedAccount<'info>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(merchant: Pubkey)]
pub struct ActivateSettlement<'info> {
    #[account(
        seeds = [RouterConfig::SEED],
        bump = config.bump,
        has_one = oracle @ RouterError::NotOracle,
    )]
    pub config: Account<'info, RouterConfig>,

    #[account(
        init,
        payer = oracle,
        space = MerchantSettlement::LEN,
        seeds = [MerchantSettlement::SEED, merchant.as_ref()],
        bump,
    )]
    pub settlement: Account<'info, MerchantSettlement>,

    #[account(mut)]
    pub oracle: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(merchant: Pubkey, amount: u64, nonce: u64)]
pub struct ExecutePayment<'info> {
    // ── Router state ──────────────────────────────────────────────────────
    #[account(
        seeds = [RouterConfig::SEED],
        bump = config.bump,
        has_one = oracle @ RouterError::NotOracle,
    )]
    pub config: Account<'info, RouterConfig>,

    #[account(
        mut,
        seeds = [MerchantSettlement::SEED, merchant.as_ref()],
        bump = settlement.bump,
    )]
    pub settlement: Account<'info, MerchantSettlement>,

    // ── Payment accounts ──────────────────────────────────────────────────
    /// Buyer's USDC — oracle must have delegate authority (or hold in escrow).
    /// SOL-064 fix: explicit owner constraint to prevent future refactoring mistakes.
    #[account(
        mut,
        token::mint = config.usdc_mint,
        constraint = payer_usdc.owner == oracle.key() @ RouterError::InvalidPayerAccount,
    )]
    pub payer_usdc: Account<'info, TokenAccount>,

    /// SOL-007 fix: Merchant's USDC account — must belong to settlement merchant or their wallet PDA.
    /// Previously had no owner validation — oracle could accidentally/maliciously route to wrong account.
    #[account(
        mut,
        token::mint = config.usdc_mint,
        constraint = merchant_usdc.owner == settlement.merchant
            || merchant_usdc.owner == settlement.agent_wallet_pda
            @ RouterError::InvalidMerchantAccount,
    )]
    pub merchant_usdc: Account<'info, TokenAccount>,

    /// Krexa treasury USDC.
    #[account(
        mut,
        address = config.platform_treasury,
    )]
    pub platform_treasury_token: Account<'info, TokenAccount>,

    // ── Vault CPI accounts (only used when repayment > 0) ────────────────
    /// SOL-008 fix: vault_config must be owned by the vault program (defense-in-depth).
    /// CHECK: Account data is validated by vault program via PDA seeds during CPI.
    /// We additionally verify the owner to prevent passing a spoofed account.
    #[account(
        mut,
        constraint = *vault_config.owner == vault_program.key() @ RouterError::InvalidVaultConfig,
    )]
    pub vault_config: UncheckedAccount<'info>,

    /// Vault's USDC pool token account — receives repayment.
    #[account(mut)]
    pub vault_token: Account<'info, TokenAccount>,

    /// Vault's insurance USDC token account.
    #[account(mut)]
    pub insurance_token: Account<'info, TokenAccount>,

    /// Agent's CreditLine PDA in the vault program.
    /// CHECK: validated by vault program (seeds = [b"credit_line", merchant])
    #[account(mut)]
    pub credit_line: UncheckedAccount<'info>,

    // ── Signers and programs ──────────────────────────────────────────────
    #[account(mut)]
    pub oracle: Signer<'info>,

    pub vault_program: Program<'info, krexa_credit_vault::program::KrexaCreditVault>,
    pub token_program: Program<'info, Token>,
}

/// Oracle-signed actions on an existing MerchantSettlement.
#[derive(Accounts)]
#[instruction(merchant: Pubkey)]
pub struct OracleAction<'info> {
    #[account(
        seeds = [RouterConfig::SEED],
        bump = config.bump,
        has_one = oracle @ RouterError::NotOracle,
    )]
    pub config: Account<'info, RouterConfig>,

    #[account(
        mut,
        seeds = [MerchantSettlement::SEED, merchant.as_ref()],
        bump = settlement.bump,
    )]
    pub settlement: Account<'info, MerchantSettlement>,

    pub oracle: Signer<'info>,
}

/// Admin-only actions on an existing MerchantSettlement.
#[derive(Accounts)]
#[instruction(merchant: Pubkey)]
pub struct AdminAction<'info> {
    #[account(
        seeds = [RouterConfig::SEED],
        bump = config.bump,
        has_one = admin @ RouterError::NotAdmin,
    )]
    pub config: Account<'info, RouterConfig>,

    #[account(
        mut,
        seeds = [MerchantSettlement::SEED, merchant.as_ref()],
        bump = settlement.bump,
    )]
    pub settlement: Account<'info, MerchantSettlement>,

    pub admin: Signer<'info>,
}

/// Admin-only actions on RouterConfig itself (e.g. pause).
#[derive(Accounts)]
pub struct AdminConfig<'info> {
    #[account(
        mut,
        seeds = [RouterConfig::SEED],
        bump = config.bump,
        has_one = admin @ RouterError::NotAdmin,
    )]
    pub config: Account<'info, RouterConfig>,

    pub admin: Signer<'info>,
}
