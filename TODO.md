# TigerPayX — MVP TODO

**Chain:** Base (EVM) — Solana features ported to Solidity
**Target:** Lending protocol MVP with x402 automated repayment
**Last updated:** 2026-03-07

---

## Phase 0: Port Solana Features to Base Contracts

### 0A. Credit Scoring System ✅
- [x] Add `CreditProfile` struct + mapping to `AgentRegistry.sol`
- [x] `updateCreditScore(address, uint16)` — admin-only, auto-derives tier (A≥750, B≥600, C≥450, D<450)
- [x] `getCreditTier()`, `isCreditValid()` view functions
- [x] 90-day score expiry constant (`CREDIT_SCORE_MAX_AGE`)
- [x] Gate `VaultFactory.createVault()` by credit tier (block D, require fresh score)
- [x] `CreditScoreUpdated` event
- [x] **10 new tests** — `CreditScoring.t.sol` (tier derivation, blocked merchant, expired score, boundaries)

### 0B. Milestone System ✅
- [x] New `MilestoneRegistry.sol` contract + `IMilestoneRegistry.sol` interface
- [x] `Milestone` struct: vault, trancheIndex, evidenceHash, status, approvalCount, requiredApprovals
- [x] `hasVoted` mapping: per-verifier-per-milestone
- [x] `initializeMilestone()`, `submitMilestone()`, `voteMilestone()`
- [x] Auto-approve when `approvalCount >= requiredApprovals`
- [x] Update `MerchantVault.releaseTranche()` to require `milestoneRegistry.isMilestoneApproved()`
- [x] Update `Deploy.s.sol` to deploy MilestoneRegistry
- [x] Milestone events: `MilestoneInitialized`, `MilestoneSubmitted`, `MilestoneApproved`, `MilestoneRejected`, `MilestoneVoted`
- [x] **15 new tests** — `MilestoneRegistry.t.sol` (full lifecycle, rejection, double-vote, tranche gate)

### 0C. Late Fee System ✅ (x402-Aware)
- [x] Add to `MerchantVault.sol`: `nextPaymentDue`, `lateFeeBps`, `totalLateFees`, `gracePeriodSeconds`
- [x] `REPAYMENT_INTERVAL` constant (30 days)
- [x] `calculateLateFee()` view: shortfall × lateFeeBps × daysLate / 10000 (x402: based on cumulative shortfall, not missed discrete payments)
- [x] `shouldDefault()` view: past nextPaymentDue + gracePeriod
- [x] `expectedRepaymentPerPeriod`: set on activation = totalToRepay / numberOfPeriods
- [x] Apply late fee in `processRepayment()` — check if behind schedule, add to `totalToRepay`
- [x] Advance `nextPaymentDue` after each period boundary
- [x] `VaultParams` struct constructor accepts lateFeeBps + gracePeriodSeconds + fundraisingDeadline
- [x] **8 new tests** — `LateFees.t.sol` (on-time, late, multi-period, grace period, default trigger)

### 0D. Keeper Functions + completeFundraisingManual ✅
- [x] `autoCancelExpired()` on MerchantVault — permissionless, checks deadline + <80%
- [x] `markDefault()` on MerchantVault — permissionless when `shouldDefault()` true, admin can always force
- [x] `completeFundraisingManual()` — admin activates vault at 80%+ raised
- [x] **x402 integration note**: keeper service calls `PaymentRouter.deactivateSettlement(agent)` after `markDefault()`
- [x] **7 new tests** — `KeeperFunctions.t.sol` (expired cancel, default, manual completion, edge cases)

### 0E. Infrastructure Changes ✅
- [x] `MerchantVault` constructor refactored to `VaultParams` struct (stack-too-deep fix)
- [x] `via_ir = true` in `foundry.toml`
- [x] `Errors.sol` — 9 new errors (credit, milestone, keeper)
- [x] `IAgentRegistry.sol` — CreditProfile, CreditTier enum, new functions
- [x] `IMerchantVault.sol` — new events + functions (autoCancelExpired, completeFundraisingManual, calculateLateFee, shouldDefault, setMilestoneRegistry, LateFeeApplied)
- [x] All 8 existing test files updated to match new constructor
- [x] **120/120 existing tests passing**

**Status: Phase 0 COMPLETE — 160/160 tests passing, all committed and pushed to Yatharth4599/TCredit.**

---

## Phase 1: Testnet Deployment (Base Sepolia) ✅

- [x] Set up `.env` with real values (deployer key, oracle address, USDC, RPC)
- [x] Run `forge script script/Deploy.s.sol --broadcast --verify`
- [x] Verify ALL contracts on BaseScan (all 6 verified)
- [x] Post-deploy wiring: `setFactory()`, `setPaymentRouter()` (handled in Deploy.s.sol)
- [x] Pre-fund deployer wallet with Base Sepolia ETH
- [x] Document deployed addresses in `deployments/base-sepolia.json`
- [x] Get Sepolia USDC (Circle faucet)
- [x] Register test merchant + assign credit score 700 (tier B) via cast
- [x] Generate TypeScript ABIs + addresses → `deployments/contracts.ts` + `deployments/abis.json`

---

## Phase 2: Backend Bootstrap ✅

- [x] Initialize Express + TypeScript project in `backend/`
- [x] Set up Prisma 6 + PostgreSQL (8 models: Merchant, Vault, Investment, VaultEvent, MilestoneRecord, Pool, ApiKey, OraclePayment)
- [x] Environment config (zod-validated: Base RPC, 7 contract addresses, oracle key)
- [x] viem contract wrappers — 6 files: agentRegistry, paymentRouter, vaultFactory, merchantVault, liquidityPool, milestoneRegistry
- [x] Express middleware: error handling (AppError), morgan request logging, CORS (localhost:5173)
- [x] API versioning: `/api/v1/` prefix + `/api` backward-compat for frontend
- [x] Health check: `GET /api/v1/health` — verifies DB + chain (Base Sepolia chainId 84532)
- [x] Docker compose for local PostgreSQL 16

---

## Phase 3: Backend Core API ✅

### Merchant Endpoints
- [x] `POST /api/v1/merchants/register` — build unsigned registerAgent tx
- [x] `GET /api/v1/merchants/:address` — read agent profile from chain
- [x] `GET /api/v1/merchants/:address/vaults` — filter vaults by agent
- [x] `GET /api/v1/merchants/:address/stats` — credit tier, TVL, loan count
- [x] `POST /api/v1/merchants/:address/credit-score` — build unsigned updateCreditScore tx

### Vault Endpoints
- [x] `POST /api/v1/vaults/create` — backend-signed createVault (admin walletClient, permissionless for users)
- [x] `GET /api/v1/vaults` — list all vaults from chain (filter by state/agent)
- [x] `GET /api/v1/vaults/:address` — full detail + waterfall + investor count
- [x] `GET /api/v1/vaults/:address/investors` — investor list with balances + claimable
- [x] `GET /api/v1/vaults/:address/repayments` — stub (Phase 5 event indexer)
- [x] `GET /api/v1/vaults/:address/waterfall` — senior/pool/community breakdown
- [x] `GET /api/v1/vaults/:address/tranches` — tranche status + released count
- [x] `GET /api/v1/vaults/:address/milestones` — milestone status per tranche
- [x] `POST /api/v1/vaults/:address/milestone/submit` — build unsigned tx
- [x] `POST /api/v1/vaults/:address/milestone/vote` — build unsigned tx

### Investment Endpoints
- [x] `POST /api/v1/invest` — build unsigned invest tx
- [x] `POST /api/v1/claim` — build unsigned claimReturns tx
- [x] `POST /api/v1/refund` — build unsigned claimRefund tx
- [x] `GET /api/v1/portfolio/:address` — all investments for wallet (live from chain)

### Pool Endpoints
- [x] `GET /api/v1/pools` — list both pools with TVL summary
- [x] `GET /api/v1/pools/:address` — pool detail
- [x] `POST /api/v1/pools/deposit` — build unsigned deposit tx
- [x] `POST /api/v1/pools/allocate` — build unsigned allocateToVault tx (admin)
- [x] `POST /api/v1/pools/withdraw` — build unsigned withdraw tx

### Platform Endpoints
- [x] `GET /api/v1/platform/stats` — live TVL, active vaults, pool liquidity from chain
- [x] `GET /api/v1/platform/config` — fee structure, limits, all contract addresses

### Notes
- All read endpoints pull live data from Base Sepolia via viem (event indexer supplements with DB)
- Most write endpoints return `{ to, data }` unsigned tx — user signs with wallet
- `POST /vaults/create` is backend-signed (admin-only on-chain) — returns `{ success, txHash }`
- Indexer auto-assigns credit score 600 (B tier) on `AgentRegistered` event
- `/merchant/:id/*` aliases added for frontend backward-compat (client.ts uses singular path)

---

---

## Phase 3.5: Design System & CSS Foundation ✅

- [x] 3-font system: Outfit (display/headings), Inter (body), JetBrains Mono (financial data/addresses)
- [x] Surface layer architecture: `surface-0` (#06070A) → `surface-4` (#1C2130) — borderless by default, depth via color
- [x] Per-page accent theming via `data-theme` on `<html>`: blue (vaults), cyan (portfolio), amber (merchant), purple (pools)
- [x] `--pill-radius: 9999px`, `--card-border-radius: 16px`, `--accent-glow` variable per theme
- [x] All 6 page CSS modules rewritten: borderless cards, pill buttons/badges/inputs, JetBrains Mono on all financial values
- [x] Core components updated: GlassCard (borderless + hover lift), BentoGrid (accent-aware), FloatingDock (pill + active route indicator)
- [x] RainbowKit dark theme aligned to design system, Toaster pill-shaped, PageLoader refined
- [x] `globals.css`: `.btn-primary`, `.btn-secondary`, `.font-mono` global utilities

> **Note**: This is CSS/token-level groundwork. The component-level visual redesign (card hierarchy, gradient text, ambient glows, skeleton states) is Phase 9.

---

## Phase 4: Oracle Service ✅

- [x] `POST /api/v1/oracle/payment` — webhook receiver
- [x] Validate payment: vault exists, settlement active, amount ≤ max
- [x] Check rate limit (block.timestamp ≥ lastPayment + minInterval)
- [x] Nonce management (monotonically increasing, stored in DB)
- [x] ECDSA signing: sign(keccak256(nonce, vault, amount, source, timestamp))
- [x] Build `PaymentRouter.executePayment()` transaction
- [x] Submit to Base with gas estimation + retry
- [x] Wait for confirmation (3 blocks)
- [x] Record in `OraclePayment` table (status, txHash, error)
- [x] Failure queue: exponential backoff (30s→60s→120s→240s, max 5 attempts)
- [x] `GET /api/v1/oracle/health` — status, queue depth, last payment per vault
- [x] Alert on 3+ consecutive failures
- [x] `GET /api/v1/oracle/payments` — list oracle payments with status/vault filters
- [x] Transaction simulation before submission (catch reverts pre-gas)
- [x] Background retry processor (catches orphaned retries after restart)
- [x] Deadline-aware retries (expire payments past deadline instead of wasting gas)

---

## Phase 5: Event Indexer ✅

- [x] Poll-based event indexer via `publicClient.getLogs()` (HTTP, 15s interval, 2000 blocks/poll)
- [x] Event parser: decode 12 event types across all 6 contracts
- [x] Events: VaultCreated, Invested, TrancheReleased, RepaymentProcessed, WaterfallDistributed, VaultDefaulted, VaultStateChanged, AllocatedToVault, CreditScoreUpdated, MilestoneSubmitted, MilestoneApproved, PaymentExecuted
- [x] Store in PostgreSQL `VaultEvent` table (eventType, data JSON, blockNumber, txHash, logIndex)
- [x] Unique constraint on `[txHash, logIndex]` — idempotent ingestion, safe to replay
- [x] Update denormalized tables: Vault (totalRaised, totalRepaid, state, tranchesReleased), Merchant (creditScore, tier), Investment (upsert on Invested)
- [x] Backfill from DEPLOYMENT_BLOCK (38,200,000) — catches up at 2000 blocks/poll
- [x] IndexerState table tracks lastIndexedBlock across restarts
- [x] `GET /api/v1/platform/indexer` — running status, lastBlock, latestBlock, lag, eventCounts
- [x] `GET /api/v1/vaults/:address/repayments` — now reads from VaultEvent DB (no longer a stub)

---

## Phase 6: Keeper / Crank Service ✅

- [x] setInterval scheduler (every 5 minutes)
- [x] Scan fundraising vaults → `autoCancelExpired()` (simulation gates eligibility, reverts skipped silently)
- [x] Scan repaying vaults → `shouldDefault()` view check → `markDefault()` if true
- [x] On default: `PaymentRouter.deactivateSettlement(agent)` — x402 payments bypass defaulted vault
- [x] All calls simulate before submit — idempotent, reverts handled gracefully
- [x] Structured logging for all lifecycle transitions
- [x] `GET /api/v1/platform/keeper` — running status, wallet configured, poll interval

---

## Phase 7: Frontend Integration ✅

- [x] Remove `@solana/wallet-adapter-*` dependencies
- [x] Install wagmi + viem + RainbowKit, configured for Base Sepolia (chainId: 84532)
- [x] API client (`src/api/client.ts`) wired to backend — all endpoints consumed
- [x] **Home page**: live platform stats (TVL, pools, active vaults) from `/platform/stats`
- [x] **Vaults page**: real vault list from chain, invest flow with wallet signing + USDC approval
- [x] **VaultDetail**: waterfall chart (real data), milestones, tranches, repayment history
- [x] **Portfolio page**: real investor data via `/portfolio/:address`
- [x] **Merchant Dashboard**: real profile, vault creation form with wallet signing
- [x] **Liquidity Pools**: real pool data, deposit/withdraw flows with USDC approval
- [x] Transaction UX: `useContractTx` hook — pending/confirmed/failed toasts
- [x] **X402 Demo**: intentional static demo (kept as-is by design)
- [x] Merchant vault creation: pre-validation guardrails (registration check, credit tier warning, form validation, backend param bounds)
- [x] Waitlist page fully removed (route, CSS, backend endpoint, API client method)
- [x] All routing reverted to normal (no more `/waitlist` redirects)
- [x] Rebranded to **Krexa** across all files
- [x] `/app/*` routes for product pages (vaults, pools, portfolio, merchant dashboard)
- [x] Marketing pages at `/vaults`, `/pools`, `/merchant` with "Launch App" → `/app/*`
- [x] Permissionless vault creation — backend signs with admin key, no user wallet tx needed
- [x] Auto credit score assignment via indexer (600 = B tier on registration)
- [x] CORS updated for production domain (krexa.xyz)

---

## Phase 8: API Documentation & SDK ✅

- [x] OpenAPI 3.0.3 spec (752 lines) — `backend/src/config/openapi.ts`
- [x] Swagger UI served at `/api/v1/docs/` (CDN-loaded, dark theme)
- [x] Raw spec at `/api/v1/docs/openapi.json`
- [x] API key system — `tck_` prefix + 48-char hex, Prisma-backed `ApiKey` table
- [x] Optional auth middleware (`apiKeyAuth`) — sets `req.apiKey` if valid key provided
- [x] Required auth middleware (`requireApiKey`) — enforces key on admin routes
- [x] Rate limiting — 30 req/min anonymous, per-key custom limit (default 100)
- [x] In-memory sliding window with cleanup, sets `X-RateLimit-*` headers
- [x] Webhook system — `whsec_` secret, `WebhookEndpoint` + `WebhookDelivery` tables
- [x] Admin routes (key-protected): CRUD for API keys + webhooks, delivery log
- [x] Background `startWebhookProcessor()` for retry on failed deliveries
- [x] All 9 tag categories documented (Health, Vaults, Merchants, Pools, Investments, Platform, Oracle, Payments, Admin)

---

## Phase 8.5: Agent Infrastructure (Deployed) ✅

### New Contracts (Base Sepolia)
- [x] **AgentIdentity** — Soulbound ERC721 reputation NFT (one per agent). Score 0-1000: 40% volume + 30% repayments + 20% age - 10% defaults. Admin mints, indexer updates.
- [x] **AgentWallet** — Human-owned, AI-operated smart wallet. Owner sets daily/per-tx limits, whitelist, freeze. Operator (AI) executes transfers within guardrails. Linkable to credit vault.
- [x] **AgentWalletFactory** — CREATE2 factory. One wallet per owner. Predictable addresses.
- [x] **Krexa402Facilitator** — x402 HTTP payment facilitator. Merchants register API endpoints with USDC prices. Agents pay per-call. Configurable fee (max 10%). Forwards via PaymentRouter.

### New Backend Routes
- [x] `GET/POST /api/v1/identity` — mint soulbound NFT, read reputation + score
- [x] `GET/POST /api/v1/wallets` — create, list, detail, balance, history, limits, operator, whitelist, freeze, deposit, transfer, emergency-withdraw
- [x] `POST /api/v1/credit/agent-line` — create agent credit line via VaultFactory
- [x] `POST /api/v1/credit/vendor` — vendor-to-vendor credit
- [x] `GET/POST /api/v1/credit/:address/lines` + `/draw` — list and draw from credit lines
- [x] `POST/GET /api/v1/x402` — register priced resources, verify payment receipts, get resource pricing
- [x] `POST/GET /api/v1/kickstart` — upload metadata, create bonding-curve token (Base mainnet), buy, credit-and-launch combo
- [x] `GET /api/v1/gateway/:address` — unified revenue dashboard (crypto + x402 + fiat)
- [x] `GET /api/v1/balance/:address` — on-chain USDC balance

### New Packages
- [x] **@krexa/mcp-server** — MCP server exposing Krexa tools to LLMs (Claude + others). 11 tools: credit, wallet, kickstart, payments.
- [x] **@krexa/x402-client** — Client SDK. Auto-detects HTTP 402, pays via Krexa transparently.
- [x] **@krexa/x402-middleware** — Express middleware for one-line API monetization.

### Known Bugs (see bugs.md)
- [ ] **BUG-001 CRITICAL** — `predictWalletAddress` returns wrong address (bytecode mismatch)
- [ ] **BUG-002 CRITICAL** — Facilitator `executeX402Payment` signature mismatch (x402 flow non-functional on-chain)
- [ ] **BUG-003 MEDIUM** — No admin transfer mechanism on AgentIdentity, AgentWalletFactory, Krexa402Facilitator
- [ ] **BUG-004 MEDIUM** — `executeX402Payment` has zero test coverage
- [ ] **BUG-005 MEDIUM** — Resource hash front-runnable (no sender binding)
- [ ] **BUG-006 LOW** — Daily limit uses sliding window, not calendar day
- [ ] **BUG-007 LOW** — `_safeMint` allows contract recipient to grief identity minting
- [ ] **BUG-008 LOW** — Operator can be set to `address(0)`
- [ ] **BUG-009 LOW** — Deactivated resources cannot be reactivated
- [ ] **BUG-010 LOW** — `getAllWallets()` unbounded, will hit gas limit at scale
- [ ] **BUG-011 LOW** — Admin can arbitrarily overwrite reputation (no delta protection)

**Total tests: 197/197 passing** (37 new: AgentIdentity×13, AgentWallet×19, Krexa402Facilitator×6 — missing executeX402Payment coverage)

---

## Phase 9: Visual Redesign ← **IN PROGRESS**

### 9-HOME. Home Page Visual Overhaul ✅

- [x] Section background colors: Insight=#00FFF0, HowItWorks=#FF5C00, ForUsers=#2CFF05, ForMerchants=#E0115F, WhyBlockchain=#FFFFFF
- [x] Global accent swaps: #FF6B35→#FF5C00, #4bf1e5→#00FFF0, #fb4173→#E0115F
- [x] Text color adapts per section (dark on bright/white bg, white on red bg)
- [x] Divider gradients removed
- [x] Easing updated to cubic-bezier(.4, 0, .2, 1) on all reveals
- [x] Flywheel cards solid colors: #2CFF05, #00FFF0, #E0115F, #FF5C00
- [x] All sections min-height: 100vh
- [x] Problem section: SVG pixel icons (`PixelIcons.tsx`)
- [x] Tiger mascot, scroll animations, full design — **completed by user**

### 9A. Financial number hierarchy (all pages) ← Next
- [ ] Portfolio total value: 3rem+, centered, JetBrains Mono, with `$` prefix dimmed
- [ ] Pool APY: dominant metric on pool card (2rem+), accent colored
- [ ] Vault raised/target: largest element on vault card with live fill animation
- [ ] Replace all hardcoded hex colors in `.tsx` files with CSS variables

### 9B. Vault card redesign (`Vaults.tsx` + `Vaults.module.css`)
- [ ] Redesign card JSX: merchant name → APY/amount hero metric → progress bar → status → actions
- [ ] Status tints the card background subtly (fundraising=blue tint, defaulted=red tint)
- [ ] Progress bar: 8px tall, full card width, fills with accent color, animated on mount
- [ ] Card hover: `box-shadow: var(--accent-glow)` + `translateY(-3px)` together

### 9C. Pool card redesign (`LiquidityPools.tsx`)
- [ ] APY as the focal hero number on each card (2.5rem, accent colored)
- [ ] Utilization bar: 8px tall, prominent, centered in the card
- [ ] Treasury/Senior pool card gets a subtle accent ring (`box-shadow: 0 0 0 1px rgba(var(--accent-rgb), 0.2)`)

### 9D. Gradient text on key elements
- [ ] Home page headline: `background: linear-gradient(...)` + `background-clip: text` + `-webkit-text-fill-color: transparent`
- [ ] Portfolio value: accent gradient text
- [ ] Page overlines: glow text-shadow matching accent

### 9E. Real ambient background (z-index fix)
- [ ] Per-page `ambientGlow` divs: set `z-index: 0`, page content `z-index: 1` — glows visible behind content
- [ ] Verify each page's colored ambient actually renders (currently may be hidden under solid `var(--bg-dark)`)

### 9F. Skeleton loading states
- [ ] `VaultCardSkeleton` component — pulse animation, matches card dimensions
- [ ] `StatRowSkeleton` — 5 pill-shaped blocks, matching pool stats row
- [ ] `PortfolioSkeleton` — left column + right column skeleton
- [ ] Replace all page-level `<Loader2>` spinners with page-specific skeletons

### 9G. Frosted glass on floating elements
- [ ] Vaults detail panel: `backdrop-filter: blur(20px)` + `background: rgba(16,20,28,0.7)`
- [ ] All modals: frosted glass overlay + semi-transparent modal bg

### 9H. New Page Marketing — Agent Identity (`/agent-identity`)
- [ ] Marketing landing section: headline "Your Agent's On-Chain Credit Identity" + subtext
- [ ] Score tier breakdown UI (A/B/C/D) with color-coded tier badges
- [ ] Animated score meter (0–1000 arc/gauge) on scroll reveal
- [ ] Stats grid: totalTransactions, totalVolume, repayments, age, defaults
- [ ] "Mint Identity" CTA → `/app/agent-identity`
- [ ] Apply Phase 9 styles: ambient glow, gradient text on score, frosted glass stat cards

### 9I. New Page Marketing — Agent Wallets (`/agent-wallets`)
- [ ] Marketing landing section: headline "Human Control, AI Speed" + subtext
- [ ] Feature grid: daily limits, per-tx limits, whitelist, freeze, credit link
- [ ] Animated wallet card mockup showing limit dials and status
- [ ] "Create Your Agent Wallet" CTA → `/app/agent-wallets`
- [ ] Apply Phase 9 styles: card hierarchy, ambient glow, skeleton on load

### 9J. New Page App — Agent Wallets app page (`/app/agent-wallets`)
- [ ] Redesign wallet list cards: address pill, daily limit bar (filled/remaining), frozen badge, balance in JetBrains Mono
- [ ] Create wallet modal: styled with frosted glass, operator input + limit sliders
- [ ] WalletDetail page redesign: owner/operator split layout, limits dashboard, action buttons grouped by role (owner vs operator)
- [ ] Transaction history table: amount, recipient, timestamp, tx hash link to BaseScan
- [ ] Freeze toggle: red/green status indicator with pulse animation

### 9K. New Page Marketing — Gateway (`/gateway`)
- [ ] Marketing section: headline "Unified Revenue Intelligence" + subtext
- [ ] Revenue source breakdown mockup: crypto / x402 / fiat with colored ring chart
- [ ] Recent payments feed preview (static demo data)
- [ ] "View Your Gateway" CTA → `/app/gateway`
- [ ] Apply Phase 9 styles: gradient text on revenue total, ambient glow

### 9L. New Page App — Gateway app page (`/app/gateway`)
- [ ] Revenue total: large JetBrains Mono number, gradient colored, centered hero
- [ ] Source breakdown cards: Crypto (accent), x402 (cyan), Fiat (amber) — each with icon + amount + % share
- [ ] Payment feed: infinite scroll or paginated table, color-coded by source
- [ ] Period selector: 24h / 7d / 30d / All time
- [ ] Apply skeleton loaders while data loads

### 9M. New Page Marketing — Kickstart (`/kickstart`)
- [ ] Marketing section: headline "Launch a Token Backed by Real Revenue" + subtext
- [ ] Flow diagram: Draw Credit (Sepolia) → Upload Metadata → Create Token (Mainnet) → Bonding Curve
- [ ] Recent token launches carousel/grid (live from backend)
- [ ] "Launch Your Token" CTA → `/app/kickstart`
- [ ] Apply Phase 9 styles: gradient headline, ambient glow, card hover lift

### 9N. New Page App — Kickstart app page (`/app/kickstart`)
- [ ] Launch modal redesign: frosted glass, name/symbol/description/image fields with preview
- [ ] "Use Credit" toggle: expands to show linked vault + drawable amount
- [ ] Steps progress indicator: 1 Upload → 2 Create → 3 Buy (optional)
- [ ] Recent tokens grid: name, symbol, curve address pill, BaseScan link
- [ ] Apply skeleton loaders, error states, tx confirmation flow

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
- [x] **Credit Scoring** — AgentRegistry FairScale 0-1000, tiers A/B/C/D, 90-day expiry, vault gating (10 tests)
- [x] **Milestone System** — MilestoneRegistry.sol, evidence + verifier voting, tranche gate (15 tests)
- [x] **Late Fee System** — x402-aware, cumulative shortfall, daysLate capped at 30, shouldDefault (8 tests)
- [x] **Keeper Functions** — autoCancelExpired, markDefault (permissionless + admin), completeFundraisingManual (7 tests)
- **Total: 160/160 tests | Phase 0 complete | Pushed to Yatharth4599/TCredit**

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
| Credit Scoring | ✅ Implemented + 10 tests | Resolved |
| Milestones | ✅ Implemented + 15 tests | Resolved |
| Late Fees | ✅ Implemented + 8 tests (daysLate capped at 30) | Resolved |
| Keeper Functions | ✅ Implemented + 7 tests | Resolved |

---

*Version 4.0 — Rewritten for Base MVP with Solana feature ports (Feb 2026)*
