# Krexa Protocol — Solana Programs

> Seven on-chain programs that together form a **credit infrastructure layer for autonomous AI agents** on Solana.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        KREXA PROTOCOL                           │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Agent        │  │  Krexit      │  │  Venue               │  │
│  │  Registry     │  │  Score       │  │  Whitelist            │  │
│  │  (Identity)   │  │  (Credit     │  │  (Approved trading    │  │
│  │              │  │   scoring)   │  │   venues & merchants) │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                 │                      │              │
│         ▼                 ▼                      ▼              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    AGENT WALLET                          │   │
│  │         (Per-agent PDA wallet — the core hub)            │   │
│  │         8 safety layers on every outbound payment        │   │
│  └────────┬──────────────┬──────────────────┬──────────────┘   │
│           │              │                  │                   │
│           ▼              ▼                  ▼                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐     │
│  │  Credit      │  │  Payment     │  │  Service          │     │
│  │  Vault       │  │  Router      │  │  Plan             │     │
│  │  (LP pool &  │  │  (x402       │  │  (Milestone       │     │
│  │   lending)   │  │   revenue)   │  │   disbursement)   │     │
│  └──────────────┘  └──────────────┘  └──────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

### Agent Types

| Type | Name | Description |
|------|------|-------------|
| A | **Trader** | Trades on DEXes, uses leverage, profit-driven |
| B | **Service** | Sells services via x402, earns revenue, milestone-based |
| C | **Hybrid** | Combination of trading and service activities |

### Credit Levels

| Level | Name | Max Credit | Leverage | Requirements |
|-------|------|-----------|----------|--------------|
| 1 | Starter | $500 | 0% (micro-credit) | Any score + KYA Tier 1 |
| 2 | Established | $20,000 | 1:1 | Score ≥ 500 + KYA Tier 1 |
| 3 | Trusted | $50,000 | 1:2 | Score ≥ 650 + KYA Tier 2 + legal agreement |
| 4 | Elite | $500,000 | 1:5+ or zero collateral | Score ≥ 750 + KYA Tier 2 |

---

## Devnet Deployments

| Program | Address |
|---------|---------|
| krexa-agent-registry | `ChJjAXy7sE4d4jst9VViG7ScanVKqH9Q1cFxtdcH78cG` |
| krexa-credit-vault | `26SQx3rAyujWCupxvPAMf9N3ok4cw1awyTWAVWDQfr9N` |
| krexa-agent-wallet | `35t8yWLsUZNTLT71ej7DF59P81HrtZTx2uZeMhwuhhf6` |
| krexa-venue-whitelist | `HyWQrHG14Sw6KpKYSMiBDmVj5u7PXfLWvim6FHbBLmua` |
| krexa-payment-router | `2Zy3d7C28Z9dfazdysKVBQUXnvvWNshxtDEFKftG83u8` |
| krexa-service-plan | `Eqc48c6TtKAPRosTMoC6Nasi85iqdLuzwbu6WBrsPFdt` |
| krexa-score | `2GwtAXnjY5LehfZfT77ZH3XSshwbni8LP9zXeA84WUqh` |

---

## Program 1: Agent Registry

**Program ID:** `ChJjAXy7sE4d4jst9VViG7ScanVKqH9Q1cFxtdcH78cG`

### Purpose

Central identity layer for all AI agents in the Krexa ecosystem. Every agent must register here before it can open a wallet, request credit, or trade. The registry stores the agent's profile — its name, credit score, KYA (Know Your Agent) verification tier, credit level, and lifetime statistics.

### State Accounts

| Account | Description |
|---------|-------------|
| `RegistryConfig` | Singleton. Stores admin pubkey, oracle pubkey, wallet program reference, and a global pause flag. |
| `AgentProfile` | One per agent. Contains: agent keypair, owner, name (32 bytes), credit score (200–850), KYA tier (0–3), credit level (1–4), lifetime stats (total volume, trades, repayments, amount borrowed), liquidation count, agent type (Trader/Service/Hybrid), wallet PDA link, active/deactivated flag, legal agreement hash. |
| `ProfileOwnershipTransfer` | Temporary PDA for 2-step ownership transfers (propose → accept). |

### Instructions

| Instruction | Who Signs | What It Does |
|-------------|-----------|--------------|
| `initialize` | Admin | One-time setup. Creates `RegistryConfig`. |
| `register_agent` | Agent + Owner | Creates `AgentProfile` with default score 400 and level 0. |
| `update_kya` | Oracle / Admin | Sets KYA tier (Basic, Enhanced, Institutional). Auto-recalculates credit level from score + tier. |
| `update_credit_score` | Oracle | Updates score (clamped 200–850). Recalculates credit level. |
| `update_agent_stats` | Wallet Program (CPI) | Increments lifetime counters: volume, trades, repayments, borrowed. Called by the wallet program after each trade or repayment. |
| `record_liquidation` | Wallet Program (CPI) | Applies an immutable **−40 point** score penalty (floor: 200). Increments liquidation count. Recalculates level. |
| `link_wallet` | Wallet Program (CPI) | One-time link: sets `wallet_pda` and `has_wallet = true` on the agent's profile. |
| `deactivate_agent` / `reactivate_agent` | Admin | Disables or re-enables an agent. |
| `sign_legal_agreement` | Owner | Records an agreement hash. Required for Level 3–4 credit. |
| `attest_score` | Oracle | Creates an on-chain attestation of the agent's score for third-party verification. |
| `set_agent_type` | Admin / Oracle | Sets the agent's classification: Trader (A), Service (B), or Hybrid (C). |
| `propose_profile_transfer` / `accept_profile_transfer` / `cancel_profile_transfer` | Owner / New Owner | Two-step ownership transfer of the agent profile. |

### Key Logic

- **Level calculation:** Combines credit score thresholds with KYA tier requirements:
  - Level 4: score ≥ 750 and KYA ≥ Tier 2
  - Level 3: score ≥ 650 and KYA ≥ Tier 2
  - Level 2: score ≥ 500 and KYA ≥ Tier 1
  - Level 1: any score and KYA ≥ Tier 1
- **Score expiry:** If the score hasn't been updated in 90 days, the agent must be re-verified before requesting credit.
- **Liquidation penalty:** Always exactly −40 points, non-negotiable. Hardcoded.

---

## Program 2: Credit Vault

**Program ID:** `26SQx3rAyujWCupxvPAMf9N3ok4cw1awyTWAVWDQfr9N`

### Purpose

The liquidity pool that funds agent credit lines. LPs deposit USDC into one of three risk tranches and earn yield. When an agent requests credit, USDC flows from the vault to the agent's wallet. When agents repay, the vault distributes interest across tranches, treasury, and an insurance reserve.

### Tranche Structure

| Tranche | Share of Pool | Target APR | Risk |
|---------|--------------|-----------|------|
| Senior | 50% | 10% | Lowest — last to absorb losses |
| Mezzanine | 30% | 12% | Medium |
| Junior | 20% | 20% | Highest — first-loss capital |

### State Accounts

| Account | Description |
|---------|-------------|
| `VaultConfig` | Singleton. Admin, oracle, wallet program, USDC mint, pool accounting (total deposits, total shares, total deployed, interest earned, defaults, insurance balance), utilization cap (80%), lockup period, treasury address, per-tranche deposits and shares. |
| `DepositPosition` | One per LP deposit. Tracks: depositor pubkey, shares held, original deposit amount, deposit timestamp, whether it's collateral, associated agent, tranche tier. |
| `CreditLine` | One per agent credit line. Tracks: agent, credit limit, credit drawn, interest rate (BPS), accrued interest, total interest paid, accrual timestamp, origination date, active flag. |

### Instructions

| Instruction | Who Signs | What It Does |
|-------------|-----------|--------------|
| `initialize_vault` | Admin | Creates `VaultConfig` PDA. |
| `create_vault_token` | Admin | Creates the vault's USDC token account. |
| `create_insurance_token` | Admin | Creates the insurance reserve's USDC token account. |
| `deposit_liquidity` | LP | Deposits USDC into a tranche. LP receives yield-bearing shares (share = amount × total_shares / total_deposits). |
| `deposit_collateral` | Agent Owner | Deposits USDC as agent collateral. Goes to Senior tranche and earns yield simultaneously. |
| `extend_credit` | Wallet Program (CPI) | Creates a `CreditLine` PDA. Calculates credit limit based on collateral value × leverage for the agent's level. Transfers USDC to the agent's wallet token account. |
| `receive_repayment` | Wallet/Router (CPI) | Splits incoming repayment: 10% protocol fee → treasury. Interest portion split between insurance (40%) and treasury (60%) when insurance is below 20% target; 10/90 split when above target. Principal portion reduces outstanding debt. |
| `withdraw_liquidity` | LP | Redeems shares for USDC. Subject to lockup period. |
| `withdraw_collateral` | Agent Owner | Withdraws collateral — only allowed when credit line is inactive (no outstanding debt). |
| `accrue_interest` | Anyone (permissionless) | Computes simple interest on outstanding debt since last accrual. |
| `write_off_bad_debt` | Admin / Oracle | When an agent defaults. Insurance fund absorbs first loss; remaining loss is socialized across LP tranches. |
| `distribute_yields` | Admin | Distributes accumulated yield to tranches pro-rata. |

### Key Logic

- **Share-based accounting:** `shares = amount × total_shares / total_deposits`. Prevents dilution.
- **Credit limits by level:** L1 = $500 flat, L2 = collateral × 1, L3 = collateral × 2, L4 = up to $500k.
- **Utilization cap:** Total deployed capital cannot exceed 80% of total deposits.
- **Insurance target:** 20% of deployed capital. When below target, more interest flows to insurance (40/60 split). When above, less (10/90).
- **Minimum deposit:** 0.001 USDC to prevent share inflation attacks.

---

## Program 3: Agent Wallet (Core)

**Program ID:** `35t8yWLsUZNTLT71ej7DF59P81HrtZTx2uZeMhwuhhf6`

### Purpose

The central hub of the protocol. Every AI agent gets its own PDA-controlled wallet that enforces **8 safety layers** on every outbound payment. This program manages credit draws, collateral, spending limits, health monitoring, deleveraging, and the full liquidation lifecycle.

### State Accounts

| Account | Description |
|---------|-------------|
| `WalletConfig` | Singleton. References all other programs (vault, registry, venue whitelist, payment router), USDC mint, keeper address, total wallet count, pause flag. |
| `AgentWallet` | One per agent. Agent keypair, owner, credit data (limit, drawn, total debt), collateral shares, daily spend tracking (limit, spent, reset timestamp), health factor (BPS), status flags (frozen, liquidating), lifetime stats (trades, volume, repaid), owner type (EOA or Multisig). |
| `VenueExposure` | One per agent per venue. Tracks cumulative USDC sent to that venue. Enforces the 50% concentration limit. |
| `OwnershipTransfer` | Temporary PDA for 2-step wallet ownership transfers. |

### Instructions

| Instruction | Who Signs | What It Does |
|-------------|-----------|--------------|
| `initialize` | Admin | Creates `WalletConfig` singleton. |
| `create_wallet` | Agent + Owner | Creates `AgentWallet` PDA and its USDC token account. CPI to Registry to link wallet. |
| `deposit` | Owner | Deposits USDC as collateral into the vault via CPI. |
| `request_credit` | Agent + Oracle + (Agent or Owner) | Dual-authorization credit request. CPI to vault's `extend_credit`. Calculates credit limit, transfers USDC to wallet. |
| `execute_trade` | Agent | Sends USDC to a whitelisted venue. Must pass all 8 safety checks (see below). |
| `pay_x402` | Agent | Outbound x402 payment. Routes through the Payment Router for revenue validation and fee splitting. |
| `withdraw` | Owner | Withdraws funds. Enforces 120% vault buffer (vault balance must remain ≥ 120% of outstanding debt). |
| `repay` | Agent | Repays debt. CPI to vault's `receive_repayment` for waterfall distribution. |
| `check_health` | Oracle | Queries current NAV. Read-only, no state change. |
| `deleverage` | Keeper | Auto-triggered when health factor is between 1.05x and 1.2x. Keeper sells positions off-chain, then calls this to update on-chain state. |
| `liquidate` | Anyone (permissionless) | Triggered when NAV drops below liquidation threshold. Full sequence below. |
| `freeze` / `unfreeze` | Admin | Emergency wallet access control. |
| `transfer_ownership` / `accept_ownership` | Owner / New Owner | Two-step wallet ownership transfer. |

### The 8 Safety Layers (execute_trade)

Every outbound trade must pass **all 8 checks** or the transaction reverts:

1. **Wallet not frozen** — Admin hasn't suspended the wallet
2. **Per-trade limit** — Single trade cannot exceed 20% of wallet balance
3. **Daily spend limit** — Cumulative daily spend cannot exceed the configured limit (resets every 24h)
4. **Per-venue concentration limit** — No more than 50% of wallet balance to any single venue
5. **Health factor gate** — Post-trade health factor must remain above warning threshold
6. **Venue whitelisted** — Target venue must be active on the venue whitelist
7. **Credit level sufficient** — Agent's credit level must meet venue's minimum requirement
8. **Venue exposure tracking** — Updates cumulative exposure for the venue

### NAV & Liquidation

**NAV (Net Asset Value)** = `(wallet_usdc_balance + collateral_value) / original_credit_limit`

Expressed in BPS (10,000 = 1.0x).

| Credit Level | Liquidation Trigger | Warning Threshold |
|-------------|-------------------|-------------------|
| Level 1 | NAV < 90% | NAV < 95% |
| Level 2 | NAV < 85% | NAV < 90% |
| Level 3–4 | NAV < 80% | NAV < 85% |

**Liquidation sequence:**
1. **FREEZE** the wallet — no more outbound transfers
2. **CALCULATE** — keeper reward (0.5% of remaining assets), repayable portion, shortfall
3. **DISTRIBUTE** — keeper reward → liquidator, repayment → vault, surplus (if any) → owner
4. **UPDATE REGISTRY** — CPI to record_liquidation (score −40, liquidation_count++)
5. **RETURN** any surplus to the owner

---

## Program 4: Venue Whitelist

**Program ID:** `HyWQrHG14Sw6KpKYSMiBDmVj5u7PXfLWvim6FHbBLmua`

### Purpose

A simple admin-controlled allowlist of trading venues and x402 merchants. The Agent Wallet checks this list before allowing any outbound payment. If a venue isn't on this list and active, the trade reverts.

### State Accounts

| Account | Description |
|---------|-------------|
| `WhitelistConfig` | Singleton. Admin, total venue count, pause flag. |
| `WhitelistedVenue` | One per venue. Program ID, name, category, active flag, added_at timestamp. |

### Venue Categories

| Code | Category | Examples |
|------|----------|---------|
| 0 | DEX | Jupiter, Raydium, Orca |
| 1 | Launchpad | Pump.fun, token launches |
| 2 | x402 | API services, data feeds |
| 3 | DeFi | Lending protocols, yield farms |

### Instructions

| Instruction | Who Signs | What It Does |
|-------------|-----------|--------------|
| `initialize` | Admin | Creates `WhitelistConfig`. |
| `add_venue` | Admin | Adds a new venue with name, program ID, and category. |
| `deactivate_venue` / `reactivate_venue` | Admin | Toggles venue active status. |
| `set_paused` | Admin | Pauses the entire whitelist (blocks all trades). |
| `update_config` | Admin | Updates admin address. |

---

## Program 5: Payment Router

**Program ID:** `2Zy3d7C28Z9dfazdysKVBQUXnvvWNshxtDEFKftG83u8`

### Purpose

Handles all x402 (HTTP 402 Payment Required) revenue flows for Type B (Service) agents. When a buyer pays for an agent's service, the payment flows through this router which validates the revenue source, detects wash trading, and atomically splits the payment across platform fees, debt repayment, and the merchant.

### State Accounts

| Account | Description |
|---------|-------------|
| `RouterConfig` | Singleton. Admin, vault program, wallet program, USDC mint, treasury address, pause flag. |
| `MerchantSettlement` | One per merchant. Tracks total revenue, pending repayment cut, daily revenue. |
| `RevenueValidator` | One per merchant. Revenue source classification, payment history ring buffer (50 entries). |
| `GlobalBlocklist` | Known wash-trade sources and associated wallets (up to 10 per agent). |
| `PlatformWhitelist` | Approved payment sources. |

### 3-Layer Revenue Validation

Every incoming x402 payment is validated before being counted as legitimate revenue:

**Layer 1 — Source Classification:**
- Check source pubkey against the platform whitelist and global blocklist
- Auto-reject payments from associated wallets (self-payment detection)

**Layer 2 — Pattern Detection:**
- **Round-trip detection:** Flags payments where 95% of the amount was sent to the same source within 24 hours
- **Amount anomaly:** Flags single payments exceeding 10× the daily average
- **Rapid return:** Flags when disbursements are returned >3× within 7 days

**Layer 3 — Economic Validation:**
- Flags any single payment exceeding 50% of the agent's credit line

### Classification Results

| Result | Effect |
|--------|--------|
| **Verified** | Counts toward revenue. Payment processed normally. |
| **Rejected** | Does not count. Payment blocked or returned. |
| **Quarantined** | Held for oracle review. Auto-approves after 72 hours if agent score > 60. |
| **PendingKeeper** | Tentative — awaiting keeper confirmation. |

### Payment Split

When a verified payment is processed:

```
Total Payment
├── 10% → Platform Fee → Treasury
├── Repayment Cut (configurable, up to 50%) → Vault (via CPI to receive_repayment)
└── Remainder → Merchant's wallet
```

### Auto-Health Transitions

- **7 days** with no revenue → Orange health zone
- **14 days** with no revenue → Red health zone (triggers wind-down eligibility)

---

## Program 6: Service Plan

**Program ID:** `Eqc48c6TtKAPRosTMoC6Nasi85iqdLuzwbu6WBrsPFdt`

### Purpose

Manages milestone-based credit disbursement and expense whitelisting for Type B (Service) agents. Instead of giving a service agent their entire credit line upfront, the vault disburses USDC in milestones as the agent hits targets. The plan also enforces revenue velocity monitoring and a wind-down lifecycle when an agent stops generating revenue.

### State Accounts

| Account | Description |
|---------|-------------|
| `ServicePlanConfig` | Singleton. Admin, oracle, vault program, wallet program, total plans, pause flag. |
| `ServicePlan` | One per agent. Total credit, total disbursed, projected monthly revenue, actual revenue this period, health zone (Green/Yellow/Orange/Red), zero-revenue days counter, wind-down state, milestones array (up to 8), expense destination count. |
| `Milestone` | Embedded in ServicePlan (up to 8). Amount, description hash, eligible_at timestamp, disbursed flag, is_active. |
| `ExpenseDestination` | One per approved expense target (up to 20). Destination token account, label hash, category, max amount per transaction, total sent, active flag. |

### Health Zones

The plan monitors revenue velocity — how much actual revenue the agent earns vs. projections:

| Zone | Revenue vs. Projected | Effect |
|------|----------------------|--------|
| **Green** | ≥ 80% | Normal operations. All milestones eligible. |
| **Yellow** | 50–79% | Milestones delayed by 7 days. |
| **Orange** | 25–49% | All disbursements paused. |
| **Red** | < 25% | Disbursements paused. Wind-down eligible. |

Zero-revenue triggers: 7 days → Orange, 14 days → Red.

### Wind-Down Lifecycle

When an agent enters the Red zone, the oracle or admin can initiate wind-down:

```
None → Grace (48-hour cooldown) → Executing → Completed
```

- **Grace period:** 48 hours. Agent can still repay during this window.
- **Executing:** Permissionless. Anyone can advance to this state after grace elapses. No more disbursements.
- **Completed:** Terminal state.

### Expense Categories

| Code | Category |
|------|----------|
| 0 | Infrastructure (hosting, compute) |
| 1 | API (third-party API calls) |
| 2 | Marketing |
| 3 | Payroll |
| 4 | Other |

### Instructions

| Instruction | Who Signs | What It Does |
|-------------|-----------|--------------|
| `initialize` | Admin | Creates `ServicePlanConfig`. |
| `create_plan` | Owner | Creates plan with total credit and milestone array. Validates milestone sum ≤ total credit. |
| `disburse_milestone` | Oracle | Releases milestone USDC from vault to agent wallet. Blocked in Orange/Red zones. Delayed 7 days in Yellow. |
| `add_expense_destination` | Owner | Adds an approved expense target (up to 20). |
| `remove_expense_destination` | Owner | Deactivates an expense destination. |
| `execute_expense` | Agent / Owner | Transfers USDC to an approved destination. Enforces per-transaction max amount. |
| `record_revenue` | Oracle | Records revenue and recalculates health zone. |
| `update_zero_revenue_days` | Oracle | Increments zero-revenue counter and recalculates health. |
| `set_projected_revenue` | Oracle | Sets the monthly revenue target and resets the period. |
| `start_wind_down` | Oracle / Admin | Must be in Red zone. Begins 48-hour grace period. |
| `advance_wind_down` | Anyone (permissionless) | Moves from Grace → Executing → Completed after grace elapses. |

---

## Program 7: Krexit Score

**Program ID:** `2GwtAXnjY5LehfZfT77ZH3XSshwbni8LP9zXeA84WUqh`

### Purpose

A comprehensive on-chain credit scoring system. Computes a composite score (200–850) from 5 weighted components, tracks behavioral and financial metrics, and maintains a 30-entry event history ring buffer. Different scoring rules apply to Trader vs. Service agents.

### Score Components

| Component | Weight | What It Measures |
|-----------|--------|-----------------|
| **Repayment** (c1) | 30% | On-time vs. late vs. missed repayments |
| **Profitability** (c2) | 25% | PnL ratio, max drawdown, Sharpe ratio |
| **Behavioral** (c3) | 20% | Time spent in each health zone (Green/Yellow/Orange/Red) |
| **Usage** (c4) | 15% | Venue entropy, unique venues, transaction count, daily volume |
| **Maturity** (c5) | 10% | Account age, credit cycles completed |

### State Accounts

| Account | Description |
|---------|-------------|
| `ScoreConfig` | Singleton. Admin, oracle, references to registry/wallet/vault programs, pause flag. |
| `KrexitScore` | One per agent. Composite score (200–850), credit level, KYA tier, all 5 component scores (0–10000 BPS each), event counters (on-time/late/missed repayments, liquidations, defaults, credit cycles), financial metrics (cumulative borrowed/repaid, current debt, PnL ratio, max drawdown, Sharpe ratio — all in BPS), behavioral metrics (time in each health zone as BPS), usage metrics (venue entropy, unique venues, total transactions, average daily volume), history ring buffer (30 entries), agent type, revenue health (Type B), milestone completion rate (Type B), active/blacklisted flags. |

### Instructions

| Instruction | Who Signs | What It Does |
|-------------|-----------|--------------|
| `initialize` | Admin | Creates `ScoreConfig`. |
| `initialize_score` | Oracle / Admin | Creates `KrexitScore` for a new agent. Starts at 350 with c1=7000, c2=c3=5000, c4=c5=0. |
| `update_score` | Oracle | Updates composite score and all components. Enforces constraints (see below). Records history entry. Handles special events. |
| `record_credit_event` | Wallet / Vault (CPI) | Records: Borrowed (updates debt + cumulative), Repaid (reduces debt), DebtUpdated (sets debt). |
| `update_kya_tier` | Admin / Oracle | Upgrades KYA tier (can only go up, never down). |
| `set_paused` | Admin | Pauses the program. |
| `update_config` | Admin | Updates admin/oracle addresses. |

### Score Update Constraints

- **Range:** Score clamped to 200–850
- **Components:** Each clamped to 0–10000 BPS
- **Normal delta limit:** ±100 BPS per update
- **Critical event delta limit:** ±200 BPS (for liquidation, default, missed repayment, wind-down)
- **Cooldown:** 60 seconds between updates (bypassed for critical events)
- **Liquidation penalty:** New score must be ≤ old score − 40 points (enforced)
- **Default:** Permanent blacklist. Repayment component set to 0.

### Event History

A 30-entry ring buffer where each entry records:
- Previous score → New score
- Event type
- Delta in BPS
- Timestamp

This provides an on-chain audit trail of score changes.

---

## Cross-Program Data Flow

### Agent Lifecycle

```
1. REGISTER      Registry.register_agent()          → AgentProfile (score=400)
                                                      │
2. KYA VERIFY    Registry.update_kya()               → KYA tier set, level calculated
                                                      │
3. CREATE WALLET Wallet.create_wallet()              → AgentWallet PDA + USDC account
                  └─ CPI → Registry.link_wallet()     → Profile linked to wallet
                                                      │
4. DEPOSIT       Wallet.deposit()                    → Collateral in vault
                  └─ CPI → Vault.deposit_collateral()  (earns Senior tranche yield)
                                                      │
5. REQUEST CREDIT Wallet.request_credit()            → Credit line opened
                   └─ CPI → Vault.extend_credit()     → USDC transferred to wallet
                                                      │
6. TRADE         Wallet.execute_trade()              → 8 safety checks → USDC to venue
                                                      │
7. EARN REVENUE  Router.receive_payment()            → 3-layer validation
                  └─ CPI → Vault.receive_repayment()   → Split: fee + insurance + principal
                                                      │
8. REPAY         Wallet.repay()                      → Debt reduced
                  └─ CPI → Vault.receive_repayment()   → Waterfall distribution
                                                      │
9. LIQUIDATE     Wallet.liquidate()                  → Assets distributed
   (if needed)    ├─ CPI → Vault.receive_repayment()   → Debt settled
                  ├─ CPI → Registry.record_liquidation() → Score −40
                  └─ CPI → Score.update_score()         → History recorded
```

### CPI Call Graph

```
Agent Wallet ──→ Credit Vault     (extend_credit, receive_repayment)
Agent Wallet ──→ Agent Registry   (link_wallet, update_agent_stats, record_liquidation)
Agent Wallet ──→ Krexit Score     (update_score on liquidation)
Agent Wallet ──→ Payment Router   (pay_x402)
Payment Router ─→ Credit Vault    (receive_repayment)
Service Plan ──→ Credit Vault     (transfer USDC for milestone disbursement)
```

---

## Key Safety Mechanisms

| # | Mechanism | Where |
|---|-----------|-------|
| 1 | **8-layer trade safety checks** | Agent Wallet — every outbound payment |
| 2 | **NAV-based liquidation** | Agent Wallet — permissionless, transparent thresholds |
| 3 | **Immutable −40 point liquidation penalty** | Registry + Score — hardcoded, not configurable |
| 4 | **Insurance fund (first-loss capital)** | Credit Vault — 20% target of deployed capital |
| 5 | **Dual authorization on credit** | Agent Wallet — requires agent + oracle + (agent or owner) |
| 6 | **3-layer revenue validation** | Payment Router — source, pattern, economic checks |
| 7 | **Milestone-gated disbursement** | Service Plan — no lump-sum credit for service agents |
| 8 | **Wind-down lifecycle** | Service Plan — 48h grace → execution → completion |
| 9 | **Per-venue concentration limits** | Agent Wallet — max 50% to any single venue |
| 10 | **Health-zone restrictions** | Service Plan — Yellow delays, Orange/Red freezes |

---

## Protocol Constants

| Constant | Value |
|----------|-------|
| Score range | 200 – 850 |
| Default starting score | 400 |
| Score expiry | 90 days |
| Liquidation score penalty | −40 points |
| Protocol fee on revenue | 10% |
| Liquidation keeper reward | 0.5% |
| Platform fee on x402 payments | 10% |
| Vault utilization cap | 80% |
| Insurance target | 20% of deployed capital |
| Per-trade limit | 20% of wallet balance |
| Per-venue limit | 50% of wallet balance |
| Withdrawal vault buffer | 120% of outstanding debt |
| Wind-down grace period | 48 hours |
| Score update cooldown | 60 seconds |
| Max milestones per plan | 8 |
| Max expense destinations | 20 |
| Revenue history buffer | 50 entries |
| Score history buffer | 30 entries |
