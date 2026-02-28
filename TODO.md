# TigerPayX — MVP TODO

**Chain:** Base (EVM) — Solana features ported to Solidity
**Target:** Lending protocol MVP with x402 automated repayment
**Last updated:** 2026-02-28

---

## Phase 0: Port Solana Features to Base Contracts

### 0A. Credit Scoring System
- [ ] Add `CreditProfile` struct + mapping to `AgentRegistry.sol`
- [ ] `updateCreditScore(address, uint16)` — admin-only, auto-derives tier (A≥750, B≥600, C≥450, D<450)
- [ ] `getCreditTier()`, `isCreditValid()` view functions
- [ ] 90-day score expiry constant (`CREDIT_SCORE_MAX_AGE`)
- [ ] Gate `VaultFactory.createVault()` by credit tier (block D, require fresh score)
- [ ] `CreditScoreUpdated` event
- [ ] **10 new tests** (tier derivation, blocked merchant, expired score, boundaries)

### 0B. Milestone System
- [ ] New `MilestoneRegistry.sol` contract (~200 lines)
- [ ] `Milestone` struct: vault, milestoneId, evidenceHash, status, approvalCount, requiredApprovals
- [ ] `VerifierVote` mapping: per-verifier-per-milestone
- [ ] `initializeMilestone()`, `submitMilestone()`, `voteMilestone()`
- [ ] Auto-approve when `approvalCount >= requiredApprovals`
- [ ] Update `MerchantVault.releaseTranche()` to require `milestoneRegistry.isMilestoneApproved()`
- [ ] Update `Deploy.s.sol` to deploy MilestoneRegistry + wire to MerchantVault
- [ ] Milestone events: `MilestoneSubmitted`, `MilestoneApproved`, `MilestoneRejected`, `MilestoneVoted`
- [ ] **15 new tests** (full lifecycle, rejection, double-vote, tranche gate)

### 0C. Late Fee System
- [ ] Add to `MerchantVault.sol`: `nextPaymentDue`, `lateFeeBps`, `totalLateFees`, `gracePeriodDays`
- [ ] `REPAYMENT_INTERVAL` constant (30 days)
- [ ] `calculateLateFee()` view: remaining × lateFeeBps × daysLate / 10000
- [ ] `shouldDefault()` view: past nextPaymentDue + gracePeriod
- [ ] Apply late fee in `processRepayment()` — add to `totalToRepay`
- [ ] Advance `nextPaymentDue` after each repayment
- [ ] Apply late fee in `PaymentRouter.executePayment()` path too
- [ ] Add `lateFeeBps`, `gracePeriodDays` params to `VaultFactory.createVault()`
- [ ] **8 new tests** (on-time, late, multi-period, grace period, default trigger)

### 0D. Keeper Functions + completeFundraisingManual
- [ ] `autoCancelExpired()` on MerchantVault — permissionless, checks deadline + <80%
- [ ] `markDefault()` on MerchantVault — permissionless, checks `shouldDefault()`
- [ ] `completeFundraisingManual()` — admin activates vault at 80%+ raised
- [ ] **7 new tests** (expired cancel, default, manual completion, edge cases)

**Total: ~40 new tests → ~160 grand total**

---

## Phase 1: Testnet Deployment (Base Sepolia)

- [ ] Set up `.env` with real values (deployer key, oracle address, USDC, RPC)
- [ ] Run `forge script script/Deploy.s.sol --broadcast --verify`
- [ ] Verify ALL contracts on BaseScan
- [ ] Post-deploy wiring: `setFactory()`, `setPaymentRouter()` on pools
- [ ] Pre-fund deployer + oracle wallets with Sepolia ETH
- [ ] Get Sepolia USDC (Circle faucet or deploy mock)
- [ ] Call `initialize_platform` / register test merchant
- [ ] Generate TypeScript ABIs from `out/` artifacts
- [ ] Document deployed addresses in config

---

## Phase 2: Backend Bootstrap

- [ ] Initialize Express + TypeScript project in `backend/`
- [ ] Set up Prisma + PostgreSQL (schema: merchants, vaults, investments, events, pools, api_keys, oracle_payments)
- [ ] Environment config (Base RPC, contract addresses, oracle key)
- [ ] ethers.js/viem contract wrappers (read chain state, build unsigned txs)
- [ ] Express middleware: error handling, request logging, CORS
- [ ] API versioning: `/api/v1/` prefix
- [ ] Health check: `GET /api/v1/health`
- [ ] Docker compose for local PostgreSQL

---

## Phase 3: Backend Core API

### Merchant Endpoints
- [ ] `POST /api/v1/merchants/register` — build register tx
- [ ] `GET /api/v1/merchants/:address` — read from chain + DB
- [ ] `GET /api/v1/merchants/:address/vaults` — list by merchant
- [ ] `POST /api/v1/merchants/:address/credit-score` — build update tx (admin)

### Vault Endpoints
- [ ] `POST /api/v1/vaults/create` — build createVault tx
- [ ] `GET /api/v1/vaults` — list with filters (state, merchant) + pagination
- [ ] `GET /api/v1/vaults/:address` — full detail + computed fields
- [ ] `GET /api/v1/vaults/:address/investors` — investor list
- [ ] `GET /api/v1/vaults/:address/repayments` — from indexed events
- [ ] `GET /api/v1/vaults/:address/waterfall` — senior/pool/community breakdown
- [ ] `GET /api/v1/vaults/:address/tranches` — tranche status
- [ ] `GET /api/v1/vaults/:address/milestones` — milestone status
- [ ] `POST /api/v1/vaults/:address/milestone/submit` — build submit tx
- [ ] `POST /api/v1/vaults/:address/milestone/vote` — build vote tx

### Investment Endpoints
- [ ] `POST /api/v1/invest` — build invest tx
- [ ] `POST /api/v1/claim` — build claim returns tx
- [ ] `POST /api/v1/refund` — build claim refund tx
- [ ] `GET /api/v1/portfolio/:address` — all investments for wallet

### Pool Endpoints
- [ ] `GET /api/v1/pools` — list pools
- [ ] `GET /api/v1/pools/:address` — pool detail
- [ ] `POST /api/v1/pools/deposit` — build deposit tx
- [ ] `POST /api/v1/pools/allocate` — build allocate tx (admin)
- [ ] `POST /api/v1/pools/withdraw` — build withdraw tx

### Platform Endpoints
- [ ] `GET /api/v1/platform/stats` — TVL, active vaults, total repaid
- [ ] `GET /api/v1/platform/config` — fee structure, limits

---

## Phase 4: Oracle Service

- [ ] `POST /api/v1/oracle/payment` — webhook receiver
- [ ] Validate payment: vault exists, settlement active, amount ≤ max
- [ ] Check rate limit (block.timestamp ≥ lastPayment + minInterval)
- [ ] Nonce management (monotonically increasing, stored in DB)
- [ ] ECDSA signing: sign(keccak256(nonce, vault, amount, source, timestamp))
- [ ] Build `PaymentRouter.executePayment()` transaction
- [ ] Submit to Base with gas estimation + retry
- [ ] Wait for confirmation (3 blocks)
- [ ] Record in `OraclePayment` table (status, txHash, error)
- [ ] Failure queue: exponential backoff (30s→60s→120s→240s, max 5 attempts)
- [ ] `GET /api/v1/oracle/health` — status, queue depth, last payment per vault
- [ ] Alert on 3+ consecutive failures

---

## Phase 5: Event Indexer

- [ ] WebSocket subscription to all contract events (ethers.js/viem)
- [ ] Event parser: decode each event type into structured data
- [ ] Events: VaultCreated, InvestmentReceived, TrancheReleased, RepaymentProcessed, WaterfallDistributed, VaultDefaulted, VaultCompleted, PoolAllocated, CreditScoreUpdated, MilestoneSubmitted, MilestoneApproved
- [ ] Store in PostgreSQL `VaultEvent` table (eventType, data JSON, blockNumber, txHash)
- [ ] Update denormalized tables (Vault, Merchant, Investment amounts)
- [ ] Backfill capability: replay from deployment block
- [ ] Health check: last indexed block, lag detection

---

## Phase 6: Keeper / Crank Service

- [ ] node-cron scheduler (every 5 minutes)
- [ ] Scan fundraising vaults past deadline with <80% → `autoCancelExpired()`
- [ ] Scan repaying vaults past grace period → `markDefault()`
- [ ] Process pool allocation returns after repayment events
- [ ] Late fee alert logging (vaults approaching due dates)
- [ ] All calls idempotent (reverted txs handled gracefully)
- [ ] Structured logging for all lifecycle transitions

---

## Phase 7: Frontend Integration

- [ ] Remove `@solana/wallet-adapter-*` dependencies
- [ ] Install wagmi + viem + Web3Modal (or RainbowKit)
- [ ] Configure Base Sepolia chain (chainId: 84532)
- [ ] Replace `lib/mockData.ts` → API calls to backend
- [ ] Replace `lib/x402MockData.ts` → oracle health + live events
- [ ] Wire Zustand store to real API responses
- [ ] **Home page**: live platform stats
- [ ] **Vaults page**: real vault list, invest flow with wallet signing
- [ ] **VaultDetail**: waterfall chart (real), milestones, tranches, repayment history
- [ ] **Portfolio page**: real investor data
- [ ] **Merchant Dashboard**: real profile, vault creation form, credit score display
- [ ] **Liquidity Pools**: real pool data, deposit/withdraw flows
- [ ] **X402 Demo**: live payment feed from indexed events
- [ ] Transaction UX: pending/confirmed/failed states, error messages

---

## Phase 8: API Documentation & SDK

- [ ] OpenAPI/Swagger spec (auto-generated from Express routes)
- [ ] API key registration system
- [ ] Per-key rate limiting middleware
- [ ] TypeScript SDK: `@tigerpay/sdk` wrapping REST endpoints
- [ ] Developer docs: "Integrate TigerPayX lending into your protocol"
- [ ] Webhook system: subscribe to vault events (created, funded, repaid, defaulted)
- [ ] Multi-tenant: per-protocol vault visibility / scoping

---

## Completed ✅ (Base Contracts)

- [x] **AgentRegistry** — Identity, stats, vault linking, deactivation (7 tests)
- [x] **PaymentRouter** — x402 execution, ECDSA oracle, settlement auto-split, replay protection, rate limiting (17 tests)
- [x] **MerchantVault** — Full lifecycle, waterfall, tranches, claims, refunds (23 tests)
- [x] **VaultFactory** — CREATE2, platform config, bounds, agent validation (22 tests)
- [x] **LiquidityPool** — Deposits, withdrawals, allocation, returns (15 tests)
- [x] **WaterfallLib** — Senior→Pool→Community (7 fuzz tests, 100% coverage)
- [x] **SignatureLib** — ECDSA verification (5 tests)
- [x] **Security Hardening** — 2-step admin, reentrancy, pause, oracle mandatory, forceApprove (12 tests)
- [x] **Deploy.s.sol** — Full deployment script with wiring
- [x] **Interface Sync** — All 4 interfaces updated (IAgentRegistry, IPaymentRouter, IMerchantVault, ILiquidityPool)
- **Total: 120/120 tests | 87% line coverage | 55% branch coverage**

---

## Security Posture

| Area | Status | Risk |
|---|---|---|
| Reentrancy | ✅ nonReentrant on all externals | Resolved |
| Oracle Verification | ✅ Always required, ECDSA via OZ | Resolved |
| Replay Protection | ✅ Nonce per sender | Resolved |
| Admin Transfer | ✅ 2-step on all 5 contracts | Resolved |
| Pause Mechanism | ✅ Router, Pool, Factory, Vault | Resolved |
| Arithmetic Safety | ✅ Solidity 0.8.24 built-in | Resolved |
| ERC20 Safety | ✅ SafeERC20 + forceApprove | Resolved |
| Access Control | ✅ onlyAdmin / onlyAuthorized | Resolved |
| Waterfall | ✅ Fuzz tested, 100% coverage | Resolved |
| CREATE2 | ✅ Salt = agent only | Resolved |
| Credit Scoring | ⬜ To be added (Phase 0A) | Pending |
| Milestones | ⬜ To be added (Phase 0B) | Pending |
| Late Fees | ⬜ To be added (Phase 0C) | Pending |
| Keeper Functions | ⬜ To be added (Phase 0D) | Pending |

---

*Version 4.0 — Rewritten for Base MVP with Solana feature ports (Feb 2026)*
