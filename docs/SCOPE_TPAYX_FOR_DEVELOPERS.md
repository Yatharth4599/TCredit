# TigerPayX — Project Scope for Outsourced Developers

**Document purpose:** Define the scope of the TigerPayX platform for development teams. Use this as the single source of truth for what we are building and how money flows.

**Vision:** TigerPayX is **The Programmable Credit Network** — a decentralized lending platform in the category of **Programmable Credit (Cash-Flow Backed Capital Markets)**, where repayment is enforced automatically through payment routing rather than relying on borrower behaviour.

---

## 1. Product overview

TigerPayX is **The Programmable Credit Network** — a platform in the category of **Programmable Credit (Cash-Flow Backed Capital Markets)**.

Global businesses operate online, but capital does not. Small and mid-sized companies generate verifiable digital revenue every day — subscriptions, trade payments, API usage, recurring invoices — yet access to financing still depends on geography, collateral, and manual approvals.

TigerPayX introduces a new primitive: **programmable credit**. Instead of lending against assets or reputation, the protocol lends against enforceable payment flow. When revenue is programmable, repayment becomes automatic — and capital can be allocated globally.

Businesses bill customers through TigerPayX payment endpoints. Incoming payments are automatically split — a portion services the loan, the remainder reaches the merchant. There is no manual repayment step. **Repayment is structural, not behavioural.**

This replaces:
- Traditional finance: geography, collateral, manual enforcement
- DeFi: overcollateralization, no real-world evaluation

TigerPayX lends against **enforceable payment flow**, not assets. Revenue becomes lendable only when it becomes enforceable. Credit risk becomes activity risk.

---

## 2. Core components

### 2.1 Payment routing layer (x402)

- Businesses bill customers using **TigerPayX payment endpoints** (x402 protocol)
- Customers pay via local rails or stablecoins
- Incoming payments route through a **controlled settlement account**
- Settlement account automatically splits: **loan repayment first, merchant net second**
- This is the enforcement mechanism — repayment happens before funds reach the merchant

### 2.2 Financial identity & credit scoring

- Transaction behaviour through TigerPayX builds a **live credit profile**
- Metrics: revenue consistency, volume, frequency, counterparty diversity
- Integration with **FairScale** (see `docs/FAIRSCALE_INTEGRATION.md`) for on-chain wallet scoring
- Credit score determines: eligibility, credit limits, interest rate tier
- Replaces manual off-chain merchant vetting

### 2.3 Merchant vaults (capital raise)

- One vault per merchant per loan campaign
- **Users (investors)** invest directly into a merchant's vault
- Vault terms: target amount, interest rate, duration, tranches
- Funds released to merchant in **tranches** upon milestone approval
- Returns to investors flow from the payment routing layer (automatic repayment stream)

### 2.4 Liquidity pool layer

Multiple pools fill vault shortfall when user investment does not reach the full target:

- **TigerPay alpha vault** — TigerPay's own treasury; first-fill source
- **Co-owned liquidity pools** — partner pools with configurable caps
- **Jupiter integration** — replaces NBFC; TigerPay borrows against treasury collateral to fill the remaining senior tranche

#### Capital structure (per loan)
| Tranche | Source | Notes |
|---|---|---|
| Community | Vault investors (users) | First portion raised |
| Liquidity pools | TigerPay alpha + co-owned pools | Fill shortfall |
| Senior | Jupiter (DeFi loan vs treasury) | Replaces NBFC 400k |
| Risk buffer | Community staking | First-loss layer |

### 2.5 Automated repayment (on-chain)

- Payment routing events trigger repayment splits on-chain
- The existing `make_repayment` instruction is a **fallback/manual path only**
- Primary repayment path: x402 settlement → on-chain split instruction → pro-rata to vault investors
- Late payment penalty (`late_fee_bps`) still applies if routing falls below expected cadence
- No milestone approval needed for repayment; milestones only gate tranche releases to merchant

---

## 3. Canonical example: gym, 500k loan

Use this example to validate all flows and for QA.

**Loan:** AED 500k to a UAE gym

| Portion | Source | Amount |
|---|---|---|
| Vault investors | Community retail investors | 20k |
| Liquidity pools | TigerPay alpha + co-owned | 80k |
| Senior tranche | Jupiter loan (treasury collateral) | 400k |
| **Total disbursed** | | **500k** |

**Repayment flow:**
1. Gym bills members via TigerPayX x402 endpoint
2. Member payments hit settlement account
3. Settlement auto-splits: ~2% monthly portion → repayment stream; remainder → gym wallet
4. Repayment stream distributed on-chain: senior (Jupiter) → pools → retail investors
5. Once fully repaid + interest, vault closes and debt tokens burn

---

## 4. What developers need to deliver

### Layer 1 — Payment routing
- x402 payment endpoint that merchants integrate into their billing
- Controlled settlement account that intercepts inflow
- On-chain split instruction: configurable repayment ratio per vault
- Events emitted for indexers (repayment amount, timestamp, vault ID)

### Layer 2 — Credit scoring
- Backend service wrapping FairScale API (`/getCreditScore`, `/evaluateMerchant`)
- Credit profile stored per merchant wallet (on-chain or off-chain, TBD)
- Vault creation checks minimum credit score gate
- Dynamic interest rate calculation based on credit tier

### Layer 3 — Vaults (extend existing)
- Existing `create_vault`, `invest`, `release_tranche`, `claim_returns` instructions are the foundation
- Modify `make_repayment` to be a manual fallback, not the primary flow
- Add `route_repayment` instruction: called by the settlement oracle/crank
- Maintain `pause_vault`, `cancel_vault`, `mark_default` for edge cases

### Layer 4 — Liquidity pools
- `LiquidityPool` account: partner address, cap, balance, APY
- `AllocateToVault` instruction: pool → vault shortfall fill
- Fill logic (priority TBD — see Section 7)
- Jupiter integration: borrow against treasury to fund senior tranche

### Layer 5 — Frontend (extend existing)
- Merchant onboarding: payment endpoint setup + credit score display
- Vault dashboard: live repayment stream progress (not just tranche dots)
- Investor portfolio: shows yield accruing from payment stream
- Liquidity pool dashboard for pool partners

---

## 5. Out of scope / later

- Final priority rules between TigerPay vault and co-owned pools
- Exact fee/revenue splits per tranche
- Regulatory and KYC requirements
- Token design and governance
- Mobile app

---

## 6. Architecture references

- **Solana programs:** `solana-programs/` (Anchor — vault, invest, repayment, tranche, milestone)
- **EVM contracts:** `evm-contracts/` (legacy — reference only)
- **Frontend:** `frontend/` (Vite + React — extend this)
- **Backend:** `backend/` (Node.js + Prisma — add credit scoring service here)
- **Credit scoring:** `docs/FAIRSCALE_INTEGRATION.md`
- **Canonical QA example:** Gym 500k (Section 3 above)

---

## 7. Loan types & economics

| Type | Typical cost | Max duration |
|---|---|---|
| Working capital lines | ~2% monthly | 12 months |
| Invoice financing | ~2% monthly | 12 months |
| Trade finance | ~2% monthly | 12 months |

Capital scales with business performance rather than approvals.

### The economic flywheel

Payments generate data → Data unlocks credit → Credit grows business → Growth generates more payments → Liquidity flows toward productivity automatically.

---

## 8. Open decisions — for boss to resolve before dev starts

> ⚠️ The following questions are **blocking** for development teams.

### Q1 — Fill priority *(Blocking for §2.4 and §4)*
> When a vault has a shortfall, in what order do pools fill it?
> - **Option A:** TigerPay alpha vault first; co-owned pools fill remainder
> - **Option B:** TigerPay vault and co-owned pools pro-rata simultaneously
> - **Option C:** Co-owned pools first; TigerPay vault as backstop

**Decision:** _______________

### Q2 — Fee and revenue splits *(Blocking for §2.4)*
> Who earns what on each tranche of the gym 500k example?
> - On the 20k user-invested portion?
> - On the 80k pool-filled portion?
> - On the 400k Jupiter-funded portion?

**Decision:** _______________

### Q3 — Jupiter integration model *(Blocking for §2.4 and §4)*
> - Fully on-chain DeFi loan (TigerPay locks collateral on Jupiter's protocol)?
> - Or off-chain treasury credit line managed by ops team?
> - Who monitors collateral health and triggers Jupiter repayment?

**Decision:** _______________

### Q4 — x402 / settlement account model *(Blocking for §2.1 and §4)*
> - Is the settlement account a custodial wallet TigerPay controls?
> - Or a smart contract escrow (fully on-chain)?
> - What happens if a merchant bypasses TigerPayX for billing?

**Decision:** _______________

### Q5 — Co-owned pool caps
> - Max number of pool partners?
> - Minimum capital per partner to join?
> - Minimum investment per individual pool investor?

**Decision:** _______________

### Q6 — Credit score gating
> - What minimum FairScale score is required for vault creation?
> - Who can override (admin whitelist)?
> - Do investors/pool partners also need credit checks?

**Decision:** _______________
## The Programmable Credit Network

**Category:** Programmable Credit (Cash-Flow Backed Capital Markets)

---

## 1. Introduction

Global businesses operate online, but capital does not.

Small and mid-sized companies generate verifiable digital revenue every day — subscriptions, trade payments, API usage, recurring invoices — yet access to financing still depends on geography, collateral, and manual approvals.

TigerPayX introduces a new primitive: **programmable credit**.

Instead of lending against assets or reputation, the protocol lends against enforceable payment flow.

When revenue is programmable, repayment becomes automatic — and capital can be allocated globally.

TigerPayX connects real economic activity to on-chain liquidity, creating internet-native capital markets for businesses.

---

## 2. The Problem

### Capital cannot follow commerce

Traditional finance:

- requires local presence
- relies on collateral
- enforces repayment manually

DeFi:

- requires overcollateralization
- ignores real-world productivity
- cannot evaluate businesses

Result: productive companies remain underfunded despite predictable cash flows.

The missing layer is not liquidity — it is enforceability.

---

## 3. The Insight

Revenue becomes lendable only when it becomes enforceable.

TigerPayX uses programmable billing (x402 payment requests) and controlled settlement accounts to ensure business income passes through the protocol before reaching the borrower.

This transforms invoices into programmable receivables.

Instead of trusting borrowers to repay, the protocol routes repayment directly from incoming payments.

Credit risk becomes activity risk.

---

## 4. What is Programmable Credit

Programmable credit is lending where repayment executes automatically from future revenue streams.

Payment event → settlement routing → repayment split

No collection process

No manual installments

No behavioral default

Businesses receive net earnings while principal and interest amortize continuously.

---

## 5. How TigerPayX Works

### Step 1 — Payment Routing

Businesses bill customers using TigerPayX payment endpoints.

Customers pay via local rails or stablecoins.

### Step 2 — Financial Identity

Transaction behavior builds a live credit profile based on revenue consistency.

### Step 3 — Capital Advance

Businesses request working capital or trade financing against receivables.

### Step 4 — Liquidity Funding

On-chain vaults fund loans via a financing entity and lending partners.

### Step 5 — Automated Repayment

Incoming payments automatically split:

- lender repayment
- remaining merchant balance

Repayment occurs before funds reach the borrower.

---

## 6. Capital Structure

Each loan is funded through structured liquidity:

Senior capital — lending partners

Liquidity pools — stablecoin providers

Risk buffers — community staking

Protocol treasury — first loss

This allows scalable funding while protecting liquidity providers.

---

## 7. Loan Types

Working capital lines

Invoice financing

Trade finance

Typical cost: ~2% monthly

Maximum duration: 12 months

Capital scales with business performance rather than approvals.

---

## 8. Why Blockchain Matters

Blockchain enables:

Global liquidity participation

Transparent yield distribution

Programmable settlement enforcement

Continuous underwriting

Traditional infrastructure cannot combine these properties.

---

## 9. The Economic Flywheel

Payments generate data

Data unlocks credit

Credit grows business

Growth generates more payments

Liquidity flows toward productivity automatically.

---

## 10. Vision

TigerPayX turns businesses into continuously fundable economic nodes.

Companies no longer apply for loans.

They stream capital as they perform.

This creates an internet capital market — where any productive business can raise funding based on activity rather than location or collateral.

---

TigerPayX is a programmable credit network that makes real-world revenue natively lendable on-chain.
---

*Document version: 2.0 — Updated to reflect programmable credit vision (litepaper Feb 2026). Decisions required by: [DATE]. Owner: [NAME].*
