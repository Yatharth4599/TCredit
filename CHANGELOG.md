# Krexa Production Readiness — Changelog

All changes made across Phases 1–4 of the production readiness audit.

---

## Phase 1 — Code Hardening (`7ce69b7`)

### 1A. Network / Environment Fixes
| File | Change |
|------|--------|
| `app/src/components/shared/TransactionToast.tsx` | Replaced hardcoded `?cluster=devnet` with dynamic cluster from `config.cluster` |
| `app/src/pages/DemoPage.tsx` | Replaced 4 hardcoded `?cluster=devnet` explorer links with dynamic cluster |
| `app/src/config.ts` | Added startup assertion — throws if `VITE_RPC_URL` or `VITE_API_URL` not set in production |
| `frontend/src/api/client.ts` | Removed hardcoded `https://tcredit-backend.onrender.com/api` fallback |
| `app/src/components/credit/RequestCreditModal.tsx` | Removed "on devnet" copy, made network name dynamic |
| `app/src/pages/VaultPage.tsx` | Gated on actual data availability, not hardcoded "devnet" string |
| `frontend/src/components/Waitlist.tsx` | Fixed "Built on Base" → "Built on Solana" |
| `backend/src/config/env.ts` | Added production startup assertion requiring all Solana program IDs, RPC URL, oracle key, keeper key |

### 1B. Silent Failure Cleanup
| File | Change |
|------|--------|
| `backend/src/services/solana-keeper.ts` | Replaced 4 silent `.catch(() => {})` with error-logging catch blocks |
| `backend/src/indexer/solana-indexer.ts` | Replaced 6 silent `.catch(() => {})` with error-logging catch blocks |
| `backend/src/chain/solana/reader.ts` | Added error context to all catch blocks (log what failed + input) |
| `backend/src/api/routes/solana-oracle.routes.ts` | Keypair validated at import time, not first use |
| `backend/src/api/routes/solana-faucet.routes.ts` | Keypair validated at import time, not first use |

### 1C. Backend Quick Fixes
| File | Change |
|------|--------|
| `backend/src/api/routes/admin.ts` | Added pagination (`page` + `pageSize` query params) to `/keys`, `/webhooks`, `/waitlist` |
| `backend/src/api/middleware/cors.ts` | Switched from raw `process.env.CORS_ORIGIN` to validated `env.CORS_ORIGIN` |
| `backend/src/api/routes/index.ts` | Removed stale `// BUG-027/028` comment |
| `backend/src/api/middleware/apiKeyAuth.ts` | Returns 503 on DB error instead of proceeding as anonymous |

### 1D. Frontend Quick Fixes
| File | Change |
|------|--------|
| `frontend/src/components/LandingPage.tsx` | Footer `<span>` → `<a>` for Blog, Support, Privacy Policy, Terms |
| `frontend/src/components/Waitlist.tsx` | Added debounce (1s) on form submission |
| `frontend/src/api/client.ts` | Removed `console.error` that leaked API URL |
| `app/src/components/vault/DepositModal.tsx` | Added tooltip on disabled Junior tranche explaining it's protocol-only |

---

## Phase 2 — Core User Journeys (`9d4e2a0`)

### 2A. Agent Onboarding Flow
| File | Change |
|------|--------|
| `app/src/utils/agentKeystore.ts` | **NEW** — Encrypted keypair storage using Web Crypto API (AES-GCM + PBKDF2). Exports: `saveAgentKeypair`, `loadAgentKeypair`, `hasAgentKeypair`, `exportAgentKeypair`, `importAgentKeypair`, `removeAgentKeypair`. Backward-compatible migration from legacy sessionStorage. |
| `app/src/components/agent/KYAStep.tsx` | **NEW** — KYA verification UI for onboarding. Tier 1 (Basic — wallet signature) and Tier 2 (Enhanced — Sumsub placeholder). Calls `POST /api/v1/solana/kya/:agent/basic`. |
| `app/src/hooks/useRegisterAgent.ts` | Updated to use `saveAgentKeypair` instead of raw `sessionStorage.setItem` |
| `app/src/hooks/useCreateWallet.ts` | Updated to use `loadAgentKeypair` instead of raw `sessionStorage.getItem`. Added explorer link in success toast. |
| `app/src/components/agent/RegisterAgentModal.tsx` | Major rewrite: added post-registration backup prompt with keypair export, `showBackup` state, `handleExportKeypair` that creates downloadable JSON file. |
| `app/src/hooks/useRepay.ts` | Added explorer link in success toast (6s duration) |
| `app/src/hooks/useDepositLP.ts` | Added explorer link in success toast |
| `app/src/hooks/useWithdrawLP.ts` | Added explorer link in success toast |
| `app/src/hooks/useDepositCollateral.ts` | Added explorer link in success toast |

### 2B. Credit Lifecycle
| File | Change |
|------|--------|
| `app/src/hooks/useCreditActivity.ts` | **NEW** — React Query hook fetching `GET /api/v1/solana/credit/:agent/activity?limit=20`. Returns score history, health history, recent trades. |
| `app/src/pages/CreditPage.tsx` | Added credit activity history section (score history with deltas + recent trades with explorer links). Added repayment schedule card (principal, interest, total owed, daily accrual, 7/30/365 day projections). |
| `app/src/components/credit/RepayModal.tsx` | Added `rawDebtUsdc` and `rawInterestUsdc` props, computed `totalDebtUsdc`, "Repay All" button. |
| `backend/src/api/routes/agent-credit.routes.ts` | Added `GET /:agent/activity` endpoint returning paginated score snapshots, health snapshots, and recent trades. |

### 2C. LP / Investor Flow
| File | Change |
|------|--------|
| `app/src/pages/LPPage.tsx` | Added tranche education cards (Senior/Mezzanine/Junior with risk/APR info). Added repayment waterfall visualization (5-step flow diagram). Added withdrawal rules documentation section. |

### 2D. Score & Credit Bureau
| File | Change |
|------|--------|
| `app/src/pages/Dashboard.tsx` | Added `ScoreSummaryCard` component (embedded Krexit Score with 5-component bars + improvement suggestions). Added devnet network warning banner. Added `KYAStep` integration when `kyaTier === 0`. |
| `app/src/pages/WalletPage.tsx` | Added `KeypairManagement` component with export backup button and file import via hidden input. |

---

## Phase 3 — Developer Experience & Embedding (`b60e022`)

### 3A. SDK Publication
| File | Change |
|------|--------|
| `app/src/sdk/package.json` | **NEW** — npm package config for `@krexa/sdk` with peer deps (`@solana/web3.js`, `@coral-xyz/anchor`, `bn.js`), module exports for all subpaths, build script. |
| `app/src/sdk/tsconfig.json` | **NEW** — Standalone TypeScript config for SDK compilation (ESNext module, declaration files, source maps). |
| `app/src/sdk/types.ts` | Added `DEVNET_PROGRAM_IDS` and `MAINNET_PROGRAM_IDS` named exports. `PROGRAM_IDS` now aliases `DEVNET_PROGRAM_IDS`. Configurable via `KrexaClientConfig.programIds`. |

### 3B. API Documentation
| File | Change |
|------|--------|
| `backend/src/config/openapi.ts` | **Major update** — bumped to v0.2.0, fixed "Base" → "Solana" description. Added 7 new tags: Agent Wallets, Vault (Solana), Oracle (Solana), Score (Solana), KYA, Faucet, x402. Added 25+ Solana endpoint paths with full request/response schemas. Added 4 x402 endpoint paths. Added `GET /credit-bureau/{agent}/check`. Added 14 new component schemas: `SolanaUnsignedTx`, `CreditEligibility`, `SolanaCreditLine`, `CreditActivity`, `AgentWalletSummary`, `AgentWalletState`, `WalletHealth`, `AgentTrade`, `SolanaVaultStats`, `LPPositions`, `KrexitScoreResponse`, `CreditCheck`. |

### 3C. x402 Payment Integration
| File | Change |
|------|--------|
| `backend/src/config/openapi.ts` | Documented all 4 x402 endpoints: `POST /x402/register-resource`, `POST /x402/verify`, `GET /x402/resource/{key}`, `GET /x402/resource-key/{rawHash}/{owner}`. |

### 3D. Embeddable Widgets
| File | Change |
|------|--------|
| `app/src/sdk/KrexaScoreBadge.tsx` | **NEW** — Embeddable React component for third-party sites. Fetches from `/credit-bureau/:agent/check`. Compact mode (score + dot) and full mode (shield icon + score + tier + PASS/FAIL badge). Inline styles for easy embedding without CSS dependencies. |
| `backend/src/services/credit-bureau.ts` | Added `getAgentCheck()` function — returns pass/fail, score, tier name, max credit, risk flags (AGENT_NOT_FOUND, DEACTIVATED, FROZEN, LIQUIDATING, LOW_HEALTH_FACTOR, HAS_LIQUIDATION_HISTORY). |
| `backend/src/api/routes/credit-bureau.routes.ts` | Added `GET /:agent/check` route (free, no API key required). Imported `getAgentCheck` from service. Logs inquiry for analytics. |

---

## Phase 4 — Infrastructure & Reliability (`b60e022`)

### 4A. Backend Reliability
| File | Change |
|------|--------|
| `backend/src/utils/retry.ts` | **NEW** — `withRetry<T>(fn, opts)` utility. Exponential backoff with configurable `maxAttempts` (default 4), `baseMs` (1s), `maxMs` (30s), `jitter` (0.2). `onRetry` callback for logging. |
| `backend/src/utils/circuit-breaker.ts` | **NEW** — `CircuitBreaker` class implementing closed→open→half_open pattern. Configurable `threshold` (default 5 failures), `resetMs` (default 60s). `onStateChange` callback. `CircuitOpenError` thrown when breaker is open. `getStatus()` for health reporting. |
| `backend/src/utils/logger.ts` | **NEW** — `createLogger(service)` structured logging. JSON output in production, pretty-print in dev. Log levels: debug/info/warn/error. Configurable via `LOG_LEVEL` env var. Fields: level, service, msg, ts, plus arbitrary extras. |

### 4A. Services Updated with Retry + Circuit Breaker + Structured Logging
| File | Change |
|------|--------|
| `backend/src/services/solana-keeper.ts` | **Full rewrite** — `sendAndConfirm()` now uses `withRetry()` (3 attempts, 2s base, 15s max) wrapped in `rpcBreaker.exec()`. All `console.log/error/warn` replaced with structured `log.info/error/warn` calls. Silent `.catch(() => {})` replaced with error-logging catches. Added metrics tracking: `cycleCount`, `lastCycleAt`, `lastCycleDurationMs`, `consecutiveErrors`. `getSolanaKeeperHealth()` now returns cycle metrics + circuit breaker state. Stats logged every 30 cycles (~60s). |
| `backend/src/indexer/solana-indexer.ts` | **Full rewrite** — `pollProgram()` now wraps `getSignaturesForAddress` in `rpcBreaker.exec()` + `withRetry()` (3 attempts). `processSignature()` wraps `getTransaction` in `withRetry()` (2 attempts). All `console.log/error` replaced with structured logging. Silent catches replaced with warning logs. Added metrics: `totalEventsIndexed`, `lastPollAt`, `consecutiveErrors`. `getSolanaIndexerHealth()` returns full metrics + circuit breaker state. |

### 4B. Database
| File | Change |
|------|--------|
| `backend/prisma/schema.prisma` | Added `@@index([creditDrawn])` and `@@index([totalDebt])` to `SolanaAgentWallet` model (alongside existing `healthFactorBps` index). |
| `backend/src/config/prisma.ts` | Updated PrismaClient instantiation with log level configuration: `['error']` in production, `['warn', 'error']` in dev. |

### 4C. Background Jobs / Health Monitoring
| File | Change |
|------|--------|
| `backend/src/api/routes/health.ts` | **Major upgrade** — now checks: (1) DB via `SELECT 1`, (2) EVM chain via `getBlockNumber`, (3) **Solana RPC via `getSlot`**, (4) **Solana keeper health** (running, cycle count, duration, circuit breaker), (5) **Solana indexer health** (events indexed, last poll, circuit breaker). Reports response time. Version bumped to 0.2.0. Status logic: `ok` if DB + any chain up, `degraded` if DB only, `down` otherwise. |
| `backend/src/index.ts` | **Rewritten** — Added `createLogger('Krexa')` for structured startup/shutdown logs. Added `process.on('unhandledRejection')` and `process.on('uncaughtException')` handlers. Graceful shutdown with 30s timeout (`SHUTDOWN_TIMEOUT_MS`). Force `process.exit(1)` if timeout exceeded. `forceTimer.unref()` to not block exit. `isShuttingDown` guard prevents double-shutdown. |

### 4A. Rate Limiter
| File | Change |
|------|--------|
| `backend/src/api/middleware/rateLimit.ts` | Added `Retry-After` header on 429 responses. Cleanup timer uses `.unref()` so it doesn't prevent process exit. Added inline documentation for Redis upgrade path. |

---

## Pending Items (Not Yet Implemented)

### Phase 3 — Remaining
| Item | Priority | Notes |
|------|----------|-------|
| Example integrations (3 reference apps) | Low | Deferred to post-launch |
| Document webhook events (types, payloads, retry) | Medium | OpenAPI schemas exist for webhook delivery |
| API key self-service from dashboard | Medium | Currently admin-only via `/admin/keys` |
| Agent payment SDK method (`client.pay()`) | Medium | x402 endpoints exist, need SDK wrapper |
| x402 revenue dashboard | Low | UI showing earned/spent via x402 |
| Auto-repayment from x402 revenue | Low | Route X% of revenue to credit repayment |
| Webhook subscriptions for score changes | Medium | Infra exists (webhook service), need score-change trigger |

### Phase 4 — Remaining
| Item | Priority | Notes |
|------|----------|-------|
| Idempotency keys on oracle endpoint | Medium | Add `Idempotency-Key` header support |
| Redis-backed rate limiter | Medium | Needed for horizontal scaling; in-memory works for single instance |
| Automated DB backups | High | Infrastructure task (Render/AWS config, not code) |
| Read replicas | Low | Only needed at scale |
| Job persistence (BullMQ + Redis) | Medium | Requires Redis; currently jobs are ephemeral |
| Job deduplication | Medium | Prevent double liquidation; requires Redis |
| Configurable keeper/indexer intervals | Low | Currently hardcoded (2s keeper, 5s indexer) |
| GitHub Actions CI/CD pipeline | High | lint → test → build → deploy |
| Pre-commit hooks | Medium | Prevent committing secrets |
| Staging environment | High | Separate Render service + DB |
| Rollback strategy | Medium | Documented process for bad deploys |

### Phase 5 — Security & Compliance (all pending)
| Item | Priority | Notes |
|------|----------|-------|
| Solana program audit (external firm) | Critical | Neodyme, OtterSec, or Trail of Bits |
| Program upgrade authority → multisig | Critical | Currently single admin key |
| Bug bounty program (Immunefi) | High | After audit |
| Mainnet program deployment | Critical | Blocked on audit |
| Zod schemas on all POST/PUT bodies | High | Currently only env vars validated |
| Secrets management (KMS/Secret Manager) | High | Currently Render dashboard |
| Key rotation procedure | Medium | Documented process needed |
| Penetration test | High | External review of API surface |
| IP allowlisting for admin routes | Medium | Restrict admin/oracle endpoints |
| Terms of Service | Critical | Legal requirement before launch |
| Privacy Policy | Critical | Legal requirement |
| Risk Disclosures for LPs | High | Loss of principal disclosure |
| Legal agreements for L3/L4 credit | Medium | DB schema exists (`LegalAgreement`), needs UI flow |
| Audit report publication | Medium | After audit complete |

### Phase 6 — Mainnet Launch (all pending)
| Item | Priority | Notes |
|------|----------|-------|
| Deploy 7 programs to mainnet | Critical | Blocked on Phase 5 audit |
| Update program IDs in env.ts + SDK | Critical | `MAINNET_PROGRAM_IDS` placeholder ready |
| Helius mainnet RPC with failover | High | Free tier sufficient initially |
| Key ceremony (air-gapped keypair gen) | Critical | Oracle + keeper mainnet keys |
| Seed initial vault + insurance fund | Critical | Bootstrap protocol liquidity |
| Sentry error tracking | High | Backend + both frontends |
| Prometheus + Grafana metrics | Medium | RPC latency, keeper cycle time, indexer lag |
| PagerDuty/Slack alerts | High | Keeper failure, low HF, oracle error |
| Uptime monitoring | Medium | External health check every 30s |
| k6/Artillery load testing | Medium | 100+ concurrent agents |
| Stress test keeper (500+ wallets) | Medium | Verify keeper scales |
| RPC quota planning | Medium | Estimate monthly calls |
| Remove all devnet UI references | High | Already dynamic from Phase 1 |
| Disable faucet for mainnet | Medium | Restrict to testnet subdomain |
| DNS + SSL on krexa.xyz | Critical | Infrastructure task |
| Launch announcement email | Medium | Waitlist → launch sequence |

---

## Commit History

| Commit | Phase | Description |
|--------|-------|-------------|
| `7ce69b7` | Phase 1 | Code hardening — network fixes, silent failures, admin pagination |
| `9d4e2a0` | Phase 2 | Core user journeys — onboarding, credit lifecycle, LP education |
| `b60e022` | Phase 3+4 | Developer experience + infrastructure reliability |

## File Change Summary

| Phase | Files Modified | Files Created | Lines Changed |
|-------|---------------|---------------|---------------|
| **1** | ~20 | 0 | ~400 |
| **2** | ~12 | 3 | ~800 |
| **3** | 5 | 4 | ~600 |
| **4** | 6 | 3 | ~500 |
| **Total** | ~35 | 10 | ~2,300+ |
