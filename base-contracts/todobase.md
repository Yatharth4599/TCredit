# TigerBNK — Base Contracts (EVM) Component Tracker

**Component:** `base-contracts/` — Solidity smart contracts for Base L2
**Purpose:** Accelerator demo — AI-native programmable credit on Base
**Last updated:** 2026-02-26

---

## What Is TigerBNK

TigerBNK is programmable credit infrastructure for autonomous economic actors — AI agents and merchants that need working capital. Instead of lending against collateral, TigerBNK lends against **enforceable payment flow**. Repayment is structural (auto-split at settlement), not behavioral (trust-based).

**Core thesis:** Credit risk = Activity risk. If the borrower keeps earning, the loan repays itself.

---

## Example Flow: TranslateBot Gets a $50K Credit Line

### Step 1 — Agent Registration
```
AgentRegistry.registerAgent("ipfs://translateBot")
```
TranslateBot now has an on-chain identity with payment history tracking.

### Step 2 — Vault Creation (Credit Line)
```
VaultFactory.createVault(
  agent: translateBot,
  target: $50,000 USDC,
  interest: 12% annualized,
  duration: 180 days,
  tranches: 4,
  repaymentRate: 15%   // 15% of every incoming payment → repayment
)
```
Deploys a `MerchantVault` via CREATE2 (deterministic address). Creates a `Settlement` in `PaymentRouter` that auto-routes 15% of TranslateBot's incoming revenue to the vault.

### Step 3 — Funding (Capital Structure)
```
Senior Pool (Alpha LP):  $40,000 → LiquidityPool.allocateToVault() → vault.investSenior()
YieldBot (retail):       $10,000 → vault.invest()
```
Once $50K raised → vault auto-activates (`Fundraising → Active`).

### Step 4 — Tranche Release
```
vault.releaseTranche()   // $12,500 released to TranslateBot
vault.releaseTranche()   // another $12,500 ...
```

### Step 5 — Automated Repayment (The Magic)
ShopBot pays TranslateBot $1,000 for services:
```
PaymentRouter.executePayment({
  from: ShopBot, to: TranslateBot,
  amount: 1000 USDC,
  signature: <oracle-signed ECDSA proof>
})
```
**Inside the router:**
1. Oracle ECDSA signature verified
2. Replay protection (nonce check)
3. Settlement lookup → 15% repayment rate
4. **Auto-split:** $150 → vault repayment, $850 → TranslateBot

### Step 6 — Waterfall Distribution
The $150 hits `vault.processRepayment()`:
1. Platform fee: 2% → $3 to fee recipient
2. Net $147 distributed via `WaterfallLib`:
   - **Senior tranche first** — until $40K + interest fully repaid
   - **Pool tranche second** — until their share repaid
   - **Community (retail) last** — gets remainder

### Step 7 — Lifecycle
- Revenue keeps flowing → auto-repayments accumulate
- `totalRepaid >= totalToRepay` → vault state = **Completed**
- Revenue stops → admin calls `markDefault()` → recovery mode
- Investors call `claimReturns()` or `claimRefund()` per outcome

---

## Architecture

```
base-contracts/
├── src/
│   ├── AgentRegistry.sol      # On-chain agent identity & stats
│   ├── PaymentRouter.sol      # x402 payment execution + auto-split
│   ├── MerchantVault.sol      # Per-agent credit vault + waterfall
│   ├── VaultFactory.sol       # CREATE2 vault deployer + platform config
│   ├── LiquidityPool.sol      # LP deposit pool → vault allocation
│   ├── interfaces/            # IAgentRegistry, IPaymentRouter, IMerchantVault, ILiquidityPool
│   └── libraries/
│       ├── Errors.sol         # Centralized custom errors (~50)
│       ├── SignatureLib.sol    # ECDSA verification for x402 proofs
│       └── WaterfallLib.sol   # Senior → Pool → Community distribution
├── test/
│   ├── AgentRegistry.t.sol    # 7 tests
│   ├── PaymentRouter.t.sol    # 5 tests
│   ├── MerchantVault.t.sol    # 8 tests
│   ├── LiquidityPool.t.sol    # 6 tests (4 unit + 2 alloc)
│   ├── Waterfall.t.sol        # 7 tests (incl. fuzz)
│   ├── SecurityHardening.t.sol # 12 tests (NEW — uncommitted)
│   ├── E2E.t.sol              # 1 full-flow integration test
│   └── mocks/MockUSDC.sol
├── script/Deploy.s.sol        # Foundry deployment script
└── foundry.toml               # Base Sepolia / Base Mainnet config
```

---

## Current State: 59/59 Tests Passing

**Build:** ✅ Clean (lint warnings only — unwrapped modifier logic)
**Tests:** ✅ 59 passed, 0 failed

### Coverage

| Contract         | Lines   | Statements | Branches | Functions |
|------------------|---------|------------|----------|-----------|
| AgentRegistry    | 97.0%   | 82.4%      | 31.3%    | 94.7%     |
| PaymentRouter    | 85.1%   | 80.4%      | 60.0%    | 81.3%     |
| MerchantVault    | 64.9%   | 59.8%      | 30.2%    | 51.6%     |
| LiquidityPool    | 82.7%   | 72.6%      | 30.0%    | 82.4%     |
| VaultFactory     | 58.3%   | 62.1%      | 16.7%    | 46.7%     |
| SignatureLib     | 50.0%   | 44.4%      | 0.0%     | 66.7%     |
| WaterfallLib     | 100.0%  | 100.0%     | 100.0%   | 100.0%    |
| **Total**        | **71.0%** | **64.2%** | **35.0%** | **68.6%** |

---

## Completed ✅

### Core Contracts (All 5 Implemented)
- [x] **AgentRegistry** — Self-registration, metadata, vault linking, payment stats, deactivation
- [x] **PaymentRouter** — x402 payment execution, oracle ECDSA verification, settlement auto-split, replay protection
- [x] **MerchantVault** — Full lifecycle (Fundraising→Active→Repaying→Completed/Defaulted/Cancelled), waterfall repayment, tranche release, investor claims/refunds
- [x] **VaultFactory** — CREATE2 vault deployment, platform config, agent validation
- [x] **LiquidityPool** — LP deposits/withdrawals, vault allocation, return processing, alpha/general pools

### Libraries
- [x] **WaterfallLib** — Senior → Pool → Community sequential distribution (100% coverage, fuzz tested)
- [x] **SignatureLib** — ECDSA payment proof verification via OpenZeppelin
- [x] **Errors** — ~50 custom errors, comprehensive coverage

### Security Hardening (Feb 2026 — uncommitted)
- [x] **2-Step Admin Transfer** — `proposeAdmin()`/`acceptAdmin()` on ALL 5 contracts
- [x] **PaymentRouter Pause** — `pause()`/`unpause()` with `notPaused` modifier on `executePayment`
- [x] **Oracle Always Required** — Removed `if (oracle != address(0))` bypass; signature verification mandatory
- [x] **Oracle Zero-Address Rejection** — Constructor + `setOracle()` reject `address(0)`
- [x] **forceApprove** — Replaced `approve()` with `forceApprove()` in PaymentRouter + LiquidityPool (handles non-standard ERC20)
- [x] **allocateToVault ReentrancyGuard** — Added `nonReentrant` to LiquidityPool allocation
- [x] **releaseTranche Dust Fix** — Arithmetic-based last-tranche calc instead of balance-based (prevents draining investor funds)
- [x] **claimRefund Div-by-Zero Guard** — `NothingToClaim` revert when balance is 0
- [x] **_activate Underflow Guard** — Reverts if `seniorFunded + poolFunded > totalRaised`
- [x] **processReturn Underflow Revert** — Explicit revert instead of silent `totalAllocated` clamp
- [x] **incrementPayments Agent Check** — Reverts for unregistered agents
- [x] **_totalClaimable Fix** — No longer subtracts platformFeesCollected (was double-counting)
- [x] **VaultFactory Bounds** — Interest capped at 50%, duration 7-730 days
- [x] **Deterministic CREATE2** — Salt uses agent address only (removed `block.timestamp`)
- [x] **Admin Event Emission** — Events on all admin config changes (setOracle, setFactory, setPaymentRouter, etc.)
- [x] **SecurityHardening.t.sol** — 12 dedicated tests for all above

### Tests
- [x] **E2E.t.sol** — Full demo flow: 4 agents, vault creation, funding, payments, waterfall verification
- [x] **Unit tests** — AgentRegistry (7), PaymentRouter (5), MerchantVault (8), LiquidityPool (6), Waterfall (7)

### Deployment
- [x] **Deploy.s.sol** — Deploys all contracts, wires basic permissions, supports Base Sepolia

---

## Remaining 🔧

### 1. Interface Sync (HIGH — blocks clean integration)
All 4 interfaces are stale after security hardening. Missing:
- [ ] **IAgentRegistry** — Add `proposeAdmin()`, `acceptAdmin()`, `setFactory()`, `setPaymentRouter()`, `deactivateAgent()`, `getAllAgents()`, `getAgentCount()` + events (`FactoryUpdated`, `PaymentRouterUpdated`, `AdminTransferProposed`, `AdminTransferred`)
- [ ] **IPaymentRouter** — Add `setFactory()`, `setOracle()`, `pause()`, `unpause()`, `proposeAdmin()`, `acceptAdmin()` + events (`Paused`, `Unpaused`, `OracleUpdated`, `FactoryUpdated`, `AdminTransferProposed`, `AdminTransferred`)
- [ ] **IMerchantVault** — Add `setPaymentRouter()`, `proposeAdmin()`, `acceptAdmin()`, `getInvestors()`, `getWaterfallState()` + events (`PaymentRouterUpdated`, `AdminTransferProposed`, `AdminTransferred`)
- [ ] **ILiquidityPool** — Add `pause()`, `unpause()`, `setMaxAllocation()`, `proposeAdmin()`, `acceptAdmin()`, `getAllocatedVaults()` + events (`MaxAllocationUpdated`, `AdminTransferProposed`, `AdminTransferred`)

### 2. Test Coverage Gaps (HIGH — demo credibility)
Branch coverage is 35%. Key untested paths:
- [ ] **VaultFactory tests** — `createVault` happy path, duplicate vault rejection, platform pause blocking, `predictVaultAddress` accuracy, `setPlatformFee`, `setFeeRecipient`, `setOracle`, admin-only guards
- [ ] **MerchantVault default flow** — `markDefault()` → `claimRefund()` with partial repayment, recovery path
- [ ] **MerchantVault claimReturns** — Investor claiming after waterfall distributions, multi-investor proportional claims
- [ ] **MerchantVault state transitions** — Invest when not fundraising, releaseTranche when not active, processRepayment when not repaying
- [ ] **PaymentRouter rate limiting** — `minPaymentInterval` enforcement, `maxSinglePayment` cap
- [ ] **PaymentRouter settlement update/deactivate** — `updateSettlement()`, `deactivateSettlement()` + attempting payment after deactivation
- [ ] **LiquidityPool full lifecycle** — `allocateToVault()` → vault repays → `processReturn()` → LP withdraws with profit
- [ ] **SignatureLib edge cases** — Invalid signature formats, expired deadline via `verifyPaymentProofFull()`
- [ ] **Multi-investor E2E** — Multiple community investors + senior + pool, verify proportional claimReturns

### 3. Deploy Script Hardening (MEDIUM — needed for testnet demo)
- [ ] **Wire LiquidityPool permissions** — Pools are deployed but not linked to factory/router (orphaned)
- [ ] **Add verification step** — `--verify` flag or post-deploy verification script for BaseScan
- [ ] **Complete .env.example** — Missing `ORACLE_ADDRESS`, `FEE_RECIPIENT`, `PLATFORM_FEE_BPS`, `USDC_ADDRESS`
- [ ] **Add deployment log** — Output deployed addresses to a JSON file for frontend/backend consumption
- [ ] **Testnet deploy & verify** — Actually deploy to Base Sepolia and verify contracts

### 4. Demo Script (HIGH — the actual presentation)
- [ ] **Interactive demo script** — Forge script that runs the E2E flow on-chain (Base Sepolia) with real transactions, console.log output showing each step
- [ ] **Demo wallet setup** — Pre-fund demo wallets with Sepolia ETH + USDC

### 5. Minor Code Quality
- [ ] **Lint cleanup** — Unwrapped modifier logic warnings in AgentRegistry (Foundry lint suggestion)
- [ ] **SignatureLib.verifyPaymentProofFull** — Change `view` to `pure` (no state access, just has `block.timestamp`)
- [ ] **NatSpec documentation** — Add `@notice`/`@param`/`@return` to all public functions for auto-generated docs

---

## Security Posture

| Area                    | Status                                | Risk     |
|-------------------------|---------------------------------------|----------|
| Reentrancy              | ✅ nonReentrant on all external calls  | Resolved |
| Oracle Verification     | ✅ Always required, ECDSA via OZ       | Resolved |
| Replay Protection       | ✅ Nonce-based per sender              | Resolved |
| Admin Transfer          | ✅ 2-step on all contracts             | Resolved |
| Pause Mechanism         | ✅ PaymentRouter, LiquidityPool, Vault | Resolved |
| Arithmetic Safety       | ✅ SafeMath implicit (0.8.24)          | Resolved |
| ERC20 Safety            | ✅ SafeERC20 + forceApprove            | Resolved |
| Access Control          | ✅ onlyAdmin / onlyAuthorized          | Resolved |
| Waterfall Correctness   | ✅ Fuzz tested, 100% coverage          | Resolved |
| CREATE2 Determinism     | ✅ Salt = agent only                   | Resolved |
| Interface Sync          | ❌ Stale after hardening               | Medium   |
| Branch Coverage         | ⚠️ 35% overall                        | Medium   |
| Deploy Wiring           | ⚠️ Pools not linked                   | Medium   |

---

*Document version: 1.0 — Created Feb 26, 2026*
