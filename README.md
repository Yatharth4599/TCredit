# Krexa — Programmable Credit Network

**Chain:** Base L2 (EVM) · **Status:** MVP Live on Base Sepolia · **Contracts:** 6 deployed + verified

Krexa is a **programmable credit network** that makes real-world business revenue natively lendable on-chain.

Instead of lending against assets or reputation, Krexa lends against **enforceable payment flow**. Businesses bill customers through x402 payment endpoints. Every incoming payment is automatically split on-chain — loan repayment first, merchant net second — before funds ever reach the borrower.

> **Core insight: Credit risk becomes activity risk. Repayment is structural, not behavioural.**

---

## Live Deployment — Base Sepolia

| Contract | Address | BaseScan |
|---|---|---|
| AgentRegistry | `0xAEa7C5CCACebB1423b163b765d3214752f1496A4` | [View](https://sepolia.basescan.org/address/0xAEa7C5CCACebB1423b163b765d3214752f1496A4) |
| PaymentRouter | `0xf8A5ED433222dFfb9514637243C3599cCE87f977` | [View](https://sepolia.basescan.org/address/0xf8A5ED433222dFfb9514637243C3599cCE87f977) |
| VaultFactory | `0xf8fDa17F877dEFFCD80784E0465F33d585644360` | [View](https://sepolia.basescan.org/address/0xf8fDa17F877dEFFCD80784E0465F33d585644360) |
| SeniorPool | `0xDf980d0734b00888e4Ac350027515B4D6E473bBa` | [View](https://sepolia.basescan.org/address/0xDf980d0734b00888e4Ac350027515B4D6E473bBa) |
| GeneralPool | `0x7E7D8082572C0AD2f51074D272A501180Db06Fb2` | [View](https://sepolia.basescan.org/address/0x7E7D8082572C0AD2f51074D272A501180Db06Fb2) |
| MilestoneRegistry | `0x48a471eEB88f84a867bEBC0f6DFF848660BC8c84` | [View](https://sepolia.basescan.org/address/0x48a471eEB88f84a867bEBC0f6DFF848660BC8c84) |
| USDC (Base Sepolia) | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | — |

All contracts are verified on BaseScan. Oracle/deployer: `0xA1090527ac5c019Abc3989F405a5a63bB008008D`

---

## Project Structure

```
TCredit/
├── base-contracts/          # Solidity 0.8.24 + Foundry (160/160 tests)
│   ├── src/
│   │   ├── AgentRegistry.sol        # Identity, credit scoring, vault linking
│   │   ├── PaymentRouter.sol        # x402 execution + ECDSA oracle signing
│   │   ├── VaultFactory.sol         # CREATE2 vault deployment + credit gating
│   │   ├── MerchantVault.sol        # Full loan lifecycle, waterfall, tranches
│   │   ├── LiquidityPool.sol        # LP deposits, allocations, return distribution
│   │   ├── MilestoneRegistry.sol    # Evidence-based tranche gating
│   │   ├── interfaces/              # IAgentRegistry, IPaymentRouter, IMerchantVault, ILiquidityPool
│   │   └── libraries/
│   │       ├── WaterfallLib.sol     # Senior → Pool → Community distribution (fuzz tested)
│   │       ├── SignatureLib.sol     # ECDSA oracle signature verification
│   │       └── Errors.sol           # All custom errors
│   ├── test/                # 160 Forge tests, 0 failing
│   ├── script/
│   │   └── Deploy.s.sol     # Full deployment + wiring script
│   └── deployments/
│       └── base-sepolia.json  # Deployed addresses
│
├── backend/                 # Express + TypeScript + Prisma + viem
│   ├── src/
│   │   ├── api/routes/      # 8 route groups (health, vaults, merchants, pools, platform, investments, payments, oracle)
│   │   ├── chain/           # viem read wrappers for all 6 contracts
│   │   ├── services/        # vault.service.ts, oracle.service.ts
│   │   ├── indexer/         # Poll-based event indexer (15s / 2000 blocks)
│   │   ├── keeper/          # Cron: autoCancelExpired, markDefault (5 min interval)
│   │   └── config/          # Zod-validated env, contract addresses + ABIs
│   └── prisma/
│       └── schema.prisma    # 11 models: Merchant, Vault, Investment, VaultEvent, Pool, OraclePayment, ...
│
└── frontend/                # Vite + React 18 + wagmi + RainbowKit
    └── src/
        ├── api/             # Typed API client for all backend endpoints
        ├── pages/           # Home, Vaults, VaultDetail, Portfolio, MerchantDashboard, LiquidityPools, X402Demo
        ├── components/      # FloatingDock, GlassCard, BentoGrid, WaterfallChart, AnimatedNumber
        ├── hooks/           # useContractTx, useUSDCApproval
        ├── lib/             # format.ts, statusConfig.ts
        └── styles/          # Design system: colors, typography, themes, animations, globals
```

---

## Technology Stack

| Layer | Technology |
|---|---|
| Smart Contracts | Solidity 0.8.24, Foundry, OpenZeppelin v5 |
| Chain | Base L2 (EVM) — testnet: Base Sepolia (chainId 84532) |
| Payment Protocol | x402 programmable payment routing |
| Frontend | Vite + React 18, wagmi v2 + viem, RainbowKit, motion (framer-motion v12) |
| Backend | Node.js + Express + TypeScript + Prisma 6 |
| Database | PostgreSQL 16 (via Prisma ORM) |
| Testing | Forge — 160 tests, ≥87% line coverage |

---

## How It Works

### 5-Step Flow

```
1. PAYMENT ROUTING     — Business bills customers via Krexa x402 endpoint (USDC)
2. CREDIT PROFILE      — x402 volume builds live on-chain credit score (FairScale 0–1000)
3. CAPITAL ADVANCE     — Merchant requests a vault: target amount, APY, term, tranches
4. LIQUIDITY FUNDING   — Retail investors fund vault; gaps filled by Senior/General pools
5. AUTO REPAYMENT      — x402 payments split on-chain: waterfall to vault → remainder to merchant
```

### Repayment Waterfall (enforced at protocol level)

```
Incoming x402 payment
      │
      ▼
Platform fee  (≤500 bps, configurable)
      │
      ▼
Senior Tranche  ◄── first priority (SeniorPool)
      │
      ▼
Liquidity Pools ◄── second priority (GeneralPool)
      │
      ▼
Community Investors  ◄── residual (retail LP positions)
      │
      ▼
Merchant Net  ◄── whatever remains
```

### Credit Tiers (FairScale 0–1000)

| Tier | Score | Access | Notes |
|---|---|---|---|
| A | ≥ 750 | Full access, best rates | — |
| B | ≥ 600 | Full access | — |
| C | ≥ 450 | Full access | — |
| D | < 450 | **Blocked** | Cannot create vaults |

Scores expire after **90 days**. Expired scores block vault creation regardless of tier.

### Milestone-Gated Tranches

Funds are not released to the merchant in one lump sum. Each tranche requires:
1. Merchant submits evidence hash (`MilestoneRegistry.submitMilestone`)
2. Verifiers vote (`MilestoneRegistry.voteMilestone`)
3. Auto-approve when `approvalCount >= requiredApprovals`
4. `MerchantVault.releaseTranche` checks `isMilestoneApproved` before releasing funds

---

## Smart Contracts

### Contract Responsibilities

| Contract | Key Functions |
|---|---|
| `AgentRegistry` | `registerAgent`, `updateCreditScore`, `getCreditTier`, `isCreditValid`, `linkVault` |
| `PaymentRouter` | `executePayment` (ECDSA-gated), `activateSettlement`, `deactivateSettlement`, replay protection |
| `VaultFactory` | `createVault` (CREATE2, credit-gated), `setFeeConfig`, `setPlatformFee` |
| `MerchantVault` | `invest`, `completeFundraising`, `releaseTranche`, `processRepayment`, `claimReturns`, `claimRefund`, `autoCancelExpired`, `markDefault` |
| `LiquidityPool` | `deposit`, `withdraw`, `allocateToVault`, `receiveReturn` |
| `MilestoneRegistry` | `initializeMilestone`, `submitMilestone`, `voteMilestone` |

### Security Properties

- `nonReentrant` on all external fund-moving functions
- 2-step admin transfers (`proposeAdmin → acceptAdmin`) on all 5 contracts
- `notPaused` guards — emergency pause on PaymentRouter, Pool, Factory, Vault
- Oracle signatures **always required** for payment execution (no bypass path)
- `SafeERC20.forceApprove` for all ERC20 interactions
- Nonce-based replay protection per oracle payment sender
- Credit tier D blocks vault creation, expired scores also block
- `via_ir = true` in `foundry.toml` (fixes stack-too-deep)

---

## Backend API

Base URL: `http://localhost:3001/api/v1/`

### Endpoints

```
GET    /health                            — DB + chain health (Base Sepolia chainId verification)

GET    /vaults                            — List all vaults (filter: state, agent)
POST   /vaults/create                     — Build unsigned createVault tx
GET    /vaults/:address                   — Full vault detail + waterfall + investor count
GET    /vaults/:address/investors         — Investor list with balances + claimable amounts
GET    /vaults/:address/tranches          — Tranche status (released/locked)
GET    /vaults/:address/milestones        — Milestone status per tranche
GET    /vaults/:address/waterfall         — Senior/pool/community breakdown
GET    /vaults/:address/repayments        — Repayment history (from indexed events)
POST   /vaults/:address/milestone/submit  — Build unsigned submitMilestone tx
POST   /vaults/:address/milestone/vote    — Build unsigned voteMilestone tx

GET    /merchants/:address                — Agent profile from chain
GET    /merchants/:address/vaults         — Vaults for this merchant
GET    /merchants/:address/stats          — Credit tier, TVL, loan count
POST   /merchants/register                — Build unsigned registerAgent tx
POST   /merchants/:address/credit-score   — Build unsigned updateCreditScore tx

GET    /pools                             — List pools + TVL summary
GET    /pools/:address                    — Pool detail
POST   /pools/deposit                     — Build unsigned deposit tx
POST   /pools/withdraw                    — Build unsigned withdraw tx
POST   /pools/allocate                    — Build unsigned allocateToVault tx (admin)

GET    /platform/stats                    — Live TVL, active vaults, pool liquidity
GET    /platform/config                   — Fee structure, limits, contract addresses
GET    /platform/indexer                  — Indexer status, lastBlock, lag, event counts
GET    /platform/keeper                   — Keeper status, wallet configured, poll interval

POST   /invest                            — Build unsigned invest tx
POST   /claim                             — Build unsigned claimReturns tx
POST   /refund                            — Build unsigned claimRefund tx
GET    /portfolio/:address                — All investments for wallet (live from chain)

POST   /oracle/payment                    — ECDSA sign + submit to PaymentRouter
GET    /oracle/health                     — Oracle status, queue depth, last payment per vault
GET    /oracle/payments                   — List oracle payments (filter: status, vault)
```

**All write endpoints return `{ to, data }` unsigned transactions. The frontend signs with the connected wallet via wagmi.**

### Database Models

| Model | Purpose |
|---|---|
| `Merchant` | Denormalized agent profile (creditScore, creditTier, scoreUpdated) |
| `Vault` | Vault state snapshot (totalRaised, totalRepaid, state, tranchesReleased) |
| `Investment` | Per-investor positions (amount, claimedReturns) |
| `VaultEvent` | Raw event log (12 event types, unique on txHash+logIndex) |
| `IndexerState` | Singleton — tracks lastIndexedBlock across restarts |
| `MilestoneRecord` | Per-tranche milestone status (approvalCount, evidenceHash) |
| `Pool` | Pool snapshot (totalDeposits, totalAllocated, paused) |
| `OraclePayment` | Payment processing queue (status, txHash, retry count, deadline) |
| `WebhookEndpoint` | Registered webhook URLs + event subscriptions |
| `WebhookDelivery` | Delivery log with retry state |
| `ApiKey` | API key registry with rate limits |

### Background Services

**Event Indexer** — polls `getLogs` every 15 seconds (2000 blocks/poll), decodes 12 event types across all 6 contracts, updates denormalized DB tables. Backfills from deployment block `38,200,000`.

**Keeper/Cron** — runs every 5 minutes:
- Scans fundraising vaults → calls `autoCancelExpired()` on eligible vaults (simulates first)
- Scans repaying vaults → checks `shouldDefault()` → calls `markDefault()` if true
- On default: calls `PaymentRouter.deactivateSettlement(agent)` to stop x402 routing

**Oracle Service** — processes webhook payments from x402:
- Validates vault exists, settlement active, amount within limits, rate limit respected
- Manages monotonically increasing nonces (stored in DB)
- Signs `keccak256(nonce, vault, amount, source, timestamp)` with ECDSA
- Submits `PaymentRouter.executePayment()` with gas estimation
- Exponential backoff retry queue (30s → 60s → 120s → 240s, max 5 attempts)
- Deadline-aware: expires payments past deadline instead of wasting gas

---

## Frontend

Built with **Vite + React 18 + wagmi v2 + RainbowKit**, connected to Base Sepolia (chainId 84532).

### Pages

| Page | Route | Description |
|---|---|---|
| Home | `/` | Live platform stats (TVL, active vaults, pool liquidity), animated counters |
| Vaults | `/vaults` | Browse + filter vaults, sidebar invest panel, real-time vault state |
| Vault Detail | `/vaults/:address` | Full lifecycle view, waterfall chart, milestones, tranches, repayments, invest flow |
| Portfolio | `/portfolio` | Live investor positions, claimable amounts, allocation breakdown |
| Merchant Dashboard | `/merchant` | Vault creation form, oracle payment feed, credit profile, stats |
| Liquidity Pools | `/pools` | Pool deposit/withdraw flows, utilization charts, TVL stats |
| X402 Demo | `/x402` | Live payment routing demo |

### Design System

- **Typography**: Outfit (display), Inter (body), JetBrains Mono (financial data/addresses)
- **Surface layers**: `surface-0` (#06070A) → `surface-4` (#1C2130) — borderless by default
- **Per-page accent theming** via `data-theme` on `<html>`: blue (vaults), cyan (portfolio), amber (merchant), purple (pools)
- **Motion**: `motion/react` (framer-motion v12) — `whileInView` stagger entrance on all cards, animated progress bars, `AnimatedNumber` counters
- **Pill shape**: `border-radius: 9999px` on all buttons, badges, inputs

### Wallet Flow

1. User connects via RainbowKit (MetaMask, Coinbase Wallet, WalletConnect)
2. Frontend calls backend for unsigned `{ to, data }` transaction
3. `useContractTx` hook calls `wagmi.sendTransaction`, shows pending/confirmed/failed toasts
4. For USDC operations: `useUSDCApproval` checks allowance and requests approval if needed

---

## Test Coverage

```bash
cd base-contracts && forge test
```

| Test Suite | Count | Covers |
|---|---|---|
| `AgentRegistry.t.sol` | 7 | Identity, stats, vault linking, deactivation |
| `PaymentRouter.t.sol` | 17 | x402 execution, ECDSA, replay protection, rate limiting |
| `MerchantVault.t.sol` | 23 | Full lifecycle, waterfall, tranches, claims, refunds |
| `VaultFactory.t.sol` | 22 | CREATE2, platform config, bounds, agent validation |
| `LiquidityPool.t.sol` | 15 | Deposits, withdrawals, allocation, returns |
| `WaterfallLib.t.sol` | 7 | Senior → Pool → Community (fuzz, 100% coverage) |
| `SignatureLib.t.sol` | 5 | ECDSA verification |
| `SecurityHardening.t.sol` | 12 | 2-step admin, reentrancy, pause |
| `CreditScoring.t.sol` | 10 | Tier derivation, blocked merchant, expired score, boundaries |
| `MilestoneRegistry.t.sol` | 15 | Full lifecycle, rejection, double-vote, tranche gate |
| `LateFees.t.sol` | 8 | On-time, late, multi-period, grace period, default trigger |
| `KeeperFunctions.t.sol` | 7 | Expired cancel, default, manual completion, edge cases |
| **Total** | **160** | **≥87% line coverage, 0 failing** |

---

## Local Development

### Prerequisites

- [Foundry](https://getfoundry.sh/) — `curl -L https://foundry.paradigm.xyz | bash`
- Node.js ≥ 20
- Docker (for PostgreSQL)

### Smart Contracts

```bash
cd base-contracts
forge install
forge build
forge test          # All 160 tests should pass
```

### Backend

```bash
cd backend
cp .env.example .env        # Fill in BASE_SEPOLIA_RPC_URL, DATABASE_URL, ORACLE_PRIVATE_KEY
docker compose up -d        # Start PostgreSQL 16
npm install
npx prisma generate
npx prisma migrate dev
npx tsx src/index.ts        # Starts on :3001
```

Environment variables required:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `BASE_SEPOLIA_RPC_URL` | Base Sepolia RPC (e.g. from Alchemy/Infura) |
| `ORACLE_PRIVATE_KEY` | Private key of the oracle/deployer wallet |
| `PORT` | Server port (default: 3001) |

### Frontend

```bash
cd frontend
npm install
npm run dev     # Starts on :5173, connects to backend at :3001
```

### Testnet Deployment (Base Sepolia)

```bash
cd base-contracts
cp .env.example .env
# Set: DEPLOYER_PRIVATE_KEY, ORACLE_ADDRESS, BASESCAN_API_KEY, BASE_SEPOLIA_RPC_URL
# Fund deployer with Base Sepolia ETH (faucet.quicknode.com/base/sepolia)
# Get USDC: faucet.circle.com

forge script script/Deploy.s.sol \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --broadcast \
  --verify
```

---

## Roadmap

| Phase | Description | Status |
|---|---|---|
| 0 | Base contract suite — 160/160 tests, all features ported from Solana spec | ✅ Complete |
| 1 | Base Sepolia testnet deployment — 6 contracts live + verified | ✅ Complete |
| 2 | Backend bootstrap — Express + Prisma + viem, health check | ✅ Complete |
| 3 | Core REST API — 25 endpoints, live chain reads | ✅ Complete |
| 3.5 | Design system — 3-font stack, surface layers, per-page accent theming | ✅ Complete |
| 4 | Oracle service — ECDSA signing, webhook receiver, retry queue | ✅ Complete |
| 5 | Event indexer — 12 event types, denormalized DB, backfill | ✅ Complete |
| 6 | Keeper/cron service — autoCancelExpired, markDefault, deactivateSettlement | ✅ Complete |
| 7 | Frontend integration — real API + wagmi wallet, all pages live | ✅ Mostly complete |
| 9 | Component-level visual redesign — motion.div animations, animated numbers, card hierarchy | 🔄 In progress |
| 8 | API docs + SDK — OpenAPI, TypeScript SDK, webhook system | ⬜ Pending |

---

## Security Posture

| Area | Status |
|---|---|
| Reentrancy | ✅ `nonReentrant` on all externals |
| Oracle Verification | ✅ Always required, ECDSA via OpenZeppelin |
| Replay Protection | ✅ Nonce per sender |
| Admin Transfer | ✅ 2-step on all 5 contracts |
| Pause Mechanism | ✅ Router, Pool, Factory, Vault |
| Arithmetic Safety | ✅ Solidity 0.8.24 built-in overflow checks |
| ERC20 Safety | ✅ SafeERC20 + forceApprove |
| Access Control | ✅ `onlyAdmin` / `onlyAuthorized` throughout |
| Waterfall | ✅ Fuzz tested, 100% line coverage |
| CREATE2 | ✅ Salt = agent address only (one vault per merchant) |
| Credit Scoring | ✅ Tier D blocked, 90-day expiry enforced |
| Milestones | ✅ Tranche gate requires verifier quorum |
| Late Fees | ✅ Cumulative shortfall model, daysLate capped at 30/period |
| Keeper Functions | ✅ Permissionless + simulation-gated |

---

## Links

- **Repo:** [github.com/Yatharth4599/TCredit](https://github.com/Yatharth4599/TCredit)
- **Chain:** [Base](https://base.org) (Coinbase L2)
- **Testnet Explorer:** [sepolia.basescan.org](https://sepolia.basescan.org)
- **USDC Faucet:** [faucet.circle.com](https://faucet.circle.com)
- **Base Sepolia ETH:** [faucet.quicknode.com/base/sepolia](https://faucet.quicknode.com/base/sepolia)

---

*Krexa — Programmable Credit on Base*
