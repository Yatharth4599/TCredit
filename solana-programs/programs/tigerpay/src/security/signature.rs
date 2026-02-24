use anchor_lang::prelude::*;
use anchor_lang::solana_program::ed25519_program;
use anchor_lang::solana_program::instruction::Instruction;
use anchor_lang::solana_program::sysvar::instructions as ixs_sysvar;

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
    #[msg("Ed25519 program not found in transaction")]
    Ed25519ProgramNotFound,
    #[msg("Invalid Ed25519 instruction data")]
    InvalidEd25519InstructionData,
}

/// Maximum age for a signed message (5 minutes)
pub const MAX_MESSAGE_AGE_SECS: i64 = 300;

/// Verify an Ed25519 signature by introspecting the transaction's instruction list.
/// The caller must include an Ed25519SigVerify instruction in the same transaction
/// prior to this instruction. This function verifies that the Ed25519 program
/// validated the oracle's signature over the serialized message.
pub fn verify_oracle_signature(
    message: &X402PaymentMessage,
    signature: &[u8],
    oracle_pubkey: &Pubkey,
    instructions_sysvar: &AccountInfo,
) -> Result<()> {
    require!(
        signature.len() == 64,
        SignatureError::InvalidSignatureLength
    );

    let message_bytes = message.try_to_vec()
        .map_err(|_| SignatureError::MessageHashFailed)?;

    // Scan preceding instructions for a matching Ed25519SigVerify instruction
    let current_ix_index = ixs_sysvar::load_current_index_checked(instructions_sysvar)
        .map_err(|_| SignatureError::Ed25519ProgramNotFound)?;

    let mut found = false;
    for i in 0..current_ix_index {
        let ix: Instruction = ixs_sysvar::load_instruction_at_checked(i as usize, instructions_sysvar)
            .map_err(|_| SignatureError::Ed25519ProgramNotFound)?;

        if ix.program_id != ed25519_program::ID {
            continue;
        }

        // Ed25519 instruction data layout (per Solana docs):
        // [0..2]   num_signatures (u16 LE)
        // [2..4]   padding
        // For each signature:
        // [4..6]   signature_offset (u16 LE)
        // [6..8]   signature_ix_index (u16 LE)
        // [8..10]  pubkey_offset (u16 LE)
        // [10..12] pubkey_ix_index (u16 LE)
        // [12..14] message_data_offset (u16 LE)
        // [14..16] message_data_size (u16 LE)
        // [16..18] message_ix_index (u16 LE)
        // Then: signature (64 bytes), pubkey (32 bytes), message (variable)
        if ix.data.len() < 16 + 64 + 32 {
            continue;
        }

        let sig_offset = u16::from_le_bytes([ix.data[4], ix.data[5]]) as usize;
        let pk_offset = u16::from_le_bytes([ix.data[8], ix.data[9]]) as usize;
        let msg_offset = u16::from_le_bytes([ix.data[12], ix.data[13]]) as usize;
        let msg_size = u16::from_le_bytes([ix.data[14], ix.data[15]]) as usize;

        if sig_offset + 64 > ix.data.len()
            || pk_offset + 32 > ix.data.len()
            || msg_offset + msg_size > ix.data.len()
        {
            continue;
        }

        let ix_sig = &ix.data[sig_offset..sig_offset + 64];
        let ix_pk = &ix.data[pk_offset..pk_offset + 32];
        let ix_msg = &ix.data[msg_offset..msg_offset + msg_size];

        if ix_pk == oracle_pubkey.to_bytes()
            && ix_sig == signature
            && ix_msg == message_bytes.as_slice()
        {
            found = true;
            break;
        }
    }

    require!(found, SignatureError::SignatureVerificationFailed);
    Ok(())
}

/// Validate that a signed message matches the expected parameters
pub fn validate_message_params(
    message: &X402PaymentMessage,
    expected_vault: &Pubkey,
    expected_amount: u64,
    current_time: i64,
) -> Result<()> {
    require!(
        message.vault == *expected_vault,
        SignatureError::VaultMismatch
    );

    require!(
        message.amount > 0 && message.amount <= expected_amount,
        SignatureError::AmountMismatch
    );

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