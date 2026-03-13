# Krexa — Full Bug Report

**Last updated:** 2026-03-13
**Scopes covered:**
- `base-contracts/` + `backend/` — EVM / Base Sepolia (BUG-001 – BUG-024)
- `solana-programs/` — Solana / Anchor programs (SOL-001 – SOL-049)

---

## Part 1 — Base Contracts + Backend (BUG-001 – BUG-024)

**Audit date:** 2026-03-09
**Checks run:** `npx tsc --noEmit` ✅ | `forge build && forge test` ✅ (`207/207` passing)

### Summary

| Severity | Total | Resolved | Remaining |
|----------|-------|----------|-----------|
| Critical | 6     | 6 ✅     | 0         |
| High     | 5     | 5 ✅     | 0         |
| Medium   | 7     | 7 ✅     | 0         |
| Low      | 5     | 4 ✅     | 1 (by design) |
| **Total**| **23**| **22 ✅**| **1**     |

---

### Critical

#### BUG-001: `AgentWalletFactory.predictWalletAddress` computes wrong CREATE2 address
**File:** `base-contracts/src/AgentWalletFactory.sol`
**Status:** ✅ Resolved

`predictWalletAddress` hashed constructor args with zero placeholders (`operator=0`, limits=0), while `createWallet` deploys with real args. Predicted and deployed addresses diverged.

**Fix applied:** `predictWalletAddress` now accepts `operator`, `dailyLimit`, `perTxLimit` params and hashes the same init bytecode as deployment.

---

#### BUG-002: `VaultFactory.predictVaultAddress` computes wrong CREATE2 address
**File:** `base-contracts/src/VaultFactory.sol`
**Status:** ✅ Resolved

`predictVaultAddress` zeroed all vault params in the hash while `createVault` used real values.

**Fix applied:** `predictVaultAddress` now accepts all 8 vault params and hashes them identically to deployment.

---

#### BUG-003: Facilitator payment path is signature-incompatible and nonce-domain inconsistent
**Files:** `base-contracts/src/Krexa402Facilitator.sol`, `base-contracts/src/PaymentRouter.sol`
**Status:** ✅ Resolved

`executeX402Payment` mutated `payment.from` and `amount`, then forwarded the original oracle signature — signature verification always failed.

**Fix applied:** Introduced `executeFacilitatedPayment(X402Payment)` in `PaymentRouter` — a trust-based path callable only by admin-approved facilitators. Nonces scoped per facilitator address.

---

#### BUG-004: Pool tranche repayments stranded (`investFromPool` has no claim path)
**Files:** `base-contracts/src/MerchantVault.sol`, `base-contracts/src/LiquidityPool.sol`
**Status:** ✅ Resolved

`investFromPool` tracked pool capital in `poolFunded` but never added the pool address to `investorBalances`, so `claimReturns()` returned zero for the pool contract.

**Fix applied:** `investFromPool` now adds pool to `investorBalances` and marks it in `isPoolInvestor`. `_claimableFor` has a dedicated pool path.

---

#### BUG-020: Facilitator can debit any approved payer without payer authorization
**File:** `base-contracts/src/Krexa402Facilitator.sol`
**Status:** ✅ Resolved

`executeX402Payment` did not require `msg.sender == payment.from`. Any caller could submit a struct with `payment.from = victim` and pull funds from any address that approved the facilitator.

**Fix applied:** Bound caller to payer (`require(msg.sender == payment.from)`).

---

#### BUG-021: Mixed tranche flags break claim accounting in `MerchantVault`
**File:** `base-contracts/src/MerchantVault.sol`
**Status:** ✅ Resolved

Same address could become both `isSeniorInvestor` and `isPoolInvestor`, causing misattribution of claims.

**Fix applied:** Enforced mutual exclusivity between tranche roles; per-tranche balance tracking added.

---

### High

#### BUG-005: Default refund math is order-dependent and leaves residual funds trapped
**File:** `base-contracts/src/MerchantVault.sol`
**Status:** ✅ Resolved

`claimRefund` used live `usdc.balanceOf(address(this))` as the pool — payout depended on claim order.

**Fix applied:** Added `uint256 public defaultSnapshotBalance` set once in `markDefault()`. All refund calculations use this immutable snapshot.

---

#### BUG-006: Backend `verifyPaymentReceipt` can mark unrelated tx as valid
**File:** `backend/src/services/facilitator.service.ts`
**Status:** ✅ Resolved

Receipt verification only checked tx success, `tx.to`, and resource active status — no calldata validation.

**Fix applied:** `verifyPaymentReceipt` now decodes `tx.input`, verifies function selector and `resourceHash` in calldata.

---

#### BUG-007: Oracle payment endpoint is unauthenticated
**File:** `backend/src/api/routes/oracle.ts`
**Status:** ✅ Resolved

`POST /api/v1/oracle/payment` had no auth guard.

**Fix applied:** `requireApiKey` middleware added.

---

#### BUG-022: Oracle nonce assignment race can create duplicate `(from, nonce)`
**File:** `backend/src/services/oracle.service.ts`
**Status:** ✅ Resolved

`getNextNonce(from)` ran before `oraclePayment.create` with no transactional lock or DB unique constraint.

**Fix applied:** Nonce reserved atomically in DB transaction with conflict retry.

---

#### BUG-024: Backend x402 resource handling mismatches facilitator keying model
**Files:** `base-contracts/src/Krexa402Facilitator.sol`, `backend/src/services/facilitator.service.ts`
**Status:** ✅ Resolved

Contract stores resources by `key = keccak256(resourceHash, owner)` but backend queried raw `resourceHash`.

**Fix applied:** Backend standardized to use resource key end-to-end.

---

### Medium

#### BUG-008: Prisma lifecycle risk — 11 client instances, no graceful disconnect
**Status:** ✅ Resolved — Singleton at `backend/src/config/prisma.ts`. All files import shared instance.

#### BUG-009: Zero-address fallbacks + missing zod env schema entries
**Status:** ✅ Resolved — All 3 contract addresses added to `env.ts` as required zod fields.

#### BUG-010: `.env.example` contains a concrete private key value
**Status:** ✅ Resolved — Replaced with empty placeholder.

#### BUG-011: Resource registration is front-runnable
**Status:** ✅ Resolved — Storage key changed to `keccak256(resourceHash, msg.sender)`.

#### BUG-012: Missing two-step admin transfer in three contracts
**Status:** ✅ Resolved — `pendingAdmin`, `proposeAdmin`, `acceptAdmin` added to `AgentIdentity`, `AgentWalletFactory`, `Krexa402Facilitator`.

#### BUG-013: No test coverage for `executeX402Payment`
**Status:** ✅ Resolved — 8 new tests added (total 197 → 207).

#### BUG-023: Retry scheduler ignores computed backoff and always uses 30s
**Status:** ✅ Resolved — Timer now scheduled from `nextRetryAt`.

---

### Low

#### BUG-014: `AgentWallet.setOperator` allows `address(0)`
**Status:** ✅ Resolved — Zero-address guard added.

#### BUG-015: Deactivated facilitator resources cannot be reactivated
**Status:** ✅ Resolved — `reactivateResource()` added.

#### BUG-016: Unbounded `getAllWallets()` response
**Status:** ✅ Resolved — Paginated `getWallets(offset, limit)` added.

#### BUG-017: `_safeMint` in soulbound identity allows receiver-griefing
**Status:** ✅ Resolved — Changed to `_mint`.

#### BUG-019: Admin can arbitrarily overwrite reputation values
**Status:** ⚠️ By design — Governance risk accepted. Mitigation path: timelock/multisig (future).

---

---

## Part 2 — Solana Programs (SOL-001 – SOL-049)

**Audit date:** 2026-03-13
**Programs audited:** krexa-agent-wallet, krexa-credit-vault, krexa-payment-router, krexa-agent-registry, krexa-venue-whitelist

### Summary

| Severity | Total | Fixed | Mitigated | Open (by-design/deferred) |
|----------|-------|-------|-----------|---------------------------|
| Critical | 8     | 8     | 0         | 0                         |
| High     | 10    | 8     | 2         | 0                         |
| Medium   | 14    | 10    | 0         | 4                         |
| Low      | 11    | 7     | 0         | 4                         |
| **Total**| **43**| **33**| **2**     | **8**                     |

**Phase 0 audit status: COMPLETE — 0 Critical or High remaining.**

---

### Critical

#### SOL-001: `repay` has no access control — anyone can force-repay any wallet
**Program:** krexa-agent-wallet | **Status:** ✅ Fixed
`caller` is a Signer but never checked against `owner` or `agent`. Anyone could trigger repayment on any wallet.
**Fix:** `constraint = caller.key() == agent_wallet.owner || caller.key() == agent_wallet.agent`

#### SOL-002: `request_credit` accepts attacker-controlled `collateral_value`
**Program:** krexa-agent-wallet | **Status:** ✅ Fixed
`collateral_value` passed as instruction arg, not computed on-chain. Attacker passes `u64::MAX` to bypass credit limit.
**Fix:** Added `collateral_position` account; value computed on-chain as `shares * total_deposits / total_shares`.

#### SOL-003: `request_credit` missing owner/agent signer — oracle alone controls credit
**Program:** krexa-agent-wallet | **Status:** ✅ Fixed
Only oracle signs. Compromised oracle can load any wallet with max debt unilaterally.
**Fix:** Agent or owner added as required co-signer (dual authorization).

#### SOL-004: First-depositor share inflation attack in credit vault
**Program:** krexa-credit-vault | **Status:** ✅ Fixed
`calculate_shares()` returns `amount` (1:1) when `total_shares == 0`. After ratio manipulation, small deposits get 0 shares.
**Fix:** `require!(shares > 0)` + minimum initial deposit guard.

#### SOL-005: `withdraw_collateral` credit line check trivially bypassable
**Program:** krexa-credit-vault | **Status:** ✅ Fixed
`credit_line` is `UncheckedAccount` with no seeds. Pass any empty account to bypass `CreditLineActive` check.
**Fix:** PDA seeds constraint added to `credit_line`.

#### SOL-006: `update_kya` bypasses `calculate_level()` — illegitimate level inflation
**Program:** krexa-agent-registry | **Status:** ✅ Fixed
`update_kya` with `new_tier >= 1` unconditionally set `credit_level = 1` without checking score. Agent with score 200 gets Level 1.
**Fix:** `profile.credit_level = calculate_level(profile.credit_score, new_tier)` always called.

#### SOL-007: `merchant_usdc` owner not validated against merchant
**Program:** krexa-payment-router | **Status:** ✅ Fixed
Only mint validated, not owner. Oracle can route revenue to any token account.
**Fix:** `constraint = merchant_usdc.owner == settlement.merchant || merchant_usdc.owner == settlement.agent_wallet_pda`

#### SOL-008: `vault_config` in ExecutePayment is UncheckedAccount with no validation
**Program:** krexa-payment-router | **Status:** ✅ Fixed
`vault_config` has only a `/// CHECK` comment — no owner/PDA validation.
**Fix:** `constraint = *vault_config.owner == vault_program.key()`

---

### High

#### SOL-009: `usdc_mint` in wallet Initialize is unchecked AccountInfo
**Program:** krexa-agent-wallet | **Status:** ✅ Fixed
**Fix:** Changed to `Account<'info, Mint>`.

#### SOL-010: Liquidation `owner_usdc` not validated — keeper steals surplus
**Program:** krexa-agent-wallet | **Status:** ✅ Fixed
**Fix:** `constraint = owner_usdc.owner == agent_wallet.owner`

#### SOL-011: Liquidation `keeper_usdc` not validated against keeper signer
**Program:** krexa-agent-wallet | **Status:** ✅ Fixed
**Fix:** `constraint = keeper_usdc.owner == keeper.key()`

#### SOL-012: `pay_x402` does not update health factor after spending
**Program:** krexa-agent-wallet | **Status:** ✅ Fixed
**Fix:** Health factor recalculation added after transfer (same as `execute_trade`).

#### SOL-013: `pay_x402` does not collect platform fee
**Program:** krexa-agent-wallet | **Status:** ✅ Fixed
`PLATFORM_FEE_BPS = 250` defined but never deducted. Protocol earns zero from x402 payments.
**Fix:** Fee deducted; `platform_treasury_token` account added to `PayX402` struct; two-transfer flow (net → facilitator, fee → treasury).

#### SOL-014: `extend_credit` allows overwriting active credit lines
**Program:** krexa-credit-vault | **Status:** ✅ Fixed
`init_if_needed` + unconditional field overwrite erases existing debt.
**Fix:** `require!(!cl.is_active || cl.agent == Pubkey::default(), VaultError::CreditLineAlreadyActive)`

#### SOL-015: Oracle-supplied `collateral_value` in vault is untrusted
**Program:** krexa-credit-vault | **Status:** 🟡 Mitigated
Same pattern as SOL-002 at vault level. Mitigated: wallet-side (SOL-002) computes value on-chain before CPI; vault trusts the CPI caller.

#### SOL-016: `receive_repayment` doesn't verify token transfer occurred
**Program:** krexa-credit-vault | **Status:** 🟡 Mitigated
Mitigated: `wallet_program_authority` signer prevents spoofing the repayment path.

#### SOL-017: No key rotation in krexa-payment-router
**Program:** krexa-payment-router | **Status:** ✅ Fixed
**Fix:** `update_config` instruction added.

#### SOL-018: No key rotation in krexa-agent-registry
**Program:** krexa-agent-registry | **Status:** ✅ Fixed
**Fix:** `update_config` instruction added.

#### SOL-019: Score expiry check skipped for `kya_tier == 0`
**Program:** krexa-agent-registry | **Status:** ✅ Fixed
**Fix:** Expiry checked unconditionally when `score_updated_at > 0`.

---

### Medium

#### SOL-020: `credit_level` in `request_credit` not validated against agent profile
**Program:** krexa-agent-wallet | **Status:** ✅ Fixed
**Fix:** `agent_profile` added to `RequestCredit`; `require!(credit_level <= profile.credit_level)`

#### SOL-021: `check_health` auto-freezes but never auto-unfreezes
**Program:** krexa-agent-wallet | **Status:** ✅ Fixed
**Fix:** Auto-unfreeze when `hf >= HF_HEALTHY && is_frozen && !is_liquidating`.

#### SOL-022: `create_wallet` does not check `is_paused`
**Program:** krexa-agent-wallet | **Status:** ✅ Fixed
**Fix:** Pause check added.

#### SOL-023: `liquidate` does not check `is_paused`
**Program:** krexa-agent-wallet | **Status:** ⬜ Open (by design — liquidation should work when paused)

#### SOL-024: Stale wallet balance in `withdraw` health calculation
**Program:** krexa-agent-wallet | **Status:** ✅ Fixed
**Fix:** `wallet_usdc.reload()` called after transfer.

#### SOL-025: `deleverage` only freezes — no actual position reduction
**Program:** krexa-agent-wallet | **Status:** ⬜ Open (deferred — rework planned)

#### SOL-026: Double liquidation not prevented
**Program:** krexa-agent-wallet | **Status:** ⬜ Open (deferred — shortfall tracking partially mitigates)

#### SOL-027: `total_deployed` underflow on bad debt write-off
**Program:** krexa-credit-vault | **Status:** ✅ Fixed
**Fix:** Only principal subtracted from `total_deployed`; interest tracked separately.

#### SOL-028: Division by zero in extend_credit utilization check
**Program:** krexa-credit-vault | **Status:** ✅ Fixed
**Fix:** `require!(cfg.total_deposits > 0, VaultError::InsufficientLiquidity)`

#### SOL-029: Lockup period only checked against first deposit timestamp
**Program:** krexa-credit-vault | **Status:** ✅ Fixed
**Fix:** `deposit_timestamp` updated on every deposit.

#### SOL-030: `deposited_amount` tracking breaks on withdrawal with yield
**Program:** krexa-credit-vault | **Status:** ⬜ Open (deferred — proportional tracking needed)

#### SOL-031: InitializeVault uses UncheckedAccount for usdc_mint
**Program:** krexa-credit-vault | **Status:** ✅ Fixed
**Fix:** Changed to `Account<'info, Mint>`.

#### SOL-032: Fee truncation to zero on small payments
**Program:** krexa-payment-router | **Status:** ⬜ Open (deferred — min payment enforcement)

#### SOL-033: Deactivated settlements cannot be reactivated
**Program:** krexa-payment-router | **Status:** ✅ Fixed
**Fix:** `reactivate_settlement` instruction added.

#### SOL-034: Deactivated agents cannot be reactivated
**Program:** krexa-agent-registry | **Status:** ✅ Fixed
**Fix:** `reactivate_agent` instruction added.

#### SOL-035: `link_wallet` has no idempotency guard
**Program:** krexa-agent-registry | **Status:** ✅ Fixed
**Fix:** `require!(!profile.has_wallet, ...)`

#### SOL-036: `category` field in `add_venue` accepts invalid values
**Program:** krexa-venue-whitelist | **Status:** ✅ Fixed
**Fix:** `require!(category <= 3, VenueError::InvalidCategory)`

#### SOL-037: No admin rotation in krexa-venue-whitelist
**Program:** krexa-venue-whitelist | **Status:** ✅ Fixed
**Fix:** `update_config` + `set_paused` instructions added.

#### SOL-038: `total_venues` never decremented on deactivation
**Program:** krexa-venue-whitelist | **Status:** ⬜ Open (cosmetic — rename to `total_venues_created`)

---

### Low

#### SOL-039: No pause/unpause instruction in krexa-agent-wallet
**Status:** ✅ Fixed — `pause` and `unpause` admin instructions added.

#### SOL-040: No mechanism to update admin/keeper in WalletConfig
**Status:** ✅ Fixed — `update_config` instruction added.

#### SOL-041: `daily_spend_limit` immutable after wallet creation
**Status:** ✅ Fixed — `update_daily_limit` owner-gated instruction added.

#### SOL-042: `venue_token` in ExecuteTrade not validated as belonging to venue
**Status:** ⬜ Open (deferred)

#### SOL-043: WalletConfig::LEN comment mismatch
**Status:** ⬜ Open (cosmetic)

#### SOL-044: `receive_repayment` not paused-gated
**Status:** ⬜ Open (by design — repayments should work when paused)

#### SOL-045: `accrue_interest` not paused-gated
**Status:** ⬜ Open (by design — accrual should work when paused)

#### SOL-046: Missing `has_one = usdc_mint` on CreateVaultToken/CreateInsuranceToken
**Status:** ✅ Fixed — `has_one = usdc_mint` added to both token init structs.

#### SOL-047: WithdrawCollateral owner/depositor confusion
**Status:** ✅ Fixed — `constraint = owner.key() == deposit_position.depositor`

#### SOL-048: `score_updated_at` not updated in `update_kya`
**Status:** ✅ Fixed — `profile.score_updated_at = now` added.

#### SOL-049: `deactivate_venue` does not check pause status
**Status:** ⬜ Open (by design — deactivation acceptable when paused)

---

## Part 3 — Phase 1 Contract Additions (2026-03-13)

These are **new features** added post-audit, not bugs. Documented for completeness.

### 1A — Legal Agreement Fields (`krexa-agent-registry`)

Added to `AgentProfile` struct:
- `legal_agreement_hash: [u8; 32]` — SHA256 of signed credit agreement
- `legal_agreement_signed_at: i64` — unix timestamp of signing (0 = not signed)
- `score_attestation_hash: [u8; 32]` — oracle-issued score proof

`AgentProfile::LEN` updated (+72 bytes). Initialized to zero in `register_agent`.

### 1B — `sign_legal_agreement` Instruction (`krexa-agent-registry`)

New instruction: `sign_legal_agreement(ctx, agreement_hash: [u8; 32])`
- Signer: agent keypair **or** owner (dual-auth)
- Stores hash + timestamp on-chain
- Emits `LegalAgreementSigned { agent, agreement_hash, signed_at }`

### 1C — L3-L4 Credit Gate (`krexa-agent-wallet`)

New error: `LegalAgreementNotSigned`

Gate in `request_credit.rs`:
```rust
if credit_level >= 3 {
    require!(profile.legal_agreement_signed_at > 0, WalletError::LegalAgreementNotSigned);
}
```

Agents must have a signed legal agreement on-chain before drawing Level 3 (≤$50K) or Level 4 (≤$100K) credit.

### 1D — `attest_score` Instruction (`krexa-agent-registry`)

New instruction: `attest_score(ctx, score_hash: [u8; 32])`
- Signer: oracle only
- Stores `sha256(agent + score + level + timestamp)` in `score_attestation_hash`
- Emits `ScoreAttested { agent, attestation_hash, attested_at }`
- Third-party platforms can verify score provenance without trusting Krexa directly

---

## Part 4 — Additional Audit Findings (2026-03-13, `solana-programs/` + `backend/`)

**Method:** static code audit + baseline runtime checks.
**Summary:** 5 High (all fixed), 3 Medium (1 fixed, 1 accepted, 1 deferred).

### Backend (new findings)

#### BUG-025: Public `/vaults/create` performs server-signed on-chain writes
**File:** `backend/src/api/routes/vaults.ts`
**Status:** ✅ Fixed
**Severity:** High

`POST /api/v1/vaults/create` is mounted publicly and calls `walletClient.writeContract(createVault)` directly when server wallet is configured.

**Fix applied:** Added `requireAdmin` middleware — only admin-tier API keys can call this endpoint.

**Evidence:** `backend/src/api/routes/vaults.ts:202-261`

---

#### BUG-026: Public `/merchants/:address/repay` triggers oracle-signed payment submission
**File:** `backend/src/api/routes/merchants.ts`
**Status:** ✅ Fixed
**Severity:** High

Endpoint has no auth guard and calls `processPayment()` directly. Caller is not required to prove control over `:address`.

**Fix applied:** Added `requireApiKey` middleware — valid API key required.

**Evidence:** `backend/src/api/routes/merchants.ts:172-212`

---

#### BUG-027: Public `/demo/full-lifecycle` performs multiple privileged writes
**Files:** `backend/src/api/routes/index.ts`, `backend/src/api/routes/demo.routes.ts`
**Status:** ✅ Fixed
**Severity:** High

`/demo` is publicly mounted; `POST /demo/full-lifecycle` uses `walletClient.writeContract` for vault creation, pool allocation, fundraising completion, and tranche release.

**Fix applied:** Router-level `requireAdmin` middleware added to all demo routes — only admin-tier API keys can access.

**Evidence:** `backend/src/api/routes/index.ts:68-69`, `backend/src/api/routes/demo.routes.ts:255-401`

---

#### BUG-028: Public `/demo/simulate-payment` can trigger oracle payment flow
**Files:** `backend/src/api/routes/index.ts`, `backend/src/api/routes/demo.routes.ts`
**Status:** ✅ Fixed
**Severity:** High

`POST /demo/simulate-payment` is public and attempts `processPayment()` (oracle-signed payment path) when oracle service is configured.

**Fix applied:** Same as BUG-027 — router-level `requireAdmin` middleware guards all demo routes.

**Evidence:** `backend/src/api/routes/index.ts:68-69`, `backend/src/api/routes/demo.routes.ts:117-214`

---

#### BUG-029: Admin routes accept any active API key (no admin scope/RBAC)
**Files:** `backend/src/api/routes/admin.ts`, `backend/src/api/middleware/apiKeyAuth.ts`
**Status:** ✅ Fixed
**Severity:** High

`requireApiKey` checks only that key exists and is active. Admin routes do not enforce role/tier/scope.

**Fix applied:** New `requireAdmin` middleware added — checks `tier === 'admin'`. Admin routes switched from `requireApiKey` to `requireAdmin`. Bootstrap: manually set one key's tier to `'admin'` via Prisma Studio.

**Evidence:** `backend/src/api/routes/admin.ts:8-10`, `backend/src/api/middleware/apiKeyAuth.ts:38-55`

---

#### BUG-030: Admin key listing endpoint returns raw API key material
**File:** `backend/src/api/routes/admin.ts`
**Status:** ✅ Fixed
**Severity:** Medium

`GET /api/v1/admin/keys` returns `key` values directly, expanding blast radius if one admin credential is compromised.

**Fix applied:** Keys redacted in list response — only prefix + last 4 chars shown (e.g. `tck_…ab3f`). Full key only returned on creation (POST).

**Evidence:** `backend/src/api/routes/admin.ts:11-18`

---

#### BUG-031: Webhook secrets stored in plaintext and used directly for signing
**Files:** `backend/prisma/schema.prisma`, `backend/src/services/webhook.service.ts`
**Status:** ⚠️ Accepted risk
**Severity:** Medium

Webhook signing secrets are persisted as plaintext (`WebhookEndpoint.secret`) and consumed directly for HMAC signatures.

**Rationale:** Industry standard — Stripe, GitHub, and other webhook providers store signing secrets in plaintext server-side because the server needs the raw secret to compute HMAC signatures. Encrypting at rest (AES-256-GCM) is a future defense-in-depth option.

**Evidence:** `backend/prisma/schema.prisma:115-123`, `backend/src/services/webhook.service.ts:34-36,63`

---

#### BUG-032: Rate limiting is in-memory and resets on restart/scale-out
**File:** `backend/src/api/middleware/rateLimit.ts`
**Status:** ⬜ Open (deferred — requires Redis)
**Severity:** Medium

Rate-limit state is process-local (`Map`), so restart or multi-instance deployments can bypass intended throttling. Acceptable for single-instance testnet; requires Redis for production multi-instance deployment.

**Evidence:** `backend/src/api/middleware/rateLimit.ts:12-21,23-49`

---

### Solana re-validation notes (open items confirmed)

#### SOL-025 (Re-validated): `deleverage` only freezes state; no debt/exposure reduction
**Program:** `krexa-agent-wallet` | **Status:** ⬜ Open (deferred) | **Severity:** Medium

Current implementation updates freeze/health fields and emits event, but performs no transfer/CPI to reduce exposure.

**Evidence:** `solana-programs/programs/krexa-agent-wallet/src/instructions/deleverage.rs:7-31`

---

#### SOL-026 (Re-validated): liquidation can be repeatedly invoked in shortfall scenarios
**Program:** `krexa-agent-wallet` | **Status:** ⬜ Open (deferred) | **Severity:** Medium

No explicit one-time liquidation guard in instruction path; repeated keeper-triggered calls can repeatedly record liquidation penalties when debt remains unresolved.

**Evidence:** `solana-programs/programs/krexa-agent-wallet/src/instructions/liquidate.rs:21-126`

---

#### SOL-042 (Re-validated): `ExecuteTrade` does not bind `venue_token` to venue identity
**Program:** `krexa-agent-wallet` | **Status:** ⬜ Open (deferred) | **Severity:** Medium

`venue_token` is constrained by mint only; it is not bound to `venue_entry.program_id` ownership/identity.

**Evidence:** `solana-programs/programs/krexa-agent-wallet/src/lib.rs:257-269`, `solana-programs/programs/krexa-agent-wallet/src/instructions/execute_trade.rs:50-61`
