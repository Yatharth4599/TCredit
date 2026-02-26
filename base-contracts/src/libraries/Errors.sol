// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Errors — Custom error definitions for TigerPayX Base contracts
/// @notice Maps from Solana errors.rs — covers vault lifecycle, payments, access control, replay, rate limits
library Errors {
    // ── Vault Lifecycle ──
    error VaultNotActive();
    error VaultNotFundraising();
    error VaultNotRepaying();
    error VaultPaused();
    error VaultCancelled();
    error VaultAlreadyPaused();
    error VaultAlreadyCancelled();
    error VaultAlreadyCompleted();
    error VaultAlreadyDefaulted();
    error InvalidVaultState();
    error FundraisingDeadlinePassed();
    error FundraisingNotComplete();
    error MaxInvestorsReached();
    error InvestmentBelowMinimum();
    error InvestmentAboveMaximum();
    error TargetAmountExceeded();
    error NoTranchesRemaining();

    // ── Repayment ──
    error InvalidRepaymentAmount();
    error NoReturnsAvailable();
    error AlreadyRefunded();
    error AlreadyRecovered();

    // ── Liquidity Pools ──
    error PoolPaused();
    error PoolInsufficientBalance();
    error AllocationExceedsCap();
    error AllocationAlreadyExists();
    error AllocationNotFound();
    error WithdrawExceedsAvailable();

    // ── x402 / Settlement ──
    error SettlementNotActive();
    error SettlementAlreadyExists();
    error InvalidSignature();
    error SignatureExpired();
    error NonceAlreadyUsed();
    error RateLimitExceeded();
    error PaymentExceedsMax();
    error PaymentExpired();
    error InvalidPaymentAmount();

    // ── Agent Registry ──
    error AgentAlreadyRegistered();
    error AgentNotRegistered();
    error AgentNotActive();

    // ── Access Control ──
    error Unauthorized();
    error OnlyFactory();
    error OnlyRouter();
    error OnlyAdmin();

    // ── Arithmetic ──
    error ArithmeticOverflow();
    error DivisionByZero();

    // ── General ──
    error ZeroAddress();
    error ZeroAmount();
    error PlatformPaused();
    error InvalidAmount();
    error InvalidMetadata();
    error InvalidTrancheCount();
    error ExceedsTarget();
    error AllTranchesReleased();
    error NothingToClaim();
    error FeeTooHigh();
    error VaultAlreadyExists();
    error PaymentTooLarge();
    error InsufficientBalance();
    error InsufficientPoolBalance();
    error ExceedsMaxAllocation();
}
