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
