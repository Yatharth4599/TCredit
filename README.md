# TigerPay Multi-Chain Protocol 🐯

## Overview
TigerPay is a decentralized BNPL/Lending platform designed for UAE merchants, leveraging tokenized debt securities. While the project started on EVM-compatible chains, the core protocol has been successfully migrated to **Solana** to provide high-performance, milestone-based financing.

## 🏗️ Project Structure
```text
TigerPay/
├── solana-programs/        # Active: Core Solana implementation (Anchor)
│   ├── programs/tigerpay/  # Rust-based program logic
│   └── tests/              # TypeScript verification suite
├── contracts/              # Legacy/Referential: Original Solidity contracts
├── test/                   # Original EVM test suite
└── scripts/                # Original EVM deployment scripts
```

## 🛠️ Technology Stack (Solana)
- **Rust & Anchor Framework (v0.29.0)**: Type-safe, high-performance program logic.
- **SPL Token Standard**: Handling underlying assets (USDC) and minted debt positions.
- **Solana CLI (v1.18.26)**: For on-chain management and deployment.
- **Solana Playground**: Build and deployment environment.

## 🏗️ Solana Program Architecture

The program uses a modular **Program-Derived Address (PDA)** architecture to handle isolated state for merchants, investors, and financing vaults.

### 1. Key Account Structures (PDAs)
- **Platform Config**: Global settings (fees, authority, constraints).
- **Merchant Profile**: Verified merchant data and vault counters.
- **Merchant Vault**: The core engine managing a specific fundraise, targets, and state.
- **Investor Account**: Tracks individual investments and claimable returns per vault.
- **Milestones & Tranches**: Decoupled state for progress-based fund releases.

### 2. Core Instructions
- `initialize_platform`: Bootstraps the protocol.
- `verify_merchant`: Permissioned onboarding of credible merchants.
- `create_vault`: Merchant defines loan terms and debt token mints.
- `invest`: Investors deposit USDC and receive minted Debt Tokens in return.
- `release_tranche`: Releases funds to merchants upon milestone approval.
- `make_repayment`: Merchant repays the loan with interest to the vault.
- `claim_returns`: Investors burn debt tokens or redeem their proportional share of repayments.

### 3. Integrated Flow
1. **Merchant Verification**: Authority verifies a merchant.
2. **Vault Launch**: Merchant creates a vault; a unique Debt Token Mint is initialized.
3. **Fundraising**: Investors populate the vault.
4. **Milestone Progress**: Verifiers vote on progress; success unlocks tranches.
5. **Repayment/Exit**: Merchant repays USDC; investors claim their yield.

## ✅ Development Progress
- [x] Full protocol migration to Solana/Anchor
- [x] PDA-based state management implemented
- [x] SPL Token integration for debt positions
- [x] Successfully deployed to **Devnet**
- [x] Verified via 12-stage test suite

## 🚀 Getting Started
1. Navigate to `solana-programs/`
2. Refer to the [Detailed Solana Guide](./solana-programs/README.md) for build, test, and deployment instructions.

---
*Note: The original Solidity implementation in `/contracts` remains for historical reference and cross-chain logic parity.*

## 👥 Team
TigerPay Protocol - Blockchain Engineering
