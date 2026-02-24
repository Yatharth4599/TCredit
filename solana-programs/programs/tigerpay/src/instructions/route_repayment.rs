use anchor_lang::prelude::*;
use anchor_lang::solana_program::hash::hashv;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::state::*;
use crate::errors::TigerPayError;
use crate::events::*;
use crate::RouteRepayment;
use crate::{REPAYMENT_SOURCE_X402, REPAYMENT_INTERVAL_SECS, MAX_MESSAGE_AGE_SECS};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct X402PaymentProof {
    pub nonce: u64,
    pub amount: u64,
    pub timestamp: i64,
    pub payment_source: [u8; 32],
    pub signature: [u8; 64],
}

pub fn route_repayment(
    ctx: Context<RouteRepayment>,
    amount: u64,
    proof: Option<X402PaymentProof>,
) -> Result<()> {
    let settlement = &mut ctx.accounts.settlement;
    let vault = &mut ctx.accounts.vault;
    let clock = Clock::get()?;

    require!(settlement.is_active(), TigerPayError::SettlementNotActive);
    require!(
        vault.is_active() || vault.is_repaying(),
        TigerPayError::InvalidVaultState
    );
    require!(amount > 0, TigerPayError::InvalidRepaymentAmount);
    require!(
        amount <= settlement.max_single_payment,
        TigerPayError::InvalidRepaymentAmount
    );

    if let Some(ref p) = proof {
        require!(
            p.nonce > settlement.nonce,
            TigerPayError::NonceAlreadyUsed
        );
        require!(
            clock.unix_timestamp - p.timestamp <= MAX_MESSAGE_AGE_SECS,
            TigerPayError::SignatureExpired
        );

        let payment_id = compute_payment_id(&vault.key(), p.nonce);
        require!(
            settlement.check_replay(payment_id),
            TigerPayError::NonceAlreadyUsed
        );
    }

    require!(
        settlement.check_rate_limit(clock.unix_timestamp),
        TigerPayError::RateLimitExceeded
    );

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.oracle_token_account.to_account_info(),
                to: ctx.accounts.vault_token_account.to_account_info(),
                authority: ctx.accounts.oracle_authority.to_account_info(),
            },
        ),
        amount,
    )?;

    vault.total_repaid = vault.total_repaid
        .checked_add(amount)
        .ok_or(TigerPayError::ArithmeticOverflow)?;
    vault.repayment_source = REPAYMENT_SOURCE_X402;

    settlement.total_routed = settlement.total_routed
        .checked_add(amount)
        .ok_or(TigerPayError::ArithmeticOverflow)?;
    settlement.total_payments = settlement.total_payments
        .checked_add(1)
        .ok_or(TigerPayError::ArithmeticOverflow)?;

    if let Some(ref p) = proof {
        let payment_id = compute_payment_id(&vault.key(), p.nonce);
        settlement.record_payment(payment_id, clock.unix_timestamp);
    }

    let late_fee = vault.calculate_late_fee(clock.unix_timestamp);
    if late_fee > 0 {
        vault.total_late_fees = vault.total_late_fees
            .checked_add(late_fee)
            .ok_or(TigerPayError::ArithmeticOverflow)?;
        vault.total_to_repay = vault.total_to_repay
            .checked_add(late_fee)
            .ok_or(TigerPayError::ArithmeticOverflow)?;
        msg!("Late fee applied: {}", late_fee);
    }

    if vault.next_payment_due > 0 && clock.unix_timestamp >= vault.next_payment_due {
        vault.next_payment_due = clock.unix_timestamp + REPAYMENT_INTERVAL_SECS;
    }

    msg!("Route repayment: {} via x402 for vault {}", amount, vault.key());

    if vault.total_repaid >= vault.total_to_repay {
        vault.state = VaultState::Completed;
        vault.next_payment_due = 0;
        msg!("Vault COMPLETED");
    } else if vault.state == VaultState::Active {
        vault.state = VaultState::Repaying;
        if vault.next_payment_due == 0 {
            vault.next_payment_due = clock.unix_timestamp + REPAYMENT_INTERVAL_SECS;
        }
    }

    emit!(RepaymentRouted {
        vault: vault.key(),
        amount,
        source: 1,
        total_repaid: vault.total_repaid,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

fn compute_payment_id(vault: &Pubkey, nonce: u64) -> [u8; 32] {
    let data = [
        vault.to_bytes().as_ref(),
        &nonce.to_le_bytes(),
    ];
    hashv(&data).to_bytes()
}