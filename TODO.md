# TigerPayX — Production Readiness TODO

This document tracks items remaining before TigerPayX Solana programs are ready for Mainnet deployment.

## 1. Tooling & Build
- [ ] **Fix Local Compilation:** Resolve the Rust 1.75 / Anchor 0.29 dependency conflicts preventing local `cargo build-bpf`.
- [ ] **IDL Verification:** Ensure `anchor build` generates a correct IDL with all 35 instructions.
- [ ] **Program Size Optimization:** Monitor the .so size; with 35 instructions, we may approach the 10MB limit.

## 2. Testing (Priority: High)
- [ ] **Waterfall Logic Test:** Verify sequential repayment (Senior -> Pools -> Retail) works as intended.
- [ ] **Interest & Late Fee Test:** Verify math precision and rounding for late fee calculations.
- [ ] **Fundraising End-to-End:** Test `create_vault` -> `invest` -> `auto_cancel_expired` (keeper flow).
- [ ] **Default & Recovery:** Test `mark_default` and `recover_funds` with remaining token balances.
- [ ] **Edge Cases:** Overflow testing on all `u64` arithmetic; concurrent investor claims.

## 3. Sequential Waterfall Completion
- [ ] **Senior Tranche (Jupiter):** Implement the specific logic for `total_senior_repaid` (currently a derived derived state field).
- [ ] **Settlement Split Ratio:** Dynamic split ratios in `route_repayment` (currently uses total amount).

## 4. Security & Hardening
- [ ] **UncheckedAccount Audit:** Review all 9 `/// CHECK:` justifications in `lib.rs`.
- [ ] **PDA Seed Collision:** Verify no seeds can overlap (especially pool vs vault seeds).
- [ ] **Arithmetic:** Replace remaining `unwrap_or(0)` in critical math with proper Error returns if warranted.
- [ ] **Upgradeability:** Define the program upgrade authority and migration path.

## 5. Integration
- [ ] **Client SDK:** Update TypeScript bindings for frontend/backend.
- [ ] **Frontend Ops:** Implement administrative dashboard for `pause_vault`, `update_credit_score`, and `recover_funds`.

Based on my review, here's a comprehensive breakdown:

  ---
  Current Security Posture

  | Area                | Status                     | Risk                              |
  |---------------------|----------------------------|-----------------------------------|
  | Anchor Version      | 0.29.0 (outdated)          | Medium - Missing security patches |
  | Reentrancy Guards   | Not implemented            | High - CPI calls vulnerable       |
  | Overflow Protection | Partial (some checked_add) | Medium                            |
  | Access Control      | Basic (authority checks)   | Medium - No role-based system     |
  | Oracle Security     | Only key check             | High - No signature verification  |
  | Rate Limiting       | Not implemented            | Medium                            |
  | Pause Mechanisms    | Partial (vault level)      | Low                               |
  | Event Emission      | Partial                    | Low                               |

  ---
  Critical Security Issues Found

  1. Reentrancy Vulnerability (HIGH)
  In tranche.rs:34-78 and pool_ops.rs, external CPI calls are made before state updates. An attacker could potentially re-enter.

  2. Oracle Authority Bypass (HIGH)
  In route_repayment.rs, only oracle_authority.key() check exists. No nonce/replay protection. A compromised oracle key could drain vaults.

  3. No Signature Verification (HIGH)
  The oracle authority is just a pubkey check. Real x402 integration needs cryptographic proof that the payment happened.

  4. Anchor Version (MEDIUM)
  Using 0.29.0 when 0.32.x has important security fixes including:
  - Better CPI safety
  - Account validation improvements
  - IDL security fixes

  ---
  Proposed Implementation

  Phase 1: Security Hardening (On-Chain)

  1. Reentrancy guard decorator for all instructions with CPIs
  2. Oracle signature verification (Ed25519)
  3. Nonce-based replay protection for x402 payments
  4. Rate limiting for repayments (max per interval)
  5. Role-based access control (Admin, Oracle, Keeper, Merchant)
  6. Emergency pause at platform level

  Phase 2: x402 Infrastructure (Off-Chain)

  1. Settlement Oracle Service
     - Listen to x402 payment events
     - Sign repayment messages with oracle key
     - Submit route_repayment with signature proof

  2. Crank Service
     - Monitor vault states
     - Trigger auto_cancel_expired
     - Process late fees and defaults

  3. Indexer
     - Parse on-chain events
     - Track settlement status
     - Expose API for frontend

  ---
  Key Files to Modify/Create

  | File                     | Changes                                         |
  |--------------------------|-------------------------------------------------|
  | lib.rs                   | Add reentrancy guard, platform pause            |
  | route_repayment.rs       | Add signature verification, nonce tracking      |
  | settlement.rs            | Add nonce, last_payment_time, rate_limit fields |
  | errors.rs                | Add security-specific errors                    |
  | state/mod.rs             | Add new security state fields                   |
  | instructions/security.rs | New file - reentrancy guard impl                |
  | x402-oracle/             | New directory - off-chain oracle service        |
