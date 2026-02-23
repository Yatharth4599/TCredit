use anchor_lang::prelude::*;

use crate::state::*;
use crate::errors::TigerPayError;
use crate::events::*;
use crate::UpdateCreditScore;

// Credit tier thresholds (FairScale 0-1000 scale)
pub const TIER_A_MIN: u16 = 750;  // A: 750-1000 — full access
pub const TIER_B_MIN: u16 = 600;  // B: 600-749  — standard access
pub const TIER_C_MIN: u16 = 450;  // C: 450-599  — restricted (lower max vault target)
pub const TIER_D_MAX: u16 = 449;  // D: 0-449    — blocked from new vaults

/// Updates a merchant's credit score from the FairScale oracle.
/// Only the platform authority (acting as oracle relay) can call this.
/// Score is on a 0-1000 scale. Tier is automatically derived.
pub fn update_credit_score(
    ctx: Context<UpdateCreditScore>,
    new_score: u16,
) -> Result<()> {
    require!(new_score <= 1000, TigerPayError::InvalidInterestRate); // reusing range error
    
    let merchant_profile = &mut ctx.accounts.merchant_profile;
    let clock = Clock::get()?;

    let old_score = merchant_profile.credit_score;
    let new_tier = derive_tier(new_score);

    merchant_profile.credit_score = new_score;
    merchant_profile.credit_tier = new_tier;
    merchant_profile.credit_updated_at = clock.unix_timestamp;

    emit!(CreditScoreUpdated {
        merchant: ctx.accounts.merchant.key(),
        score: new_score,
        tier: new_tier,
    });

    msg!(
        "Credit score updated: {} -> {} (tier {}). Merchant: {}",
        old_score, new_score, new_tier, ctx.accounts.merchant.key()
    );
    Ok(())
}

/// Derives tier from score:
/// 3=A (750+), 2=B (600+), 1=C (450+), 0=D (below 450)
fn derive_tier(score: u16) -> u8 {
    if score >= TIER_A_MIN { 3 }
    else if score >= TIER_B_MIN { 2 }
    else if score >= TIER_C_MIN { 1 }
    else { 0 }
}
