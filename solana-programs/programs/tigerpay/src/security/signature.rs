use anchor_lang::prelude::*;

/// Message structure for x402 payment proof signed by oracle
/// This ensures the oracle cannot be bypassed and provides replay protection
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct X402PaymentMessage {
    /// Unique nonce for this payment (prevents replay)
    pub nonce: u64,
    /// Vault receiving the repayment
    pub vault: Pubkey,
    /// Payment amount in base units
    pub amount: u64,
    /// Original payment source (x402 endpoint identifier)
    pub payment_source: [u8; 32],
    /// Timestamp of the payment event
    pub timestamp: i64,
    /// Repayment rate applied (basis points)
    pub repayment_rate_bps: u16,
}

/// Error codes for signature verification
#[error_code]
pub enum SignatureError {
    #[msg("Invalid signature length")]
    InvalidSignatureLength,
    #[msg("Signature verification failed")]
    SignatureVerificationFailed,
    #[msg("Message hash computation failed")]
    MessageHashFailed,
    #[msg("Nonce already used - replay attack detected")]
    NonceAlreadyUsed,
    #[msg("Message timestamp too old")]
    MessageTooOld,
    #[msg("Message timestamp in the future")]
    MessageInFuture,
    #[msg("Vault mismatch in signed message")]
    VaultMismatch,
    #[msg("Amount mismatch in signed message")]
    AmountMismatch,
}

/// Maximum age for a signed message (5 minutes)
pub const MAX_MESSAGE_AGE_SECS: i64 = 300;

/// Verify an Ed25519 signature against a message
/// Returns the message if signature is valid
pub fn verify_oracle_signature(
    message: &X402PaymentMessage,
    signature: &[u8],
    oracle_pubkey: &Pubkey,
) -> Result<()> {
    // Signature must be 64 bytes for Ed25519
    require!(
        signature.len() == 64,
        SignatureError::InvalidSignatureLength
    );

    // Serialize the message for hashing
    let message_bytes = message.try_to_vec()
        .map_err(|_| SignatureError::MessageHashFailed)?;

    // Use Solana's built-in Ed25519 signature verification
    // This is done via a sysvar instruction that gets verified by the runtime
    // For now, we'll use a placeholder that will be replaced with actual verification

    // Note: In production, this would use `solana_program::ed25519::verify`
    // which requires the Ed25519SigVerify1111111111111111111111111111 program

    // Placeholder: In actual implementation, call the Ed25519 verification program
    // For development/testing, we log the verification attempt
    msg!("Oracle signature verification for vault: {}", message.vault);
    msg!("Nonce: {}, Amount: {}", message.nonce, message.amount);

    // TODO: Replace with actual Ed25519 verification
    // This requires including the Ed25519 program in the instruction
    // and passing the signature through CPI

    Ok(())
}

/// Validate that a signed message matches the expected parameters
pub fn validate_message_params(
    message: &X402PaymentMessage,
    expected_vault: &Pubkey,
    expected_amount: u64,
    current_time: i64,
) -> Result<()> {
    // Verify vault matches
    require!(
        message.vault == *expected_vault,
        SignatureError::VaultMismatch
    );

    // Verify amount (allow any amount up to expected for flexibility)
    require!(
        message.amount > 0 && message.amount <= expected_amount,
        SignatureError::AmountMismatch
    );

    // Verify timestamp is within acceptable range
    let age = current_time - message.timestamp;
    require!(
        age >= 0,
        SignatureError::MessageInFuture
    );
    require!(
        age <= MAX_MESSAGE_AGE_SECS,
        SignatureError::MessageTooOld
    );

    Ok(())
}

/// Compute a unique hash for replay protection tracking
pub fn compute_payment_id(vault: &Pubkey, nonce: u64) -> [u8; 32] {
    use anchor_lang::solana_program::hash::hashv;

    let data = [
        vault.to_bytes().as_ref(),
        &nonce.to_le_bytes(),
    ];

    let hash = hashv(&data);
    hash.to_bytes()
}