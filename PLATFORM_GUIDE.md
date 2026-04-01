# Krexa Platform Walkthrough Guide

## Section 1 — What Is Krexa

Krexa is a programmable AI agent credit protocol built on Solana. It issues on-chain credit lines to autonomous AI agents — traders, service providers, and hybrid participants — using a five-component behavioral credit score called the **Krexit Score**. Liquidity is pooled from human LPs across Senior and Mezzanine tranches, then deployed to agents that have demonstrated creditworthiness through on-chain activity.

The ecosystem has two sides: **Humans** (LPs who deposit capital, agent owners who register and manage agents, and admins who operate the platform) and **AI Agents** (Type A Traders, Type B Services, and Type C Hybrids that draw credit, execute activity, and repay). These two sides form a closed loop — LP capital funds agent credit, agent activity generates revenue and repayments, repayments return yield to LPs, and strong repayment history raises credit limits, enabling bigger cycles.

---

## Section 2 — Setup (Everyone)

### Prerequisites
- Solana wallet: [Phantom](https://phantom.app) or [Backpack](https://backpack.app)
- Devnet SOL for transaction fees (use Solana faucet: `https://faucet.solana.com`)
- Test USDC: connect wallet at `https://www.krexa.xyz/app` → click **"Get 10 Test USDC"**

### Base URLs
| Resource | URL |
|----------|-----|
| App (landing page) | `https://www.krexa.xyz` |
| App Hub (main dashboard) | `https://www.krexa.xyz/app` |
| Backend API | `https://tcredit-backend.onrender.com/api` |

> All API examples below use the base path `https://tcredit-backend.onrender.com/api`. Authenticated routes require `X-API-Key: {your_key}` header.

---

## Section 3 — Human Flows

### 3A. Liquidity Provider (LP)

**Goal:** Deposit USDC into a tranche vault, earn yield, withdraw anytime.

| Step | URL | Action |
|------|-----|--------|
| 1 | `https://www.krexa.xyz/` | Visit landing page — read protocol overview and vault stats |
| 2 | `https://www.krexa.xyz/vaults` | View vault marketing page with tranche info |
| 3 | `https://www.krexa.xyz/app/solana/lp` | Connect wallet via Phantom/Backpack |
| 4 | `https://www.krexa.xyz/app/solana/lp` | Click **"Deposit"** → choose tranche: **Senior** (10% APR, lowest risk) or **Mezzanine** (12% APR, medium risk) |
| 5 | `https://www.krexa.xyz/app/solana/lp` | Enter USDC amount → sign transaction → receive vault shares |
| 6 | `https://www.krexa.xyz/app/solana/lp` | Monitor: shares balance, accrued yield, vault health |
| 7 | `https://www.krexa.xyz/app/solana/lp` | Click **"Withdraw"** → enter shares to burn → receive USDC + accumulated yield |

**Risk hierarchy** (losses absorbed from bottom up):
```
Junior (protocol-only) → Mezzanine → Senior
```
Junior tranche is protocol-reserved — not available for external LP deposits. Senior is last to absorb losses.

---

### 3B. Agent Owner

**Goal:** Register an AI agent, draw credit, repay, improve Krexit Score, upgrade level.

| Step | URL | Action |
|------|-----|--------|
| 1 | `https://www.krexa.xyz/app/wallets` | Connect wallet → click **"Register Agent"** |
| 2 | `https://www.krexa.xyz/app/wallets` | Choose agent type: **Trader / Service / Hybrid** → enter agent name → sign tx |
| 3 | `https://www.krexa.xyz/app/wallets` | **"Create Wallet"** step appears → set daily spending limit → sign tx (creates on-chain PDA wallet) |
| 4 | `https://www.krexa.xyz/app/identity` | KYA prompt: click **"Verify Basic"** → sign wallet message → Tier 1 unlocked instantly |
| 5 | `https://www.krexa.xyz/app/solana/credit` | View credit profile: Krexit Score, level (L0→L4), health factor |
| 6 | `https://www.krexa.xyz/app/solana/credit` | Click **"Request Credit"** → enter amount (max $500 at L1) → oracle co-signs → sign tx |
| 7 | `https://www.krexa.xyz/app/solana/credit` | Credit drawn — repayment schedule shown: principal + interest + daily accrual |
| 8 | `https://www.krexa.xyz/app/solana/credit` | Click **"Repay"** or **"Repay All"** → sign tx → debt cleared |
| 9 | `https://www.krexa.xyz/app/solana/score` | View public score card: 5 components, history, level badge |
| 10 | `https://www.krexa.xyz/app/solana/credit` | Score improves → upgrade path to L2 shown → repeat cycle at higher credit |

**KYA Tiers:**

| Tier | Method | Speed | Unlocks |
|------|--------|-------|---------|
| Tier 1 Basic | Wallet signature | Instant | L1 ($500) |
| Tier 2 Enhanced | Sumsub KYC | Minutes | L2/L3 ($20K/$50K) |
| Tier 3 Institutional | Manual review | 1–2 days | L4 ($500K) |

---

### 3C. Admin

**Goal:** Issue API keys, configure webhooks, monitor platform health.

All admin routes require: `X-API-Key: {admin_key}`

| Action | Method + Path |
|--------|--------------|
| Create API key | `POST /api/v1/admin/keys` → body: `{ "name": "my-key", "tier": "free" \| "paid" }` |
| List API keys | `GET /api/v1/admin/keys?page=1&limit=50` |
| Create webhook | `POST /api/v1/admin/webhooks` → body: `{ "url": "https://...", "secret": "...", "events": ["ScoreChanged", "CreditRequested"] }` |
| View webhook deliveries | `GET /api/v1/admin/webhooks/:id/deliveries` |
| Export waitlist | `GET /api/v1/admin/waitlist/export` (returns CSV) |
| Platform health | `GET /api/v1/health` |
| Admin waitlist page | `https://www.krexa.xyz/admin/waitlist` |

Available webhook events: `ScoreChanged`, `CreditRequested`, `CreditApproved`, `CreditRejected`, `RepaymentMade`, `LiquidationTriggered`

---

## Section 4 — AI Agent Flows

All agents require the owner to complete Section 3B first: register agent, create wallet, complete KYA Tier 1, receive at least L1 credit eligibility.

Agent API calls are made programmatically (from agent code or via curl/SDK). Replace `{agent}` with the agent's public key throughout.

---

### Agent Type A — Trader

**Profile:** Algorithmic trading agent with whitelisted venue access
**Best for:** DeFi bots, market makers, arbitrage agents
**Key score drivers:** C1 Repayment (30%), C2 Profitability (25%), C4 Usage (15%)

**Full credit cycle (API-driven):**

| Step | Method + Path | Purpose |
|------|--------------|---------|
| 1 | `GET /api/v1/solana/credit/{agent}/eligibility` | Check credit eligibility and current level |
| 2 | `POST /api/v1/solana/credit/{agent}/request` → `{ "amount": 500, "creditLevel": 1 }` | Get unsigned credit request transaction |
| 3 | `POST /api/v1/solana/oracle/sign-credit` → pass unsigned tx | Oracle validates eligibility and co-signs → returns base64 tx |
| 4 | *(sign + submit tx via wallet/SDK)* | Credit drawn, agent PDA wallet funded |
| 5 | *(execute trades on whitelisted venues)* | Trading volume → C4 Usage improves; profitable trades → C2 Profitability improves |
| 6 | `GET /api/v1/solana/credit/{agent}/line` | Check current credit line state and outstanding debt |
| 7 | `POST /api/v1/solana/credit/{agent}/repay` → `{ "amount": 500, "callerPubkey": "..." }` | Repay on time → C1 Repayment score grows |
| 8 | `GET /api/v1/solana/score/{agent}` | Check updated Krexit Score |
| 9 | `GET /api/v1/solana/credit/{agent}/requests` | View full credit request history (Pending / Approved / Rejected) |

**Score milestone:** 500 points → complete KYA Tier 2 → upgrade to L2 ($20K) → repeat cycle at higher credit

---

### Agent Type B — Service

**Profile:** Revenue-generating service agent with milestone-based credit growth
**Best for:** Data feed providers, signal services, API-based agents
**Key score drivers:** C1 Repayment (30%), C3 Behavioral (20%), C5 Maturity (10%)

**Full credit cycle:**

| Step | Method + Path | Purpose |
|------|--------------|---------|
| 1 | `POST /api/v1/x402/register-resource` → `{ "url": "https://your-api.com/endpoint", "priceUsdc": 0.01, "ownerPubkey": "..." }` | Register API endpoint as x402-protected paid resource |
| 2 | *(clients call your API)* | Each client request hits your endpoint with x402 payment header |
| 3 | `POST /api/v1/x402/verify` → `{ "url": "...", "agentPubkey": "..." }` | Verify payment receipt → earn USDC per call |
| 4 | `GET /api/v1/solana/credit/{agent}/eligibility` | Consistent revenue builds C3 Behavioral → check updated eligibility |
| 5 | `POST /api/v1/solana/credit/{agent}/request` | Draw credit to scale infrastructure or service capacity |
| 6 | `POST /api/v1/solana/oracle/sign-credit` | Oracle validates and co-signs → agent submits to chain |
| 7 | *(serve more clients, earn x402 revenue)* | Revenue stream funds upcoming repayments |
| 8 | `POST /api/v1/solana/credit/{agent}/repay` | Repay from earnings → consistent on-time repayment = high C1 |
| 9 | `GET /api/v1/solana/score/{agent}` | Review score — C3 Behavioral elevated from revenue consistency |

**Score milestone:** 650 points + KYA Tier 2 → upgrade to L3 ($50K)

---

### Agent Type C — Hybrid

**Profile:** Combined trading + service agent — highest credit ceiling
**Best for:** Full-stack autonomous agents, protocol participants, sovereign AI entities
**Key score drivers:** All 5 components benefit simultaneously

**Full credit cycle (combines Type A + B flows):**

| Step | Action | Score Component Affected |
|------|--------|------------------------|
| 1 | Register as **Hybrid** on `https://www.krexa.xyz/app/wallets` | — |
| 2 | Register x402 resource via `POST /api/v1/x402/register-resource` | C3 Behavioral ↑ |
| 3 | Execute trades on whitelisted venues (Trader flow) | C2 Profitability ↑, C4 Usage ↑ |
| 4 | Earn revenue from both x402 calls + trading P&L | C3 Behavioral ↑↑ |
| 5 | Draw credit via oracle: `POST /api/v1/solana/oracle/sign-credit` | C1 Repayment clock starts |
| 6 | Use credit to call other agents' x402 services via SDK: `X402Client.pay()` | C4 Usage ↑ |
| 7 | Repay principal + interest on time or early | C1 Repayment ↑↑ |
| 8 | Account age accumulates over completed cycles | C5 Maturity ↑ |
| 9 | Score hits 750 + KYA Tier 3 → L4 Elite ($500K) | All components near maximum |

---

## Section 5 — Full Circle Diagram

```
         LPs deposit USDC
               ↓
    Senior (10% APR) / Mezzanine (12% APR)
               ↓
         Vault fills with liquidity
               ↓
     Agent draws credit (L1 → L4)
    ┌──────────────────────────────────┐
    │  Trader: executes DeFi trades    │
    │  Service: earns x402 revenue     │
    │  Hybrid: does both               │
    └──────────────────────────────────┘
               ↓
    Agent earns revenue / P&L
               ↓
    Agent repays principal + interest
               ↓
    Krexit Score improves (200 → 850)
               ↓
    LPs receive yield distributions
               ↓
    Credit level upgrades (L1 → L4)
               ↑_________________________|
                     (cycle repeats)
```

---

## Section 6 — Credit Levels Quick Reference

| Level | Name | Max Credit | APR | Min Score | Min KYA |
|-------|------|-----------|-----|-----------|---------|
| L1 | Starter | $500 | 36.5% | 400 | Tier 1 |
| L2 | Established | $20,000 | 29.2% | 500 | Tier 2 |
| L3 | Trusted | $50,000 | 21.9% | 650 | Tier 2 |
| L4 | Elite | $500,000 | 18.25% | 750 | Tier 3 |

> Interest accrues daily. Health factor must remain above **1.20x** (collateral / debt) to avoid liquidation.

---

## Section 7 — Krexit Score Quick Reference

| Component | Weight | Improves With | Hurt By |
|-----------|--------|--------------|---------|
| C1 Repayment | 30% | On-time / early repayments, full repayment history | Late payments, missed payments, liquidation events |
| C2 Profitability | 25% | Positive P&L, growing SOL balance, profitable trades | Realized losses, large drawdowns |
| C3 Behavioral | 20% | Consistent revenue streams, regular on-chain activity | Anomalous patterns, sudden large withdrawals |
| C4 Usage | 15% | Many whitelisted venues, high transaction count | Low activity, single-venue concentration |
| C5 Maturity | 10% | Account age, number of completed credit cycles | Nothing (only grows with time) |

**Score formula:**
```
Krexit Score = 200 + 650 × (0.30×C1 + 0.25×C2 + 0.20×C3 + 0.15×C4 + 0.10×C5)
```

**Range:** 200 (new wallet, no history) → 850 (elite agent, all components maxed)

---

## Section 8 — Key API Endpoints Reference

All paths are relative to `https://tcredit-backend.onrender.com/api`.

| Category | Method | Path | Description |
|----------|--------|------|-------------|
| Health | GET | `/health` | Service status, RPC connectivity, keeper status |
| Score | GET | `/solana/score/{agent}` | Full Krexit Score breakdown (all 5 components) |
| Credit | GET | `/solana/credit/{agent}/eligibility` | Eligibility check and recommended credit level |
| Credit | GET | `/solana/credit/{agent}/line` | Current credit line state and outstanding debt |
| Credit | GET | `/solana/credit/{agent}/requests` | Full credit request history with statuses |
| Credit | POST | `/solana/credit/{agent}/request` | Generate unsigned credit request transaction |
| Credit | POST | `/solana/credit/{agent}/repay` | Generate unsigned repayment transaction |
| Oracle | POST | `/solana/oracle/sign-credit` | Oracle co-signs validated credit transaction |
| Wallet | GET | `/solana/wallets/{agent}/health` | Agent wallet health factor |
| Vault / LP | GET | `/solana/vault/lp/{depositor}` | LP position: shares, accrued yield, tranche |
| x402 | POST | `/x402/register-resource` | Register API endpoint as paid x402 resource |
| x402 | POST | `/x402/verify` | Verify payment receipt for a resource call |
| KYA | POST | `/solana/kya/{agent}/basic` | Complete Tier 1 KYA (wallet signature) |
| Faucet | POST | `/solana/faucet/airdrop` | Airdrop devnet test USDC |
| Params | GET | `/solana/credit/protocol-params` | Current credit levels, APRs, thresholds |
| Admin Keys | POST | `/admin/keys` | Create API key (`X-API-Key` required) |
| Admin Keys | GET | `/admin/keys` | List API keys |
| Admin Webhooks | POST | `/admin/webhooks` | Register webhook endpoint |
| Admin Webhooks | GET | `/admin/webhooks/:id/deliveries` | View webhook delivery history |
| Admin Waitlist | GET | `/admin/waitlist/export` | Export waitlist as CSV |

---

## Section 9 — Glossary

| Term | Definition |
|------|-----------|
| **Krexit Score** | Five-component on-chain credit score ranging 200–850, computed from repayment history, profitability, behavioral patterns, usage activity, and account maturity |
| **KYA (Know Your Agent)** | Three-tier identity verification: Basic (wallet signature, instant) → Enhanced (Sumsub KYC) → Institutional (manual review) |
| **Health Factor** | Ratio of collateral value to outstanding debt. Must stay above **1.20x** — falls below 1.0x triggers liquidation |
| **Tranche** | Capital priority tier within the vault. Senior = lowest risk, last to absorb losses. Mezzanine = medium risk. Junior = highest risk, first to absorb losses (protocol-only) |
| **x402** | HTTP 402 micropayment standard — protects API endpoints with per-call USDC pricing, enabling machine-to-machine payments |
| **Oracle** | Backend co-signing service that validates agent eligibility and signs credit transactions before they can be submitted on-chain |
| **Agent Wallet PDA** | Program Derived Address — the on-chain credit wallet created per agent, controlled by the Krexa program with owner-set spending limits |
| **Waterfall** | Repayment distribution order through the vault: Senior → Mezzanine → Junior → Protocol reserve |
| **Liquidation** | Forced closure of a credit position when health factor falls below 1.0x — partial or full collateral seized to cover outstanding debt |
| **C1–C5** | Shorthand for the five Krexit Score components: C1=Repayment, C2=Profitability, C3=Behavioral, C4=Usage, C5=Maturity |
