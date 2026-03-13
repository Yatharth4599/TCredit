//! # krexa-agent-wallet (THE CORE)
//!
//! PDA wallets for AI agents. 8 safety layers on every outbound payment.
//! Collateral earns yield in the credit vault. Full liquidation lifecycle.

use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};
use krexa_agent_registry::{AgentProfile, RegistryConfig};
use krexa_credit_vault::{VaultConfig, DepositPosition, CreditLine};
use krexa_venue_whitelist::WhitelistedVenue;

pub mod state;
pub mod events;
pub mod errors;
pub mod instructions;
pub mod utils;

pub use state::*;
pub use events::*;
pub use errors::WalletError;

declare_id!("35t8yWLsUZNTLT71ej7DF59P81HrtZTx2uZeMhwuhhf6");

// ═════════════════════════════════════════════════════════════════════════════
// ACCOUNTS STRUCTS — must be defined at crate root for #[program] macro
// ═════════════════════════════════════════════════════════════════════════════

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = admin,
        space = WalletConfig::LEN,
        seeds = [WalletConfig::SEED],
        bump,
    )]
    pub config: Account<'info, WalletConfig>,

    /// CHECK: just stored as the USDC mint address
    pub usdc_mint: AccountInfo<'info>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateWallet<'info> {
    #[account(
        mut,
        seeds = [WalletConfig::SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, WalletConfig>,

    #[account(
        init,
        payer = owner,
        space = AgentWallet::LEN,
        seeds = [AgentWallet::SEED, agent.key().as_ref()],
        bump,
    )]
    pub agent_wallet: Account<'info, AgentWallet>,

    #[account(
        init,
        payer = owner,
        token::mint = usdc_mint,
        token::authority = agent_wallet,
        seeds = [AgentWallet::USDC_SEED, agent.key().as_ref()],
        bump,
    )]
    pub wallet_usdc: Account<'info, TokenAccount>,

    #[account(address = config.usdc_mint)]
    pub usdc_mint: Account<'info, Mint>,

    #[account(
        seeds = [b"registry_config"],
        seeds::program = config.agent_registry_program,
        bump = registry_config.bump,
    )]
    pub registry_config: Account<'info, RegistryConfig>,

    #[account(
        mut,
        seeds = [b"agent_profile", agent.key().as_ref()],
        seeds::program = config.agent_registry_program,
        bump = agent_profile.bump,
        constraint = agent_profile.agent == agent.key() @ WalletError::AgentNotEligible,
    )]
    pub agent_profile: Account<'info, AgentProfile>,

    pub agent: Signer<'info>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub registry_program: Program<'info, krexa_agent_registry::program::KrexaAgentRegistry>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(
        seeds = [WalletConfig::SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, WalletConfig>,

    #[account(
        mut,
        seeds = [AgentWallet::SEED, agent_wallet.agent.as_ref()],
        bump = agent_wallet.bump,
        has_one = owner @ WalletError::UnauthorizedOwner,
    )]
    pub agent_wallet: Account<'info, AgentWallet>,

    #[account(
        mut,
        seeds = [b"vault_config"],
        seeds::program = config.credit_vault_program,
        bump = vault_config.bump,
    )]
    pub vault_config: Account<'info, VaultConfig>,

    #[account(
        mut,
        address = vault_config.vault_token_account,
    )]
    pub vault_token: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"collateral", agent_wallet.agent.as_ref()],
        seeds::program = config.credit_vault_program,
        bump,
    )]
    pub collateral_position: Account<'info, DepositPosition>,

    #[account(
        mut,
        token::mint = config.usdc_mint,
        token::authority = owner,
    )]
    pub owner_usdc: Account<'info, TokenAccount>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub vault_program: Program<'info, krexa_credit_vault::program::KrexaCreditVault>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RequestCredit<'info> {
    #[account(
        seeds = [WalletConfig::SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, WalletConfig>,

    #[account(
        mut,
        seeds = [AgentWallet::SEED, agent_wallet.agent.as_ref()],
        bump = agent_wallet.bump,
    )]
    pub agent_wallet: Account<'info, AgentWallet>,

    #[account(
        mut,
        seeds = [AgentWallet::USDC_SEED, agent_wallet.agent.as_ref()],
        bump = agent_wallet.usdc_bump,
        address = agent_wallet.wallet_usdc,
    )]
    pub wallet_usdc: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"vault_config"],
        seeds::program = config.credit_vault_program,
        bump = vault_config.bump,
    )]
    pub vault_config: Account<'info, VaultConfig>,

    #[account(
        mut,
        address = vault_config.vault_token_account,
    )]
    pub vault_token: Account<'info, TokenAccount>,

    /// CHECK: credit_line may not exist yet — created by vault.extend_credit CPI inside this ix.
    /// Seeds and discriminator are validated by the vault program during the CPI.
    #[account(mut)]
    pub credit_line: UncheckedAccount<'info>,

    #[account(mut, address = vault_config.oracle @ WalletError::NotOracle)]
    pub oracle: Signer<'info>,

    pub vault_program: Program<'info, krexa_credit_vault::program::KrexaCreditVault>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(venue_program_id: Pubkey)]
pub struct ExecuteTrade<'info> {
    #[account(
        seeds = [WalletConfig::SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, WalletConfig>,

    #[account(
        mut,
        seeds = [AgentWallet::SEED, agent_wallet.agent.as_ref()],
        bump = agent_wallet.bump,
        has_one = agent @ WalletError::UnauthorizedAgent,
    )]
    pub agent_wallet: Account<'info, AgentWallet>,

    #[account(
        mut,
        seeds = [AgentWallet::USDC_SEED, agent_wallet.agent.as_ref()],
        bump = agent_wallet.usdc_bump,
        address = agent_wallet.wallet_usdc,
    )]
    pub wallet_usdc: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = config.usdc_mint,
    )]
    pub venue_token: Account<'info, TokenAccount>,

    #[account(
        seeds = [b"venue", venue_program_id.as_ref()],
        seeds::program = config.venue_whitelist_program,
        bump = venue_entry.bump,
        constraint = venue_entry.is_active @ WalletError::VenueNotWhitelisted,
    )]
    pub venue_entry: Account<'info, WhitelistedVenue>,

    #[account(
        seeds = [b"vault_config"],
        seeds::program = config.credit_vault_program,
        bump = vault_config.bump,
    )]
    pub vault_config: Account<'info, VaultConfig>,

    pub agent: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(facilitator: Pubkey)]
pub struct PayX402<'info> {
    #[account(
        seeds = [WalletConfig::SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, WalletConfig>,

    #[account(
        mut,
        seeds = [AgentWallet::SEED, agent_wallet.agent.as_ref()],
        bump = agent_wallet.bump,
        has_one = agent @ WalletError::UnauthorizedAgent,
    )]
    pub agent_wallet: Account<'info, AgentWallet>,

    #[account(
        mut,
        seeds = [AgentWallet::USDC_SEED, agent_wallet.agent.as_ref()],
        bump = agent_wallet.usdc_bump,
        address = agent_wallet.wallet_usdc,
    )]
    pub wallet_usdc: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = config.usdc_mint,
    )]
    pub facilitator_token: Account<'info, TokenAccount>,

    #[account(
        seeds = [b"venue", facilitator.as_ref()],
        seeds::program = config.venue_whitelist_program,
        bump = venue_entry.bump,
        constraint = venue_entry.is_active @ WalletError::VenueNotWhitelisted,
    )]
    pub venue_entry: Account<'info, WhitelistedVenue>,

    #[account(
        seeds = [b"vault_config"],
        seeds::program = config.credit_vault_program,
        bump = vault_config.bump,
    )]
    pub vault_config: Account<'info, VaultConfig>,

    pub agent: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(
        seeds = [WalletConfig::SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, WalletConfig>,

    #[account(
        mut,
        seeds = [AgentWallet::SEED, agent_wallet.agent.as_ref()],
        bump = agent_wallet.bump,
        has_one = owner @ WalletError::UnauthorizedOwner,
    )]
    pub agent_wallet: Account<'info, AgentWallet>,

    #[account(
        mut,
        seeds = [AgentWallet::USDC_SEED, agent_wallet.agent.as_ref()],
        bump = agent_wallet.usdc_bump,
        address = agent_wallet.wallet_usdc,
    )]
    pub wallet_usdc: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = config.usdc_mint,
        token::authority = owner,
    )]
    pub owner_usdc: Account<'info, TokenAccount>,

    #[account(
        seeds = [b"vault_config"],
        seeds::program = config.credit_vault_program,
        bump = vault_config.bump,
    )]
    pub vault_config: Account<'info, VaultConfig>,

    pub owner: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Repay<'info> {
    #[account(
        seeds = [WalletConfig::SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, WalletConfig>,

    #[account(
        mut,
        seeds = [AgentWallet::SEED, agent_wallet.agent.as_ref()],
        bump = agent_wallet.bump,
    )]
    pub agent_wallet: Account<'info, AgentWallet>,

    #[account(
        mut,
        seeds = [AgentWallet::USDC_SEED, agent_wallet.agent.as_ref()],
        bump = agent_wallet.usdc_bump,
        address = agent_wallet.wallet_usdc,
    )]
    pub wallet_usdc: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"vault_config"],
        seeds::program = config.credit_vault_program,
        bump = vault_config.bump,
    )]
    pub vault_config: Account<'info, VaultConfig>,

    #[account(
        mut,
        address = vault_config.vault_token_account,
    )]
    pub vault_token: Account<'info, TokenAccount>,

    #[account(
        mut,
        address = vault_config.insurance_token_account,
    )]
    pub insurance_token: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"credit_line", agent_wallet.agent.as_ref()],
        seeds::program = config.credit_vault_program,
        bump = credit_line.bump,
    )]
    pub credit_line: Account<'info, CreditLine>,

    #[account(
        seeds = [b"registry_config"],
        seeds::program = config.agent_registry_program,
        bump = registry_config.bump,
    )]
    pub registry_config: Account<'info, RegistryConfig>,

    #[account(
        mut,
        seeds = [b"agent_profile", agent_wallet.agent.as_ref()],
        seeds::program = config.agent_registry_program,
        bump = agent_profile.bump,
    )]
    pub agent_profile: Account<'info, AgentProfile>,

    /// Agent or owner may repay
    pub caller: Signer<'info>,

    pub vault_program: Program<'info, krexa_credit_vault::program::KrexaCreditVault>,
    pub registry_program: Program<'info, krexa_agent_registry::program::KrexaAgentRegistry>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CheckHealth<'info> {
    #[account(
        seeds = [WalletConfig::SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, WalletConfig>,

    #[account(
        mut,
        seeds = [AgentWallet::SEED, agent_wallet.agent.as_ref()],
        bump = agent_wallet.bump,
    )]
    pub agent_wallet: Account<'info, AgentWallet>,

    #[account(address = agent_wallet.wallet_usdc)]
    pub wallet_usdc: Account<'info, TokenAccount>,

    #[account(
        seeds = [b"vault_config"],
        seeds::program = config.credit_vault_program,
        bump = vault_config.bump,
    )]
    pub vault_config: Account<'info, VaultConfig>,

    pub caller: Signer<'info>,
}

#[derive(Accounts)]
pub struct Deleverage<'info> {
    #[account(
        seeds = [WalletConfig::SEED],
        bump = config.bump,
        has_one = keeper @ WalletError::NotKeeper,
    )]
    pub config: Account<'info, WalletConfig>,

    #[account(
        mut,
        seeds = [AgentWallet::SEED, agent_wallet.agent.as_ref()],
        bump = agent_wallet.bump,
    )]
    pub agent_wallet: Account<'info, AgentWallet>,

    #[account(address = agent_wallet.wallet_usdc)]
    pub wallet_usdc: Account<'info, TokenAccount>,

    #[account(
        seeds = [b"vault_config"],
        seeds::program = config.credit_vault_program,
        bump = vault_config.bump,
    )]
    pub vault_config: Account<'info, VaultConfig>,

    pub keeper: Signer<'info>,
}

#[derive(Accounts)]
pub struct Liquidate<'info> {
    #[account(
        seeds = [WalletConfig::SEED],
        bump = config.bump,
        has_one = keeper @ WalletError::NotKeeper,
    )]
    pub config: Account<'info, WalletConfig>,

    #[account(
        mut,
        seeds = [AgentWallet::SEED, agent_wallet.agent.as_ref()],
        bump = agent_wallet.bump,
    )]
    pub agent_wallet: Account<'info, AgentWallet>,

    #[account(
        mut,
        seeds = [AgentWallet::USDC_SEED, agent_wallet.agent.as_ref()],
        bump = agent_wallet.usdc_bump,
        address = agent_wallet.wallet_usdc,
    )]
    pub wallet_usdc: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"vault_config"],
        seeds::program = config.credit_vault_program,
        bump = vault_config.bump,
    )]
    pub vault_config: Account<'info, VaultConfig>,

    #[account(mut, address = vault_config.vault_token_account)]
    pub vault_token: Account<'info, TokenAccount>,

    #[account(mut, address = vault_config.insurance_token_account)]
    pub insurance_token: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"credit_line", agent_wallet.agent.as_ref()],
        seeds::program = config.credit_vault_program,
        bump = credit_line.bump,
    )]
    pub credit_line: Account<'info, CreditLine>,

    #[account(
        seeds = [b"registry_config"],
        seeds::program = config.agent_registry_program,
        bump = registry_config.bump,
    )]
    pub registry_config: Account<'info, RegistryConfig>,

    #[account(
        mut,
        seeds = [b"agent_profile", agent_wallet.agent.as_ref()],
        seeds::program = config.agent_registry_program,
        bump = agent_profile.bump,
    )]
    pub agent_profile: Account<'info, AgentProfile>,

    #[account(mut, token::mint = config.usdc_mint)]
    pub keeper_usdc: Account<'info, TokenAccount>,

    #[account(mut, token::mint = config.usdc_mint)]
    pub owner_usdc: Account<'info, TokenAccount>,

    pub keeper: Signer<'info>,

    pub vault_program: Program<'info, krexa_credit_vault::program::KrexaCreditVault>,
    pub registry_program: Program<'info, krexa_agent_registry::program::KrexaAgentRegistry>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct FreezeWallet<'info> {
    #[account(
        seeds = [WalletConfig::SEED],
        bump = config.bump,
        has_one = admin @ WalletError::NotAdmin,
    )]
    pub config: Account<'info, WalletConfig>,

    #[account(
        mut,
        seeds = [AgentWallet::SEED, agent_wallet.agent.as_ref()],
        bump = agent_wallet.bump,
    )]
    pub agent_wallet: Account<'info, AgentWallet>,

    pub admin: Signer<'info>,
}

// ═════════════════════════════════════════════════════════════════════════════
// PROGRAM MODULE
// ═════════════════════════════════════════════════════════════════════════════

#[program]
pub mod krexa_agent_wallet {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        keeper: Pubkey,
        credit_vault_program: Pubkey,
        agent_registry_program: Pubkey,
        venue_whitelist_program: Pubkey,
        payment_router_program: Pubkey,
    ) -> Result<()> {
        instructions::initialize::handle(
            ctx, keeper, credit_vault_program,
            agent_registry_program, venue_whitelist_program, payment_router_program,
        )
    }

    pub fn create_wallet(ctx: Context<CreateWallet>, daily_spend_limit: u64) -> Result<()> {
        instructions::create_wallet::handle(ctx, daily_spend_limit)
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        instructions::deposit::handle(ctx, amount)
    }

    pub fn request_credit(
        ctx: Context<RequestCredit>,
        amount: u64,
        rate_bps: u16,
        credit_level: u8,
        collateral_value: u64,
    ) -> Result<()> {
        instructions::request_credit::handle(ctx, amount, rate_bps, credit_level, collateral_value)
    }

    pub fn execute_trade(
        ctx: Context<ExecuteTrade>,
        venue_program_id: Pubkey,
        amount: u64,
        trade_data: Vec<u8>,
    ) -> Result<()> {
        instructions::execute_trade::handle(ctx, venue_program_id, amount, trade_data)
    }

    pub fn pay_x402(
        ctx: Context<PayX402>,
        facilitator: Pubkey,
        recipient: Pubkey,
        amount: u64,
        memo: [u8; 32],
    ) -> Result<()> {
        instructions::pay_x402::handle(ctx, facilitator, recipient, amount, memo)
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        instructions::withdraw::handle(ctx, amount)
    }

    pub fn repay(ctx: Context<Repay>, amount: u64) -> Result<()> {
        instructions::repay::handle(ctx, amount)
    }

    pub fn check_health(ctx: Context<CheckHealth>) -> Result<()> {
        instructions::check_health::handle(ctx)
    }

    pub fn deleverage(ctx: Context<Deleverage>) -> Result<()> {
        instructions::deleverage::handle(ctx)
    }

    pub fn liquidate(ctx: Context<Liquidate>) -> Result<()> {
        instructions::liquidate::handle(ctx)
    }

    pub fn freeze_wallet(ctx: Context<FreezeWallet>) -> Result<()> {
        instructions::freeze::handle_freeze(ctx)
    }

    pub fn unfreeze_wallet(ctx: Context<FreezeWallet>) -> Result<()> {
        instructions::freeze::handle_unfreeze(ctx)
    }
}
