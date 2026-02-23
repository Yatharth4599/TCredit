use anchor_lang::prelude::*;

use crate::state::*;
use crate::errors::TigerPayError;
use crate::events::*;
use crate::{UpdateCreditScore, MAX_CREDIT_SCORE};

/// Credit tier thresholds (FairScale 0-1000 scale).
/// These determine access level for vault creation and pool eligibility.
pub const TIER_A_MIN: u16 = 750;  // Full access, best rates
pub const TIER_B_MIN: u16 = 600;  // Standard access
pub const TIER_C_MIN: u16 = 450;  // Restricted (lower max vault target)
// Below 450 = Tier D: blocked from new vault creation

/// Updates a merchant's on-chain credit score from the FairScale oracle relay.
/// Only callable by platform authority. Score is on a 0-1000 scale.
/// Tier is automatically derived from score thresholds.
pub fn update_credit_score(
    ctx: Context<UpdateCreditScore>,
    new_score: u16,
) -> Result<()> {
    require!(new_score <= MAX_CREDIT_SCORE, TigerPayError::InvalidCreditScore);
    
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

/// Derives credit tier from raw score:
///   3 = A (750+): full access, best rates
///   2 = B (600-749): standard access
///   1 = C (450-599): restricted, lower limits
///   0 = D (0-449): blocked from new vaults
fn derive_tier(score: u16) -> u8 {
    if score >= TIER_A_MIN { 3 }
    else if score >= TIER_B_MIN { 2 }
    else if score >= TIER_C_MIN { 1 }
    else { 0 }
}
