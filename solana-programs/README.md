# TigerPay Solana Architecture 🐯

Hey team! We've successfully ported the core TigerPay logic from Ethereum (Solidity) to Solana (Anchor). This move brings high-speed tranches and milestone-based financing to the Solana ecosystem.

## 🚀 The Big Success
Due to some local dependency conflicts with the latest Solana SDK and Anchor, we successfully deployed the program to **Devnet** using **Solana Playground**. 

- **Program ID**: `5xzKq3bRuxLh4WezvMRHz8nodp4W6gihUvjeB5VcWa8z`
- **Network**: Devnet
- **Status**: Verified and Tested

## 🏗️ Architecture Overview

The Solana implementation mirrors our Solidity logic but utilizes Solana's account-based model for maximum parallelization.

### 1. Account Mapping (EVM -> Solana)
- **MerchantVault.sol** -> `MerchantVault` PDA. Stores vault state, funding targets, and repayment tracking.
- **Investor Tracking** -> `InvestorAccount` PDA. Maps 1:1 between a specific Vault and an Investor.
- **Milestones** -> `Milestone` PDA. Decoupled from the vault to allow independent verification.
- **Tranches** -> `Tranche` PDA. Scheduled fund releases.

### 2. SPL Token Integration
Instead of custom Solidity ERC20s, we use standard **SPL Tokens**:
- **Funding Currency**: Any stablecoin (e.g., USDC).
- **Debt Tokens**: Automatically minted to investors upon investment as a receipt/proof of debt.

### 3. Key Workflows
- **Fundraising**: Investors deposit tokens -> receive minted debt tokens.
- **Milestones**: Merchants submit proof -> Verifiers vote -> Approval triggers tranche eligibility.
- **Repayment**: Merchant pays back into the vault -> State transitions to `Repaying` or `Completed`.
- **Claiming**: Investors burn/hold debt tokens to claim their share of the repaid funds proportionally.

## 🛠️ Developer Notes
The project is structured in a standard Anchor format. Even if you hit local toolchain snags with Rust versions, the code in `programs/tigerpay/src/` is the source of truth.

To test or redeploy:
1. Copy the modular source to [Solana Playground](https://beta.solpg.io).
2. Use the updated `tigerpay.ts` test suite.

The original Solidity contracts are kept in the `/contracts` directory for reference as we continue to sync feature parity.
