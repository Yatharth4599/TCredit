valtoosh
valtoosh
Idle

This is the start of the #product-dev channel. 
0XiaoBao — 06/03/26, 8:20 PM
Pending part is Repayment, let's work on it from tomorrow

@valtoosh does the revenue router logic works ? so just the repayment flow is pending right ?
valtoosh — 06/03/26, 8:20 PM
Router works
0XiaoBao — 06/03/26, 8:21 PM
Perfect!
0XiaoBao — 07/03/26, 12:13 AM
Include salaries as well to use case (YK)
For C2C loans
0XiaoBao — 07/03/26, 10:51 AM
Finish the Risk Analysis AI Part too
@valtoosh I am currently working on the code once I push i will ping you
0XiaoBao — 07/03/26, 1:03 PM
Phase1  :MCP Server
Phase2 : x402 Facilitator
Phase3 : Agent Wallet
Phase4 : Gateway + ACP
Phase5 : Agent Credit Lines
Phase6: Agent Identity
Contracts for all phases deployed in a new branch named Protocol @valtoosh 
Image
valtoosh — 07/03/26, 1:31 PM
These are for agents right?
0XiaoBao — 07/03/26, 1:36 PM
Yes
0XiaoBao — 11/03/26, 7:00 PM
@valtoosh @Himanshu Mourya guys think of use cases how we can integrate to polymarket and make it a huge use case and think on solana as its easy to go mainnet there, also lets do it asap
@valtoosh @Himanshu Mourya also think of cool places where we can give credit to agents and make money,  right now i see in trading, polymarket, token launches
valtoosh — 11/03/26, 7:06 PM
Are we allowing bots to take a credit line to gamble? Wont our defaults increase substantially
We can create a different page for polymarket use case with a disclaimer where bots are pooling on one bit with lets say a high winrate on polymarket which then splits the winnings but again there will be compliance
0XiaoBao — Yesterday at 10:49 PM
I will start pushing Solana Stuff from here
The Krexa Agent Credit Ladder
The key insight is that agents don't start with credit. They EARN it. Like a human going from no credit history → secured credit card → unsecured card → premium card → personal loans.
Attachment file type: acrobat
The Krexa Agent Credit Ladder.pdf
453.02 KB
# KREXA PROTOCOL — SOLANA AGENT CREDIT
# Technical Architecture Document v1.0
# March 2026

---

Krexa_Solana_Architecture.md
30 KB
valtoosh — Yesterday at 10:58 PM
Level 0 they put collateral in our liquidity pools need to be specified so we can market the hedging functionality that you are basically also earning on your stake while giving interest
Can put this in level 1 and eliminate level zero just a kya ad level 0
Explain the max wallet metric
0XiaoBao — Yesterday at 11:00 PM
Here I have a question so if i need $5000 to trade then why will i put $7500 as collateral and take $5000 to trade and take return of stake on 7500? 
valtoosh — Yesterday at 11:01 PM
Put 5000 as collateral not 7500
This is to build your initial credit score future onwards you don’t need to have a deposit
Like when I go to get a credit card without any cibil history I have to take it against a FD but when I have a credit score I don’t do an fd 
0XiaoBao — Yesterday at 11:03 PM
Makes sense!
valtoosh — Yesterday at 11:04 PM
For max cap lets just keep 100k for now that comes with a certain deposit % in our liquidity pools to minimize risk
Also @0XiaoBao how will we make sure the AI agent uses our apis for the repayment waterfall
0XiaoBao — Yesterday at 11:06 PM
By using the multisig wallets
valtoosh — Yesterday at 11:06 PM
We will also have to imply that the owner of the agent esign a legal document in some way just to be safe
0XiaoBao — Yesterday at 11:06 PM
For large amounts yes
0XiaoBao — Yesterday at 11:07 PM
We will also do KYC, KYB of agent owners as they keep getting ahead in steps
valtoosh — Yesterday at 11:07 PM
Will have to finalize the math too once we start deploying can’t change that without redeploying
0XiaoBao — Yesterday at 11:07 PM
Yeah right!
That's correct need to make calculations to be risk averse and profitable
valtoosh — Yesterday at 11:11 PM
Each pool yield needs to be decided
What amount a loan will be distributed in what no of tranches
@0XiaoBao fo we include fairscale in KYA?
0XiaoBao — Yesterday at 11:15 PM
@valtoosh I will talk to them tomorrow as they talk a lot and do not take action if no update then just build our own
valtoosh — Yesterday at 11:42 PM
We have to focus on the credit score too so that in future if someone cpycats our product they will have to get the data from us like cibil operates
Lets say any other platform gives out credit they will have to come to us for the agents credit history thats a bigger game
valtoosh — 5:35 PM
https://github.com/valeo-cash
GitHub
valeo-cash - Overview
Building the future of autonomous internet money. x402 and ai agentic payments. - valeo-cash
Image
0XiaoBao — 5:51 PM
Did you check there GitHub bro are they making something or just scamming as far as I know there team they are not builders just defi ghosters
valtoosh — 5:52 PM
Let me review I thought they legit
Pulling from main
﻿
# KREXA PROTOCOL — SOLANA AGENT CREDIT
# Technical Architecture Document v1.0
# March 2026

---

## 1. EXECUTIVE SUMMARY

Krexa extends its revenue-enforced credit protocol to Solana, enabling AI agents to access credit for trading, token launching, service payments, and business operations — with 8 layers of programmatic safety ensuring LP capital protection.

The core innovation: **agents never hold funds directly.** All capital lives in Program Derived Address (PDA) wallets controlled by Krexa's on-chain programs. Agents have *permission* to trade, not *ownership* of funds. Combined with real-time health monitoring, auto-liquidation, whitelisted venues, and a credit graduation system, this creates the first structurally safe agent credit protocol.

**Chains:** Base (EVM) + Solana (SVM) — unified via one SDK
**Status:** Base Sepolia live (6 contracts, 160 tests). Solana in development.

---

## 2. SYSTEM ARCHITECTURE

### 2.1 High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        INTEGRATORS                               │
│                                                                 │
│  @krexa/sdk          @krexa/x402-middleware      @krexa/mcp     │
│  (developers)        (API merchants)             (AI agents)    │
│                                                                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     KREXA UNIFIED API                            │
│                   api.krexa.xyz/v1/...                           │
│                                                                 │
│  Chain-agnostic REST API. Routes to correct chain internally.   │
│  Handles: auth, rate limiting, chain detection, tx building     │
│                                                                 │
│  ┌──────────────────┐    ┌───────────────────┐                 │
│  │  Base Adapter     │    │  Solana Adapter    │                 │
│  │  (viem + EVM)     │    │  (@solana/web3.js) │                 │
│  └────────┬─────────┘    └────────┬──────────┘                 │
└───────────┼──────────────────────┼──────────────────────────────┘
            │                      │
            ▼                      ▼
┌────────────────────┐  ┌──────────────────────────────────────┐
│   BASE CONTRACTS   │  │        SOLANA PROGRAMS                │
│   (Existing)       │  │        (New)                          │
│                    │  │                                      │
│  AgentRegistry     │  │  krexa_agent_registry                │
│  PaymentRouter     │  │  krexa_credit_vault                  │
│  VaultFactory      │  │  krexa_agent_wallet  ← THE CORE     │
│  MerchantVault     │  │  krexa_venue_whitelist               │
│  LiquidityPool     │  │  krexa_payment_router                │
│  MilestoneRegistry │  │                                      │
│                    │  │  + Keeper Bot (off-chain)             │
│  Full merchant     │  │  + Oracle Service (off-chain)        │
│  credit suite      │  │  + KYA Service (off-chain)           │
│                    │  │                                      │
│  6 contracts       │  │  5 programs                          │
│  160 tests         │  │  Agent credit ladder                 │
└────────────────────┘  └──────────────────────────────────────┘
```

### 2.2 Solana Program Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SOLANA PROGRAM MAP                            │
│                                                                 │
│  ┌─────────────────────┐                                       │
│  │  AGENT REGISTRY      │  Identity, KYA status, credit score  │
│  │  (Program 1)         │  credit level (0-4), history         │
│  └──────────┬──────────┘                                       │
│             │ reads score                                       │
│             ▼                                                   │
│  ┌─────────────────────┐    ┌──────────────────────┐          │
│  │  CREDIT VAULT        │    │  VENUE WHITELIST      │          │
│  │  (Program 2)         │    │  (Program 4)          │          │
│  │                      │    │                      │          │
│  │  LP deposits         │    │  Approved protocols: │          │
│  │  Credit extension    │    │  Jupiter, Raydium,   │          │
│  │  Repayment receipt   │    │  Pump.fun, Orca,     │          │
│  │  Insurance fund      │    │  x402 facilitators   │          │
│  └──────────┬──────────┘    └──────────┬───────────┘          │
│             │ funds credit              │ checks venue          │
│             ▼                           │                       │
│  ┌──────────────────────────────────────┴──────────┐          │
│  │  AGENT WALLET (Program 3) ← THE CORE            │          │
│  │                                                  │          │
│  │  PDA wallet per agent (Krexa owns authority)     │          │
│  │                                                  │          │
│  │  Functions:                                      │          │
│  │  ├── create_wallet()                             │          │
│  │  ├── deposit_collateral()                        │          │
│  │  ├── execute_trade()  ← checks whitelist         │          │
│  │  ├── pay_x402()                                  │          │
│  │  ├── withdraw()  ← gated by debt                │          │
│  │  ├── repay_loan()                                │          │
│  │  ├── check_health()                              │          │
│  │  ├── liquidate()  ← keeper calls this            │          │
│  │  ├── auto_deleverage()                           │          │
│  │  └── freeze_wallet()  ← admin emergency          │          │
│  │                                                  │          │
│  │  Enforcement:                                    │          │
│  │  ├── Only whitelisted venues can receive funds   │          │
│  │  ├── Withdrawal blocked until debt < value*0.83  │          │
│  │  ├── Per-trade limit: 20% of wallet value        │          │
│  │  ├── Per-venue limit: 50% of wallet value        │          │
│  │  └── Health factor checked after every action     │          │
│  └──────────────────────────────────────────────────┘          │
│             │                                                   │
│             ▼                                                   │
│  ┌─────────────────────┐                                       │
│  │  PAYMENT ROUTER      │  Handles x402 payment flows          │
│  │  (Program 5)         │  Revenue routing for earning agents  │
│  │                      │  Waterfall split for merchant credit │
│  └─────────────────────┘                                       │
│                                                                 │
│  OFF-CHAIN SERVICES:                                           │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐            │
│  │ Keeper  │ │ Oracle  │ │ KYA     │ │ Price   │            │
│  │ Bot     │ │ Service │ │ Service │ │ Feed    │            │
│  │         │ │         │ │         │ │         │            │
│  │ Health  │ │ Signs   │ │ Agent   │ │ Jupiter │            │
│  │ monitor │ │ credit  │ │ code    │ │ price   │            │
│  │ + liq.  │ │ decisions│ │ audit   │ │ API     │            │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 Agent Wallet PDA Structure

```
AGENT WALLET PDA (per agent):

Seeds: ["agent_wallet", agent_pubkey]
Authority: krexa_agent_wallet program

Token Accounts (Associated Token Accounts owned by PDA):
├── USDC account    — main capital
├── SOL account     — for gas (minimal)
├── wSOL account    — for trading
└── [dynamic]       — any token received from trading

State Account:
├── agent: Pubkey                    — agent's signing key
├── owner: Pubkey                    — human owner's wallet
├── credit_vault: Pubkey             — which vault funded this
├── collateral_deposited: u64        — agent's own capital (USDC)
├── credit_extended: u64             — Krexa's credit (USDC)
├── credit_used: u64                 — how much credit drawn
├── total_debt: u64                  — principal + accrued interest
├── interest_rate_bps: u16           — annual rate in basis points
├── last_interest_accrual: i64       — timestamp
├── credit_level: u8                 — 0, 1, 2, 3, or 4
├── health_factor_bps: u16           — current health (10000 = 1.0)
├── is_frozen: bool                  — emergency freeze
├── created_at: i64                  — registration timestamp
├── total_trades: u64                — lifetime trade count
├── total_volume: u64                — lifetime volume in USDC
├── total_repaid: u64                — lifetime repayments
├── liquidation_count: u8            — times liquidated
├── daily_spend_limit: u64           — max per day
├── per_trade_limit_bps: u16         — max per trade (% of wallet)
└── bump: u8                         — PDA bump seed
```

### 2.4 Credit Vault Structure

```
CREDIT VAULT PDA:

Seeds: ["credit_vault", admin_pubkey]
Authority: krexa_credit_vault program

State:
├── admin: Pubkey                    — multi-sig admin
├── total_deposits: u64              — total LP capital
├── total_deployed: u64              — capital out in agent wallets
├── total_repaid: u64                — lifetime repayments received
├── total_defaults: u64              — lifetime bad debt
├── insurance_fund: u64              — 5% reserve
├── utilization_cap_bps: u16         — max deployment (8500 = 85%)
├── min_collateral_bps: u16          — per credit level
├── is_paused: bool
└── bump: u8

LP Position PDA (per LP):
Seeds: ["lp_position", vault_pubkey, lp_pubkey]
├── deposited: u64
├── shares: u64
├── deposit_timestamp: i64
└── bump: u8
```

---

## 3. THE AGENT CREDIT LADDER

### 3.1 Level Progression

```
LEVEL 0 → 1 → 2 → 3 → 4
Unknown  Verified  Established  Trusted  Elite

Requirements:
  L0→L1: Basic KYA pass + registration
  L1→L2: 3+ months + repayment history + Enhanced KYA
  L2→L3: 6+ months + profitability proof + strong score
  L3→L4: 12+ months + Institutional KYA + revenue stream

Collateral:
  L0: 100% (own money only)
  L1: None (micro-credit $50-$500)
  L2: 50% ($1 collateral per $1 credit)
  L3: 25% ($1 collateral per $3 credit)
  L4: 0-10% (under-collateralized)

Max Credit:
  L0: $0
  L1: $500
  L2: $10,000
  L3: $100,000
  L4: $500,000
```

### 3.2 Credit Score Model (200-850)

```
Component              Weight    Measured By
──────────────────────────────────────────────────
Repayment History      30%      On-time repayments, missed payments
Profitability          25%      Wallet value trend over time
Behavioral Health      20%      Health factor history, liquidation count
Usage Pattern          15%      Transaction diversity, frequency, venues
Account Age + Volume   10%      Registration date + total volume

Tier Mapping:
  750-850 → Elite (Level 4 eligible)
  650-749 → Trusted (Level 3 eligible)
  500-649 → Established (Level 2 eligible)
  400-499 → Verified (Level 1 eligible)
  200-399 → Restricted (Level 0 only)
```

### 3.3 KYA (Know Your Agent) Verification

```
TIER 1 — BASIC (Automated, instant):
  ☐ Human owner wallet signature
  ☐ Agent metadata (framework, model, purpose)
  ☐ Automated code scan (red flags, secrets, suspicious deps)
  ☐ Runtime environment check
  → Unlocks: Level 0-1

TIER 2 — ENHANCED (Automated + human KYC):
  ☐ Everything in Tier 1
  ☐ Human owner KYC/KYB (Sumsub/Persona)
  ☐ 3-month behavioral analysis
  ☐ Code deep audit (prompt injection, error handling)
  → Unlocks: Level 2-3

TIER 3 — INSTITUTIONAL (Full due diligence):
  ☐ Everything in Tier 1-2
  ☐ Full business entity verification
  ☐ 12-month on-chain history audit
  ☐ Third-party code audit
  ☐ Revenue verification
  ☐ Stress testing
  → Unlocks: Level 4
```

---

## 4. EIGHT-LAYER SAFETY MODEL

```
LAYER 1: PDA WALLET CONTROL
  Funds live in a PDA. Agent has permission, not ownership.
  Krexa program is the authority. Agent cannot transfer freely.

LAYER 2: COLLATERAL REQUIREMENT
  Agent deposits own money first. Credit is on top.
  Agent's money absorbs losses before LP capital.

LAYER 3: WHITELISTED VENUES
  Only approved programs can receive funds.
  ✅ Jupiter, Raydium, Orca, Pump.fun, x402 facilitators
  ❌ Personal wallets, unknown programs, mixers
  Enforced at program level — cannot be bypassed.

LAYER 4: POSITION LIMITS
  Per-trade max: 20% of wallet value
  Per-venue max: 50% of wallet value
  Health factor checked after every trade.

LAYER 5: REAL-TIME HEALTH MONITORING
  Keeper bot checks every ~400ms (Solana slot time).
  HF > 1.5: healthy | 1.2-1.5: warning | 1.05-1.2: danger | < 1.05: liquidate

LAYER 6: AUTO-LIQUIDATION
  When HF < 1.05: freeze → sell all non-USDC → repay LP → return excess.
  Fully automated. Keeper bot has permission to call liquidate().
  Liquidation incentive: keeper gets 0.5% of recovered amount.

LAYER 7: MULTI-SIG ADMIN (Squads Protocol)
  2-of-3: venue whitelist changes, parameter adjustments, emergency pause
  3-of-5: program upgrades, vault capital movement, multi-sig membership
  Signers: 2 Krexa team + 1 security advisor + 1 LP rep + 1 tech advisor

LAYER 8: INSURANCE FUND
  5% of all interest collected → reserve PDA
  Covers liquidation shortfalls. Multi-sig access only.
```

---

## 5. ENFORCEMENT METHODS (By Use Case)

```
USE CASE                  ENFORCEMENT                   LEVEL
─────────────────────────────────────────────────────────────
x402 micropayments        Dashboard repay + score drop   1
Operational spending      Wallet auto-deduct / dashboard 1-2
Voyager BNPL             User installment debit          2-3
DEX trading              PDA + withdrawal gate + liq.    2-3
Token launching          PDA + position limits + liq.    2-3
DeFi strategies          PDA + position as collateral    3
Agent working capital    Revenue Router intercept        3-4
Under-collateral loans   Revenue Router + wallet freeze  4
Flash credit             Atomic — tx reverts if unpaid   1+
```

---

## 6. REPOSITORY STRUCTURE

```
TCredit/                              ← EXISTING REPO
├── base-contracts/                   ← EXISTING (unchanged)
│   ├── src/
│   ├── test/
│   ├── script/
│   └── deployments/
│
├── solana-programs/                  ← NEW
│   ├── programs/
│   │   ├── krexa-agent-registry/
│   │   │   └── src/lib.rs
│   │   ├── krexa-credit-vault/
│   │   │   └── src/lib.rs
│   │   ├── krexa-agent-wallet/
│   │   │   └── src/lib.rs
│   │   ├── krexa-payment-router/
│   │   │   └── src/lib.rs
│   │   └── krexa-venue-whitelist/
│   │       └── src/lib.rs
│   ├── tests/
│   ├── migrations/
│   ├── Anchor.toml
│   └── Cargo.toml
│
├── backend/                          ← EXISTING (extended)
│   ├── src/
│   │   ├── api/routes/               ← existing + new solana routes
│   │   ├── chain/
│   │   │   ├── base/                 ← existing Base chain adapter
│   │   │   └── solana/               ← NEW Solana chain adapter
│   │   ├── services/
│   │   │   ├── vault.service.ts      ← existing
│   │   │   ├── oracle.service.ts     ← existing
│   │   │   ├── solana-keeper.ts      ← NEW health monitor
│   │   │   ├── solana-oracle.ts      ← NEW Ed25519 oracle
│   │   │   ├── kya.service.ts        ← NEW KYA verification
│   │   │   ├── credit-score.ts       ← NEW score calculator
│   │   │   └── price-feed.ts         ← NEW Jupiter price API
│   │   ├── indexer/
│   │   │   ├── base-indexer.ts       ← existing (renamed)
│   │   │   └── solana-indexer.ts     ← NEW
│   │   └── config/
│   └── prisma/
│       └── schema.prisma             ← extended with Solana models
│
├── sdk/                              ← NEW (unified SDK)
│   ├── src/
│   │   ├── index.ts
│   │   ├── krexa-sdk.ts
│   │   ├── chains/
│   │   │   ├── base-adapter.ts
│   │   │   └── solana-adapter.ts
│   │   ├── agent-wallet.ts
│   │   ├── credit.ts
│   │   └── x402.ts
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                         ← EXISTING (extended)
│   └── src/
│       ├── pages/                    ← add Solana agent pages
│       └── ...
│
└── docs/                             ← Architecture docs
    ├── architecture.md               ← THIS DOCUMENT
    ├── solana-programs.md
    ├── credit-ladder.md
    └── safety-model.md
```

---

## 7. DATA MODELS (Prisma Extensions)

```prisma
// Add to existing schema.prisma

model AgentWallet {
  id                  String   @id @default(uuid())
  chain               String   // "solana" | "base"
  walletAddress       String   @unique  // PDA address
  agentPubkey         String   // agent's signing key
  ownerPubkey         String   // human owner's wallet
  creditLevel         Int      @default(0)  // 0-4
  creditScore         Int      @default(400)  // 200-850
  kyaTier             Int      @default(0)  // 0=none, 1=basic, 2=enhanced, 3=institutional
  collateralDeposited Decimal  @default(0)
  creditExtended      Decimal  @default(0)
  totalDebt           Decimal  @default(0)
  healthFactor        Decimal  @default(0)
  isFrozen            Boolean  @default(false)
  totalTrades         Int      @default(0)
  totalVolume         Decimal  @default(0)
  totalRepaid         Decimal  @default(0)
  liquidationCount    Int      @default(0)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  trades              AgentTrade[]
  healthHistory       HealthSnapshot[]
  scoreHistory        ScoreSnapshot[]
}

model AgentTrade {
  id              String   @id @default(uuid())
  walletId        String
  wallet          AgentWallet @relation(fields: [walletId], references: [id])
  chain           String
  venue           String   // "jupiter" | "raydium" | "pump_fun" | "x402"
  action          String   // "swap" | "launch_token" | "pay_x402" | "deposit_lp"
  fromToken       String
  toToken         String
  fromAmount      Decimal
  toAmount        Decimal
  txSignature     String   @unique
  healthBefore    Decimal
  healthAfter     Decimal
  createdAt       DateTime @default(now())
}

model HealthSnapshot {
  id              String   @id @default(uuid())
  walletId        String
  wallet          AgentWallet @relation(fields: [walletId], references: [id])
  healthFactor    Decimal
  walletValue     Decimal
  totalDebt       Decimal
  action          String?  // "warning" | "deleverage" | "liquidation" | null
  createdAt       DateTime @default(now())
}

model ScoreSnapshot {
  id              String   @id @default(uuid())
  walletId        String
  wallet          AgentWallet @relation(fields: [walletId], references: [id])
  score           Int
  repaymentScore  Int
  profitScore     Int
  behaviorScore   Int
  usageScore      Int
  ageScore        Int
  createdAt       DateTime @default(now())
}

model KyaVerification {
  id              String   @id @default(uuid())
  walletId        String
  tier            Int      // 1, 2, 3
  status          String   // "pending" | "passed" | "failed"
  codeAuditScore  Int?
  humanKycId      String?  // Sumsub/Persona reference
  details         Json?
  createdAt       DateTime @default(now())
}

model VenueWhitelist {
  id              String   @id @default(uuid())
  chain           String
  programId       String   @unique
  name            String
  category        String   // "dex" | "launchpad" | "x402" | "defi"
  isActive        Boolean  @default(true)
  addedBy         String   // multi-sig tx signature
  createdAt       DateTime @default(now())
}

model InsuranceFund {
  id              String   @id @default(uuid())
  chain           String
  balance         Decimal  @default(0)
  totalCollected  Decimal  @default(0)
  totalPaidOut    Decimal  @default(0)
  updatedAt       DateTime @updatedAt
}
```

---

## 8. API EXTENSIONS

```
// New Solana-specific endpoints added to existing API

// ═══ AGENT WALLET ═══
POST   /api/v1/agent-wallet/create         — Create PDA wallet for agent
POST   /api/v1/agent-wallet/deposit        — Deposit collateral
POST   /api/v1/agent-wallet/trade          — Execute trade through wallet
POST   /api/v1/agent-wallet/pay-x402       — Pay for x402 service
POST   /api/v1/agent-wallet/withdraw       — Withdraw (debt-gated)
POST   /api/v1/agent-wallet/repay          — Repay credit
GET    /api/v1/agent-wallet/:address       — Get wallet status + health
GET    /api/v1/agent-wallet/:address/trades — Trade history
GET    /api/v1/agent-wallet/:address/health — Health factor history

// ═══ CREDIT ═══
GET    /api/v1/credit/eligibility/:agent   — Check credit eligibility + max
POST   /api/v1/credit/extend              — Extend credit to agent wallet
GET    /api/v1/credit/score/:agent        — Get credit score + breakdown
GET    /api/v1/credit/level/:agent        — Get current level + next requirements

// ═══ KYA ═══
POST   /api/v1/kya/basic                  — Submit for Basic KYA
POST   /api/v1/kya/enhanced               — Submit for Enhanced KYA
GET    /api/v1/kya/status/:agent          — Check KYA verification status

// ═══ VAULT (Solana) ═══
GET    /api/v1/solana/vault/stats         — Vault TVL, utilization, deposits
POST   /api/v1/solana/vault/deposit       — LP deposits USDC
POST   /api/v1/solana/vault/withdraw      — LP withdraws

// ═══ VENUES ═══
GET    /api/v1/venues                     — List whitelisted venues
GET    /api/v1/venues/:programId          — Check if venue is whitelisted

// ═══ KEEPER ═══
GET    /api/v1/keeper/status              — Keeper health, last check, alerts
GET    /api/v1/keeper/liquidations        — Recent liquidation events
```

---

## 9. SDK INTERFACE

```typescript
import { KrexaSDK } from '@krexa/sdk';

const krexa = new KrexaSDK({ apiKey: 'your-api-key' });

// ═══ AGENT WALLET ═══
await krexa.agent.createWallet({ chain: 'solana' });
await krexa.agent.depositCollateral({ amount: 5000 });
await krexa.agent.getWalletStatus();
// → { balance, debt, healthFactor, creditLevel, score, ... }

// ═══ TRADING ═══
await krexa.agent.trade({
  venue: 'jupiter',
  from: 'USDC', to: 'SOL',
  amount: 1000
});

await krexa.agent.launchToken({
  venue: 'pump_fun',
  name: 'AgentCoin', symbol: 'AGNT',
  initialLiquidity: 2000
});

// ═══ CREDIT ═══
await krexa.credit.checkEligibility();
// → { level: 2, maxCredit: 10000, collateralRequired: 5000, rate: 1200 }

await krexa.credit.extend({ amount: 5000 });
await krexa.credit.repay({ amount: 2000 });
await krexa.credit.getScore();
// → { score: 620, tier: 'Established', breakdown: { ... } }

// ═══ x402 PAYMENTS ═══
await krexa.x402.pay({
  recipient: 'merchant_address',
  amount: 0.50,
  chain: 'solana'
});

// ═══ KYA ═══
await krexa.kya.submitBasic({ agentMetadata: { ... } });
await krexa.kya.getStatus();
// → { tier: 2, status: 'passed', score: 85 }

// ═══ VOYAGER-STYLE BNPL ═══
await krexa.bnpl.createOrder({
  merchant: 'airline_api',
  amount: 800,
  installments: 4,
  interval: 'weekly'
});
```

---

## 10. DEPLOYMENT PLAN

```
WEEK 1-2:  Solana programs (Anchor/Rust) — 5 programs + tests
WEEK 3:    Backend extensions — chain adapter, keeper, oracle, indexer
WEEK 4:    SDK + MCP server + x402 middleware
WEEK 5:    Devnet testing + Mainnet deployment (conservative)
           Max loan: $10K | Max vault: $50K | Whitelist-only

POST-LAUNCH:
  Month 1:  5-10 agents, $50K vault, monitor and iterate
  Month 2:  Open registration, raise limits, add venues
  Month 3:  First Level 2 agents graduating
  Month 6:  First Level 3 agents, under-collateralized pilots
  Month 12: Level 4 agents, full credit ladder operational
```

---

## 11. RISK MATRIX

```
RISK                    SEVERITY  PROBABILITY  MITIGATION
─────────────────────────────────────────────────────────────
Program exploit         Critical  Low          3 audits, bug bounty
Flash crash (all tokens)High      Low          Liquidation engine, insurance
Oracle price failure    High      Medium       Multi-source pricing, fallback
Keeper bot downtime     High      Medium       Multiple keepers, alerting
Venue exploit (Jupiter) Medium    Low          Venue monitoring, pause capability
Agent collusion         Medium    Medium       Anomaly detection, limits
LP bank run             Medium    Low          Utilization caps, lockups
Regulatory action       Medium    Medium       Legal structure, KYA compliance
Bad debt accumulation   Medium    Medium       Insurance fund, conservative LTV
```

---

*Document Version: 1.0 | March 2026 | Krexa Protocol*
*Confidential — for team and investor distribution*
Krexa_Solana_Architecture.md
30 KB