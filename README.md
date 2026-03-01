# TCredit — Programmable Credit Network

**Chain:** Base L2 (EVM) | **Contracts:** Solidity 0.8.24 + Foundry | **Status:** Phase 0 Complete

TCredit is a **programmable credit network** that makes real-world business revenue natively lendable on-chain.

Instead of lending against assets or reputation, TCredit lends against **enforceable payment flow**. Businesses bill customers through TCredit x402 endpoints. Incoming payments are automatically split — repayment first, merchant net second — before funds ever reach the borrower. Repayment is structural, not behavioural.

> **Core insight: Credit risk becomes activity risk.**

---

## Project Structure

```
TCredit/
├── base-contracts/         # Solidity contracts (Foundry)
│   ├── src/
│   │   ├── AgentRegistry.sol       # Identity, credit scoring, vault linking
│   │   ├── PaymentRouter.sol       # x402 execution + oracle ECDSA signing
│   │   ├── VaultFactory.sol        # CREATE2 vault deployment + config
│   │   ├── MerchantVault.sol       # Full loan lifecycle, waterfall, tranches
│   │   ├── LiquidityPool.sol       # LP deposits, allocations, returns
│   │   ├── MilestoneRegistry.sol   # Evidence-based tranche gating
│   │   ├── interfaces/             # IAgentRegistry, IPaymentRouter, IMerchantVault, ILiquidityPool
│   │   └── libraries/
│   │       ├── WaterfallLib.sol    # Senior → Pool → Community distribution
│   │       ├── SignatureLib.sol    # ECDSA oracle verification
│   │       └── Errors.sol          # All custom errors
│   ├── test/               # Forge tests (160 tests, 0 failing)
│   └── script/
│       └── Deploy.s.sol    # Full deployment script
├── frontend/               # Vite + React + Zustand (wagmi/viem)
├── backend/                # Node.js + Express + Prisma
└── docs/                   # Architecture specs and integration docs
```

---

## Technology Stack

| Layer | Technology |
|---|---|
| Smart Contracts | Solidity 0.8.24, Foundry, OpenZeppelin v5 |
| Chain | Base L2 (EVM) — testnet: Base Sepolia (chainId 84532) |
| Payment Protocol | x402 programmable payment routing |
| Frontend | Vite + React 18 + Zustand, wagmi + viem |
| Backend | Node.js + Express + TypeScript + Prisma |
| Database | PostgreSQL (via Prisma ORM) |
| Testing | Forge (160 tests, ≥87% line coverage) |

---

## How It Works

### 5-Step Flow

1. **Payment Routing** — Businesses bill via TCredit x402 endpoints; customers pay via stablecoins (USDC)
2. **Financial Identity** — Transaction history builds a live on-chain credit profile (FairScale 0–1000)
3. **Capital Advance** — Business requests working capital; credit tier (A/B/C/D) determines rate and eligibility
4. **Liquidity Funding** — Vault funded by retail investors → liquidity pools → senior tranche
5. **Automated Repayment** — x402 payments auto-split on-chain: repayment waterfall → vault investors; remainder → merchant

### Repayment Waterfall (enforced on-chain)

```
Incoming x402 payment
      │
      ▼
Platform fee (≤500 bps)
      │
      ▼
Senior Tranche  ◄── first priority
      │
      ▼
Liquidity Pools ◄── second priority
      │
      ▼
Community Investors ◄── residual
```

### Credit Tiers

| Tier | Score Range | Access |
|---|---|---|
| A | ≥ 750 | Full access, best rates |
| B | ≥ 600 | Full access |
| C | ≥ 450 | Full access |
| D | < 450 | **Blocked** from vault creation |

Scores expire after 90 days. Expired scores block vault creation.

---

## Smart Contract Architecture

### Core Contracts

| Contract | Responsibility |
|---|---|
| `AgentRegistry` | Identity, credit scoring (FairScale 0-1000), vault linking |
| `PaymentRouter` | x402 execution, ECDSA oracle, settlement auto-split, replay protection |
| `VaultFactory` | CREATE2 deterministic deployment, platform config, credit gating |
| `MerchantVault` | Full loan lifecycle: fundraise → active → repaying → complete/default |
| `LiquidityPool` | LP deposits, vault allocations, return distribution |
| `MilestoneRegistry` | Evidence submission, verifier voting, tranche approval gating |

### Key Features

- **x402 Structural Repayment** — repayment is enforced at the payment routing layer, not behavioural
- **Milestone-Gated Tranches** — funds released to merchant only after verifier approval
- **Late Fee System** — cumulative shortfall × lateFeeBps × daysLate (capped at 30/period)
- **Keeper Functions** — permissionless `autoCancelExpired()` + `markDefault()`
- **2-Step Admin Transfers** — `proposeAdmin → acceptAdmin` on all contracts
- **SafeERC20 + forceApprove** — all ERC20 interactions via OZ SafeERC20

---

## Test Coverage

```
forge test
```

| Test File | Tests | Coverage |
|---|---|---|
| `AgentRegistry.t.sol` | 7 | Registry, stats, vault linking |
| `PaymentRouter.t.sol` | 17 | x402, ECDSA, replay protection, rate limiting |
| `MerchantVault.t.sol` | 23 | Lifecycle, waterfall, tranches, claims |
| `VaultFactory.t.sol` | 22 | CREATE2, platform config, credit gating |
| `LiquidityPool.t.sol` | 15 | Deposits, withdrawals, allocation |
| `WaterfallLib.t.sol` | 7 | Senior→Pool→Community (fuzz) |
| `SignatureLib.t.sol` | 5 | ECDSA verification |
| `SecurityHardening.t.sol` | 12 | 2-step admin, reentrancy, pause |
| `CreditScoring.t.sol` | 10 | Tier derivation, gating, expiry |
| `MilestoneRegistry.t.sol` | 15 | Full lifecycle, voting, rejection |
| `LateFees.t.sol` | 8 | On-time, late, multi-period, grace |
| `KeeperFunctions.t.sol` | 7 | Cancel, default, manual completion |
| **Total** | **160** | **≥87% line coverage** |

---

## Getting Started

### Prerequisites

- [Foundry](https://getfoundry.sh/) — `curl -L https://foundry.paradigm.xyz | bash`
- Node.js ≥ 20
- PostgreSQL (for backend)

### Smart Contracts

```bash
cd base-contracts
forge install
forge build
forge test
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend

```bash
cd backend
npm install
npx prisma generate
npm run dev
```

### Testnet Deployment (Base Sepolia)

1. Copy `.env.example` to `.env` in `base-contracts/`
2. Fill in: `DEPLOYER_PRIVATE_KEY`, `ORACLE_ADDRESS`, `BASESCAN_API_KEY`
3. Get Base Sepolia ETH: [faucet.quicknode.com](https://faucet.quicknode.com/base/sepolia)
4. Get Base Sepolia USDC: [faucet.circle.com](https://faucet.circle.com)
5. Run: `forge script script/Deploy.s.sol --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast --verify`

---

## Roadmap

| Phase | Description | Status |
|---|---|---|
| 0 | Base contract suite + 160 tests | ✅ Complete |
| 1 | Base Sepolia testnet deployment | ⬜ Next |
| 2 | Backend bootstrap (Express + Prisma) | ⬜ Pending |
| 3 | Core REST API (vaults, merchants, pools) | ⬜ Pending |
| 4 | Oracle service (x402 payment processing) | ⬜ Pending |
| 5 | Event indexer (chain → PostgreSQL) | ⬜ Pending |
| 6 | Keeper / crank service | ⬜ Pending |
| 7 | Frontend integration (wagmi/viem) | ⬜ Pending |

---

## Security

All contracts implement:
- `nonReentrant` on all external fund-moving functions
- 2-step admin transfers (`proposeAdmin → acceptAdmin`)
- `notPaused` guards with emergency pause on all critical contracts
- Oracle signatures always required for payment execution (no bypass)
- `SafeERC20.forceApprove` for all ERC20 operations
- Nonce-based replay protection for oracle payments
- Credit gating: tier D agents blocked from vault creation

---

## Links

- **Repo:** [github.com/Yatharth4599/TCredit](https://github.com/Yatharth4599/TCredit)
- **Chain:** [Base](https://base.org) (Coinbase L2)
- **Testnet Explorer:** [sepolia.basescan.org](https://sepolia.basescan.org)

---

*TCredit Protocol — Programmable Credit on Base*
