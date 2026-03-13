/// Compute the health factor in BPS (10_000 = 1.0x).
///
/// health_factor = total_value / total_debt
/// total_value   = wallet_usdc_balance + collateral_value
/// collateral_value = shares * vault_total_deposits / vault_total_shares
///
/// Returns u16::MAX when total_debt == 0 (infinite health).
pub fn compute_health(
    wallet_usdc_balance: u64,
    collateral_shares: u64,
    vault_total_deposits: u64,
    vault_total_shares: u64,
    total_debt: u64,
) -> u16 {
    if total_debt == 0 {
        return u16::MAX;
    }

    let collateral_value = if vault_total_shares == 0 {
        collateral_shares // fallback 1:1
    } else {
        (collateral_shares as u128
            * vault_total_deposits as u128
            / vault_total_shares as u128) as u64
    };

    let total_value = wallet_usdc_balance.saturating_add(collateral_value);

    // HF in BPS — clamp to u16::MAX
    let hf = (total_value as u128)
        .checked_mul(10_000)
        .unwrap_or(u128::MAX)
        .checked_div(total_debt as u128)
        .unwrap_or(0)
        .min(u16::MAX as u128);

    hf as u16
}

/// Projected health AFTER spending `amount` from wallet_usdc.
/// Used as a pre-flight check in execute_trade and pay_x402.
pub fn projected_health(
    wallet_usdc_balance: u64,
    spend_amount: u64,
    collateral_shares: u64,
    vault_total_deposits: u64,
    vault_total_shares: u64,
    total_debt: u64,
) -> u16 {
    let projected_balance = wallet_usdc_balance.saturating_sub(spend_amount);
    compute_health(
        projected_balance,
        collateral_shares,
        vault_total_deposits,
        vault_total_shares,
        total_debt,
    )
}

/// Collateral value in USDC from shares.
pub fn collateral_value_usdc(
    shares: u64,
    vault_total_deposits: u64,
    vault_total_shares: u64,
) -> u64 {
    if vault_total_shares == 0 {
        return shares;
    }
    (shares as u128 * vault_total_deposits as u128 / vault_total_shares as u128) as u64
}
