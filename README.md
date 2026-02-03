# TigerPay Multi-Chain Protocol 🐯

## Overview
TigerPay is a decentralized BNPL/Lending platform designed for UAE merchants, leveraging tokenized debt securities. The core protocol is implemented on **Solana** for high-performance, milestone-based financing, with the original **EVM** implementation preserved for reference.

## 🏗️ Project Structure
```text
TigerPay/
├── solana-programs/        # Active: Core Solana implementation (Anchor)
│   ├── programs/tigerpay/  # Rust-based program logic
│   │   └── src/
│   │       ├── lib.rs          # Entry point & routing
│   │       ├── state/          # Account definitions (PDAs)
│   │       └── instructions/   # Transaction logic
│   └── tests/              # TypeScript verification suite
├── contracts/              # Referential: Original Solidity contracts
├── test/                   # Original EVM test suite
└── scripts/                # Original EVM deployment scripts
```

## 🛠️ Technology Stack
- **Solana (Primary)**: Rust & Anchor Framework (v0.29.0), SPL Token Standard.
- **EVM (Referential)**: Solidity v0.8.24, Hardhat, OpenZeppelin.
- **Testing**: TypeScript & Anchor Test suite.
- **Deployment**: Live on Devnet (Program ID: `5xzKq3bRuxLh4WezvMRHz8nodp4W6gihUvjeB5VcWa8z`).

## 🏗️ Solana Program Architecture

The program uses a modular **Program-Derived Address (PDA)** architecture to handle isolated state for merchants, investors, and financing vaults.

### 1. Key Account Structures (PDAs)
- **Platform Config**: Global settings (fees, authority).
- **Merchant Profile**: Verified merchant data and vault counters.
- **Merchant Vault**: Core engine managing fundraise targets and state.
- **Investor Account**: Tracks individual investments and claimable returns.
- **Milestones & Tranches**: State for progress-based fund releases.

### 2. Core Instructions
- `initialize_platform`: Protocol bootstrap.
- `verify_merchant`: Permissioned merchant onboarding.
- `create_vault`: Loan terms and debt token mint initialization.
- `invest`: Deposits USDC and mints Debt Tokens in return.
- `release_tranche`: Releases funds upon milestone approval.
- `make_repayment`: Merchant loan repayment with interest.
- `claim_returns`: Proportional redemption of investor returns.

### 3. Technical Flow
1. **Onboarding**: Authority verifies a merchant.
2. **Financing**: Merchant creates a vault; Investors provide liquidity.
3. **Execution**: Milestones are submitted/voted; success triggers fund release.
4. **Settlement**: Merchant repays; investors claim yield from the vault.

## 🚀 Getting Started
To interact with the Solana programs:
1. Ensure your environment matches the **Technology Stack** above.
2. Build and deploy using **Solana Playground** (https://beta.solpg.io) for the most stable experience.
3. Run tests using `anchor test` or `run-test` in the Playground environment.

---
## 👥 Team
TigerPay Protocol - Blockchain Engineering
