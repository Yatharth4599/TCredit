# TigerPayX — Programmable Credit Network 🐯

## Overview

TigerPayX is a **programmable credit network** that makes real-world business revenue natively lendable on-chain.

Instead of lending against assets or reputation, TigerPayX lends against **enforceable payment flow**. Businesses bill customers through TigerPayX endpoints. Incoming payments are automatically split — repayment first, merchant net second — before funds ever reach the borrower. Repayment is structural, not behavioural.

> The core insight: **Credit risk becomes activity risk.**

---

## 🏗️ Project Structure

```text
tpayx/
├── solana-programs/        # Core Solana implementation (Anchor / Rust)
│   ├── programs/tigerpay/
│   │   └── src/
│   │       ├── lib.rs              # Entry point & routing
│   │       ├── state/              # Account definitions (PDAs)
│   │       └── instructions/       # Transaction logic
│   └── tests/                      # TypeScript test suite
├── evm-contracts/          # Legacy EVM contracts (reference only)
├── frontend/               # Vite + React frontend (investor & merchant UI)
├── backend/                # Node.js + Prisma backend (credit scoring, APIs)
└── docs/                   # Scope, integration specs, and design docs
```

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| Solana Programs | Rust + Anchor Framework (v0.29.0), SPL Token |
| Frontend | Vite + React 18, CSS Modules, React Router v6 |
| Backend | Node.js, Prisma, TypeScript |
| Credit Scoring | FairScale API (on-chain wallet scoring) |
| Payment Routing | x402 programmable payment endpoints |
| Liquidity | On-chain vaults + Jupiter DeFi loans |
| Deployment | Devnet: `5xzKq3bRuxLh4WezvMRHz8nodp4W6gihUvjeB5VcWa8z` |

---

## ⚙️ How It Works

### 5-Step Flow

1. **Payment Routing** — Businesses bill via TigerPayX x402 endpoints; customers pay via local rails or stablecoins
2. **Financial Identity** — Transaction history builds a live on-chain credit profile (FairScale)
3. **Capital Advance** — Business requests working capital against verified receivables; credit tier determines rate and limit
4. **Liquidity Funding** — Vault funded by: retail investors → liquidity pools → Jupiter senior tranche
5. **Automated Repayment** — Incoming payments auto-split on-chain: repayment stream → vault investors; remainder → merchant

### Capital Structure (per loan)

| Tranche | Source |
|---|---|
| Retail investors | Direct vault investment |
| Liquidity pools | TigerPay alpha vault + co-owned pools |
| Senior | Jupiter DeFi loan (treasury-collateralised) |

---

## 🏗️ Solana Program Architecture

### Key PDAs

- **Platform Config** — Global settings (fees, authority)
- **Merchant Profile** — Verified merchant data, credit tier, vault counters
- **Merchant Vault** — Core engine: fundraise target, terms, repayment state
- **Investor Account** — Individual investments and claimable returns
- **Liquidity Pool** — Partner pool balances and allocation rules
- **Milestones & Tranches** — Progress-based fund releases to merchant

### Core Instructions

| Instruction | Purpose |
|---|---|
| `initialize_platform` | Protocol bootstrap |
| `verify_merchant` | Permissioned onboarding with credit check |
| `create_vault` | Vault creation with credit-tier-based rate |
| `invest` | Deposit USDC, mint Debt Tokens |
| `release_tranche` | Release funds on milestone approval |
| `route_repayment` | **Primary:** auto-split from payment routing oracle |
| `make_repayment` | **Fallback:** manual merchant repayment |
| `claim_returns` | Investor yield redemption |
| `mark_default` | Default + recovery flow |
| `pause_vault` / `cancel_vault` | Operational controls |

---

## 🚀 Getting Started

```bash
# Solana programs
cd solana-programs
anchor build
anchor test

# Frontend
cd frontend
npm install
npm run dev

# Backend
cd backend
npm install
npx prisma generate
npm run dev
```

Full setup: see `SOLANA_SETUP.md`

---

## 📚 Key Docs

- [Scope for Developers](docs/SCOPE_TPAYX_FOR_DEVELOPERS.md) — Single source of truth for what to build
- [FairScale Integration](docs/FAIRSCALE_INTEGRATION.md) — Credit scoring setup
- [Solana Setup](SOLANA_SETUP.md) — Environment and deployment guide

---

## 👥 Team

TigerPayX Protocol — Blockchain Engineering
