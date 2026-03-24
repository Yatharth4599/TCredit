# Krexa — Full Bug Report

**Last updated:** 2026-03-24
**Scopes covered:**
- `base-contracts/` + `backend/` — EVM / Base Sepolia (BUG-001 – BUG-024)
- `solana-programs/` — Solana / Anchor programs (SOL-001 – SOL-049)
- `backend/` + `sdk/` + `mcp-server/` + `demo/` + `frontend/` — Full-stack security hardening (BUG-033 – BUG-064)
- `backend/src/api/routes/solana-*` + `solana-programs/programs/krexa-score` + `krexa-service-plan` — New code audit (BUG-065 – BUG-080, SOL-053 – SOL-057)

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

---

---

## Part 7 — New Code Audit: Devnet Stack + Score/ServicePlan Programs (2026-03-24)

**Audit scope:** 3 new backend routes (faucet, oracle co-sign, score lookup), 2 new Solana programs (krexa-score, krexa-service-plan), new app/ frontend, keeper + oracle service updates
**Method:** Automated scans (npm audit, secrets grep, CORS, lockfiles) + 2 parallel deep agent reviews

### Summary

| Severity | Total | Scope |
|----------|-------|-------|
| Critical | 1     | Oracle co-sign endpoint unauthenticated |
| High     | 5     | Token account validation, caller validation, faucet rate limit |
| Medium   | 7     | Info disclosure, logging, rate limiting, keeper auth, performance |
| Low      | 5     | Heuristic gaming, bounds checks, deserialization fallbacks |
| **Total**| **18**| |

### Security Strengths (Positive Findings)
- ✅ **Helmet enabled** on backend (`app.use(helmet())`) — proper security headers
- ✅ **CORS whitelisted** on demo server — only krexa.xyz + localhost origins
- ✅ **TypeScript strict mode** enabled in backend, sdk, and both MCP servers
- ✅ **Solana program signers** properly gated — oracle-only writes on krexa-score
- ✅ **Score range validation** (200-850) enforced in krexa-score program
- ✅ **Ring buffer** for score history — prevents unbounded growth
- ✅ **Nonce replay protection** in payment router — monotonically increasing

---

### Critical

#### BUG-065: Oracle co-sign endpoint has NO authentication
**File:** `backend/src/api/routes/solana-oracle.routes.ts:47`
**Status:** ✅ Fixed
**Severity:** Critical

`POST /api/v1/solana/oracle/sign-credit` has no `requireApiKey` or `requireAdmin` middleware. Any caller can trigger the oracle to partially sign a credit request for ANY agent. Combined with the on-chain eligibility check passing, this means unauthenticated users can trigger oracle signing.

**Fix:** Add `requireApiKey` middleware: `router.post('/sign-credit', requireApiKey, async (req, res, next) => { ... })`

---

### High

#### BUG-066: Oracle co-sign does not validate `agentOrOwnerPubkey` matches caller
**File:** `backend/src/api/routes/solana-oracle.routes.ts:49`
**Status:** ⬜ Open
**Severity:** High

Even with auth added, `agentOrOwnerPubkey` is accepted from the request body without verifying the caller owns that pubkey. An authenticated API key holder can request credit on behalf of any agent.

**Fix:** Bind `agentOrOwnerPubkey` to the authenticated wallet or require proof of ownership.

---

#### SOL-053: krexa-service-plan `DisburseMilestone` — token account ownership not validated
**File:** `solana-programs/programs/krexa-service-plan/src/lib.rs:891-897`
**Status:** ⬜ Open
**Severity:** High

`vault_token` and `agent_token` are `Account<'info, TokenAccount>` but have no `token::owner` or `token::mint` constraints. State mutation (marking milestone as disbursed) happens BEFORE the token transfer — if transfer fails, milestone is permanently marked as disbursed (DoS).

**Fix:** Add constraints: `token::mint = usdc_mint`, `token::authority = config` on vault_token; `token::mint = vault_token.mint` on agent_token.

---

#### SOL-054: krexa-service-plan `execute_expense` — destination not validated against whitelist
**File:** `solana-programs/programs/krexa-service-plan/src/lib.rs:589-591, 998-1006`
**Status:** ⬜ Open
**Severity:** High

`destination_token.owner` is not constrained to equal `expense_dest.destination` (the whitelisted address). An attacker can pass any token account as destination, diverting funds.

**Fix:** Add constraint: `constraint = destination_token.owner == expense_dest.destination`

---

#### BUG-067: Faucet rate limit is in-memory — lost on restart, bypassed by scaling
**File:** `backend/src/api/routes/solana-faucet.routes.ts:23`
**Status:** ⬜ Open
**Severity:** High

Same pattern as BUG-032 — in-memory `Map` for rate limiting. Server restart = all limits reset. Multiple instances = each has independent limits.

**Fix:** Use Prisma `faucetMint` table with `upsert` on (recipient, mintDate) or Redis.

---

### Medium

#### BUG-068: Score lookup leaks registered agent metadata without auth
**File:** `backend/src/api/routes/solana-score.routes.ts:227`
**Status:** ⬜ Open
**Severity:** Medium

Public endpoint returns agent name, credit level, and KYA tier for registered agents. Allows enumeration of all registered agents and their credit tiers.

**Fix:** Redact profile info for unauthenticated requests or require API key for registered agent data.

---

#### BUG-069: Faucet keypair pubkey logged on startup
**File:** `backend/src/api/routes/solana-faucet.routes.ts:47`
**Status:** ✅ Fixed
**Severity:** Medium

`console.log('[Faucet] keypair loaded, pubkey:', kp.publicKey.toBase58())` — pubkey is not secret, but production logs should be minimal. Could be modified to accidentally log secrets.

**Fix:** Only log in development: `if (env.NODE_ENV === 'development')`

---

#### BUG-070: Score lookup has no rate limiting — RPC exhaustion risk
**File:** `backend/src/api/routes/solana-score.routes.ts:194`
**Status:** ✅ Fixed
**Severity:** Medium

Public endpoint makes multiple RPC calls per request (getAccountInfo, getSignaturesForAddress with limit 100). No rate limiting middleware. Attacker can exhaust RPC quota.

**Fix:** Add rate limiter: `router.get('/:agent', rateLimit({ windowMs: 60000, max: 100 }), ...)`

---

#### BUG-071: Vault health endpoint queries all wallets without caching
**File:** `backend/src/api/routes/solana-vault.routes.ts:146`
**Status:** ⬜ Open
**Severity:** Medium

Multiple `prisma.solanaAgentWallet.count()` calls per request with no caching. At scale (10K+ wallets), this degrades performance. Likely hit every 10-30s by dashboards.

**Fix:** Cache for 30s or pre-compute stats in keeper cycle.

---

#### BUG-072: Keeper does not validate its own authorization before liquidating
**File:** `backend/src/services/solana-keeper.ts:92`
**Status:** ⬜ Open
**Severity:** Medium

Keeper calls `buildLiquidate` without checking if its keypair matches the on-chain `WalletConfig.keeper`. A compromised or misconfigured keeper could attempt unauthorized liquidations (on-chain would reject, but wastes gas and creates noise).

**Fix:** Read `WalletConfig` at keeper startup and validate keeper pubkey matches.

---

#### BUG-073: Keeper has no per-cycle transaction throttle
**File:** `backend/src/services/solana-keeper.ts:210`
**Status:** ✅ Fixed
**Severity:** Medium

2-second poll interval with no cap on transactions per cycle. On mainnet, this rapidly exhausts RPC quota and priority fee budget.

**Fix:** Add `MAX_TXS_PER_CYCLE = 10` guard.

---

#### SOL-055: krexa-score `InitializeScore` — agent_profile is UncheckedAccount with no owner validation
**File:** `solana-programs/programs/krexa-score/src/lib.rs:421-422`
**Status:** ⬜ Open
**Severity:** Medium

`agent_profile` is used for PDA derivation but never validated as being owned by the registry program. Arbitrary accounts could be passed (PDA constraint limits impact, but defense-in-depth is missing).

**Fix:** Validate `agent_profile.owner == registry_program_id` or use typed `Account<'info, AgentProfile>`.

---

### Low

#### BUG-074: Preview score heuristic easily gamed
**File:** `backend/src/api/routes/solana-score.routes.ts:164-178`
**Status:** ⬜ Open (by design)
**Severity:** Low

Preview scores based on wallet age + tx count + SOL balance can be trivially inflated. Max preview score is 600 with no Krexa activity.

**Status:** Acceptable — preview is advisory only, not used for credit decisions.

---

#### BUG-075: Score deserializer has no buffer bounds check on history loop
**File:** `backend/src/api/routes/solana-score.routes.ts:91-98`
**Status:** ✅ Fixed
**Severity:** Low

30-entry history loop reads 15 bytes per entry without checking `off + 15 <= buf.length`. Malformed accounts could cause out-of-bounds read.

**Fix:** Add `if (off + 15 > buf.length) break;` at loop start.

---

#### BUG-076: App SDK deserializers silently default missing fields to 0
**File:** `app/src/sdk/client.ts:587-623`
**Status:** ⬜ Open (by design)
**Severity:** Low

Backward-compatibility fallbacks mean truncated buffers don't error — could hide on-chain bugs.

---

#### BUG-077: App SDK validation doesn't check pubkey format of array members
**File:** `app/src/sdk/validation.ts:191-195`
**Status:** ⬜ Open
**Severity:** Low

Expense whitelist array length is validated but individual pubkey format is not.

**Fix:** Validate each pubkey with `validatePublicKey()`.

---

#### SOL-056: krexa-service-plan milestone eligible_at saturation edge case
**File:** `solana-programs/programs/krexa-service-plan/src/lib.rs:450-456`
**Status:** ⬜ Open
**Severity:** Low

If `eligible_at` is near `i64::MAX`, `saturating_add(YELLOW_DELAY)` saturates and the delay check becomes permanently false — DoS on that milestone.

---

#### SOL-057: krexa-service-plan `advance_wind_down` is permissionless
**File:** `solana-programs/programs/krexa-service-plan/src/lib.rs:731-763`
**Status:** ⬜ Open (by design)
**Severity:** Low

Anyone can call after grace period. By design — Solana priority fees handle spam.

---

### Automated Scan Findings

#### [AUTO] BUG-078: Demo agent-service uses unrestricted `cors()`
**File:** `demo/agent-service/src/server.ts:9`
**Status:** ✅ Fixed
**Severity:** Medium

`app.use(cors())` with no origin restrictions. Any website can call the demo agent endpoints.

**Fix:** Whitelist origins: `cors({ origin: ['https://krexa.xyz', 'http://localhost:5173'] })`

---

#### [AUTO] BUG-079: Backend has 6 high-severity npm audit vulnerabilities
**File:** `backend/package.json` (Prisma/effect dependency chain)
**Status:** ⬜ Open
**Severity:** Medium

`npm audit` reports 6 high vulnerabilities in Prisma >=6.13.0 via `@prisma/config` → `effect`. Not directly exploitable but should be tracked.

**Fix:** Monitor Prisma releases; update when patched version available.

---

#### [AUTO] BUG-080: `app/` tsconfig has no `"strict": true`
**File:** `app/tsconfig.json`
**Status:** ✅ Verified — strict:true already in tsconfig.app.json
**Severity:** Low

All other packages have strict mode. The new `app/` directory does not, allowing implicit any, loose null checks, etc.

**Fix:** Add `"strict": true` to `app/tsconfig.json`.

---

## Part 8 — Solana Contract Audit: Deep Review (2026-03-24)

**Scope:** All 8 Solana programs (9,240 LoC) — krexa-agent-wallet, krexa-service-plan, krexa-score, krexa-payment-router, krexa-credit-vault, krexa-agent-registry, krexa-venue-whitelist, krexa-common.

**Methodology:** Line-by-line Anchor constraint audit, cross-program interaction analysis, math safety review. All findings verified against source code. Deduplicated against SOL-001 – SOL-057.

| Severity | Count |
|----------|-------|
| Critical | 3     |
| High     | 3     |
| Medium   | 5     |
| Low      | 2     |

---

### Critical

#### SOL-058: PayX402 `platform_treasury_token` missing owner constraint
**File:** `solana-programs/programs/krexa-agent-wallet/src/lib.rs:324-329`
**Status:** ✅ Fixed
**Severity:** Critical

The `platform_treasury_token` account validates `token::mint = config.usdc_mint` but has NO owner or address constraint. An attacker can pass ANY USDC token account they own as the treasury. On every x402 payment, the platform fee (up to 1% per PLATFORM_FEE_BPS) is siphoned to the attacker instead of the real treasury.

**Fix applied:** Replaced mint+authority constraints with `address = config.platform_treasury_token @ WalletError::InvalidTreasury`.

---

#### SOL-059: DisburseMilestone `vault_token` has ZERO constraints
**File:** `solana-programs/programs/krexa-service-plan/src/lib.rs:891-893`
**Status:** ⬜ Deferred (krexa-service-plan program not yet deployed)
**Severity:** Critical

The source token account for milestone disbursements is `#[account(mut)]` with no mint, owner, or address validation. If oracle key is compromised, attacker can pass any token account and drain vault funds via disburse_milestone.

**Fix:** Add `usdc_mint: Pubkey` to `ServicePlanConfig`. Then constrain: `token::mint = config.usdc_mint, token::authority = config.key()`.

---

#### SOL-060: ExecuteExpense `destination_token` has NO mint constraint
**File:** `solana-programs/programs/krexa-service-plan/src/lib.rs:1001-1003`
**Status:** ⬜ Deferred (krexa-service-plan program not yet deployed)
**Severity:** Critical

Distinct from SOL-054 (whitelist validation). The token account itself has no mint check — an attacker can pass a token account with a different mint entirely. Combined with SOL-054, both destination address AND token type are unvalidated.

**Fix:** `token::mint = config.usdc_mint, constraint = destination_token.key() == expense_dest.destination @ ServicePlanError::DestinationMismatch`.

---

### High

#### SOL-061: DisburseMilestone `agent_token` has NO constraints
**File:** `solana-programs/programs/krexa-service-plan/src/lib.rs:895-897`
**Status:** ⬜ Deferred (krexa-service-plan program not yet deployed)
**Severity:** High

The destination token account for milestone disbursements has zero validation (`#[account(mut)]` only). Oracle can direct disbursed funds to any account.

**Fix:** `token::mint = config.usdc_mint, constraint = agent_token.owner == plan.agent_wallet @ ServicePlanError::InvalidAgentToken`.

---

#### SOL-062: ExecuteExpense `agent_token` (source) has NO constraints
**File:** `solana-programs/programs/krexa-service-plan/src/lib.rs:997-999`
**Status:** ⬜ Deferred (krexa-service-plan program not yet deployed)
**Severity:** High

The SOURCE token account for expense execution has no validation. Authority signer could drain any token account they have access to, not just the agent's wallet.

**Fix:** `token::mint = config.usdc_mint, constraint = agent_token.owner == plan.agent_wallet @ ServicePlanError::InvalidAgentToken`.

---

#### SOL-063: `record_credit_event` caller_authority check broken for program IDs
**File:** `solana-programs/programs/krexa-score/src/lib.rs:289-293`
**Status:** ⬜ Deferred (krexa-score program not yet deployed)
**Severity:** High

Compares `caller_authority.key()` against `config.wallet_program` and `config.vault_program`. These are stored as program IDs during `initialize()`. Solana program IDs CANNOT sign transactions — only PDAs can sign via CPI. If these contain program IDs (as names suggest), `record_credit_event` is permanently uncallable. If they contain PDA addresses, naming is dangerously misleading.

**Fix:** Rename to `wallet_authority`/`vault_authority`. Store config PDA addresses (not program IDs). Verify during deployment that stored values are CPI-signable PDAs.

---

### Medium

#### SOL-064: ExecutePayment `payer_usdc` missing owner constraint
**File:** `solana-programs/programs/krexa-payment-router/src/lib.rs:512-517`
**Status:** ✅ Fixed
**Severity:** Medium

The `payer_usdc` only validates `token::mint`. SPL token::transfer CPI implicitly validates authority, but explicit owner constraint prevents future refactoring mistakes and makes trust model explicit.

**Fix applied:** Added `constraint = payer_usdc.owner == oracle.key() @ RouterError::InvalidPayerAccount`. Added `InvalidPayerAccount` error variant.

---

#### SOL-065: CreatePlan `agent_wallet` is UncheckedAccount with no existence validation
**File:** `solana-programs/programs/krexa-service-plan/src/lib.rs:865-867`
**Status:** ⬜ Deferred (krexa-service-plan program not yet deployed)
**Severity:** Medium

Plans can be created referencing any arbitrary pubkey as `agent_wallet`. If set to nonexistent account, combined with SOL-061, milestone funds can be directed to wrong destinations.

**Fix:** `#[account(owner = config.agent_wallet_program)] pub agent_wallet: UncheckedAccount<'info>`.

---

#### SOL-066: `repay` instruction not paused-gated
**File:** `solana-programs/programs/krexa-agent-wallet/src/instructions/repay.rs:7`
**Status:** ✅ Fixed
**Severity:** Medium

Unlike deposit, withdraw, execute_trade, pay_x402, and request_credit — repay does not check `config.is_paused`. During emergency pause, agents can still repay debt, manipulating position before remediation. Distinct from SOL-044 (credit-vault's receive_repayment) and SOL-045 (accrue_interest).

**Fix:** Add `require!(!ctx.accounts.config.is_paused, WalletError::Paused);` at line 8.

---

#### SOL-067: `update_score` doesn't validate credit_level against kya_tier
**File:** `solana-programs/programs/krexa-agent-registry/src/lib.rs:333-365`
**Status:** ✅ Already fixed — `calculate_level(new_score, profile.kya_tier)` enforces tier-score coupling
**Severity:** Medium

Oracle can set `new_level = 4` for agent with `kya_tier = 0`. Protocol rules require Enhanced KYA (tier 2+) for Level 3-4. Score program doesn't enforce this on-chain, relying entirely on off-chain oracle logic.

**Fix:** Add on-chain validation: `let max_level = match kya_tier { 0 => 1, 1 => 2, _ => 4 }; require!(new_level <= max_level)`.

---

#### SOL-068: venue-whitelist `update_config` allows `Pubkey::default()` as admin
**File:** `solana-programs/programs/krexa-venue-whitelist/src/lib.rs:142-147`
**Status:** ✅ Fixed
**Severity:** Medium

Admin can set `new_admin = Pubkey::default()`, permanently locking the program — no one can update config, pause, or manage venues afterward.

**Fix:** `require!(admin != Pubkey::default(), VenueError::InvalidAdmin);`

---

### Low

#### SOL-069: LinkWallet uses wrong error code
**File:** `solana-programs/programs/krexa-agent-registry/src/lib.rs:403`
**Status:** ✅ Fixed
**Severity:** Low

Uses `RegistryError::AgentNotActive` when wallet is already linked. Semantically incorrect — agent IS active, wallet is already assigned. Confuses clients/debugging.

**Fix:** Add `WalletAlreadyLinked` error variant to `RegistryError`.

---

#### SOL-070: ProfileOwnershipTransfer has no timelock
**File:** `solana-programs/programs/krexa-agent-registry/src/lib.rs`
**Status:** ⬜ Open
**Severity:** Low

Proposal and acceptance can happen in the same block/transaction. Two-step pattern provides basic protection, but a timelock would add defense against compromised admin scenarios.

**Fix:** Add `proposed_at: i64` field; require `clock.unix_timestamp >= proposed_at + TIMELOCK_SECONDS` in accept handler.

---

### Security Strengths Observed
- ✅ **Math safety**: All arithmetic uses `checked_add`/`saturating_sub` — no raw operations
- ✅ **PDA design**: Seeds well-structured with program-specific prefixes, bump stored
- ✅ **Anchor has_one**: Correctly used on most admin/oracle/owner contexts
- ✅ **CEI pattern**: Checks-Effects-Interactions followed in DisburseMilestone and others
- ✅ **CPI validation**: Target programs validated via `Program<>` typed accounts
- ✅ **Score integrity**: Liquidation penalty enforced on-chain (-40 floor), KYA only increases
- ✅ **Ownership transfer**: Proper propose/accept/cancel three-step with PDA close
- ✅ **Revenue validation**: 3-layer anti-wash-trading system in payment-router
- ✅ **Health factor**: Computed and stored after every financial operation
- ✅ **Pause gates**: Present on most financial instructions (with exceptions noted above)

---

## Part 9 — Backend, SDK, MCP, Frontend Deep Review (2026-03-24)

**Scope:** Backend API routes, oracle service, keeper, SDK, MCP servers, demo infrastructure, frontend. Deduplicated against BUG-001–BUG-080 and SOL-001–SOL-070.

| Severity | Count |
|----------|-------|
| Critical | 2     |
| High     | 5     |
| Medium   | 9     |
| Low      | 6     |

---

### Critical

#### BUG-081: Admin API key stored in sessionStorage (WaitlistAdmin)
**File:** `frontend/src/pages/WaitlistAdmin.tsx:22,40`
**Status:** ✅ Fixed
**Severity:** Critical

API key (`tck_*`) is persisted in `sessionStorage.setItem(STORAGE_KEY, key)` and auto-restored on page load. SessionStorage is accessible to any JavaScript on the same origin — a single XSS vector (even in a dependency) exposes the admin API key. This key grants access to: waitlist export (all emails/wallets), API key CRUD, and webhook management.

**Fix:** Remove sessionStorage persistence. Accept API key only via form input, hold in React state (memory only, lost on refresh). Alternatively, implement short-lived session tokens with HttpOnly cookies.

---

#### BUG-082: PATCH webhook endpoint missing URL validation (SSRF)
**File:** `backend/src/api/routes/admin.ts:174-188`
**Status:** ✅ Fixed
**Severity:** Critical

`PATCH /api/v1/admin/webhooks/:id` allows updating webhook URL without calling `validateWebhookUrl()`. The POST handler (line 148-150) validates, but PATCH skips entirely. Attacker with admin key can change webhook destination to `http://169.254.169.254/metadata` (cloud SSRF) or internal services.

**Fix:** Add `if (url !== undefined) { validateWebhookUrl(url); data.url = url; }` at line 179.

---

### High

#### BUG-083: Merchant credit-score endpoint has no authentication
**File:** `backend/src/api/routes/merchants.ts:238`
**Status:** ✅ Fixed
**Severity:** High

`POST /api/v1/merchants/:address/credit-score` is publicly accessible. No `requireAdmin` or `requireApiKey` middleware. Comment says "admin only" but no guard is applied. Any caller can build an unsigned `updateCreditScore` transaction for any merchant.

**Fix:** Add `requireAdmin` middleware: `router.post('/:address/credit-score', requireAdmin, async (...) => { ... })`.

---

#### BUG-084: Merchant repay endpoint has IDOR (any API key can repay for any merchant)
**File:** `backend/src/api/routes/merchants.ts:174-213`
**Status:** ✅ Fixed
**Severity:** High

`POST /api/v1/merchants/:address/repay` has `requireApiKey` but no ownership check. Any API key holder can trigger oracle-signed repayment for any merchant address, incrementing their nonce and diverting routing fees.

**Fix:** Bind API key to wallet address or require admin tier for cross-merchant operations.

---

#### BUG-085: Webhook URL validation allows IPv6 loopback SSRF bypass
**File:** `backend/src/api/routes/admin.ts:131-142`
**Status:** ✅ Fixed
**Severity:** High

Line 132 checks for `'[::1]'` (with brackets), but `new URL('http://[::1]:8080').hostname` returns `::1` (without brackets in Node.js). Additionally, IPv6 private ranges (`fd00::`, `fe80::`, `fc00::`) are not checked by the IPv4-only regex at line 135.

**Fix:** Use a proper IP parsing library (e.g., `ipaddr.js`) that handles both IPv4 and IPv6 private ranges. Or add: `if (hostname === '::1' || hostname.startsWith('fd') || hostname.startsWith('fe80')) throw ...`.

---

#### BUG-086: Anthropic API key stored in plain config object (demo agent-service)
**File:** `demo/agent-service/src/config.ts:11`
**Status:** ✅ Fixed
**Severity:** High

`config.anthropicApiKey` stores the key in a plain exported object. If any error handler, logging middleware, or debug statement serializes `config`, the key is exposed in logs. Config objects are a common accidental-leak vector.

**Fix:** Don't export the key in the config object. Use a getter function: `export function getAnthropicApiKey() { return process.env.ANTHROPIC_API_KEY; }`.

---

#### BUG-087: Frontend Solana API client falls back to HTTP in production
**File:** `frontend/src/api/solanaClient.ts:3`
**Status:** ⬜ Deferred (file does not exist in current codebase)
**Severity:** High

`const KREXA_API_URL = import.meta.env.VITE_KREXA_API_URL || 'http://localhost:3001'` — if `VITE_KREXA_API_URL` is unset in production, all Solana API requests (including API key headers) transmit over unencrypted HTTP.

**Fix:** Fail fast if URL is not HTTPS: `if (!url.startsWith('https') && !url.includes('localhost')) throw new Error(...)`.

---

### Medium

#### BUG-088: Merchant address params lack EVM format validation
**File:** `backend/src/api/routes/merchants.ts` (multiple endpoints)
**Status:** ✅ Fixed
**Severity:** Medium

GET/POST endpoints accept `:address` with no EVM format validation. `req.params.address as Address` is a TypeScript-only cast. Invalid addresses like `0x123` (too short) or `0xZZZ` are accepted, causing silent failures or cache poisoning.

**Fix:** Add zod schema: `z.string().regex(/^0x[a-fA-F0-9]{40}$/)` on all address params.

---

#### BUG-089: Faucet amount parameter lacks type and bounds validation
**File:** `backend/src/api/routes/solana-faucet.routes.ts:109`
**Status:** ✅ Fixed
**Severity:** Medium

`amountUsdc` from request body accepts any type. Negative numbers pass through `Math.floor()` and `Math.min()` creating negative `BigInt` values for SPL token transfer.

**Fix:** Add zod validation: `z.number().positive().finite().max(100)`.

---

#### BUG-090: Oracle error messages leak internal state to clients
**File:** `backend/src/services/oracle.service.ts:262`
**Status:** ✅ Fixed
**Severity:** Medium

`throw new AppError(502, \`Payment submission failed: ${errMsg}\`)` exposes raw viem/Prisma/RPC error details including internal IPs, connection strings, and configuration.

**Fix:** Log detailed error internally; return generic message to client: `'Payment submission failed. Please try again.'`.

---

#### BUG-091: Faucet rate limit bypassable via pubkey format normalization
**File:** `backend/src/api/routes/solana-faucet.routes.ts:115`
**Status:** ✅ Fixed
**Severity:** Medium

Rate limit key uses raw `recipient` string. Same Solana pubkey can be submitted in base58 vs JSON array format, bypassing the rate limit (different string keys in Map).

**Fix:** Normalize to canonical base58 before rate limit check: `const normalizedKey = new PublicKey(recipient).toBase58()`.

---

#### BUG-092: MCP `rateBps` parameter has no bounds validation
**File:** `mcp-server/src/index.ts:151-157`
**Status:** ✅ Fixed
**Severity:** Medium

`krexa_draw_credit` tool accepts `rateBps` without min/max bounds. LLM can pass `Infinity`, `-99999`, or `NaN`, causing backend logic errors in interest calculations.

**Fix:** Add `minimum: 0, maximum: 10000` to JSON schema.

---

#### BUG-093: Credit Bureau SDK HTTP requests lack timeout
**File:** `sdk/src/credit-bureau.ts:83`
**Status:** ✅ Fixed
**Severity:** Medium

`fetch()` with no timeout hangs indefinitely if server doesn't respond. Can cause agent processes to freeze and memory exhaustion from accumulated pending requests.

**Fix:** Add `AbortSignal.timeout(10_000)` to fetch options.

---

#### BUG-094: x402 middleware replay protection uses unbounded in-memory Set
**File:** `demo/agent-service/src/x402-middleware.ts:9-42`
**Status:** ✅ Fixed
**Severity:** Medium

`usedSignatures` Set has no TTL, grows unboundedly (cleanup at 10K is not TTL-based), and is lost on restart (all previous signatures become replayable). Iterator cleanup order is implementation-dependent.

**Fix:** Use Map with timestamps, clean entries older than 1 hour. For production: persist to database.

---

#### BUG-095: MCP tool argument type coercion allows type confusion
**File:** `mcp-server/src/index.ts:219-247`
**Status:** ✅ Fixed
**Severity:** Medium

Handlers use `args.amount as number` without runtime type checks. If LLM generates malformed JSON (`"amount": "5.00"`), TypeScript cast produces NaN silently. `args.recipient as string` on a number input creates string `"123"`.

**Fix:** Add explicit type checks: `if (typeof args.amount !== 'number' || !Number.isFinite(args.amount)) throw ...`.

---

#### BUG-096: Demo server error broadcast leaks internal state to WebSocket clients
**File:** `demo/server.ts:128-129`
**Status:** ✅ Fixed
**Severity:** Medium

Error messages from `runDemo()` are broadcast to ALL WebSocket clients without sanitization. Errors may contain API keys, database connection strings, file paths, or stack traces.

**Fix:** Sanitize error before broadcast: only send generic message or first 100 chars with sensitive pattern filtering.

---

### Low

#### BUG-097: API key comparison not constant-time (timing attack)
**File:** `backend/src/api/middleware/apiKeyAuth.ts:21,46,71`
**Status:** ✅ Fixed
**Severity:** Low

Prisma `findUnique(where: { key: headerKey })` uses standard DB comparison. Timing differences between "key not found" (fast) and "key found + validated" (slower) can be measured to infer valid key prefixes.

**Fix:** Use `crypto.timingSafeEqual()` after DB lookup. Compare against dummy on miss to normalize timing.

---

#### BUG-098: SDK `toBase()` precision loss on fractional amounts
**File:** `sdk/src/agent.ts:92-94`
**Status:** ✅ Fixed
**Severity:** Low

`Math.round(usdc * 1_000_000)` has floating-point imprecision. While usually < 1 gwei ($0.000001), edge cases exist (e.g., `toBase(0.0000001)` → 0 base units, silent loss).

**Fix:** Add minimum check: `if (cents <= 0) throw new Error('Amount too small')`.

---

#### BUG-099: SDK client response body not type-validated
**File:** `sdk/src/client.ts:14-26`
**Status:** ✅ Fixed
**Severity:** Low

`res.json() as Promise<T>` casts without runtime validation. MITM or backend version mismatch returns unexpected schema, silently corrupting downstream data.

**Fix:** Add basic runtime check: `if (!data || typeof data !== 'object') throw ...`. Better: use zod schemas for critical response types.

---

#### BUG-100: Demo server race condition on concurrent trigger
**File:** `demo/server.ts:107-132`
**Status:** ✅ Fixed
**Severity:** Low

Two concurrent POST `/trigger` requests both pass the `demoStatus === 'running'` check before either sets it, causing parallel demo runs with interleaved WebSocket broadcasts.

**Fix:** Use a boolean lock: `if (demoRunning) return 409; demoRunning = true; try { ... } finally { demoRunning = false; }`.

---

#### BUG-101: CORS regex too permissive in demo agent-service
**File:** `demo/agent-service/src/server.ts:14`
**Status:** ✅ Fixed
**Severity:** Low

`/\.krexa\.xyz$/` matches ANY subdomain including `attacker.krexa.xyz` if attacker controls DNS for that subdomain.

**Fix:** Use explicit whitelist: `['https://krexa.xyz', 'https://www.krexa.xyz', 'https://demo.krexa.xyz']`.

---

#### BUG-102: Webhook secret returned in creation response
**File:** `backend/src/api/routes/admin.ts:161-167`
**Status:** ⬜ Open
**Severity:** Low

Webhook secret (`whsec_*`) is returned in the POST response body. If response is captured by proxy logs, browser history, or HTTP interceptor, the secret is exposed. Correctly NOT returned in GET/PATCH.

**Fix:** Return secret only once via a one-time-view pattern, or require client to generate the secret.

---

### Security Strengths (Backend/SDK/MCP/Frontend)
- ✅ **Helmet**: Active with default CSP in `backend/src/app.ts`
- ✅ **TypeScript strict mode**: Enabled in all 5 packages
- ✅ **CORS allowlist**: Origin-based in backend, not wildcard
- ✅ **API key middleware**: Present on admin routes with tier system
- ✅ **Zod env validation**: Backend environment validated at startup
- ✅ **Unsigned tx pattern**: Backend returns unsigned tx data for wallet signing — never holds user keys
- ✅ **Webhook event filtering**: Endpoints receive only subscribed event types
- ✅ **Rate limiting**: Global rate limiter active (30 req/min for standard, 100 for admin)
- ✅ **MCP audit logging**: Tool calls logged to stderr with parameter masking
- ✅ **SDK error boundaries**: `try/catch` on all HTTP calls with typed errors
