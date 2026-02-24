# TigerPayX — Production Readiness TODO

This document tracks items remaining before TigerPayX Solana programs are ready for Mainnet deployment.

Last updated: 2026-02-24

---

## Completed ✅

### Security Hardening (On-Chain)

- [x] **Reentrancy Protection:** All CPI instructions (`release_tranche`, `route_repayment`, `make_repayment`) reordered to checks-effects-interactions pattern — state updates happen BEFORE external CPI calls.
- [x] **Ed25519 Oracle Signature Verification:** `security/signature.rs` implements real Ed25519 verification via Solana instruction introspection (Ed25519SigVerify program). Replaces the previous placeholder.
- [x] **Signature Wired into route_repayment:** `route_repayment.rs` calls `verify_oracle_signature()` and `validate_message_params()` when an `X402PaymentProof` is provided. `RouteRepayment` accounts struct includes `instructions_sysvar` for introspection.
- [x] **Nonce-Based Replay Protection:** `SettlementAccount` tracks last 8 payment IDs, enforces monotonically increasing nonces, and checks replay via `check_replay()`.
- [x] **Rate Limiting:** `SettlementAccount` enforces `min_payment_interval_secs` between payments via `check_rate_limit()`. Configurable per settlement.
- [x] **Security Module Imported:** `pub mod security;` added to `lib.rs` so `security/reentrancy.rs` and `security/signature.rs` compile and are available.

### Sequential Waterfall

- [x] **Senior Tranche Logic:** `MerchantVault::distribute_waterfall()` implemented in `vault.rs`. Distributes each repayment: Senior (Jupiter/Treasury) first → Liquidity Pools second → Retail investors last. Updates `total_senior_repaid` and `total_pool_repaid`.
- [x] **Dynamic Split Ratios:** Both `route_repayment.rs` (x402 path) and `repayment.rs` (manual path) call `distribute_waterfall()` on every payment. Split is dynamic based on what each tranche is still owed.

### Arithmetic Safety

- [x] **invest.rs:** Replaced 3x `.unwrap()` on `checked_mul`/`checked_div` with `.ok_or(TigerPayError::ArithmeticOverflow)?`.
- [x] **investor.rs:** Replaced `checked_mul().unwrap_or(0)` chain with `saturating_mul()` in `calculate_claimable()`.
- [x] **vault.rs:** Replaced raw `/ 10000` division in `calculate_late_fee()` with `checked_div(10000).unwrap_or(0)`.

### Event Emission

- [x] **Duplicate Events Fixed:** Removed 7 duplicate event structs from `events.rs`. Updated originals (`VaultDefaulted`, `FundsRecovered`, `VaultCancelled`, `VaultPaused`, `VaultUnpaused`) to match actual emit field signatures.
- [x] **TrancheReleased:** Event emitted in `tranche.rs::release_tranche()`.
- [x] **RepaymentReceived:** Event emitted in `repayment.rs::make_repayment()`.
- [x] **WaterfallDistributed:** New event emitted on every repayment with full senior/pool/retail breakdown.
- [x] **RepaymentRouted:** Already existed; confirmed emitting correctly.

### Compilation Fixes

- [x] **Settlement Signature Mismatch:** Fixed `lib.rs::create_settlement` to pass all 4 arguments (added optional `min_payment_interval_secs` and `max_single_payment`).
- [x] **TODO Comments Removed:** Placeholder/TODO comments in `signature.rs` removed per rules.md anti-vibecoding policy.

---

## Remaining — On-Chain 🔧

### 1. Tooling & Build (MEDIUM)

- [ ] **Fix Local Compilation:** `constant_time_eq` v0.4.2 requires Rust 2024 edition, incompatible with Rust 1.82 / Cargo 1.82. Options: (a) pin `constant_time_eq = "=0.3.1"` via `[patch]` in workspace `Cargo.toml`, (b) upgrade Rust toolchain to 1.85+, or (c) upgrade Anchor to 0.32+ which may resolve transitive dep.
- [ ] **Anchor Version Mismatch:** `Cargo.toml` uses `anchor-lang = "0.29.0"` but `Anchor.toml` specifies `anchor_version = "0.32.1"`. Decide whether to upgrade on-chain deps to 0.32 (recommended — includes CPI safety, account validation improvements, IDL fixes).
- [ ] **IDL Verification:** Ensure `anchor build` generates a correct IDL with all instructions after the security changes (new `instructions_sysvar` account, updated `X402PaymentProof` struct with `repayment_rate_bps` field).
- [ ] **Program Size Optimization:** Monitor the .so size; with 35+ instructions + security module, we may approach the 10MB BPF limit.

### 2. Testing (HIGH)

- [ ] **Waterfall Logic Test:** Verify `distribute_waterfall()` correctly splits Senior → Pools → Retail using the gym 500k canonical example (400k senior, 80k pool, 20k retail).
- [ ] **Ed25519 Signature Test:** Test `route_repayment` with a valid Ed25519 signature from oracle, verify introspection matches.
- [ ] **Replay Protection Test:** Submit same nonce twice, verify second call fails with `NonceAlreadyUsed`.
- [ ] **Rate Limit Test:** Submit two payments within `min_payment_interval_secs`, verify second fails with `RateLimitExceeded`.
- [ ] **Interest & Late Fee Test:** Verify math precision and rounding for late fee calculations with checked arithmetic.
- [ ] **Fundraising End-to-End:** Test `create_vault` → `invest` → `auto_cancel_expired` (keeper flow).
- [ ] **Default & Recovery:** Test `mark_default` and `recover_funds` with remaining token balances.
- [ ] **Edge Cases:** Overflow testing on all `u64` arithmetic; concurrent investor claims; zero-amount edge cases.

### 3. Security Audit (MEDIUM)

- [ ] **UncheckedAccount Audit:** Review all `/// CHECK:` justifications in `lib.rs`. Currently 6 unchecked accounts — each has technical justification, but should be re-validated.
- [ ] **PDA Seed Collision:** Verify no seeds can overlap (especially `b"liquidity_pool"` vs `b"vault"` vs `b"settlement"` seeds).
- [ ] **Upgradeability:** Define the program upgrade authority and migration path for mainnet.
- [ ] **Role-Based Access Control:** Currently basic authority checks. Consider formal Admin/Oracle/Keeper/Merchant role system for production.
- [ ] **Platform-Level Emergency Pause:** `PlatformConfig.paused` exists but only checked in `invest`. Should gate all critical operations.

---

## Remaining — Off-Chain (x402 Infrastructure) 🌐

The on-chain x402 infrastructure is complete. The following off-chain services are required to connect real payment events to the on-chain settlement system.

### 4. Settlement Oracle Service (HIGH)

The oracle is the bridge between real-world x402 payment events and on-chain `route_repayment` execution.

- [ ] **Event Listener:** Service that monitors x402 payment endpoints for incoming customer payments. Receives webhooks or polls payment provider APIs.
- [ ] **Message Signing:** When a payment is detected, constructs an `X402PaymentMessage` (nonce, vault, amount, payment_source, timestamp, repayment_rate_bps) and signs it with the oracle's Ed25519 keypair.
- [ ] **Transaction Builder:** Builds a Solana transaction containing: (1) an Ed25519SigVerify instruction with the signed message, and (2) the `route_repayment` instruction with the `X402PaymentProof`.
- [ ] **Transaction Submission:** Submits the transaction to Solana with retry/confirmation logic.
- [ ] **Nonce Management:** Maintains a monotonically increasing nonce per vault to satisfy `settlement.nonce` checks. Must be durable across restarts.
- [ ] **Oracle Key Security:** Ed25519 signing key must be stored in a secure enclave or HSM. Key rotation mechanism needed.
- [ ] **Failure Handling:** If tx fails (rate limit, insufficient funds), queue for retry with backoff. Alert on repeated failures.

**Tech stack suggestion:** Node.js/TypeScript service in `backend/src/services/oracle/`, using `@solana/web3.js` for tx building and `tweetnacl` for Ed25519 signing.

### 5. Crank / Keeper Service (MEDIUM)

Permissionless automation for vault lifecycle operations.

- [ ] **Vault Expiry Monitor:** Poll active vaults past `fundraising_deadline` with `total_raised < 80%` of target. Call `auto_cancel_expired` for each.
- [ ] **Default Detection:** Poll repaying vaults past `next_payment_due + grace_period`. Call `mark_default` when conditions met.
- [ ] **Late Fee Tracking:** Monitor vaults approaching payment deadlines. Emit alerts/events for the frontend.
- [ ] **Pool Allocation Returns:** After a vault repays, trigger `return_pool_allocation` to credit liquidity pools.
- [ ] **Scheduling:** Run on interval (every 5-15 minutes). Must be idempotent — calling instructions that have already been processed should fail gracefully.

**Tech stack suggestion:** Node.js/TypeScript service in `backend/src/jobs/keeper/`, or a Clockwork/cron-based trigger.

### 6. Event Indexer (MEDIUM)

Parses on-chain events into a queryable database for frontend/analytics.

- [ ] **Event Parser:** Subscribe to program logs and decode events: `RepaymentRouted`, `WaterfallDistributed`, `VaultCreated`, `TrancheReleased`, `VaultDefaulted`, etc.
- [ ] **Database Schema:** Store parsed events with vault ID, timestamp, amounts, waterfall breakdown.
- [ ] **REST API:** Expose endpoints for frontend:
  - `GET /vaults/:id/repayments` — repayment history with waterfall splits
  - `GET /vaults/:id/waterfall` — current senior/pool/retail repayment totals
  - `GET /settlements/:vault/status` — settlement health (last payment, nonce, rate limit state)
- [ ] **WebSocket Feed:** Real-time event stream for live dashboard updates.
- [ ] **Backfill:** Ability to replay historical transactions to rebuild state from genesis.

**Tech stack suggestion:** Node.js service in `backend/src/services/indexer/` using Solana `onLogs` subscription, PostgreSQL for storage.

---

## Remaining — Integration & Frontend 🖥️

### 7. Client SDK (LOW)

- [ ] **TypeScript IDL Bindings:** Generate updated TypeScript types from Anchor IDL after build (includes new `instructions_sysvar`, `X402PaymentProof.repayment_rate_bps`, `WaterfallDistributed` event).
- [ ] **SDK Helper Functions:** Wrap common flows: `createVaultAndSettle()`, `investWithDebtToken()`, `buildRouteRepaymentTx()` (constructs Ed25519 + route_repayment in one tx).

### 8. Frontend Ops Dashboard (LOW)

- [ ] **Admin Panel:** `pause_vault`, `unpause_vault`, `update_credit_score`, `recover_funds`, `mark_default` controls.
- [ ] **Waterfall Visualization:** Live chart showing Senior/Pool/Retail repayment progress per vault.
- [ ] **Settlement Monitor:** Show oracle health, last payment timestamp, nonce state, rate limit countdown.
- [ ] **Investor Portfolio:** Yield accruing from waterfall distribution (uses `WaterfallDistributed` events).

---

## Current Security Posture

| Area                | Status                           | Risk     |
|---------------------|----------------------------------|----------|
| Anchor Version      | 0.29.0 (outdated)                | Medium   |
| Reentrancy Guards   | ✅ State-before-CPI enforced     | Resolved |
| Overflow Protection | ✅ All checked/saturating         | Resolved |
| Access Control      | Basic (authority checks)         | Medium   |
| Oracle Security     | ✅ Ed25519 signature + nonce      | Resolved |
| Rate Limiting       | ✅ Per-settlement interval        | Resolved |
| Pause Mechanisms    | Partial (vault level only)       | Low      |
| Event Emission      | ✅ Full coverage + waterfall      | Resolved |
| Waterfall           | ✅ Sequential Senior→Pool→Retail  | Resolved |

---

*Document version: 3.0 — Updated after security hardening and waterfall implementation (Feb 2026).*
