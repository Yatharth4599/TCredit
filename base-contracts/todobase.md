# TigerBNK — Base Contracts (EVM) Component Tracker

**Component:** `base-contracts/` — Solidity smart contracts for Base L2
**Purpose:** Accelerator demo — AI-native programmable credit on Base
**Last updated:** 2026-03-09

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
│   ├── AgentRegistry.sol        # On-chain agent identity & stats
│   ├── PaymentRouter.sol        # x402 payment execution + auto-split
│   ├── MerchantVault.sol        # Per-agent credit vault + waterfall
│   ├── VaultFactory.sol         # CREATE2 vault deployer + platform config
│   ├── LiquidityPool.sol        # LP deposit pool → vault allocation
│   ├── MilestoneRegistry.sol    # Verifier voting + tranche gate
│   ├── AgentIdentity.sol        # Soulbound ERC721 reputation NFT
│   ├── AgentWallet.sol          # Human-controlled, AI-operated smart wallet
│   ├── AgentWalletFactory.sol   # CREATE2 wallet deployer, one per owner
│   ├── Krexa402Facilitator.sol  # x402 HTTP payment facilitator
│   ├── interfaces/              # All interfaces synced
│   └── libraries/
│       ├── Errors.sol           # Centralized custom errors
│       ├── SignatureLib.sol     # ECDSA verification for x402 proofs
│       └── WaterfallLib.sol     # Senior → Pool → Community distribution
├── test/
│   ├── AgentRegistry.t.sol           # 7 unit tests
│   ├── PaymentRouter.t.sol           # 5 unit tests
│   ├── MerchantVault.t.sol           # 8 unit tests
│   ├── LiquidityPool.t.sol           # 6 unit tests
│   ├── Waterfall.t.sol               # 7 tests (incl. fuzz)
│   ├── VaultFactory.t.sol            # 22 tests
│   ├── SecurityHardening.t.sol       # 12 tests
│   ├── MerchantVaultLifecycle.t.sol  # 15 tests
│   ├── PaymentRouterSettlement.t.sol # 12 tests
│   ├── LiquidityPoolLifecycle.t.sol  # 9 tests
│   ├── MultiInvestorE2E.t.sol        # 2 tests
│   ├── E2E.t.sol                     # 1 full demo flow
│   ├── AgentIdentity.t.sol           # 13 tests (soulbound, reputation, score)
│   ├── AgentWallet.t.sol             # 19 tests (factory, transfer, limits, whitelist, freeze)
│   ├── Krexa402Facilitator.t.sol     # 18 tests (register, update, deactivate, fees, executeX402Payment full coverage)
│   └── mocks/MockUSDC.sol
├── script/
│   ├── Deploy.s.sol               # Core contracts deployment
│   ├── DeployAgentIdentity.s.sol  # AgentIdentity deployment
│   ├── DeployAgentWallet.s.sol    # AgentWalletFactory deployment
│   └── DeployFacilitator.s.sol    # Krexa402Facilitator deployment
├── deployments/
│   ├── base-sepolia.json          # All deployed addresses
│   ├── abis.json                  # All contract ABIs
│   └── contracts.ts               # TypeScript typed exports
├── .env.example                   # All required env vars documented
└── foundry.toml                   # RPC + optimizer config
```

---

## Current State: 207/207 Tests Passing

**Build:** ✅ Clean
**Tests:** ✅ 207 passed, 0 failed
**Last commit:** `feature/waitlist` branch (all bug fixes applied)

### Coverage

| Contract              | Lines   | Branches | Functions | Notes                          |
|-----------------------|---------|----------|-----------|--------------------------------|
| AgentRegistry         | ~97%    | ~60%     | ~95%      |                                |
| PaymentRouter         | ~90%    | ~70%     | ~95%      |                                |
| MerchantVault         | ~85%    | ~50%     | ~85%      |                                |
| LiquidityPool         | ~88%    | ~55%     | ~88%      |                                |
| VaultFactory          | ~80%    | ~50%     | ~85%      |                                |
| SignatureLib          | ~75%    | ~50%     | ~85%      |                                |
| WaterfallLib          | 100%    | 100%     | 100%      |                                |
| AgentIdentity         | ~85%    | ~50%     | ~90%      |                                |
| AgentWallet           | ~90%    | ~60%     | ~95%      |                                |
| AgentWalletFactory    | ~80%    | ~50%     | ~90%      |                                |
| Krexa402Facilitator   | ~90%    | ~70%     | ~95%      | Full execution path covered    |
| **Total**             | **88%** | **60%**  | **~90%**  |                                |

---

## Completed ✅

### Agent Infrastructure Contracts (Phase 8.5 — Deployed Base Sepolia)
- [x] **AgentIdentity** — Soulbound ERC721, one per agent, admin-mint, reputation struct (volume, repayments, defaults, age), score 0-1000, 13 tests
- [x] **AgentWallet** — Human owner + AI operator roles, daily limit, per-tx limit, sliding 24h window reset, whitelist mode, freeze/unfreeze, emergency withdraw, credit vault link, 19 tests
- [x] **AgentWalletFactory** — CREATE2 factory, one wallet per owner, `getAllWallets()` + paginated `getWallets(offset, limit)`, 2-step admin transfer, event emission
- [x] **Krexa402Facilitator** — Merchant resource registration (sender-bound to prevent front-running), x402 per-call pricing, fee split (max 10%), forwards via `executeFacilitatedPayment`, `reactivateResource`, 2-step admin transfer, 18 tests
- [x] **Deploy scripts** — Individual deploy scripts for each new contract
- [x] **deployments/abis.json + contracts.ts** — Auto-generated TypeScript exports for all contracts

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

### Security Hardening (committed — `99a21c9`)
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
- [x] **SecurityHardening.t.sol** — 12 dedicated security hardening tests
- [x] **VaultFactory.t.sol** — 22 VaultFactory unit tests (CREATE2, fees, admin, pause, bounds)
- [x] **MerchantVaultLifecycle.t.sol** — 15 lifecycle tests (default, claimRefund, state transitions, claimReturns)
- [x] **PaymentRouterSettlement.t.sol** — 12 settlement tests (rate limiting, maxPayment, deactivate, update)
- [x] **LiquidityPoolLifecycle.t.sol** — 9 pool lifecycle tests (allocate → repay → processReturn → withdraw)
- [x] **MultiInvestorE2E.t.sol** — 2 multi-investor E2E tests (proportional claims, senior pool claims)
- **Total: 207/207 tests passing | 88% line coverage | 60% branch coverage**

### Deployment
- [x] **Deploy.s.sol** — Deploys all contracts, wires basic permissions, supports Base Sepolia
- [x] **.env.example** — All required vars: DEPLOYER_PRIVATE_KEY, ORACLE_ADDRESS, FEE_RECIPIENT, PLATFORM_FEE_BPS, USDC_ADDRESS, BASE_RPC_URL, BASE_SEPOLIA_RPC_URL, BASESCAN_API_KEY

### Interface Sync
- [x] **IAgentRegistry** — All security functions + events added
- [x] **IPaymentRouter** — pause/unpause, setFactory/setOracle, proposeAdmin/acceptAdmin + 6 events
- [x] **IMerchantVault** — setPaymentRouter, proposeAdmin/acceptAdmin, getInvestors, getWaterfallState + 3 events
- [x] **ILiquidityPool** — pause/unpause, setMaxAllocation, proposeAdmin/acceptAdmin, getAllocatedVaults + 3 events

### Code Quality
- [x] **AgentRegistry modifier** — Extracted `_checkAuthorized()` internal function (Foundry lint fix)
- [x] **Duplicate events removed** — Event declarations live in interfaces only (contracts inherit via `is IFoo`)

---

## Remaining 🔧

### 1. Bug Fixes
- All 17 actionable bugs resolved ✅ — see bugs.md for full status
- BUG-019 (admin reputation overwrite) accepted as governance risk

### 2. Missing Tests
- [ ] **Fuzz tests** — AgentIdentity score computation, AgentWallet spending limits
- [ ] **Edge cases** — `dailyLimit=0` (unlimited), `perTxLimit=0` (unlimited), `transfer(amount=0)`

### 3. Demo Script
- [ ] **Interactive Forge script** — Runs E2E flow on-chain with console.log output showing each step
- [ ] **Demo narrative output** — Each step prints human-readable: "TranslateBot registered → Vault created ($50K) → Senior funded ($40K) → 9 payments processed → Waterfall distributed → Returns claimed"

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
| Interface Sync          | ✅ All 4 interfaces updated            | Resolved |
| Branch Coverage         | ✅ 88% line / 60% branch (207 tests)  | Resolved |
| Deploy Wiring           | ✅ All contracts live on Base Sepolia   | Resolved |
| AgentWallet Admin       | ✅ 2-step admin on all contracts        | Resolved |
| AgentWalletFactory      | ✅ predictWalletAddress fixed           | Resolved |
| Krexa402Facilitator     | ✅ x402 payments functional via facilitatedPayment path | Resolved |
| x402 Resource Security  | ✅ Hash bound to sender, front-running eliminated | Resolved |
| Default Refund Fairness | ✅ Snapshot-based, order-independent    | Resolved |
| Pool Claim Path         | ✅ Pool investors tracked, claimReturns works | Resolved |

---

*Document version: 3.1 — Updated 2026-03-09 — All 17 bugs resolved. 207/207 tests passing. See bugs.md for full audit log.*
