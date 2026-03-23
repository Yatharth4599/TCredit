# Krexa Protocol — Complete Technical Document

## How We Built an On-Chain Credit System for AI Agents on Solana

---

## Table of Contents

1. [What is Krexa?](#1-what-is-krexa)
2. [Why Does This Need to Exist?](#2-why-does-this-need-to-exist)
3. [Architecture Overview — The 5 Programs](#3-architecture-overview--the-5-programs)
4. [Program 1: Agent Registry — Identity & Credit Scoring](#4-program-1-agent-registry--identity--credit-scoring)
5. [Program 2: Credit Vault — The Liquidity Pool](#5-program-2-credit-vault--the-liquidity-pool)
6. [Program 3: Agent Wallet — The Core, 8 Safety Layers](#6-program-3-agent-wallet--the-core-8-safety-layers)
7. [Program 4: Venue Whitelist — Approved Protocols](#7-program-4-venue-whitelist--approved-protocols)
8. [Program 5: Payment Router — Revenue Waterfall](#8-program-5-payment-router--revenue-waterfall)
9. [How Money Flows Through the System](#9-how-money-flows-through-the-system)
10. [How Krexa Makes Money](#10-how-krexa-makes-money)
11. [The Credit Level System](#11-the-credit-level-system)
12. [Health Factor & Liquidation — How We Protect LP Capital](#12-health-factor--liquidation--how-we-protect-lp-capital)
13. [Security: Every Fix We Made and Why](#13-security-every-fix-we-made-and-why)
14. [On-Chain Math — Every Formula](#14-on-chain-math--every-formula)
15. [Why Solana?](#15-why-solana)
16. [Deployment Architecture](#16-deployment-architecture)

---

## 1. What is Krexa?

Krexa is an **on-chain credit protocol for AI agents** built on Solana. It lets AI agents borrow USDC to trade, launch tokens, and pay for services — while protecting the people who lend that capital.

Think of it like a **credit card for AI agents**, but everything runs on a blockchain with no human middlemen.

**In simple terms:**
- **Liquidity Providers (LPs)** deposit USDC into a vault and earn yield
- **AI agents** register, build a credit score, and borrow from that vault
- **8 layers of safety** prevent agents from running away with the money
- **Revenue from agent earnings** automatically flows back to repay debt
- **If an agent's position becomes risky**, the system automatically liquidates it before LPs lose money

**The key innovation:** AI agents can get credit based on their **on-chain track record**, not a human's FICO score. Good behavior = more credit. Bad behavior = less credit, or liquidation.

---

## 2. Why Does This Need to Exist?

AI agents are becoming autonomous economic actors. They trade on DEXes, launch tokens on Pump.fun, pay for API services, and interact with DeFi protocols. But they have a fundamental problem: **they can only spend what they already have.**

Imagine an AI trading bot that spots a profitable arbitrage opportunity but doesn't have enough USDC to execute it. Or an AI agent that needs to pay for a service upfront but won't receive revenue until later. Without credit, these agents are limited.

**The problem we solve:**
1. **AI agents need credit** — just like humans use credit cards for cash flow
2. **Nobody trusts AI agents with unsecured loans** — so we built 8 layers of safety
3. **LPs want yield but fear defaults** — so we built an insurance fund and auto-liquidation
4. **There's no on-chain credit score for agents** — so we built one (KYA + behavioral scoring)

**Why on-chain?** Because trust. Every rule, every limit, every liquidation threshold is enforced by immutable code on Solana. No one — not even the Krexa team — can override the safety layers without an on-chain transaction that everyone can verify.

---

## 3. Architecture Overview — The 5 Programs

Krexa is not a single smart contract. It's **5 interconnected Solana programs**, each with a specific job. They communicate through Cross-Program Invocations (CPI) — Solana's way of letting programs call each other atomically within a single transaction.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        KREXA PROTOCOL                               │
│                                                                     │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐    │
│  │   AGENT      │   │   CREDIT     │   │    AGENT WALLET      │    │
│  │  REGISTRY    │◄──│   VAULT      │◄──│   (THE CORE)         │    │
│  │              │   │              │   │                      │    │
│  │ • Identity   │   │ • LP Pool    │   │ • PDA Wallets        │    │
│  │ • KYA Tiers  │   │ • Shares     │   │ • 8 Safety Layers    │    │
│  │ • Scores     │   │ • Interest   │   │ • Health Monitoring   │    │
│  │ • Levels     │   │ • Insurance  │   │ • Auto-Liquidation   │    │
│  └──────────────┘   └──────────────┘   └──────────────────────┘    │
│                                              ▲         ▲           │
│  ┌──────────────┐   ┌──────────────┐         │         │           │
│  │    VENUE     │   │   PAYMENT    │─────────┘         │           │
│  │  WHITELIST   │   │   ROUTER     │───────────────────┘           │
│  │              │   │              │                               │
│  │ • Jupiter    │   │ • Fee Split  │                               │
│  │ • Raydium    │   │ • Repayment  │                               │
│  │ • Pump.fun   │   │ • Waterfall  │                               │
│  │ • Orca       │   │ • x402       │                               │
│  └──────────────┘   └──────────────┘                               │
└─────────────────────────────────────────────────────────────────────┘
```

**Why 5 separate programs instead of 1?**

1. **Separation of concerns** — each program has a single responsibility
2. **Independent upgradability** — we can fix the vault without touching the wallet
3. **Security isolation** — a bug in the whitelist can't drain the vault
4. **Composability** — other protocols can integrate with individual programs
5. **Account size limits** — Solana has limits on how much data one program can manage

---

## 4. Program 1: Agent Registry — Identity & Credit Scoring

**Program ID:** `ChJjAXy7sE4d4jst9VViG7ScanVKqH9Q1cFxtdcH78cG`

### What It Does

The registry is the **identity layer**. Before an AI agent can get a wallet or credit, it must register here. Think of it as the DMV for AI agents — it issues an identity, tracks their history, and determines what credit level they qualify for.

### Key Concepts

#### KYA (Know Your Agent) — Not KYC, but KYA

Traditional finance has KYC (Know Your Customer). We invented **KYA (Know Your Agent)** — a tiered verification system for AI agents:

| Tier | Name | What's Required | What It Unlocks |
|------|------|----------------|-----------------|
| 0 | None | Nothing | Nothing — just registered |
| 1 | Basic | Automated code scan + owner wallet signature | Level 1 credit ($500 micro) |
| 2 | Enhanced | + Human review + 3-month on-chain behavior analysis | Level 2-3 credit (up to $100K) |
| 3 | Institutional | + Full business/legal entity verification + 12-month history | Level 4 credit (up to $500K) |

**Why?** We can't ask an AI agent for a driver's license. But we CAN analyze its code, its owner's on-chain history, and its behavioral patterns over time. A bot that has been trading responsibly for 12 months with zero liquidations is more trustworthy than a brand-new bot with no history.

#### Credit Scoring (200–850)

Every agent gets a credit score, just like a human FICO score:

- **200** — Floor (worst possible, after multiple liquidations)
- **400** — Default for new agents
- **850** — Maximum (perfect track record)

The score is updated by an **oracle** (an off-chain service we run) that analyzes:
- Trading volume and frequency
- Repayment history
- Liquidation events (each one drops the score by 100 points)
- Revenue consistency

#### Credit Levels — What Score + KYA Gets You

The combination of credit score and KYA tier determines your **credit level**:

```
Level 4 (Elite):       score >= 750 AND KYA >= 3  →  up to $500K, 5:1 leverage
Level 3 (Trusted):     score >= 650 AND KYA >= 2  →  up to $100K, 2:1 leverage
Level 2 (Established): score >= 500 AND KYA >= 2  →  up to $10K,  1:1 leverage
Level 1 (Starter):     score >= 400 AND KYA >= 1  →  up to $500,  no collateral needed
Level 0 (KYA Only):    below thresholds           →  no credit
```

**Both conditions must be met.** An agent with a score of 800 but KYA tier 1 is stuck at Level 1. An agent with KYA tier 3 but a score of 300 (from liquidations) gets Level 0.

#### Score Expiry

Credit scores expire after **90 days** (7,776,000 seconds). If an agent's score hasn't been re-verified by the oracle within 90 days, it becomes ineligible for credit. This prevents agents from getting a good score and then going dormant before re-appearing to exploit old credentials.

### How It Works On-Chain

**Accounts:**

- **RegistryConfig** (1 per protocol) — stores admin, oracle address, total agent count
- **AgentProfile** (1 per agent) — stores identity, scores, stats, wallet link

**Agent Registration Flow:**

1. Agent owner calls `register_agent(name)`
2. Both the agent keypair AND the owner keypair must sign (dual authorization)
3. A PDA (Program Derived Address) is created with seeds `["agent_profile", agent_pubkey]`
4. Agent starts with score 400, KYA tier 0, Level 0
5. Oracle later updates KYA tier → level recalculated
6. Oracle later updates credit score → level recalculated

**Profile Ownership Transfer:**

Agents can change owners through a 2-step process:
1. Current owner proposes a transfer to a new address
2. New owner accepts the transfer
3. Either party can cancel before acceptance

This prevents accidental transfers and supports migrating agents to multisig wallets (required for Level 3-4 credit).

### Stats Tracking

The registry tracks lifetime stats for each agent, updated via CPI from the wallet program:
- `total_volume_usd` — cumulative trading volume
- `total_trades` — total trade count
- `total_repaid` — total debt repaid
- `total_borrowed` — total debt borrowed
- `liquidation_count` — number of times liquidated

These stats are used by the oracle to compute credit scores.

---

## 5. Program 2: Credit Vault — The Liquidity Pool

**Program ID:** `26SQx3rAyujWCupxvPAMf9N3ok4cw1awyTWAVWDQfr9N`

### What It Does

The vault is the **money pool**. It's where LPs deposit USDC to earn yield, and where agents borrow from. Think of it like a bank's savings account combined with its lending desk — but fully automated and on-chain.

### Key Concepts

#### Share-Based Accounting — How LP Deposits Work

We don't track individual dollar amounts for each LP. Instead, we use a **share system** (like how mutual funds work):

**Depositing:**
```
When you deposit $1,000 USDC into the vault:
  - If the pool has $10,000 total and 10,000 shares outstanding
  - Your share price = $10,000 / 10,000 = $1.00 per share
  - You receive 1,000 shares
  - Pool now has $11,000 and 11,000 shares
```

**Why shares instead of dollars?** Because the pool earns interest. When agents pay interest, that money goes into the pool, increasing the value of each share:

```
After the pool earns $1,100 in interest:
  - Pool has $12,100 total, still 11,000 shares
  - Share price = $12,100 / 11,000 = $1.10 per share
  - Your 1,000 shares are now worth $1,100
  - You earned $100 without doing anything
```

**Withdrawing:**
```
You withdraw your 1,000 shares:
  - amount_out = (1,000 shares × $12,100) / 11,000 shares = $1,100
  - You get $1,100 USDC back (your original $1,000 + $100 yield)
```

This is the same mechanism used by Aave, Compound, and other major DeFi lending protocols. It's elegant because:
- Interest distribution is automatic (no claiming or harvesting)
- Gas costs don't increase with more depositors
- Share price only goes up (unless there are defaults)

#### The First-Deposit Attack Prevention

A common vulnerability in share-based systems is the "first deposit attack" — where an attacker:
1. Deposits 1 wei (smallest unit)
2. Donates a large amount directly to the vault
3. Inflates the share price before others deposit
4. Steals from future depositors via rounding

**Our fix:** We require a minimum first deposit of 1,000 base units (0.001 USDC) and verify that shares minted are > 0. This is our SOL-004 fix.

#### Collateral vs. LP Deposits

The vault holds two types of deposits, both using the same share system:

| Aspect | LP Deposit | Collateral Deposit |
|--------|-----------|-------------------|
| Purpose | Earn yield | Back an agent's credit line |
| PDA Seed | `["deposit", depositor]` | `["collateral", agent]` |
| Earns yield? | Yes (share price grows) | Yes (same pool) |
| Can withdraw anytime? | After lockup period | Only if agent has no active credit |
| Who deposits? | Anyone | Agent's owner |

**Key insight:** Collateral earns yield even while it's being used to back a credit line. This is a major feature — agents aren't losing opportunity cost by posting collateral.

#### Lockup Period

LPs can't withdraw immediately after depositing. There's a configurable lockup period (e.g., 30 days). This prevents "hot money" from draining the pool during stress events.

**Important:** The lockup timer resets on every new deposit. If you deposit on Day 1 with a 30-day lockup, then deposit again on Day 15, you can't withdraw until Day 45.

### How Credit Lines Work

When an agent requests credit, the vault creates a **CreditLine** account:

```
CreditLine {
  agent:                 [agent's pubkey]
  credit_limit:          $10,000          (max they can borrow)
  credit_drawn:          $5,000           (what they've actually borrowed)
  interest_rate_bps:     1200             (12% annual)
  accrued_interest:      $47.50           (unpaid interest so far)
  total_interest_paid:   $150.00          (lifetime interest paid)
  last_accrual_timestamp: 1710500000     (when interest was last calculated)
  is_active:             true
}
```

**Interest accrues continuously** using simple interest:
```
new_interest = (credit_drawn × interest_rate_bps × elapsed_seconds) / (10,000 × 31,536,000)
```

For $5,000 at 12% (1200 bps) for 30 days:
```
new_interest = ($5,000 × 1,000,000 × 1200 × 2,592,000) / (10,000 × 31,536,000)
             = ~$49.32 USDC
```

#### Utilization Cap — Preventing Over-Lending

The vault won't lend out more than a configurable percentage of its total deposits. For example, with an 85% utilization cap:

```
If vault has $100,000 in deposits and $80,000 already lent out:
  Utilization = 80,000 / 100,000 = 80%

  Agent requests $10,000 more credit:
  New utilization = 90,000 / 100,000 = 90% > 85% cap
  → REJECTED
```

This ensures LPs can always withdraw a portion of their funds, preventing bank-run scenarios.

### The Insurance Fund

5% of all interest collected goes into a separate **insurance fund**. This is the first line of defense if an agent defaults:

```
Agent pays $100 in interest:
  → $5 goes to insurance fund
  → $95 stays in the vault pool (increasing LP share prices)
```

**When an agent defaults (bad debt):**
1. Insurance fund covers as much of the loss as possible
2. Any remaining loss is absorbed by LPs (their share prices drop)
3. The default is recorded in `total_defaults`

**Example:**
```
Agent defaults on $1,000 principal + $100 accrued interest = $1,100 total loss
Insurance fund has $60

→ Insurance covers: $60
→ LPs absorb: $1,040
→ LP share prices drop by $1,040 / total_shares
```

This is similar to how FDIC insurance works for bank deposits, but smaller in scale and fully transparent.

### Repayment Flow

When an agent repays debt, the payment is split:

```
Agent repays $600:
  1. Interest portion first: min($600, accrued_interest)
     - Say accrued_interest = $50
     - Interest portion = $50

  2. Insurance cut from interest: $50 × 5% = $2.50
     - Transferred to insurance token account

  3. Net interest to vault: $50 - $2.50 = $47.50
     - Added to total_deposits (grows LP share prices)

  4. Principal portion: $600 - $50 = $550
     - Reduces credit_drawn
     - Reduces total_deployed

  5. Updated state:
     - credit_drawn: was $5,000, now $4,450
     - accrued_interest: was $50, now $0
     - If credit_drawn reaches 0 → credit line marked inactive
```

---

## 6. Program 3: Agent Wallet — The Core, 8 Safety Layers

**Program ID:** `35t8yWLsUZNTLT71ej7DF59P81HrtZTx2uZeMhwuhhf6`

### What It Does

This is the **heart of Krexa**. It creates PDA-controlled wallets for AI agents, manages their spending, enforces safety limits, monitors health, and executes liquidations. Every outbound payment goes through 8 layers of safety checks.

### Key Concepts

#### PDA Wallets — Why Not Regular Wallets?

Each agent gets a **Program Derived Address (PDA)** wallet instead of a regular Solana keypair wallet. PDAs are special addresses that can only be controlled by the program that derived them.

**Why this matters:**
- The agent can't just transfer all the USDC to itself and run away
- Every outbound transfer must go through the program's safety checks
- The program can automatically freeze, deleverage, or liquidate the wallet
- No private key exists for the wallet — it's controlled purely by code

```
Agent Wallet PDA:    seeds = ["agent_wallet", agent_pubkey]
Wallet USDC Account: seeds = ["wallet_usdc", agent_pubkey]
```

The USDC token account is **owned by the wallet PDA**, meaning only the wallet program can authorize transfers from it.

#### The 8 Safety Layers

Every `execute_trade` (outbound payment to a DEX/protocol) passes through ALL 8 checks. If any single check fails, the entire transaction reverts. No partial execution.

**Layer 1 — Global Pause Check**
```
Is the entire protocol paused by admin?
If yes → REJECT (no trades for anyone)
```
This is the emergency brake. If we discover a critical bug, we pause everything.

**Layer 2 — Amount Validation**
```
Is the trade amount > 0?
If no → REJECT (prevents no-op/spam transactions)
```

**Layer 3 — Wallet Frozen Check**
```
Is this specific wallet frozen?
If yes → REJECT (admin froze it for investigation, or auto-freeze from health decline)
```

**Layer 4 — Liquidation Status Check**
```
Is this wallet currently being liquidated?
If yes → REJECT (can't trade while being unwound)
```

**Layer 5 — Per-Trade Limit (20% of wallet balance)**
```
Is this trade > 20% of the wallet's total balance?
If yes → REJECT

Example: Wallet has $10,000 → max single trade = $2,000
```
This prevents an agent from blowing its entire balance on one bad trade.

**Layer 6 — Daily Spend Limit**
```
Has the agent spent more than its daily limit today?
If yes → REJECT

Daily limit is set by the owner (e.g., $5,000/day)
Resets at UTC midnight (every 86,400 seconds)

Example: Limit = $5,000, already spent $3,000 today
  → Trade of $2,500 → REJECTED ($3,000 + $2,500 = $5,500 > $5,000)
  → Trade of $1,500 → ALLOWED ($3,000 + $1,500 = $4,500 < $5,000)
```

**Layer 7 — Projected Health Factor (if the agent has debt)**
```
Would this trade drop the health factor below the warning threshold?
If yes → REJECT

Pre-flight simulation:
  1. Calculate what the wallet balance would be AFTER the trade
  2. Calculate the health factor with that reduced balance
  3. If projected HF < 1.3x (HF_WARNING) → REJECT

This prevents agents from trading themselves into liquidation.
```

**Layer 8 — Venue Whitelist Check**
```
Is the destination protocol on the approved venues list?
If no → REJECT

Only whitelisted venues (Jupiter, Raydium, Pump.fun, Orca, x402) can receive funds.
This prevents agents from sending money to random addresses.
```

**All 8 layers must pass.** This is the core safety guarantee that protects LP capital.

### Wallet Lifecycle

```
1. REGISTRATION (Registry)
   Agent registers → gets profile with score 400, KYA 0

2. KYA VERIFICATION (Registry, off-chain)
   Oracle verifies agent → KYA tier upgraded → credit level calculated

3. WALLET CREATION (Wallet)
   Owner creates wallet → PDA + USDC token account initialized
   Owner sets daily spending limit

4. COLLATERAL DEPOSIT (Wallet → Vault)
   Owner deposits USDC into vault as collateral → receives shares
   Collateral earns yield alongside LP deposits

5. CREDIT REQUEST (Wallet → Vault)
   Agent + oracle both sign → vault extends credit → USDC sent to wallet
   Credit limit based on level + collateral value

6. TRADING (Wallet → Whitelisted Venues)
   Agent executes trades through 8 safety layers
   Each trade updates daily spend tracking + health factor

7. EARNING (Payment Router → Wallet or Vault)
   Revenue from agent's services flows through router
   Platform fee deducted → repayment portion goes to vault → net to agent

8. REPAYMENT (Wallet → Vault)
   Agent or owner repays credit
   Interest paid first, then principal
   When fully repaid → credit line marked inactive

9. MONITORING (Keeper bot)
   Keeper checks health factors periodically
   If HF drops below 1.2x → auto-deleverage (freeze wallet)
   If HF drops below 1.05x → liquidation

10. WITHDRAWAL (Wallet → Owner)
    Owner withdraws free collateral (if no active debt)
    Or withdraws USDC balance from wallet
```

### Dual Authorization — Who Can Do What?

We designed a careful permission system separating **agent**, **owner**, **oracle**, **keeper**, and **admin** roles:

| Action | Who Signs | Why |
|--------|----------|-----|
| Create wallet | Agent + Owner | Both parties agree to the relationship |
| Deposit collateral | Owner | Owner controls capital |
| Request credit | (Agent OR Owner) + Oracle | Dual auth prevents rogue borrowing |
| Execute trade | Agent only | Agent operates autonomously |
| Pay x402 | Agent only | Agent handles payments |
| Repay debt | Agent or Owner | Either can reduce debt |
| Withdraw | Owner | Owner controls capital exits |
| Freeze wallet | Admin | Emergency control |
| Deleverage | Keeper | Automated safety |
| Liquidate | Keeper | Automated safety |
| Set daily limit | Owner | Owner controls risk |

**Why dual authorization for credit?** Without it, a rogue agent could max out its credit line and disappear. By requiring the oracle to co-sign, we ensure the credit request has been validated off-chain (agent identity verified, credit score checked, etc.).

### x402 Payments — Agent-to-Service Payments

x402 is a payment protocol for web services. When an agent pays for an API call or service:

```
Agent pays $100 via x402:
  1. Platform fee: $100 × 2.5% = $2.50 → Krexa treasury
  2. Net amount: $97.50 → Service provider (facilitator)

  Agent's daily spend updated by full $100
  Health factor recalculated after payment
```

This is how agents pay for things in the real world — API calls, data feeds, compute resources — with automatic fee extraction.

---

## 7. Program 4: Venue Whitelist — Approved Protocols

**Program ID:** `HyWQrHG14Sw6KpKYSMiBDmVj5u7PXfLWvim6FHbBLmua`

### What It Does

This is the **bouncer at the door**. It maintains a list of approved protocols that agents can interact with. If a venue isn't on the list, agents can't send money there.

### Why We Need This

Without a whitelist, an agent could:
- Send borrowed USDC to a random wallet (theft)
- Interact with a malicious contract (exploit)
- Use an unaudited protocol (risk)

The whitelist ensures agents can only trade on **known, vetted protocols**.

### Venue Categories

| Category | Code | Examples | Purpose |
|----------|------|----------|---------|
| DEX | 0 | Jupiter, Raydium | Token swaps, trading |
| Launchpad | 1 | Pump.fun | Token launches |
| x402 | 2 | x402 protocol | Service payments |
| DeFi | 3 | Orca | Yield, lending, etc. |

### How It Works

Each venue is a PDA with seeds `["venue", program_id]`. The wallet program reads this PDA during `execute_trade` to verify the destination is approved.

```
Admin calls: add_venue(jupiter_program_id, "Jupiter", category=0)
  → Creates WhitelistedVenue PDA
  → venue.is_active = true

Later, during execute_trade:
  → Wallet program derives PDA ["venue", trade_destination]
  → Checks venue_entry.is_active == true
  → If not found or inactive → REJECT
```

Venues can be deactivated (if compromised) and reactivated by admin.

---

## 8. Program 5: Payment Router — Revenue Waterfall

**Program ID:** `2Zy3d7C28Z9dfazdysKVBQUXnvvWNshxtDEFKftG83u8`

### What It Does

The router handles **incoming payments to agents** and automatically splits them into three destinations. This is the mechanism that enables **under-collateralized credit** for proven agents — their revenue automatically repays debt.

### The Revenue Waterfall

When an agent earns money (e.g., from providing an API service, from trading profits, from x402 payments):

```
Incoming Payment: $10,000 USDC
          │
          ▼
┌─────────────────────────────────┐
│  Stage 1: Platform Fee (2.5%)   │ ──→ $250 → Krexa Treasury
│  Remainder: $9,750              │
└─────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────┐
│  Stage 2: Repayment Split (20%) │ ──→ $1,950 → Credit Vault (reduces debt)
│  (only if agent has active      │
│   credit & split configured)    │
└─────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────┐
│  Stage 3: Merchant Net          │ ──→ $7,800 → Agent's Wallet
│  (whatever remains)             │
└─────────────────────────────────┘
```

### Why This Matters

This is what makes **Level 3-4 credit** possible. Traditional DeFi requires full collateralization (deposit $100 to borrow $50). But if an agent has a proven revenue stream, we can lend more than their collateral because:

1. Revenue automatically flows through the router
2. A configurable percentage (up to 50%) goes directly to repaying debt
3. The agent can't intercept or redirect this — it's atomic on-chain
4. The vault gets paid before the agent touches the money

**This is like factoring or invoice financing** — the agent's future revenue secures the loan.

### Merchant Settlements

Each agent/merchant gets a **MerchantSettlement** account:

```
MerchantSettlement {
  merchant:            [agent pubkey]
  agent_wallet_pda:    [linked wallet]
  has_active_credit:   true          (auto-repay if true)
  split_bps:           2000          (20% → vault)
  total_routed:        $50,000       (lifetime gross)
  total_repaid:        $8,000        (lifetime repaid)
  total_merchant_received: $40,250   (lifetime net)
  nonce:               47            (replay protection)
}
```

### Replay Protection

Every payment has a **nonce** — a monotonically increasing number. If someone tries to replay a payment (submit the same transaction twice), the nonce check catches it:

```
Payment with nonce 48:
  Check: 48 > settlement.nonce (47) → PASS
  Update: settlement.nonce = 48

Same payment replayed:
  Check: 48 > settlement.nonce (48) → FAIL → REJECTED
```

### CPI to Vault

When the router sends repayment to the vault, it doesn't just transfer tokens — it also calls the vault's `receive_repayment` instruction via CPI. This atomically:
1. Transfers USDC to the vault's token account
2. Updates the agent's credit line (reduces debt)
3. Splits the interest portion for insurance
4. All in one transaction — atomic, can't partially fail

---

## 9. How Money Flows Through the System

### Flow 1: LP Deposits and Earns Yield

```
LP deposits $10,000 USDC
  → Vault receives $10,000
  → LP gets shares (e.g., 10,000 shares at $1.00 each)
  → Over time, interest from agent loans increases total_deposits
  → LP's shares become worth more (e.g., $1.10 each)
  → LP withdraws after lockup → receives $11,000
  → Profit: $1,000 (10% yield)
```

### Flow 2: Agent Borrows and Trades

```
Agent owner deposits $5,000 collateral
  → Vault receives $5,000, agent gets collateral shares
  → Agent requests $5,000 credit (Level 2, 1:1 leverage)
  → Vault sends $5,000 USDC to agent's wallet
  → Agent now has $5,000 in wallet + $5,000 collateral = $10,000 total value
  → Agent trades on Jupiter (passes all 8 safety checks)
  → Agent's health factor monitored continuously
```

### Flow 3: Agent Earns Revenue

```
Agent provides API service, gets paid $1,000 through router:
  → $25 → Krexa treasury (2.5% platform fee)
  → $195 → Vault (20% repayment split)
  → $780 → Agent's wallet

  Agent's debt reduced by $195 automatically
  No action required from agent — it's built into the payment flow
```

### Flow 4: Agent Repays and Withdraws

```
Agent explicitly repays remaining $4,805 debt:
  → Interest paid first (e.g., $200 accrued)
    → $10 to insurance (5% of interest)
    → $190 to vault pool (increases LP share prices)
  → Principal paid: $4,605
  → Credit line closed (is_active = false)

Agent owner withdraws collateral:
  → Collateral shares redeemed (may be worth more than deposited due to yield)
  → Owner receives $5,200 (original $5,000 + $200 yield)
```

### Flow 5: Liquidation (Bad Scenario)

```
Agent borrows $5,000, trades badly:
  → Wallet USDC drops to $1,000 (lost $4,000 on bad trades)
  → Health factor: ($1,000 + $5,000 collateral) / $5,000 debt = 1.2x
  → HF < 1.2x (HF_DANGER) → Keeper calls deleverage → wallet FROZEN

Agent doesn't repay, market moves further:
  → HF drops below 1.05x (HF_LIQUIDATION)
  → Keeper calls liquidate:
    1. Keeper reward: $1,000 × 0.5% = $5 → keeper
    2. Remaining $995 → vault (reduces debt)
    3. Shortfall: $5,000 - $995 = $4,005 unpaid
    4. Collateral $5,000 seized to cover remaining debt
    5. Agent's score drops by 100 points
    6. Wallet permanently frozen
```

---

## 10. How Krexa Makes Money

Krexa generates revenue from **four sources**, all enforced on-chain:

### Source 1: Platform Fee on x402 Payments (2.5%)

Every time an agent pays for a service via the x402 protocol, 2.5% goes to the Krexa treasury.

```
Agent pays $100 for API call → $2.50 to Krexa
Agent pays $10,000 for compute → $250 to Krexa
```

**Constant:** `PLATFORM_FEE_BPS = 250` (250 basis points = 2.5%)

### Source 2: Platform Fee on Routed Payments (2.5%)

Every payment flowing through the Payment Router also incurs a 2.5% fee.

```
Agent earns $50,000 in revenue through router:
  → $1,250 to Krexa (2.5%)
```

**This is the primary revenue driver.** As agent volume grows, platform fees grow proportionally.

### Source 3: Interest Spread (Indirect)

While interest goes to LPs (via the vault), Krexa controls the protocol parameters:
- Base interest rate configuration
- Utilization-based rate adjustments
- The oracle that sets per-agent rates

The protocol could capture spread by setting rates slightly above market, though currently all net interest (after insurance) flows to LPs.

### Source 4: Insurance Fund Growth

5% of all interest goes to the insurance fund. While this is meant for covering defaults, any excess beyond what's needed for coverage represents protocol value.

```
Protocol processes $10M in credit at average 10% rate:
  → $1M in interest
  → $50K to insurance fund
  → If defaults are only $20K → $30K excess in insurance
```

### Revenue Projections

| Scenario | Monthly Agent Volume | Platform Fees (2.5%) | Annual Revenue |
|----------|---------------------|---------------------|----------------|
| Launch | $100K | $2,500/mo | $30K |
| Growth | $1M | $25K/mo | $300K |
| Scale | $10M | $250K/mo | $3M |
| Mature | $100M | $2.5M/mo | $30M |

---

## 11. The Credit Level System

### Level 0 — KYA Only (No Credit)

- **Score:** Any (below 400, or KYA too low)
- **KYA Required:** None
- **Max Credit:** $0
- **Collateral Required:** N/A
- **Use Case:** Agent is registered but not yet verified. Can't borrow.

### Level 1 — Starter (Micro-Credit)

- **Score:** >= 400
- **KYA Required:** Basic (Tier 1) — automated code scan + owner wallet signature
- **Max Credit:** $500
- **Collateral Required:** None
- **Leverage:** N/A (no collateral needed)
- **Use Case:** New agents testing the waters. Pay for a few API calls, make small trades.

### Level 2 — Established (1:1 Leverage)

- **Score:** >= 500
- **KYA Required:** Enhanced (Tier 2) — human review + 3-month behavior history
- **Max Credit:** $10,000
- **Collateral Required:** Equal to credit (1:1)
- **Leverage:** Deposit $5,000 → borrow $5,000 → $10,000 total purchasing power
- **Use Case:** Agents with a track record. Enough to do meaningful trading.

### Level 3 — Trusted (2:1 Leverage)

- **Score:** >= 650
- **KYA Required:** Enhanced (Tier 2)
- **Max Credit:** $100,000
- **Collateral Required:** Half of credit (2:1 leverage)
- **Leverage:** Deposit $10,000 → borrow $20,000 → $30,000 total
- **Use Case:** Professional agents with revenue streams. Revenue routing auto-repays debt.

### Level 4 — Elite (5:1 Leverage)

- **Score:** >= 750
- **KYA Required:** Institutional (Tier 3) — full business verification + 12-month history
- **Max Credit:** $500,000
- **Collateral Required:** Minimal (5:1 leverage, or zero for proven agents)
- **Leverage:** Deposit $10,000 → borrow $50,000 → $60,000 total
- **Use Case:** Top-tier agents with proven revenue, near-zero default history.
- **Additional Requirements:** Legal agreement signed on-chain, multisig owner recommended

---

## 12. Health Factor & Liquidation — How We Protect LP Capital

### Health Factor — The Single Most Important Number

The health factor (HF) is a single number that represents how safe an agent's position is:

```
Health Factor = Total Value / Total Debt

Where:
  Total Value = wallet_usdc_balance + collateral_value
  Collateral Value = (collateral_shares × vault_total_deposits) / vault_total_shares
  Total Debt = credit_drawn + accrued_interest
```

**Expressed in basis points** (10,000 = 1.0x):

| Health Factor | Meaning | What Happens |
|--------------|---------|--------------|
| 20,000 (2.0x) | Very healthy | All operations allowed |
| 15,000 (1.5x) | Healthy | All operations allowed |
| 13,000 (1.3x) | Warning | New borrows restricted; pre-flight check blocks risky trades |
| 12,000 (1.2x) | Danger | Keeper auto-deleverages (freezes wallet) |
| 10,500 (1.05x) | Liquidation | Keeper liquidates the position |
| < 10,000 (< 1.0x) | Underwater | Loss has occurred; insurance + LP absorb it |

**Example:**
```
Agent has:
  - $3,000 USDC in wallet
  - $5,000 in collateral (at current share price)
  - $6,000 total debt (principal + interest)

Health Factor = ($3,000 + $5,000) / $6,000 = 1.33x = 13,333 bps
→ Warning zone: can't borrow more, trades restricted

If agent loses $2,000 on a trade:
  Health Factor = ($1,000 + $5,000) / $6,000 = 1.0x = 10,000 bps
  → Below liquidation threshold → LIQUIDATE
```

### Deleverage — The Warning Shot

When health drops below 1.2x but above 1.05x, the keeper bot calls `deleverage`:

1. Keeper detects HF < 12,000 bps
2. Calls deleverage instruction
3. Wallet is **frozen** — no more trades
4. Agent/owner must manually repay to restore health
5. If they repay and HF recovers above 1.5x → wallet unfreezes

**This is a circuit breaker.** It stops the bleeding before liquidation becomes necessary.

### Liquidation — The Last Resort

When health drops below 1.05x, the keeper calls `liquidate`:

```
Step 1: Calculate distributions
  - Keeper reward: wallet_balance × 0.5% (incentive to run keeper bots)
  - Available for repay: wallet_balance - keeper_reward
  - Repay amount: min(available_for_repay, total_debt)
  - Shortfall: total_debt - repay_amount (if any)
  - Returned to owner: available_for_repay - repay_amount (if any surplus)

Step 2: Execute transfers (all atomic, in one transaction)
  - USDC to vault (debt repayment)
  - USDC to keeper (reward)
  - USDC to owner (any surplus)

Step 3: CPI to registry
  - Record liquidation event
  - Credit score drops by 100 points
  - Credit level recalculated (likely downgraded)

Step 4: Update wallet state
  - is_liquidating = false
  - is_frozen = true (permanently)
  - credit_drawn = 0
  - credit_limit = 0
  - total_debt = shortfall (unpaid amount)
```

**After liquidation:**
- Wallet is permanently frozen
- Agent's credit score drops by 100
- Credit level likely drops (e.g., from Level 3 to Level 2 or worse)
- Any shortfall (unpaid debt) is tracked as bad debt
- Admin can write off bad debt → insurance fund covers what it can → LPs absorb rest

### The Full Safety Stack (Summary)

```
Layer 1: KYA verification (identity)
Layer 2: Credit scoring (behavioral)
Layer 3: Collateral requirements (financial)
Layer 4: Per-trade limits (20% max)
Layer 5: Daily spend limits (owner-set)
Layer 6: Health factor monitoring (continuous)
Layer 7: Venue whitelist (destination control)
Layer 8: Projected health check (pre-flight)
   +
Auto-deleverage at 1.2x (circuit breaker)
Auto-liquidation at 1.05x (last resort)
Insurance fund (5% of interest)
Bad debt write-off (socialized loss)
```

---

## 13. Security: Every Fix We Made and Why

During development, we identified and fixed numerous security vulnerabilities. Here's every fix with context:

### SOL-001: Unauthorized Repayment
- **Bug:** Anyone could repay an agent's debt (sounds harmless, but enables griefing attacks and state manipulation)
- **Fix:** Only agent or owner can call `repay`

### SOL-002: Fake Collateral Value
- **Bug:** The `request_credit` instruction accepted `collateral_value` as a user-supplied parameter. An attacker could claim $1M collateral when they only had $100.
- **Fix:** Collateral value is now computed on-chain from vault shares: `value = shares × total_deposits / total_shares`

### SOL-003: Unilateral Credit Request
- **Bug:** An agent alone could request credit without owner knowledge
- **Fix:** Both (agent OR owner) AND oracle must sign credit requests (dual authorization)

### SOL-004: Share Inflation Attack
- **Bug:** First depositor could manipulate share prices to steal from future depositors
- **Fix:** Minimum first deposit of 0.001 USDC; require minted shares > 0

### SOL-005: Collateral Withdrawal Bypass
- **Bug:** Collateral PDA seeds weren't properly validated, allowing withdrawal from wrong positions
- **Fix:** Strict PDA seed validation for collateral positions

### SOL-006: KYA Tier Auto-Upgrade
- **Bug:** Updating KYA tier could auto-upgrade credit level without checking score
- **Fix:** Always use `calculate_level(score, new_tier)` function that checks both

### SOL-007: Merchant Account Spoofing
- **Bug:** Router's `execute_payment` didn't validate that the merchant USDC account belonged to the merchant
- **Fix:** Validate `merchant_usdc.owner == merchant || merchant_usdc.owner == agent_wallet_pda`

### SOL-008: Vault Config Spoofing
- **Bug:** Router accepted any account as vault config without ownership verification
- **Fix:** Validate `vault_config.owner == vault_program_id`

### SOL-009: Invalid USDC Mint
- **Bug:** Initialize instruction accepted any account as `usdc_mint` without verifying it was a real SPL Token Mint
- **Fix:** Validate that `usdc_mint` is a real SPL Mint account

### SOL-010/011: Liquidation Token Account Spoofing
- **Bug:** During liquidation, keeper_usdc and owner_usdc weren't validated for ownership. Attacker could redirect liquidation proceeds.
- **Fix:** `keeper_usdc.owner == keeper.key()` and `owner_usdc.owner == agent_wallet.owner`

### SOL-012: Missing Health Update in x402
- **Bug:** `pay_x402` didn't update the health factor after payment, unlike `execute_trade`
- **Fix:** Recalculate and store health factor after every x402 payment

### SOL-013: Missing Platform Fee in x402
- **Bug:** `pay_x402` didn't deduct the platform fee, so x402 payments generated zero revenue
- **Fix:** Deduct `PLATFORM_FEE_BPS` before sending to facilitator

### SOL-019: Score Expiry Bypass
- **Bug:** Stale credit scores (>90 days old) could pass eligibility checks
- **Fix:** Unconditionally check score age against `SCORE_EXPIRY_SECONDS`

### SOL-020: Credit Level Spoofing
- **Bug:** `request_credit` accepted `credit_level` as user input without checking against registry
- **Fix:** Validate `requested_level <= agent_profile.credit_level` (on-chain registry lookup)

### SOL-027: Bad Debt Underflow
- **Bug:** `write_off_bad_debt` subtracted accrued interest from `total_deployed`, causing underflow
- **Fix:** Only subtract principal (not accrued interest) from `total_deployed`

### SOL-029: Lockup Timer Bypass
- **Bug:** LP could deposit once, wait for lockup, then deposit again and immediately withdraw everything
- **Fix:** Reset `deposit_timestamp` on every new deposit

### SOL-033: Settlement Double-Activation
- **Bug:** `reactivate_settlement` didn't check if settlement was already active
- **Fix:** Check `!settlement.is_active` before reactivating

### SOL-035: Wallet Re-Linking
- **Bug:** `link_wallet` could be called multiple times, allowing wallet reassignment
- **Fix:** One-time flag: `require(!profile.has_wallet)`

### SOL-036: Invalid Venue Category
- **Bug:** `add_venue` accepted any u8 as category, including invalid values
- **Fix:** Validate category is 0-3

### SOL-039: No Global Pause
- **Bug:** No way to halt all operations in an emergency
- **Fix:** Added `is_paused` flag and `pause/unpause` instructions

### SOL-040: No Admin Rotation
- **Bug:** Admin and keeper couldn't be changed after initialization
- **Fix:** Added `update_config` instruction for admin/keeper rotation

### SOL-041: Immutable Daily Limit
- **Bug:** Daily spend limit couldn't be changed after wallet creation
- **Fix:** Added `update_daily_limit` instruction (owner-only)

### SOL-047: Collateral Withdrawal Owner Bypass
- **Bug:** Anyone could withdraw collateral by providing the right PDA seeds
- **Fix:** Validate `caller == deposit_position.depositor`

### SOL-048: KYA Score Timestamp
- **Bug:** Updating KYA tier didn't update `score_updated_at`, so a KYA update wouldn't prevent score expiry
- **Fix:** Update `score_updated_at` when KYA tier changes

---

## 14. On-Chain Math — Every Formula

### Share Price
```
share_price = total_deposits / total_shares
```

### Shares from Deposit
```
if first_deposit:
  shares = amount  (1:1)
else:
  shares = (amount × total_shares) / total_deposits
```

### USDC from Shares (Withdrawal)
```
amount = (shares × total_deposits) / total_shares
```

### Collateral Value
```
value = (collateral_shares × vault_total_deposits) / vault_total_shares
```

### Interest Accrual (Simple Interest)
```
interest = (principal × rate_bps × elapsed_seconds) / (10,000 × 31,536,000)
```

### Health Factor
```
total_value = wallet_balance + collateral_value
health_factor_bps = (total_value × 10,000) / total_debt
```

### Projected Health (Pre-Trade)
```
projected_balance = wallet_balance - trade_amount
projected_hf = ((projected_balance + collateral_value) × 10,000) / total_debt
```

### Utilization
```
utilization_bps = (total_deployed × 10,000) / total_deposits
```

### Platform Fee
```
fee = (amount × PLATFORM_FEE_BPS) / 10,000
net = amount - fee
```

### Insurance Cut
```
insurance = (interest_portion × INSURANCE_FEE_BPS) / 10,000
net_interest = interest_portion - insurance
```

### Keeper Reward (Liquidation)
```
reward = (wallet_balance × LIQUIDATION_REWARD_BPS) / 10,000
```

### Revenue Waterfall (Router)
```
platform_fee = (amount × platform_fee_bps) / 10,000
remainder = amount - platform_fee
repayment = (remainder × split_bps) / 10,000
merchant_net = remainder - repayment
```

### Credit Limit by Level
```
Level 1: min($500, LEVEL_1_MAX)
Level 2: min(collateral × 1, LEVEL_2_MAX)      // $10K cap
Level 3: min(collateral × 2, LEVEL_3_MAX)      // $100K cap
Level 4: LEVEL_4_MAX                            // $500K cap
```

### Credit Level Calculation
```
Level 4: score >= 750 AND kya >= 3
Level 3: score >= 650 AND kya >= 2
Level 2: score >= 500 AND kya >= 2
Level 1: score >= 400 AND kya >= 1
Level 0: everything else
```

### Daily Spend Reset
```
current_day = unix_timestamp / 86,400
last_reset_day = last_daily_reset / 86,400
if current_day > last_reset_day:
  daily_spent = 0  (new day)
```

All arithmetic uses **saturating operations** (no overflow panics) and **u128 intermediaries** for multiplication (prevents truncation on large values).

---

## 15. Why Solana?

### Speed
Solana processes transactions in ~400ms. Health factor checks, liquidations, and trades need to happen fast. On Ethereum (12-second blocks), an agent could lose significant value between health check and liquidation.

### Cost
A Solana transaction costs ~$0.00025. Agents might execute dozens of trades per day. On Ethereum, gas fees would make micro-credit uneconomical.

### PDAs (Program Derived Addresses)
Solana's PDA system is perfect for our use case. We can create wallet addresses that are controlled entirely by program code — no private keys. This is the foundation of our safety model.

### Composability via CPI
Cross-Program Invocations let our 5 programs call each other atomically within a single transaction. A liquidation triggers:
1. Token transfer (wallet → vault)
2. Credit line update (vault)
3. Registry score update (registry)
4. Token transfer (wallet → keeper)

All atomic. All in one transaction. If any step fails, everything reverts.

### Account Model
Solana's account model (vs. Ethereum's storage model) means each agent's data is in its own account. This scales better — we don't have one giant contract storing all agents' data.

### Anchor Framework
We built on Anchor (v0.30.1), Solana's most mature smart contract framework. It provides:
- Account validation with declarative constraints
- Automatic PDA derivation and verification
- Built-in serialization/deserialization
- Event emission
- CPI helpers

---

## 16. Deployment Architecture

### Programs (On-Chain)

| Program | ID | Size |
|---------|-----|------|
| Agent Registry | `ChJjAXy7...` | 320 KB |
| Credit Vault | `26SQx3rA...` | 435 KB |
| Agent Wallet | `35t8yWLs...` | 643 KB |
| Venue Whitelist | `HyWQrHG1...` | 223 KB |
| Payment Router | `2Zy3d7C2...` | 304 KB |

### Off-Chain Services

| Service | Purpose |
|---------|---------|
| Oracle | Updates credit scores, co-signs credit requests, verifies KYA |
| Keeper Bot | Monitors health factors, triggers deleverage/liquidation |
| x402 Gateway | Routes agent payments through the payment router |
| Frontend | Dashboard for LPs and agent owners |

### Key Accounts

| Account | Type | Purpose |
|---------|------|---------|
| RegistryConfig | Singleton PDA | Protocol-wide registry settings |
| VaultConfig | Singleton PDA | Vault parameters, pool accounting |
| WalletConfig | Singleton PDA | Wallet program settings, linked programs |
| WhitelistConfig | Singleton PDA | Venue whitelist admin |
| RouterConfig | Singleton PDA | Payment routing settings |
| AgentProfile | Per-agent PDA | Identity, score, stats |
| AgentWallet | Per-agent PDA | Wallet state, health, limits |
| DepositPosition | Per-depositor PDA | LP or collateral shares |
| CreditLine | Per-agent PDA | Outstanding debt tracking |
| MerchantSettlement | Per-merchant PDA | Revenue routing config |
| WhitelistedVenue | Per-venue PDA | Approved protocol |

### Mainnet Parameters (Conservative Launch)

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Max credit per agent | $5,000 | Start small, increase with confidence |
| Vault cap | $50,000 | Limit exposure during early days |
| Utilization cap | 75% | Ensure LP withdrawal liquidity |
| Registration | Whitelist-only | Admin manually approves agents |
| Initial vault funding | $20K-$50K | Own capital, not external LPs |
| Admin | 2-of-3 Squads multisig | No single point of failure |

---

## Appendix: Glossary

| Term | Definition |
|------|-----------|
| **PDA** | Program Derived Address — a Solana address controlled by a program, not a private key |
| **CPI** | Cross-Program Invocation — one program calling another within a transaction |
| **BPS** | Basis Points — 1/100th of a percent (100 bps = 1%, 10,000 bps = 100%) |
| **HF** | Health Factor — ratio of total value to total debt |
| **KYA** | Know Your Agent — identity verification for AI agents |
| **LP** | Liquidity Provider — someone who deposits USDC into the vault to earn yield |
| **Keeper** | A bot that monitors positions and triggers deleverage/liquidation |
| **Oracle** | An off-chain service that provides credit scores and co-signs transactions |
| **Share** | A unit representing proportional ownership of the vault pool |
| **Collateral** | USDC deposited to back a credit line (earns yield while pledged) |
| **Utilization** | Percentage of vault deposits currently lent out |
| **x402** | A payment protocol for web services |
| **Deleverage** | Freezing a wallet when health drops to danger zone (1.2x) |
| **Liquidation** | Seizing and distributing wallet funds when health drops to critical (1.05x) |
| **Insurance Fund** | Reserve built from 5% of interest, used to cover defaults before LP losses |
| **Revenue Waterfall** | Automatic splitting of incoming payments: fee → repayment → merchant |
| **Nonce** | Monotonically increasing counter preventing transaction replay |
| **Dual Authorization** | Requiring two different signers for sensitive operations |
