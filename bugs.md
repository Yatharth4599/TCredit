# Krexa — Full Bug Report

**Last updated:** 2026-03-16
**Scopes covered:**
- `base-contracts/` + `backend/` — EVM / Base Sepolia (BUG-001 – BUG-024)
- `solana-programs/` — Solana / Anchor programs (SOL-001 – SOL-049)
- `backend/` + `sdk/` + `mcp-server/` + `demo/` + `frontend/` — Full-stack (BUG-033 – BUG-064)

### Overall Status

| Status | Count |
|--------|-------|
| ✅ Fixed / Resolved | 91 |
| 🟡 Mitigated | 2 |
| ⚠️ Accepted risk | 3 |
| ⬜ Open (deferred/by-design) | 13 |
| ⬜ Open (needs work) | 5 |
| **Total** | **114** |

### Open Bugs — Quick Reference

#### Needs Code (5)

| ID | Severity | Component | Issue | Blocker |
|----|----------|-----------|-------|---------|
| BUG-032 | Medium | Backend | Rate limiting is in-memory, resets on restart/scale-out | Needs Redis |
| BUG-038 | Medium | Keeper | Health factor thresholds hardcoded instead of read from chain | Needs on-chain VaultConfig reader |
| BUG-052 | High | Oracle | Credit score computed from mutable DB — no on-chain cross-validation | Architectural: needs IndexerState integration |
| BUG-053 | Medium | Oracle | Keypair cached indefinitely, no rotation mechanism | Needs KMS integration (AWS/Hashicorp) |
| BUG-058 | High | SDK | Server responses not schema-validated — MITM can inject fake data | Needs Zod dependency + response schemas |

#### Deferred — Solana On-Chain Changes Required (8)

| ID | Severity | Program | Issue | Rationale |
|----|----------|---------|-------|-----------|
| SOL-025 | Medium | agent-wallet | `deleverage` only freezes, no position reduction | Rework planned |
| SOL-026 | Medium | agent-wallet | Double liquidation not prevented in shortfall | Shortfall tracking partially mitigates |
| SOL-030 | Medium | credit-vault | `deposited_amount` breaks on withdrawal with yield | Proportional tracking needed |
| SOL-032 | Medium | payment-router | Fee truncation to zero on small payments | Min payment enforcement needed |
| SOL-042 | Medium | agent-wallet | `venue_token` not validated against venue identity | Requires ATA derivation check |
| SOL-050 | Medium | agent-registry | No expiry on ownership transfer requests | Add 7-day expiry check |
| SOL-051 | Low | agent-wallet | Minimum keeper reward not enforced — dust positions | Add min reward or admin force_liquidate |
| SOL-052 | Low | agent-wallet | Admin can unfreeze wallet with outstanding shortfall | Add shortfall check on unfreeze |

#### By Design (5)

| ID | Severity | Program | Issue | Rationale |
|----|----------|---------|-------|-----------|
| SOL-023 | Medium | agent-wallet | `liquidate` does not check `is_paused` | Liquidation must work when paused — safety critical |
| SOL-044 | Low | credit-vault | `receive_repayment` not paused-gated | Repayments should always be accepted |
| SOL-045 | Low | credit-vault | `accrue_interest` not paused-gated | Interest accrual is passive/read-like |
| SOL-049 | Low | venue-whitelist | `deactivate_venue` does not check pause | Deactivation is a safety action |
| BUG-061 | High | MCP | Two divergent implementations | Needs decision: consolidate to one |

#### Cosmetic (2)

| ID | Severity | Program | Issue |
|----|----------|---------|-------|
| SOL-038 | Low | venue-whitelist | `total_venues` never decremented on deactivation — rename to `total_venues_created` |
| SOL-043 | Low | agent-wallet | `WalletConfig::LEN` comment mismatch |

#### Accepted Risk (3)

| ID | Severity | Component | Issue | Rationale |
|----|----------|-----------|-------|-----------|
| BUG-019 | Low | Base contracts | Admin can overwrite reputation values | Governance risk — timelock/multisig future |
| BUG-031 | Medium | Backend | Webhook secrets stored plaintext | Industry standard (Stripe, GitHub do same) |
| BUG-045 | Low | Backend | No CSRF protection | Mitigated by X-API-Key header requirement |

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

## Part 5 — Full-Stack Security Audit (2026-03-16)

**Audit scope:** Solana programs (re-audit), Backend REST API, Oracle, Keeper, SDK, MCP server, Demo infrastructure, Frontend
**Method:** 3 parallel static analysis agents + manual cross-reference against Parts 1–4

### Summary

| Severity | Total | Scope |
|----------|-------|-------|
| Critical | 2     | Demo infra, .env.example |
| High     | 3     | Backend IDOR, Demo x402 |
| Medium   | 7     | Keeper, Oracle, SDK, MCP, Frontend, Solana |
| Low      | 4     | Error handling, CSRF, info disclosure, Solana |
| **Total**| **16**| |

### Solana Programs Re-Audit

All SOL-001 through SOL-049 fixes verified in place. No regressions. Overall posture: **strong**.

---

### Critical

#### BUG-033: Demo server writes Solana keypairs to world-readable `/tmp`
**File:** `demo/server.ts:28-46`
**Status:** ✅ Fixed
**Severity:** Critical

`bootstrapKeypairs()` decodes base64 env vars (AGENT_KEYPAIR, OWNER_KEYPAIR, ORACLE_KEYPAIR, CUSTOMER_KEYPAIR) and writes them as plaintext JSON to `/tmp/krexa-keys/`. On shared Render dynos or any multi-user host, any process can read these files (`/tmp` is world-readable by default).

**Fix:** Keep keypairs in memory only. Replace file-write approach with an in-memory loader that returns `Keypair` objects directly from the base64 env var, passed to `runDemo()` as a config argument. Remove all `writeFileSync` to `/tmp`.

---

#### BUG-034: `base-contracts/.env.example` contains real Basescan API key
**File:** `base-contracts/.env.example:3`
**Status:** ✅ Fixed
**Severity:** Critical

`BASESCAN_API_KEY=JVPQ3556WXETFE7FSKRQEW84W2MZTKA9FV` — a real API key committed to source. BUG-010 fixed the private key placeholder but missed this credential.

**Fix:** Replace with `BASESCAN_API_KEY=<your-basescan-api-key>`. Rotate the exposed key in the Basescan dashboard.

---

### High

#### BUG-035: IDOR on `GET /merchants/:address/repayments` — no auth
**File:** `backend/src/api/routes/merchants.ts:137`
**Status:** ✅ Fixed
**Severity:** High

Endpoint returns full payment history (amounts, tx hashes, payment IDs, error messages) for any merchant address. No `requireApiKey` middleware. An attacker can enumerate all merchant payment histories by iterating addresses.

**Fix:** Add `requireApiKey` middleware to this route.

---

#### BUG-036: Demo x402 middleware doesn't verify payment recipient, amount, or idempotency
**File:** `demo/agent-service/src/x402-middleware.ts:9-27`
**Status:** ✅ Fixed
**Severity:** High

`verifyPayment()` only checks: (1) tx exists on-chain, (2) within 5 minutes, (3) no on-chain errors. Does NOT verify payment recipient matches merchant wallet, payment amount matches required price, or that the signature hasn't been used before. An attacker can reuse one valid tx signature for unlimited API calls.

**Fix:** Validate recipient by parsing SPL token transfer instructions. Validate amount matches the price parameter. Track used signatures in a Set/DB and reject duplicates.

---

#### BUG-037: Demo agent-service token address not format-validated — prompt injection risk
**File:** `demo/agent-service/src/server.ts:32-52`
**Status:** ✅ Fixed
**Severity:** High

Only validates string length (32-44 chars), not base58 format. Input is passed directly into Claude prompt: `Analyze the token at address: ${tokenAddress}`. An attacker can inject prompt manipulation via a crafted "address" string that passes the length check.

**Fix:** Validate against base58 regex: `/^[1-9A-HJ-NP-Za-km-z]{32,44}$/`. Optionally validate as a real `PublicKey`.

---

### Medium

#### BUG-038: Keeper hardcodes health factor thresholds
**File:** `backend/src/services/solana-keeper.ts:25-28`
**Status:** ⬜ Open
**Severity:** Medium

Liquidation thresholds (10500, 12000, 13000 bps) are hardcoded constants. If on-chain VaultConfig thresholds are updated, the keeper operates on stale values — either missing liquidations or liquidating healthy wallets.

**Fix:** Read thresholds from on-chain `VaultConfig` PDA at the start of each keeper cycle.

---

#### BUG-039: No idempotency enforcement on oracle payment endpoint
**File:** `backend/src/api/routes/oracle.ts:18-37`
**Status:** ✅ Fixed
**Severity:** Medium

`POST /api/v1/oracle/payment` accepts optional `paymentId` but doesn't enforce uniqueness. Identical requests create separate DB records and could sign/submit duplicate on-chain transactions.

**Fix:** Add unique constraint on `(from, to, amount, paymentId)` in Prisma schema. Reject duplicates with 409 Conflict.

---

#### BUG-040: Webhook URL validation missing — SSRF risk
**File:** `backend/src/api/routes/admin.ts:124-150`
**Status:** ✅ Fixed
**Severity:** Medium

`POST /api/v1/admin/webhooks` accepts any URL without validation. An attacker with admin API key can register `http://localhost:6379` or `http://169.254.169.254` to probe internal services when webhook fires.

**Fix:** Validate URL scheme (HTTPS only in production). Block private IP ranges (127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16).

---

#### BUG-041: MCP server doesn't validate agent address format at startup
**File:** `mcp-server/src/index.ts:33-38`
**Status:** ✅ Fixed
**Severity:** Medium

`KREXA_AGENT_ADDRESS` is passed directly to SDK without format validation. If empty, malformed, or pointing to wrong agent, the LLM silently operates on the wrong account or gets cryptic runtime errors.

**Fix:** Validate address format on startup (base58 for Solana, 0x hex for Base). Fail fast with clear error.

---

#### BUG-042: SDK `baseUrl` not validated — can redirect to malicious API
**File:** `sdk/src/client.ts:205`
**Status:** ✅ Fixed
**Severity:** Medium

`KrexaSDK` accepts any `baseUrl` without validation. A supply-chain attack or config compromise could redirect all API calls (including payment submissions) to a malicious server.

**Fix:** Add warning log when non-default URLs are used. In production builds, optionally validate URL against `krexa.xyz` domain.

---

#### BUG-043: Frontend WaitlistAdmin stores API key in localStorage
**File:** `frontend/src/pages/WaitlistAdmin.tsx`
**Status:** ✅ Fixed
**Severity:** Medium

API key persisted in `localStorage` — accessible via XSS, browser DevTools, or local malware. Any XSS vulnerability leaks the admin key.

**Fix:** Use `sessionStorage` instead (clears on tab close). Better: HTTP-only cookie from backend.

---

#### SOL-050: No expiry on ownership transfer requests
**Program:** `krexa-agent-registry` | **Status:** ⬜ Open | **Severity:** Medium

`ProfileOwnershipTransfer` stores `proposed_at` timestamp but never checks it for expiry. A transfer proposed today can be accepted years later, even if the proposed owner's wallet is later compromised.

**Evidence:** `solana-programs/programs/krexa-agent-registry/src/lib.rs:525-569`

**Fix:** Add expiry check in `accept_profile_transfer`: `require!(now - transfer.proposed_at <= 7 * 86_400, RegistryError::TransferExpired)`.

---

### Low

#### BUG-044: Error messages leak internal state in dev mode
**File:** `backend/src/api/middleware/errorHandler.ts`
**Status:** ✅ Fixed
**Severity:** Low

Non-production error responses include full stack traces, DB query info, and function names. Useful for attacker reconnaissance.

**Fix:** Only return generic messages in production; log details server-side.

---

#### BUG-045: No CSRF protection on state-changing endpoints
**File:** `backend/src/app.ts`
**Status:** ⚠️ Accepted risk
**Severity:** Low

Mitigated by API key header requirement on sensitive endpoints. Browsers don't add custom `X-API-Key` headers in CSRF attacks, so this is low-risk for API-key-gated routes.

---

#### BUG-046: Oracle health endpoint exposes internal state without auth
**File:** `backend/src/api/routes/oracle.ts:39-47`
**Status:** ✅ Fixed
**Severity:** Low

`GET /api/v1/oracle/health` returns oracle address, queue depth, and failure rates. Unauthenticated. Useful for attacker reconnaissance.

**Fix:** Restrict to authenticated users or remove detailed fields from public response.

---

#### SOL-051: Minimum keeper reward not enforced — dust positions never liquidated
**Program:** `krexa-agent-wallet` | **Status:** ⬜ Open (deferred) | **Severity:** Low

Keeper reward = 0.5% of wallet balance. For wallets with <$10, reward rounds to $0 — no incentive to liquidate. Underwater dust positions persist indefinitely.

**Evidence:** `solana-programs/programs/krexa-agent-wallet/src/instructions/liquidate.rs:24-28`

**Fix:** Set minimum reward (e.g., 100,000 base units = 0.1 USDC). Or: add admin `force_liquidate` for dust cleanup.

---

#### SOL-052: Admin can unfreeze wallet with outstanding shortfall
**Program:** `krexa-agent-wallet` | **Status:** ⬜ Open (deferred) | **Severity:** Low

After liquidation, `total_debt = shortfall` (unrepaid balance) and wallet is frozen. Admin `freeze_wallet(false)` can thaw the wallet without checking shortfall, potentially allowing the agent to trade again while underwater.

**Evidence:** `solana-programs/programs/krexa-agent-wallet/src/instructions/freeze.rs`

**Fix:** Add `require!(agent_wallet.total_debt == 0, WalletError::OutstandingShortfall)` to unfreeze path.

---

---

## Part 6 — Deep Audit: Oracle, SDK, MCP (2026-03-16)

**Audit scope:** Oracle service (all signing/scoring/retry logic), SDK (all 6 source files), MCP server (both implementations)
**Method:** 3 parallel exhaustive code reviews reading every line of every file

### Summary

| Severity | Total | Scope |
|----------|-------|-------|
| Critical | 3     | Oracle wallet state check, attestation hash, SDK attestation |
| High     | 9     | Oracle retry/payments/scoring, SDK validation, MCP divergence |
| Medium   | 6     | Oracle rotation, SDK errors, MCP logging/config |
| **Total**| **18**| |

---

### Critical

#### BUG-047: Oracle signs payments to frozen/liquidating wallets
**File:** `backend/src/services/solana-oracle.service.ts` (submitPayment)
**Status:** ✅ Fixed
**Severity:** Critical

Oracle reads `MerchantSettlement` and `AgentWallet` on-chain but does NOT check `isFrozen` or `isLiquidating` flags before signing. Oracle will sign and submit a payment to a wallet that the keeper has already marked for liquidation — potentially interfering with the liquidation flow or sending funds to a seized wallet.

**Fix:** Add `if (agentWallet.isFrozen) throw new AppError(400, 'Wallet is frozen')` and `if (agentWallet.isLiquidating) throw new AppError(400, 'Wallet is being liquidated')` before signing.

---

#### BUG-048: Attestation hash uses ambiguous ASCII concatenation
**File:** `backend/src/services/credit-score.ts:155-163`
**Status:** ✅ Fixed
**Severity:** Critical

`computeAttestationHash()` concatenates raw ASCII strings without length prefixes or separators: `Buffer.from(agent) + Buffer.from(score.toString()) + Buffer.from(level.toString()) + Buffer.from(timestamp.toString())`. This is ambiguous — e.g., `agent="A", score=100` produces the same buffer as `agent="A1", score=00`. An attacker can forge attestations with different parameters that hash identically.

**Fix:** Use fixed-width binary encoding: PublicKey → 32 bytes, score → 2 bytes LE, level → 1 byte, timestamp → 8 bytes LE.

---

#### BUG-054: SDK attestation verification uses SHA256 instead of Keccak256
**File:** `sdk/src/credit-bureau.ts:124-139`
**Status:** ✅ Fixed
**Severity:** Critical

`verifyAttestation()` uses `createHash('sha256')` but JSDoc says "keccak256". If the on-chain contract uses keccak256, the SDK will never correctly verify an attestation. Worse, an attacker can craft a SHA256 hash that passes SDK validation but doesn't match the on-chain hash.

**Fix:** Use `keccak256` from viem. Ensure hash algorithm matches on-chain program.

---

### High

#### BUG-049: signAndSubmit marks record 'submitted' before simulation
**File:** `backend/src/services/oracle.service.ts:99-137`
**Status:** ✅ Fixed
**Severity:** High

Order is: sign → update DB to 'submitted' → simulate. If simulation fails, the DB record is already marked 'submitted' but the tx was never actually submitted. This corrupts state and confuses retry logic.

**Fix:** Reorder to: sign → simulate → update DB to 'submitted' → submit on-chain.

---

#### BUG-050: Retry logic race condition — concurrent retries can double-submit
**File:** `backend/src/services/oracle.service.ts:281-324, 357-394`
**Status:** ✅ Fixed
**Severity:** High

`scheduleRetry()` uses `setTimeout` AND a background processor runs every 15 seconds. Both can pick up the same 'pending' record simultaneously, both call `signAndSubmit()`, producing double-submission to the chain with different nonces but same payment intent.

**Fix:** Add `retryLocked` flag or use database-level lock: `UPDATE ... WHERE status = 'pending' AND retry_locked = false RETURNING *`.

---

#### BUG-051: `GET /oracle/payments` unauthenticated — exposes payment history
**File:** `backend/src/api/routes/oracle.ts:50`
**Status:** ✅ Fixed
**Severity:** High

Unlike `POST /oracle/payment` (which requires `requireApiKey`), the `GET /oracle/payments` endpoint has NO auth middleware. Exposes all payment records including from/to addresses, amounts, nonces, tx hashes, error messages, and vault addresses.

**Fix:** Add `requireApiKey` middleware to this endpoint.

---

#### BUG-052: Credit score computation relies on mutable DB snapshots
**File:** `backend/src/services/credit-score.ts:222-244`
**Status:** ⬜ Open
**Severity:** High

Oracle computes credit scores from `HealthSnapshot` and `SolanaAgentTrade` DB records. An oracle operator (or anyone with DB access) can insert fake records to inflate any agent's score. No cross-validation against immutable on-chain event logs.

**Fix:** Cross-validate score inputs against on-chain event logs (IndexerState). Add score change rate limiting (max ±50 points per day).

---

#### BUG-055: SDK has no input validation on amounts
**File:** `sdk/src/agent.ts` (deposit, requestCredit, trade, payX402, withdraw, repay)
**Status:** ✅ Fixed
**Severity:** High

All 6 financial methods accept `amount: number` with zero validation. `NaN`, `Infinity`, negative numbers, and astronomically large values all pass through to `toBase()` and the API call.

**Fix:** Add `validateAmount()` guard: must be `Number.isFinite()`, positive, and under a sane cap (e.g., 1e14 USDC).

---

#### BUG-056: SDK has no recipient address format validation
**File:** `sdk/src/agent.ts:152-167` (payX402)
**Status:** ✅ Fixed
**Severity:** High

`recipient` parameter is passed directly to the API with no format check. A prompt-injected LLM could send funds to an invalid or attacker-controlled address.

**Fix:** Validate base58 regex for Solana (`/^[1-9A-HJ-NP-Za-km-z]{32,44}$/`), 0x hex for Base.

---

#### BUG-057: SDK has no trade venue validation
**File:** `sdk/src/agent.ts:140-149` (trade)
**Status:** ✅ Fixed
**Severity:** High

`venue` parameter accepts any string. SDK should enforce known venues (jupiter, raydium, orca, pump.fun) to prevent routing to attacker-controlled protocols.

**Fix:** Maintain an SDK-side venue allowlist. Warn or reject unknown venues.

---

#### BUG-058: SDK doesn't validate server responses — MITM can inject fake data
**File:** `sdk/src/client.ts:25`, `sdk/src/agent.ts:48`
**Status:** ⬜ Open
**Severity:** High

All responses are cast via `res.json() as Promise<T>` with no schema validation. A MITM or compromised backend can inject fake balances, credit limits, or health factors — causing agents to make bad financial decisions.

**Fix:** Add runtime schema validation (Zod) on critical response types (wallet state, credit eligibility, score).

---

#### BUG-060: MCP tools have no amount bounds — LLM can request unlimited operations
**File:** `mcp-server/src/index.ts:76,127` + `packages/mcp-server/src/tools/*.ts`
**Status:** ✅ Fixed
**Severity:** High

Both MCP implementations accept amounts with no min/max constraints. A rogue LLM can call `krexa_pay(amount=1e15)` or `krexa_draw_credit(amount=999999999)`. Backend should reject, but MCP should stop it first as defense-in-depth.

**Fix:** Add min/max bounds to all tool input schemas (e.g., `amount: { min: 0.01, max: 500000 }`).

---

#### BUG-061: Two divergent MCP implementations — inconsistent behavior and security
**File:** `mcp-server/src/` vs `packages/mcp-server/src/`
**Status:** ⬜ Open
**Severity:** High

Standalone has 6 tools via `@krexa/sdk`. Monorepo has 13+ tools via direct HTTP. Different validation approaches, different defaults (HTTPS vs HTTP), different error handling. Creates confusion and security skew.

**Fix:** Consolidate to one canonical implementation. Delete the other.

---

### Medium

#### BUG-053: Oracle keypair cached indefinitely — no rotation mechanism
**File:** `backend/src/services/solana-oracle.service.ts:54-70`
**Status:** ⬜ Open
**Severity:** Medium

`getOracleKeypair()` caches the keypair in a module-level variable forever. No TTL, no refresh, no rotation support. If the key is compromised, the only remediation is a full service restart.

**Fix:** Add TTL-based refresh or integrate external key management (AWS KMS, Hashicorp Vault).

---

#### BUG-059: SDK error messages may leak API key from server responses
**File:** `sdk/src/agent.ts:46`, `sdk/src/client.ts:22`
**Status:** ✅ Fixed
**Severity:** Medium

Error handling exposes raw server response body: `throw new KrexaError(res.status, body)`. If server returns `"Invalid API key: tck_abc123..."`, the key appears in the error message and potentially in agent logs.

**Fix:** Sanitize auth errors — return generic "Authentication failed" for 401/403 responses.

---

#### BUG-062: MCP monorepo defaults to HTTP for API URL
**File:** `packages/mcp-server/src/config.ts:5`
**Status:** ✅ Fixed
**Severity:** Medium

Default `apiUrl` is `http://localhost:3001/api/v1`. If deployed on a real server without overriding, API key is transmitted over unencrypted HTTP.

**Fix:** Default to `https://api.krexa.xyz/api/v1`. Warn if URL scheme is `http://` and `NODE_ENV=production`.

---

#### BUG-063: MCP has no audit logging — tool calls untraceable
**File:** Both MCP implementations
**Status:** ✅ Fixed
**Severity:** Medium

No tool calls are logged. If an LLM executes unauthorized payments, there's no audit trail to investigate post-incident.

**Fix:** Log every tool call to stderr: `{ timestamp, tool, args (sanitized), agentAddress, result_status }`.

---

#### BUG-064: MCP exposes callerAddress override — potential signature spoofing
**File:** `packages/mcp-server/src/tools/credit.tools.ts:63`
**Status:** ⬜ Open
**Severity:** Medium

`krexa_draw_credit` and `krexa_repay` tools accept an optional `callerAddress` parameter that overrides the signer. If not validated by the backend, this could allow signing as a different agent.

**Fix:** Remove `callerAddress` from MCP tool schemas. Let the backend determine the caller from the API key.
