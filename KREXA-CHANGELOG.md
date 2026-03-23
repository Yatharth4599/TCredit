# Krexa Protocol — What Was Built

> A complete breakdown of every package, program, service, dashboard, and script built for the Krexa Protocol.

---

## Table of Contents

1. [Solana Programs (On-Chain)](#1-solana-programs-on-chain)
2. [Krexa SDK (`packages/krexa-sdk`)](#2-krexa-sdk)
3. [Krexa REST API (`packages/krexa-api`)](#3-krexa-rest-api)
4. [Oracle Scoring Engine (`oracle/`)](#4-oracle-scoring-engine)
5. [Agent Dashboard App (`app/`)](#5-agent-dashboard-app)
6. [Frontend Waitlist Pages (`frontend/`)](#6-frontend-waitlist-pages)
7. [Demo Scripts (`demo/`)](#7-demo-scripts)
8. [Base Contracts Seeder (`base-contracts/script/`)](#8-base-contracts-seeder)
9. [Deployments & Infrastructure](#9-deployments--infrastructure)
10. [Browser Compatibility Fixes](#10-browser-compatibility-fixes)

---

## 1. Solana Programs (On-Chain)

Two brand-new Anchor programs were written from scratch, and all existing programs received significant updates.

### 1.1 krexa-score (NEW)

**Path:** `solana-programs/programs/krexa-score/`
**Files:** `src/lib.rs`, `src/state.rs`, `src/errors.rs`, `Cargo.toml`
**Devnet:** `2GwtAXnjY5LehfZfT77ZH3XSshwbni8LP9zXeA84WUqh`

A comprehensive on-chain credit scoring system called **Krexit Score**. Stores a composite score (200–850) broken into 5 weighted components, along with financial metrics, behavioral metrics, and a 30-entry event history ring buffer.

**State Accounts:**

- **ScoreConfig** — Singleton PDA. Holds admin, oracle, references to registry/wallet/vault programs, and a pause flag.
- **KrexitScore** — One per agent (~1,100 bytes). Contains:
  - Composite score (u16, 200–850) and credit level (u8, 1–4)
  - 5 component scores (u16 each, 0–10,000 BPS):
    - C1 Repayment (30% weight)
    - C2 Profitability (25% weight)
    - C3 Behavioral health (20% weight)
    - C4 Usage patterns (15% weight)
    - C5 Account maturity (10% weight)
  - Event counters: on-time repayments, late repayments, missed repayments, liquidations, defaults, credit cycles completed
  - Financial metrics: cumulative borrowed/repaid, current debt, PnL ratio (BPS), max drawdown (BPS), Sharpe ratio (BPS)
  - Behavioral metrics: percentage of time in Green/Yellow/Orange/Red health zones (each as BPS)
  - Usage metrics: venue entropy (BPS), unique venues, total transactions, average daily volume
  - Timestamps: registered_at, last_score_update, last_critical_event, last_repayment
  - History ring buffer: 30 entries, each storing old_score → new_score, event type, delta in BPS, and timestamp
  - Type B agent fields: revenue_health_bps, milestone_completion_rate_bps
  - Flags: is_active, is_blacklisted

**Instructions:**

| Instruction | Signer | Description |
|-------------|--------|-------------|
| `initialize` | Admin | Creates the ScoreConfig singleton PDA. |
| `initialize_score` | Oracle/Admin | Creates a KrexitScore PDA for a new agent. Starting score is 350. Initial components: C1=7000, C2=5000, C3=5000, C4=0, C5=0. |
| `update_score` | Oracle | Updates composite score + all 5 components + financial/behavioral metrics. Takes ~20 parameters. Enforces: score range 200–850, component range 0–10000, normal delta limit ±100 BPS, critical event delta ±200 BPS, 60-second cooldown between updates (bypassed for critical events). Records a history entry in the ring buffer. Special event handling: on-time/early/late/missed repayment counters, liquidation penalty (score must drop ≥40 points), default → permanent blacklist + C1 set to 0. |
| `record_credit_event` | Wallet/Vault (CPI) | Records credit events: Borrowed (increases current_debt and cumulative_borrowed), Repaid (decreases current_debt, increases cumulative_repaid), DebtUpdated (sets current_debt directly). |
| `update_kya_tier` | Oracle/Admin | Upgrades KYA tier. Can only go up, never down. |
| `set_paused` | Admin | Pauses the program. |
| `update_config` | Admin | Updates admin and oracle addresses. |

---

### 1.2 krexa-service-plan (NEW)

**Path:** `solana-programs/programs/krexa-service-plan/`
**Files:** `src/lib.rs`, `Cargo.toml`
**Devnet:** `Eqc48c6TtKAPRosTMoC6Nasi85iqdLuzwbu6WBrsPFdt`

Manages milestone-based credit disbursement and expense whitelisting for Type B (Service) agents. Instead of giving a service agent their full credit upfront, the vault disburses USDC in milestones as the agent hits targets.

**State Accounts:**

- **ServicePlanConfig** — Singleton. Admin, oracle, vault/wallet program references, total plan count, pause flag.
- **ServicePlan** — One per agent. Contains:
  - Agent wallet reference and owner
  - Total credit allocated and total disbursed so far
  - Projected monthly revenue (set by oracle) and actual revenue this period
  - Health zone (Green=0, Yellow=1, Orange=2, Red=3)
  - Zero-revenue days counter
  - Wind-down state (None=0, Grace=1, Executing=2, Completed=3)
  - Array of up to 8 milestones
  - Expense destination count (up to 20)
- **Milestone** — 58 bytes each, embedded in ServicePlan:
  - Amount to disburse (u64)
  - Description hash (32 bytes, SHA-256 prefix)
  - Eligible-at timestamp (i64)
  - Disbursed flag + disbursed-at timestamp
  - Is-active flag
- **ExpenseDestination** — Separate PDA per approved expense target:
  - Destination token account
  - Label hash and category (0=infrastructure, 1=API, 2=marketing, 3=payroll, 4=other)
  - Max amount per transaction
  - Total sent (cumulative)
  - Active flag and approved-at timestamp

**Instructions:**

| Instruction | Signer | Description |
|-------------|--------|-------------|
| `initialize` | Admin | Creates ServicePlanConfig. |
| `create_plan` | Owner | Creates plan with total credit and milestone array. Validates that the sum of milestone amounts ≤ total credit. |
| `disburse_milestone` | Oracle | Releases milestone USDC from vault to agent wallet. Blocked if health is Orange/Red. Delayed by 7 days if health is Yellow. |
| `add_expense_destination` | Owner | Adds an approved expense target (up to 20). Specifies category and optional per-tx max. |
| `remove_expense_destination` | Owner | Deactivates an expense destination. |
| `execute_expense` | Agent/Owner | Transfers USDC to an approved destination. Enforces per-transaction max amount if set. |
| `record_revenue` | Oracle | Records actual revenue. Recalculates health zone: ≥80% projected → Green, 50–79% → Yellow, 25–49% → Orange, <25% → Red. |
| `update_zero_revenue_days` | Oracle | Increments zero-revenue counter. 7 days → Orange, 14 days → Red. |
| `set_projected_revenue` | Oracle | Sets the monthly revenue target and resets the period. |
| `start_wind_down` | Oracle/Admin | Must be in Red zone. Begins 48-hour grace period. |
| `advance_wind_down` | Anyone | Permissionless. Moves Grace → Executing → Completed after grace elapses. |

---

### 1.3 Changes to Existing Programs

**krexa-agent-registry** — Added 7 new instructions: `sign_legal_agreement`, `attest_score`, `set_agent_type`, `propose_profile_transfer`, `accept_profile_transfer`, `cancel_profile_transfer`, and expanded `AgentProfile` with agent_type, legal_agreement_hash, and ownership transfer fields. Profile transfer is a 2-step mechanism with a separate `ProfileOwnershipTransfer` PDA.

**krexa-credit-vault** — Added tranche accounting (Senior/Mezzanine/Junior deposits and shares tracked separately in VaultConfig), insurance fund mechanics (first-loss capital with 20% target), `deposit_collateral` instruction for agent-specific collateral that earns Senior tranche yield, `write_off_bad_debt` for handling defaults, `distribute_yields` for pro-rata tranche distributions, and `create_insurance_token` for the insurance reserve account.

**krexa-agent-wallet** — Added `VenueExposure` PDA for per-agent per-venue cumulative tracking (50% concentration limit enforcement), `OwnershipTransfer` PDA for 2-step wallet transfers, `pay_x402` instruction that routes through the Payment Router, expanded `execute_trade` with the full 8 safety check layers, `deleverage` instruction for auto-triggered health recovery (HF between 1.05x and 1.2x), and `owner_type` field (EOA vs Multisig) with multisig requirement for L3–L4 credit.

**krexa-payment-router** — Massively expanded from a simple router to a full revenue validation engine. Added `RevenueValidator` PDA (per-merchant, with 50-entry payment history ring buffer), `GlobalBlocklist` PDA (known wash-trade sources, up to 10 associated wallets per agent), `PlatformWhitelist` PDA (approved payment sources), and the complete 3-layer validation pipeline: Layer 1 source classification (whitelist/blocklist check), Layer 2 pattern detection (round-trip, amount anomaly, rapid return), Layer 3 economic validation (single payment vs credit line ratio).

**krexa-venue-whitelist** — Added `update_config` instruction for admin address rotation.

**krexa-common** — Significantly expanded shared constants and state enums. Added: credit level definitions with leverage ratios, KYA tier definitions, vault tranche structure, health factor thresholds (1.5x healthy, 1.3x warning, 1.2x danger, 1.05x liquidation), agent type enum (Trader/Service/Hybrid), fee schedule (10% protocol fee, 0.5% liquidation reward, 10% platform fee on x402), service plan health zones, wind-down states, revenue validation classifications, and all the canonical protocol constants.

---

### 1.4 New Test Suites

**`tests/revenue-validation.test.ts`** (922 lines) — End-to-end test suite for the Payment Router's 3-layer revenue validation system. Tests cover:
- Verified payment processing and correct fee splitting (10% platform, repayment cut, remainder to merchant)
- Rejected payments from blocklisted sources
- Quarantined payments from unknown sources (auto-approval after 72h if score > 60)
- Round-trip wash-trade detection (95% amount similarity within 24h)
- Amount anomaly detection (>10x daily average)
- Rapid return detection (>3x disbursed within 7 days)
- Economic validation (single payment > 50% of credit line)
- Associated wallet self-payment blocking
- Payment history ring buffer cycling (50 entries)

**`tests/service-plan.test.ts`** (989 lines) — End-to-end test suite for the Service Plan program. Tests cover:
- Plan creation with milestone validation (sum ≤ total credit)
- Milestone disbursement in Green zone
- Milestone delay in Yellow zone (7-day penalty)
- Disbursement blocking in Orange and Red zones
- Expense destination CRUD (add, remove, execute)
- Per-transaction max enforcement on expenses
- Revenue recording and health zone transitions
- Zero-revenue day tracking and auto-Orange/Red transitions
- Wind-down lifecycle: start (requires Red) → Grace (48h) → Executing → Completed
- Permissionless wind-down advancement after grace period

---

## 2. Krexa SDK

**Path:** `packages/krexa-sdk/`
**Files:** `src/client.ts`, `src/types.ts`, `src/pda.ts`, `src/utils.ts`, `src/validation.ts`, `src/index.ts`

A complete TypeScript SDK for interacting with all Krexa Protocol Solana programs. Works with or without a wallet (read-only mode for querying, write mode when wallet is provided).

### Client Architecture

The main `KrexaClient` class exposes three modules:

```
KrexaClient
├── agent: AgentModule    — Agent profiles, wallets, health, credit terms
├── vault: VaultModule    — Vault statistics, tranche data, revenue
└── lp: LPModule          — LP positions, deposit/withdraw previews
```

### AgentModule Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `getProfile(agent)` | AgentProfile | Agent identity: name, score, level, KYA tier, lifetime stats (volume, trades, repayments, borrowed), liquidation count, agent type |
| `getWallet(agent)` | AgentWallet | Wallet state: credit limit/drawn, total debt, collateral shares, daily spend tracking, health factor (BPS), frozen/liquidating flags, trade stats |
| `getHealth(agent)` | HealthData | Computed health factor (BPS), wallet USDC balance, collateral value, total debt, credit drawn, health status label |
| `getCreditLine(agent)` | CreditLine | Active credit line: limit, drawn, interest rate (BPS), accrued interest, total interest paid, origination date |
| `getTerms(agent)` | CreditTerms | Credit terms for the agent's current level: max credit, interest rate, collateral ratio, NAV trigger, daily limit |
| `getServicePlan(agent)` | ServicePlan | Type B agent plan: milestones (up to 8), total credit, disbursed, projected/actual revenue, health zone, wind-down state |
| `getRevenueValidator(agent)` | RevenueValidator | Revenue source validation state and payment history |
| `checkLevelUpgrade(agent)` | UpgradeCheck | Whether the agent is eligible for a level upgrade, and what requirements remain |
| `estimateRepaymentTime(agent)` | RepaymentEstimate | Estimated days and date to pay off current debt at current repayment rate |

### VaultModule Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `getStats()` | VaultStats | Total deposits, total borrowed, utilization %, per-tranche breakdown (deposits, shares, APR) |
| `getTrancheStats(tranche)` | TrancheStats | Single tranche: deposits, shares, APR, current share price |
| `getRevenueBreakdown()` | RevenueBreakdown | Daily interest income split across tranches, treasury, and insurance |
| `getLossBufferStatus()` | LossBuffer | Insurance fund balance, capacity before senior tranche absorbs losses |

### LPModule Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `getPosition(owner, tranche)` | Position | LP's position: shares held, current value, estimated yield |
| `getAllPositions(owner)` | Map<Tranche, Position> | All tranche positions for an LP |
| `previewDeposit(tranche, amount)` | Preview | Estimated shares received for a given USDC amount |
| `previewWithdraw(tranche, shares)` | Preview | Estimated USDC received for redeeming shares |

### PDA Helpers (`pda.ts`)

19 functions that compute Program Derived Addresses using fixed seeds:

| Function | Seeds | Program |
|----------|-------|---------|
| `findRegistryConfig` | `"registry_config"` | Agent Registry |
| `findAgentProfile` | `"agent_profile"` + agent pubkey | Agent Registry |
| `findVaultConfig` | `"vault_config"` | Credit Vault |
| `findCreditLine` | `"credit_line"` + agent pubkey | Credit Vault |
| `findDepositPosition` | `"deposit_position"` + depositor + tranche | Credit Vault |
| `findInsuranceAccount` | `"insurance"` | Credit Vault |
| `findWalletConfig` | `"wallet_config"` | Agent Wallet |
| `findAgentWallet` | `"agent_wallet"` + agent pubkey | Agent Wallet |
| `findWalletUsdc` | `"wallet_usdc"` + agent pubkey | Agent Wallet |
| `findVenueExposure` | `"venue_exposure"` + agent + venue | Agent Wallet |
| `findWhitelistConfig` | `"whitelist_config"` | Venue Whitelist |
| `findWhitelistedVenue` | `"venue"` + venue program pubkey | Venue Whitelist |
| `findRouterConfig` | `"router_config"` | Payment Router |
| `findMerchantSettlement` | `"merchant"` + merchant pubkey | Payment Router |
| `findRevenueValidator` | `"revenue_validator"` + merchant | Payment Router |
| `findServicePlanConfig` | `"service_plan_config"` | Service Plan |
| `findServicePlan` | `"service_plan"` + agent wallet | Service Plan |
| `findExpenseDestination` | `"expense_dest"` + plan + destination | Service Plan |
| `findScoreConfig` | `"score_config"` | Krexit Score |

### Utility Functions (`utils.ts`)

| Function | Description |
|----------|-------------|
| `usdcToLamports(amount)` | Converts human-readable USDC to lamports (×10^6) |
| `lamportsToUsdc(lamports)` | Converts lamports to human-readable USDC |
| `formatUsdc(lamports)` | Formats as `"1,234.56"` string |
| `calculateInterest(principal, rateBps, seconds)` | Simple interest: `principal × rate × time / (10000 × 365.25 days)` |
| `calculateHealthFactor(walletBalance, collateralValue, totalDebt)` | Returns health factor in BPS: `(wallet + collateral) / debt × 10000` |
| `getCreditTerms(level)` | Returns max credit, rate, collateral ratio, NAV trigger, daily limit for a given level |
| `encodeName(name)` | Encodes a string into a 32-byte `Uint8Array` (for on-chain name fields) |
| `decodeName(bytes)` | Decodes a 32-byte array back to a trimmed string |

### Validation Functions (`validation.ts`)

| Function | What It Validates |
|----------|-------------------|
| `validateAmount(amount)` | Positive, finite number |
| `validatePublicKey(key)` | Valid base58 Solana public key |
| `validateCreditRequest(milestones, expenses)` | 2–8 milestones, sum ≤ total credit, expense whitelist checks |
| `validateDeposit(amount, tranche)` | Minimum $1, valid tranche |
| `validateWithdrawal(shares, position, vaultStats)` | Sufficient shares, lockup period, buffer maintenance |
| `validateRepayment(amount, creditLine)` | Positive amount ≤ outstanding debt |
| `validateTrade(amount, wallet, venue)` | Per-trade limit (20%), daily limit, venue concentration (50%), health gate |
| `validateLpDeposit(amount, tranche)` | Minimum deposit, utilization cap check |
| `validateLpWithdraw(shares, position)` | Sufficient shares, lockup expired |

### Deserialization

The SDK includes manual Borsh deserialization functions (no external dependency) for all on-chain account types. Each function reads a `Buffer` byte-by-byte using helpers: `readU8`, `readU16`, `readU64`, `readI64`, `readBool`, `readPubkey`, `readBytes`.

---

## 3. Krexa REST API

**Path:** `packages/krexa-api/`
**Stack:** Fastify + TypeScript

A REST API that wraps the SDK and exposes all protocol data over HTTP. Handles wallet-based authentication, rate limiting, and admin-only routes.

### Server Configuration

- **CORS:** Allows `app.krexa.xyz`, `localhost:3000`, `localhost:5173`
- **Rate limiting:** 100 requests/minute per wallet address (falls back to IP)
- **Port:** `PORT` env variable (default 3001)

### Authentication (`middleware/auth.ts`)

Wallet-based signature verification using NaCl:
1. Client sets `x-wallet-address` header (base58 public key)
2. Client sets `x-wallet-signature` header (base58 signature of `x-wallet-timestamp`)
3. Server verifies the signature using `tweetnacl.sign.detached.verify`
4. Rejects if timestamp is more than ±5 minutes from server time

### Admin Gate (`middleware/adminGate.ts`)

Layers wallet auth + checks if the wallet address is in the `ADMIN_WALLETS` comma-separated env variable.

### Endpoints

#### Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | None | Returns `{status: "ok", version, timestamp}` |

#### Agent Routes (`/agent`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/agent/:address/profile` | None | Agent profile (name, score, level, KYA, stats) |
| GET | `/agent/:address/wallet` | None | Agent wallet state (credit, debt, limits, status) |
| GET | `/agent/:address/health` | None | Computed health factor and breakdown |
| GET | `/agent/:address/score` | None | Score, level, and KYA tier |
| GET | `/agent/:address/terms` | None | Credit terms for the agent's current level |
| GET | `/agent/:address/service-plan` | None | Service plan with milestones (Type B agents) |

#### Credit Routes (`/credit`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/credit/:address/line` | None | Active credit line details |
| GET | `/credit/:address/repayment-estimate` | None | Estimated days and date to pay off debt |
| GET | `/credit/:address/upgrade-check` | None | Level upgrade eligibility and remaining requirements |

#### Vault Routes (`/vault`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/vault/stats` | None | Total deposits, borrowed, utilization, tranche breakdown |
| GET | `/vault/tranche/:tranche` | None | Single tranche stats (senior, mezzanine, junior) |
| GET | `/vault/revenue` | None | Daily revenue breakdown across tranches/treasury/insurance |
| GET | `/vault/loss-buffer` | None | Insurance fund capacity before senior tranche losses |

#### LP Routes (`/lp`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/lp/:address/positions` | None | All tranche positions for an LP |
| GET | `/lp/:address/position/:tranche` | None | Single tranche position with yield estimate |
| GET | `/lp/preview/deposit` | None | Query params: `tranche`, `amount`. Estimated shares received. |
| GET | `/lp/preview/withdraw` | None | Query params: `tranche`, `shares`. Estimated USDC received. |

#### Admin Routes (`/admin`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/admin/vault-stats` | Admin | Combined vault stats + revenue breakdown + loss buffer |

---

## 4. Oracle Scoring Engine

**Path:** `oracle/`
**Stack:** TypeScript + @solana/web3.js

An off-chain scoring engine that computes Krexit Scores for agents based on 5 weighted components. Designed to run as a daily cron job executed by the oracle authority keypair.

### Score Computation (`scoring/engine.ts`)

The main function `computeKrexitScore(agentData)` produces a score from 200–850 by computing 5 components and combining them with fixed weights:

#### C1: Repayment History (30% weight)

Looks at every repayment event in the agent's history and applies recency-weighted scoring:

| Event Type | Impact |
|-----------|--------|
| On-time repayment | +3% |
| Early repayment | +4% |
| Late repayment | −10% |
| Missed repayment | −25% |
| Liquidation | −40% |
| Default | Score → 0 (immediate) |

**Recency multipliers:** Last 30 days = 2.0×, 30–90 days = 1.5×, 90–180 days = 1.0×, 180+ days = 0.5×. Recent events have double the weight of older events.

#### C2: Profitability (25% weight)

For **Trader agents** (Type A): `return = (walletValue − originalCredit) / originalCredit`. Passed through a sigmoid function centered at 10% return.

For **Service agents** (Type B): `return = (cumulativeRevenue − expenses) / expenses`.

Bonuses and penalties:
- +trend bonus if recent 7-day performance exceeds previous 7-day by 10%+
- −drawdown penalty if max drawdown exceeds 30%
- +Sharpe ratio bonus if Sharpe > 1.0

#### C3: Behavioral Health (20% weight)

Measures what percentage of time the agent spends in each health zone:

| Zone | Score Value |
|------|------------|
| Green | 100% |
| Yellow | 60% |
| Orange | 20% |
| Red | 0% |

Self-correction bonus: if the agent was in danger (Orange/Red) and recovered to Green, +10%.

#### C4: Usage Patterns (15% weight)

For **Traders:** Shannon entropy of venue distribution (how diversified are trades across venues) + volume consistency (inverse coefficient of variation of daily volumes).

For **Service agents:** Revenue source diversity (`unique_sources / 10`) + efficiency (`revenue / expenses`, capped at 1.0) + consistency (inverse CoV of daily revenue).

#### C5: Account Maturity (10% weight)

Three sub-components averaged:
- Age: `log(days + 1) / log(400)` — approaches 1.0 at ~400 days
- Volume: `log₁₀(lifetime_volume + 1) / 7` — approaches 1.0 at $10M
- Cycles: `completed_credit_cycles / 22` — approaches 1.0 at 22 cycles

#### Level Determination

After computing the score, the engine determines credit level:

| Level | Minimum Score | Minimum Age |
|-------|--------------|-------------|
| 4 (Elite) | 750 | 6 months |
| 3 (Trusted) | 650 | 3 months |
| 2 (Established) | 500 | — |
| 1 (Starter) | 200 (default) | — |

### Score Updater (`scoring/updater.ts`)

The `ScoreUpdater` class connects to Solana RPC and orchestrates daily score updates:

1. `runDailyUpdate()` — Fetches all `KrexitScore` PDAs via `getProgramAccounts`, computes new scores for each, logs the results. (On-chain submission via `update_score` instruction is prepared but marked TODO for production keypair integration.)

2. `handleCriticalEvent(agentPubkey, eventType, score)` — Immediately applies a −40 point penalty for liquidation or wind-down events. Bypasses the normal 60-second cooldown.

3. `startScoringOracle(rpcUrl, keypairPath, programId)` — Entry point that starts the daily update loop on a configurable interval.

### Types (`scoring/types.ts`)

- `AgentData` — Input to the scoring engine: agent type, repayment events array, NAV/revenue history, transaction list, financial metrics
- `RepaymentEvent` — Type (on_time/early/late/missed/liquidation/default) + timestamp + amount
- `ScoreResult` — Output: composite score (200–850), level (1–4), component scores (C1–C5 as BPS values 0–10,000)

---

## 5. Agent Dashboard App

**Path:** `app/`
**Stack:** React 19 + Vite 8 + Tailwind CSS 4 + Solana Wallet Adapter + React Query

A full-featured dashboard for AI agents to monitor their wallet health, credit lines, and positions. Connects to Solana devnet via browser wallet extensions (Phantom, Solflare).

### Entry Point & Polyfills

**Problem:** Solana's `@solana/web3.js` and wallet adapter libraries require Node.js globals (`Buffer`, `process`, `global`) that don't exist in browsers. ES module `import` statements are hoisted — they execute before any other code in the module, so you can't set up polyfills before static imports.

**Solution:** A two-stage boot process:

1. **`src/main.tsx`** — Only statically imports `buffer`. Sets `window.Buffer`, `window.global`, and `window.process` synchronously. Then dynamically imports `./bootstrap` (which contains all React/Solana code).
2. **`src/bootstrap.tsx`** — Dynamically loaded after polyfills are set. Creates the React root and mounts `<App />`. Includes try/catch error handling that renders errors to the page in red text.
3. **`index.html`** — Contains a visible "Loading Krexa Dashboard…" message inside `#root` so the user never sees a blank screen.

### Providers

**`providers/WalletProvider.tsx`** — Wraps the app in Solana wallet adapter context. Configures Phantom and Solflare wallet adapters with auto-connect. Reads RPC endpoint from `VITE_RPC_URL` env (defaults to devnet).

**`providers/QueryProvider.tsx`** — React Query provider with: 10-second stale time, 2 retries on failure, refetch on window focus enabled.

### Configuration (`config.ts`)

```typescript
rpcEndpoint: VITE_RPC_URL || clusterApiUrl('devnet')
apiUrl: VITE_API_URL || 'http://localhost:3001'
adminWallets: VITE_ADMIN_WALLETS (comma-separated)
refreshIntervals: { health: 10s, positions: 30s, vault: 60s, score: 120s }
```

### Hooks (`src/hooks/`)

| Hook | Data Source | Refresh | Description |
|------|-----------|---------|-------------|
| `useKrexa()` | — | — | Memoized `KrexaClient` instance from connection + wallet |
| `useAgentProfile(pubkey?)` | `client.agent.getProfile()` | 120s | Agent profile: name, score, level, stats |
| `useAgentWallet(pubkey?)` | `client.agent.getWallet()` | 30s | Wallet state: credit, debt, limits, flags |
| `useAgentHealth(pubkey?)` | `client.agent.getHealth()` | 10s | Health factor (BPS), balances, status |
| `useCreditLine(pubkey?)` | `client.agent.getCreditLine()` | 30s | Credit line: limit, drawn, rate, interest |
| `useVaultStats()` | `client.vault.getStats()` | 60s | Global vault: deposits, borrowed, utilization |
| `useLPPositions(pubkey?)` | `client.lp.getAllPositions()` | 30s | All LP positions across tranches |
| `useIsAdmin()` | config.adminWallets | — | Boolean: is connected wallet an admin |

### Components

**Agent Components (`components/agent/`):**

- **AgentCard** — Displays agent name (decoded from 32-byte on-chain field), public key (truncated), credit level badge, score badge. Stats grid: total volume, total trades, total borrowed, registration time.
- **HealthIndicator** — Health factor gauge with color-coded bar (green ≥1.5x, yellow ≥1.3x, orange ≥1.2x, red <1.2x). Shows scale markers from 1.05x to 1.50x+. Breakdown: wallet balance, total debt, credit drawn.
- **CreditLineCard** — Utilization bar showing drawn vs. limit. Level badge. Interest rate (APR), accrued interest, origination date.
- **WalletCard** — Grid of stats: credit limit, credit drawn, total debt, daily spend limit, daily spent, total trades. Shows frozen/liquidating status badges and creation time.

**LP Components (`components/lp/`):**

- **VaultOverview** — Total deposits, total borrowed, utilization percentage, plus three TrancheCards.
- **TrancheCard** — Per-tranche display: name, deposits, shares, APR, color-coded (blue=Senior, purple=Mezzanine, orange=Junior).
- **PositionCard** — LP position: current value, shares held, estimated yield.

**Shared Components (`components/shared/`):**

- **StatCard** — Label + value card with optional trend indicator and description
- **ScoreBadge** — Color-coded score display (green ≥700, yellow ≥500, orange ≥350, red <350)
- **LevelBadge** — Credit level pill (L1 Starter, L2 Established, L3 Trusted, L4 Elite)
- **HealthDot** — Small colored circle indicator for health status
- **EmptyState** — Centered icon + title + description + optional action button
- **LoadingSpinner** — Animated spinner
- **TokenAmount** — Formatted USDC display with mint icon

**Layout Components (`components/layout/`):**

- **AppLayout** — Sidebar + main content area with React Router `<Outlet />`
- **Sidebar** — Navigation: Dashboard, Wallet, Credit, Health, LP, Vault, Admin. Active route highlighting. Krexa logo.
- **PageHeader** — Title + optional subtitle

### Pages

| Route | Page | What It Shows |
|-------|------|---------------|
| `/` | Dashboard | When not connected: "Connect your wallet" with WalletMultiButton. When connected but no on-chain data: demo placeholder cards showing Agent (Not Registered), Health (—), Credit ($0), Wallet ($0.00) with explanatory messages. When connected with data: live AgentCard, HealthIndicator, CreditLineCard, WalletCard. |
| `/wallet` | WalletPage | WalletCard component for connected wallet |
| `/credit` | CreditPage | CreditLineCard component |
| `/health` | HealthPage | HealthIndicator component |
| `/lp` | LPPage | All LP positions across tranches with PositionCards |
| `/vault` | VaultPage | VaultOverview with tranche breakdown |
| `/admin` | AdminPage | Protocol stats (admin-only, checks useIsAdmin) |

### Bundled SDK Copy (`src/sdk/`)

A complete copy of `packages/krexa-sdk/src/` lives at `app/src/sdk/` for standalone Vercel builds. The only difference: `client.ts` defines the `Wallet` interface inline instead of importing it from `@coral-xyz/anchor` (because anchor's browser ESM build doesn't export `Wallet`).

### Build & Deploy Config

- **`vite.config.ts`** — React plugin + Tailwind CSS v4 plugin. Aliases: `@` → `src/`, `@krexa/solana-sdk` → `src/sdk/index.ts`. Defines `process.env: {}` and `global: globalThis` for browser compatibility.
- **`vercel.json`** — Install: `npm install`, build: `npm run build`, output: `dist/`.
- **`package.json`** — Build command is just `vite build` (skips `tsc` for faster builds).

---

## 6. Frontend Waitlist Pages

**Path:** `frontend/src/pages/` and `frontend/src/api/`

Four new dashboard pages added to the existing waitlist frontend, plus an API client.

### API Client (`api/solanaClient.ts`)

Axios-based HTTP client pointing to `VITE_KREXA_API_URL` (defaults to localhost:3001). Organized into namespaced exports:

| Namespace | Methods |
|-----------|---------|
| `agentApi` | `getProfile`, `getWallet`, `getHealth`, `getScore`, `getTerms`, `getServicePlan` |
| `creditApi` | `getCreditLine`, `getRepaymentEstimate`, `getUpgradeCheck` |
| `vaultApi` | `getStats`, `getTrancheStats`, `getRevenue`, `getLossBuffer` |
| `lpApi` | `getPositions`, `getPosition`, `previewDeposit`, `previewWithdraw` |
| `scoreApi` | `getScore`, `getProfile`, `getHealth`, `getServicePlan` |
| `healthApi` | `check` |

### KrexitScoreDashboard.tsx (658 lines)

The most complex frontend page. A full Krexit Score analytics dashboard:

- **Search bar** — Enter any agent public key to look up their score
- **Score gauge** — SVG circular progress visualization (200–850 range) with color-coded arc
- **5-component breakdown** — Weighted bar charts for C1 Repayment, C2 Profitability, C3 Behavioral, C4 Usage, C5 Maturity, each showing raw score (0–10,000 BPS) and weight
- **Score history timeline** — Plots the last 30 score change events from the ring buffer, showing old → new score, event type, and delta
- **Event counters** — On-time repayments, late, missed, liquidations, defaults, credit cycles
- **Financial metrics** — Cumulative borrowed/repaid, current debt, P&L ratio, max drawdown, Sharpe ratio
- **Health zone distribution** — Percentage of time in Green/Yellow/Orange/Red zones (stacked bar)
- **Usage metrics** — Venue entropy, unique venues, total transactions, average daily volume
- **Level upgrade path** — Visual stepper showing current level and what's needed for the next level
- **Type B metrics** — For service agents: revenue health percentage, milestone completion rate

### SolanaCreditDashboard.tsx (467 lines)

Agent credit overview page:
- Search by agent pubkey
- Agent profile card (name, score, level, KYA tier, agent type)
- Health zone indicator with color coding
- Credit utilization bar (drawn vs. limit)
- Credit terms display (max credit, rate, NAV trigger)
- Repayment estimate (days to payoff)
- Service plan milestones table (if Type B agent)

### SolanaLPDashboard.tsx (308 lines)

LP position management:
- Search by LP wallet address
- Position cards for each tranche (Senior/Mezzanine/Junior)
- Current value, shares held, estimated yield
- Deposit/withdraw preview calculators

### SolanaVaultDashboard.tsx (307 lines)

Vault analytics:
- Total deposits, total borrowed, utilization percentage
- Per-tranche breakdown (deposits, shares, APR, share price)
- Revenue breakdown (daily interest to tranches, treasury, insurance)
- Loss buffer status (insurance capacity before senior losses)

---

## 7. Demo Scripts

**Path:** `demo/`
**Stack:** TypeScript + @solana/web3.js + @solana/spl-token

Four scripts for setting up and validating a complete demo environment on devnet.

### configure-demo.ts (550 lines)

End-to-end demo environment setup. Runs 8 steps:

1. **Generate keypairs** — Creates agent, owner, and customer keypairs (or loads existing ones from `demo/keys/`).
2. **Fund wallets** — Transfers SOL from the admin wallet (`~/.config/solana/id.json`) to agent, owner, and customer.
3. **Create USDC accounts** — Creates Associated Token Accounts for each wallet. Mints $100 USDC to owner and customer (requires USDC mint authority).
4. **Seed vault** — Deposits $500 USDC into the Credit Vault via the `deposit_liquidity` instruction as initial liquidity.
5. **Whitelist venue** — Adds the Payment Router program as an approved x402 venue on the Venue Whitelist.
6. **Create collateral position** — Deposits $2 USDC as collateral via the vault's `deposit_collateral` instruction, creating the collateral DepositPosition PDA.
7. **Write environment file** — Generates `demo/.env` with all addresses, keypair paths, and program IDs.
8. **Write agent service template** — Generates `demo/agent-service/.env` template (user fills in ANTHROPIC_API_KEY).

Includes low-level instruction encoders that manually build Anchor instruction data with discriminators (first 8 bytes of SHA-256 of `"global:<instruction_name>"`).

### setup-demo.ts (467 lines)

Pre-flight validation script. Checks everything is ready before running the demo:

1. Verifies all 7 programs exist and are executable on devnet
2. Checks all config PDAs are initialized (RegistryConfig, VaultConfig, WalletConfig, WhitelistConfig, RouterConfig)
3. Validates vault has sufficient liquidity (≥$50 USDC)
4. Checks owner and agent USDC balances
5. Tests the Krexa API endpoint (`http://localhost:3001/health`)
6. Tests WebSocket connectivity (`ws://localhost:3002`)
7. Verifies venue whitelist configuration
8. Dry-runs a `register_agent` transaction (simulates without submitting)

### setup-oracle-usdc.ts (48 lines)

Quick utility that:
1. Creates an Associated Token Account for the oracle wallet (if it doesn't exist)
2. Mints $100 USDC to the oracle (for x402 payment processing in demos)

### update-vault-router.ts (63 lines)

Calls the vault's `update_config` instruction to set the `router_program` reference. Required before x402 payments can flow through the Payment Router → Vault repayment path.

---

## 8. Base Contracts Seeder

**Path:** `base-contracts/script/`

### SeedDemo.s.sol (616 lines)

A Foundry Solidity script for seeding the Base chain (EVM) demo environment. Sets up:
- Mock USDC token deployment
- Credit vault initialization with seed liquidity
- Agent registration with demo profiles
- Collateral deposits and credit line origination
- Sample trade and repayment transactions

### SeedDemo.sh (79 lines)

Shell wrapper script that:
1. Sets environment variables (RPC URL, private key, contract addresses)
2. Runs the Foundry script with `forge script SeedDemo.s.sol --rpc-url $RPC --broadcast`
3. Logs deployed addresses to `demo-addresses.json`

---

## 9. Deployments & Infrastructure

### Vercel Deployments

| App | URL | Root Directory |
|-----|-----|---------------|
| Frontend (Waitlist) | https://frontend-navy-eight-10.vercel.app | `frontend/` |
| Agent Dashboard | https://krexa-dashboard.vercel.app | `app/` |

### Render Services

| Service | Type | Description |
|---------|------|-------------|
| tcredit-backend | Web Service | Express + Prisma waitlist API |
| krexa-demo-server | Web Service | Demo server |
| krexa-api | Web Service | Fastify REST API wrapping the SDK |

All three are on Render's free tier (sleeps after 15 minutes of inactivity).

### Solana Devnet Programs

All 7 programs compiled with `cargo build-sbf` and deployed via `solana program deploy`:

| Program | Address | Size |
|---------|---------|------|
| krexa-venue-whitelist | `HyWQrHG14Sw6KpKYSMiBDmVj5u7PXfLWvim6FHbBLmua` | 225 KB |
| krexa-score | `2GwtAXnjY5LehfZfT77ZH3XSshwbni8LP9zXeA84WUqh` | 264 KB |
| krexa-agent-registry | `ChJjAXy7sE4d4jst9VViG7ScanVKqH9Q1cFxtdcH78cG` | 318 KB |
| krexa-service-plan | `Eqc48c6TtKAPRosTMoC6Nasi85iqdLuzwbu6WBrsPFdt` | 342 KB |
| krexa-credit-vault | `26SQx3rAyujWCupxvPAMf9N3ok4cw1awyTWAVWDQfr9N` | 436 KB |
| krexa-payment-router | `2Zy3d7C28Z9dfazdysKVBQUXnvvWNshxtDEFKftG83u8` | 481 KB |
| krexa-agent-wallet | `35t8yWLsUZNTLT71ej7DF59P81HrtZTx2uZeMhwuhhf6` | 645 KB |

Deploy authority: `ERahGcUAeFo4saDoJEH2TFWL6Hc43yAZkoVPuQKKQW19`

### GitHub

All code pushed to: https://github.com/Yatharth4599/Krexa

---

## 10. Browser Compatibility Fixes

Several iterations of fixes were needed to get the Agent Dashboard working in browsers:

### The Problem

`@solana/web3.js` and `@solana/wallet-adapter-*` packages use Node.js APIs (`Buffer`, `process`, `global`) that don't exist in browsers. Vite 8 uses Rolldown (not Rollup), which has different polyfill behavior.

### Fix 1: Define globals in Vite config

Added to `vite.config.ts`:
```typescript
define: {
  'process.env': {},
  global: 'globalThis',
}
```
This handles `process.env` and `global` references but not `Buffer`.

### Fix 2: Buffer polyfill with import hoisting workaround

ES module `import` statements are hoisted — they execute before any code in the module body. So this doesn't work:

```typescript
// ❌ Buffer assignment runs AFTER imports are evaluated
import { Buffer } from 'buffer'
window.Buffer = Buffer  // Too late — Solana libs already crashed
import { SomeComponent } from '@solana/...'
```

**Solution:** Split the app into two files with a dynamic import boundary:

```typescript
// main.tsx — polyfills only (static import of 'buffer' is fine)
import { Buffer } from 'buffer'
window.Buffer = Buffer
window.global = window
window.process = window.process || ({ env: {} } as any)

// Dynamic import — evaluated AFTER the code above runs
import('./bootstrap').then(({ bootstrap }) => bootstrap())
```

```typescript
// bootstrap.tsx — all React/Solana code loads here
import App from './App'  // This import is safe — Buffer exists by now
```

### Fix 3: Wallet import for browser build

`@coral-xyz/anchor` doesn't export `Wallet` in its browser ESM build. Fixed by defining the interface inline in `app/src/sdk/client.ts`:

```typescript
// Instead of: import { AnchorProvider, Wallet } from "@coral-xyz/anchor"
import { AnchorProvider } from "@coral-xyz/anchor"

interface Wallet {
  signTransaction<T>(tx: T): Promise<T>
  signAllTransactions<T>(txs: T[]): Promise<T[]>
  publicKey: PublicKey
}
```

### Fix 4: Error visibility

Added error handling so failures are visible instead of showing a black screen:
- `bootstrap.tsx` wraps React render in try/catch, displays errors in red
- `main.tsx` adds `.catch()` on the dynamic import
- `index.html` shows "Loading Krexa Dashboard…" text inside `#root` (visible before JS loads)
- Global `window.addEventListener('error', ...)` catches uncaught errors and renders them
