# TigerPayX — Infrastructure & MVP Plan

## Decision: Base (EVM) + Solana Features Ported

Base contracts are production-ready today (120/120 tests, security hardened, deploy script). Solana program has rich business logic but won't compile and has zero tests. We go Base for MVP and port the Solana-only features.

---

## 1. Current State (Honest Assessment)

### Base Contracts — Production Ready ✅

| Contract | What It Does | Tests | Status |
|---|---|---|---|
| `AgentRegistry.sol` | On-chain identity, payment stats, vault linking | 7 | ✅ |
| `PaymentRouter.sol` | x402 payment execution, oracle ECDSA, settlement auto-split, replay protection | 17 | ✅ |
| `MerchantVault.sol` | Full vault lifecycle (Fundraising→Active→Repaying→Completed/Defaulted/Cancelled), waterfall repayment, tranche release, investor claims/refunds | 23 | ✅ |
| `VaultFactory.sol` | CREATE2 vault deployment, platform config, agent validation, bounds checking | 22 | ✅ |
| `LiquidityPool.sol` | LP deposits/withdrawals, vault allocation, return processing, alpha/general pools | 15 | ✅ |
| `WaterfallLib.sol` | Senior→Pool→Community sequential distribution | 7 (fuzz) | ✅ 100% coverage |
| `SignatureLib.sol` | ECDSA payment proof verification via OpenZeppelin | 5 | ✅ |
| `Errors.sol` | ~50 custom errors | — | ✅ |
| **TOTAL** | **5 contracts + 3 libraries** | **120/120** | **87% line coverage** |

**Security hardening (all tested):**
- 2-step admin transfer on ALL 5 contracts
- Reentrancy guards on all external calls
- Oracle ECDSA always required (no bypass)
- SafeERC20 + forceApprove
- Pause mechanisms on PaymentRouter, LiquidityPool, VaultFactory
- Replay protection (nonce per sender)
- Rate limiting per settlement
- CREATE2 deterministic deploys (salt = agent only)

**Deployment:** `Deploy.s.sol` ready — deploys Registry, Router, Factory, SeniorPool, GeneralPool, wires permissions.

### Solana Features to Port (business logic exists, needs Solidity implementation)

These are features in the Solana program that Base contracts don't have yet:

**1. Credit Scoring / Tier System**
- Source: `solana-programs/.../credit_ops.rs` + `investor.rs` (MerchantProfile fields)
- What: FairScale credit score (0-1000) → tier derivation (A≥750, B≥600, C≥450, D<450)
- Behavior: Tier D blocked from vault creation. Score expires after 90 days. Platform authority updates scores.
- Port to: `AgentRegistry.sol` (add `CreditProfile` mapping + `updateCreditScore()`)
- Gate: `VaultFactory.createVault()` checks tier ≥ C and score freshness

**2. Milestone-Gated Tranche Releases**
- Source: `solana-programs/.../milestone_ops.rs` + `tranche.rs` + `state/milestone.rs`
- What: Merchant submits milestone evidence → verifiers vote → upon approval threshold → tranche can be released
- Behavior: Milestones have status (Pending/Submitted/Approved/Rejected), evidence_hash, required_approvals. VerifierVotes are per-verifier-per-milestone. releaseTranche requires milestone approved.
- Port to: New `MilestoneRegistry.sol` + update `MerchantVault.releaseTranche()` to check milestone status

**3. Late Fee System**
- Source: `solana-programs/.../state/vault.rs` (`calculate_late_fee()`, `should_default()`)
- What: If merchant misses repayment due date, late fees accrue daily. Fee = remaining_balance × late_fee_bps × days_late / 10000. Grace period before default.
- Behavior: `nextPaymentDue` tracks 30-day intervals. Late fees added to `totalToRepay`. `shouldDefault()` = past grace period.
- Port to: `MerchantVault.sol` (add fields + modify `processRepayment()` / `executePayment()` path)

**4. Automated Keeper Functions**
- Source: `solana-programs/.../keeper_ops.rs`
- What: Permissionless automation — anyone can call to maintain vault lifecycle
- `autoCancelExpired()`: Vaults past fundraising deadline with <80% raised → auto-cancel
- `markDefault()`: Vaults past next_payment_due + grace_period → mark defaulted
- `returnPoolAllocation()`: Credit pool returns after vault repayment
- Port to: Add functions to `MerchantVault.sol` + `VaultFactory.sol`

**5. Complete Fundraising Manual**
- Source: `solana-programs/.../create_vault.rs` (`complete_fundraising_manual`)
- What: Authority can manually activate vault when it reaches 80%+ but hasn't hit 100%
- Port to: Add `completeFundraisingManual()` to `MerchantVault.sol`

### Backend — Completely Empty ❌

```
backend/src/
├── api/        → .gitkeep (no routes)
├── services/   → .gitkeep (no services)
├── jobs/       → .gitkeep (no jobs)
└── solana/     → .gitkeep (wrong chain, rename to chain/)
```

No Express server. No database. No Prisma schema. No API endpoints. Nothing.

### Frontend — Beautiful But All Mock Data ⚠️

**Pages (7):** Home, Vaults, Portfolio, MerchantDashboard, LiquidityPools, X402Demo
**Components:** WaterfallChart, LivePaymentFeed, WaterfallBreakdown, Navbar/Sidebar/Topbar
**State:** Zustand store scaffolded (vaults, merchantStats, walletAddress) — but all data from `lib/mockData.ts`
**Wallet:** `@solana/wallet-adapter-*` installed — needs replacing with wagmi/viem for Base

---

## 2. Architecture Target

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│  Vite + React 18 + wagmi + viem + Web3Modal                      │
│  Pages: Home | Vaults | Portfolio | Merchant | Pools | X402      │
│                           │                                       │
│                     API Client (REST)                             │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                   ┌────────▼─────────┐
                   │   BACKEND API     │
                   │   Express + TS    │
                   │   /api/v1/...     │
                   ├───────────────────┤
                   │ • Merchants API   │
                   │ • Vaults API      │
                   │ • Investors API   │
                   │ • Pools API       │
                   │ • Platform API    │
                   └──┬────┬────┬─────┘
                      │    │    │
           ┌──────────┘    │    └──────────┐
           │               │               │
    ┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
    │  ORACLE     │ │  INDEXER    │ │  KEEPER     │
    │  Service    │ │  Service    │ │  Service    │
    │             │ │             │ │             │
    │ Webhook rx  │ │ Event sub   │ │ Cron (5min) │
    │ ECDSA sign  │ │ Parse logs  │ │ Expiry scan │
    │ Tx submit   │ │ → Postgres  │ │ Default det │
    │ Retry queue │ │ Backfill    │ │ Pool return │
    └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
           │               │               │
           └───────────────┼───────────────┘
                           │
                    ┌──────▼──────┐
                    │  PostgreSQL  │
                    │  (Prisma)    │
                    │              │
                    │ events       │
                    │ vaults       │
                    │ merchants    │
                    │ investments  │
                    │ settlements  │
                    │ api_keys     │
                    └──────┬──────┘
                           │
              ┌────────────▼────────────┐
              │     BASE L2 (EVM)        │
              │                          │
              │ AgentRegistry            │
              │ PaymentRouter            │
              │ VaultFactory             │
              │ MerchantVault (per loan) │
              │ LiquidityPool (×N)       │
              │ MilestoneRegistry (NEW)  │
              │                          │
              │ Base Sepolia → Mainnet   │
              └──────────────────────────┘
```

---

## 3. Smart Contract Changes (Port Solana → Base)

### 3A. Credit Scoring (AgentRegistry.sol)

**New storage:**
```solidity
struct CreditProfile {
    uint16 score;         // 0-1000 FairScale
    uint8 tier;           // 0=D(blocked), 1=C, 2=B, 3=A
    uint256 updatedAt;    // timestamp of last update
}
mapping(address => CreditProfile) public creditProfiles;
uint256 public constant CREDIT_SCORE_MAX_AGE = 90 days;
uint16 public constant TIER_A_MIN = 750;
uint16 public constant TIER_B_MIN = 600;
uint16 public constant TIER_C_MIN = 450;
```

**New functions:**
```solidity
function updateCreditScore(address agent, uint16 score) external onlyAdmin;
function getCreditTier(address agent) external view returns (uint8);
function isCreditValid(address agent) external view returns (bool);
```

**VaultFactory change:** `createVault()` adds:
```solidity
CreditProfile memory cp = registry.creditProfiles(agent);
if (cp.score > 0) {
    require(cp.tier >= 1, "CreditScoreTooLow");  // Block tier D
    require(block.timestamp - cp.updatedAt < CREDIT_SCORE_MAX_AGE, "CreditScoreExpired");
}
```

**New tests (~10):**
- `test_updateCreditScore_derivesCorrectTier` (A/B/C/D boundaries)
- `test_tierD_blockedFromVaultCreation`
- `test_expiredScore_blockedFromVaultCreation`
- `test_noScore_allowedForNewMerchants`
- `test_onlyAdmin_canUpdateScore`
- `test_scoreAbove1000_reverts`
- `test_creditProfileEmitsEvent`
- `test_tierUpgrade_allowsVaultCreation`
- `test_multipleMerchants_independentScores`
- `test_scoreAt90Days_stillValid`

### 3B. Milestone System (New: MilestoneRegistry.sol)

**New contract: ~200 lines**
```solidity
contract MilestoneRegistry {
    enum MilestoneStatus { Pending, Submitted, Approved, Rejected }

    struct Milestone {
        address vault;
        uint8 milestoneId;
        bytes32 evidenceHash;
        bytes32 descriptionHash;
        MilestoneStatus status;
        uint256 submittedAt;
        uint256 approvedAt;
        uint8 approvalCount;
        uint8 rejectionCount;
        uint8 requiredApprovals;
    }

    struct VerifierVote {
        bool voted;
        bool approved;
        bytes32 commentHash;
        uint256 votedAt;
    }

    // vault => milestoneId => Milestone
    mapping(address => mapping(uint8 => Milestone)) public milestones;
    // vault => milestoneId => verifier => Vote
    mapping(address => mapping(uint8 => mapping(address => VerifierVote))) public votes;

    function initializeMilestone(address vault, uint8 milestoneId, bytes32 descriptionHash, uint8 requiredApprovals) external;
    function submitMilestone(address vault, uint8 milestoneId, bytes32 evidenceHash) external;
    function voteMilestone(address vault, uint8 milestoneId, bool approve, bytes32 commentHash) external;
    function isMilestoneApproved(address vault, uint8 milestoneId) external view returns (bool);
}
```

**MerchantVault change:** `releaseTranche()` adds:
```solidity
require(milestoneRegistry.isMilestoneApproved(address(this), trancheIndex + 1), "MilestoneNotApproved");
```

**New tests (~15):**
- `test_initializeMilestone_setsPending`
- `test_submitMilestone_updatesStatusAndHash`
- `test_submitMilestone_onlyMerchant`
- `test_submitMilestone_revertIfNotPending`
- `test_voteMilestone_incrementsApproval`
- `test_voteMilestone_reachesThreshold_approvesAutomatically`
- `test_voteMilestone_rejection`
- `test_voteMilestone_doubleVote_reverts`
- `test_voteMilestone_onlyVerifier`
- `test_releaseTranche_requiresMilestoneApproved`
- `test_releaseTranche_withoutMilestone_reverts`
- `test_fullFlow_submit_vote_approve_release`
- `test_multipleMilestones_perVault`
- `test_rejectedMilestone_canResubmit` (if needed)
- `test_milestoneEvents_emitted`

### 3C. Late Fee Logic (MerchantVault.sol)

**New storage:**
```solidity
uint256 public nextPaymentDue;
uint16 public lateFeeBps;
uint256 public totalLateFees;
uint8 public gracePeriodDays;
uint256 public constant REPAYMENT_INTERVAL = 30 days;
```

**New/modified functions:**
```solidity
function calculateLateFee() public view returns (uint256);
function shouldDefault() public view returns (bool);
// Modified: processRepayment() applies late fee, advances nextPaymentDue
// Modified: VaultFactory.createVault() accepts lateFeeBps + gracePeriodDays params
```

**Late fee formula (from Solana):**
```
days_late = (block.timestamp - nextPaymentDue) / 1 days
remaining = totalToRepay - totalRepaid
fee = remaining * lateFeeBps * days_late / 10000
```

**New tests (~8):**
- `test_noLateFee_whenOnTime`
- `test_lateFee_calculatedCorrectly`
- `test_lateFee_addedToTotalToRepay`
- `test_lateFee_multiplePeriodsLate`
- `test_nextPaymentDue_advancesAfterRepayment`
- `test_shouldDefault_afterGracePeriod`
- `test_shouldNotDefault_withinGracePeriod`
- `test_lateFee_zeroWhenNextPaymentDueNotSet`

### 3D. Keeper Functions

**MerchantVault.sol additions:**
```solidity
function autoCancelExpired() external;  // permissionless — anyone can call
function markDefault() external;        // permissionless when grace period passed
```

**autoCancelExpired logic:**
```solidity
require(state == VaultState.Fundraising);
require(block.timestamp > fundraisingDeadline);
require(totalRaised < targetAmount * 80 / 100);
state = VaultState.Cancelled;
```

**markDefault logic:**
```solidity
require(state == VaultState.Repaying);
require(shouldDefault());
state = VaultState.Defaulted;
```

**completeFundraisingManual():**
```solidity
function completeFundraisingManual() external onlyAdmin;
// Require: state == Fundraising, totalRaised >= 80% of target
// Effect: state = Active, calculate totalToRepay with interest
```

**New tests (~7):**
- `test_autoCancelExpired_cancelsUnderFundedVault`
- `test_autoCancelExpired_revertsIfStillActive`
- `test_autoCancelExpired_revertsIfOverThreshold`
- `test_markDefault_afterGracePeriod`
- `test_markDefault_revertsBeforeGracePeriod`
- `test_completeFundraisingManual_at80Percent`
- `test_completeFundraisingManual_revertsUnder80Percent`

**Total new tests: ~40 → Grand total: ~160 tests**

---

## 4. Backend API Specification

### 4.1 Merchant Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/merchants/register` | Register merchant on-chain (builds unsigned tx) |
| `GET` | `/api/v1/merchants/:address` | Merchant profile + credit score + stats |
| `GET` | `/api/v1/merchants/:address/vaults` | List merchant's vaults |
| `POST` | `/api/v1/merchants/:address/credit-score` | Update credit score (admin-only, builds tx) |

### 4.2 Vault Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/vaults/create` | Create vault (builds unsigned tx with all params) |
| `GET` | `/api/v1/vaults` | List vaults (filter: state, merchant, sort: raised, created) |
| `GET` | `/api/v1/vaults/:address` | Full vault detail + computed fields (APY, time remaining) |
| `GET` | `/api/v1/vaults/:address/investors` | Investor list + balances |
| `GET` | `/api/v1/vaults/:address/repayments` | Repayment history (from indexed events) |
| `GET` | `/api/v1/vaults/:address/waterfall` | Senior/pool/community breakdown |
| `GET` | `/api/v1/vaults/:address/tranches` | Tranche status + release history |
| `GET` | `/api/v1/vaults/:address/milestones` | Milestone status + vote counts |
| `POST` | `/api/v1/vaults/:address/milestone/submit` | Submit milestone evidence (merchant tx) |
| `POST` | `/api/v1/vaults/:address/milestone/vote` | Vote on milestone (verifier tx) |

### 4.3 Investment Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/invest` | Build invest tx (investor signs with wallet) |
| `POST` | `/api/v1/claim` | Build claim returns tx |
| `POST` | `/api/v1/refund` | Build claim refund tx (cancelled vaults) |
| `GET` | `/api/v1/portfolio/:address` | All investments across vaults |

### 4.4 Pool Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/pools` | List all liquidity pools |
| `GET` | `/api/v1/pools/:address` | Pool detail + allocation status |
| `POST` | `/api/v1/pools/deposit` | Build deposit tx |
| `POST` | `/api/v1/pools/allocate` | Build allocate-to-vault tx (admin) |
| `POST` | `/api/v1/pools/withdraw` | Build withdraw tx |

### 4.5 Platform Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/platform/stats` | TVL, active vaults, total repaid, investor count |
| `GET` | `/api/v1/platform/config` | Fee structure, limits, addresses |

### 4.6 Oracle Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/oracle/payment` | Receive payment event webhook |
| `GET` | `/api/v1/oracle/health` | Oracle status, queue depth, last payment per vault |

---

## 5. Database Schema (Prisma)

```prisma
model Merchant {
  address      String   @id
  name         String?
  creditScore  Int      @default(0)
  creditTier   Int      @default(0)
  scoreUpdated DateTime?
  registeredAt DateTime
  vaults       Vault[]
}

model Vault {
  address          String   @id
  merchant         Merchant @relation(fields: [merchantAddr], references: [address])
  merchantAddr     String
  targetAmount     BigInt
  totalRaised      BigInt   @default(0)
  totalRepaid      BigInt   @default(0)
  totalToRepay     BigInt   @default(0)
  interestRateBps  Int
  durationSeconds  Int
  numTranches      Int
  tranchesReleased Int      @default(0)
  state            String   @default("fundraising")
  seniorFunded     BigInt   @default(0)
  poolFunded       BigInt   @default(0)
  userFunded       BigInt   @default(0)
  totalSeniorRepaid BigInt  @default(0)
  totalPoolRepaid  BigInt   @default(0)
  nextPaymentDue   DateTime?
  lateFeeBps       Int      @default(0)
  totalLateFees    BigInt   @default(0)
  gracePeriodDays  Int      @default(7)
  createdAt        DateTime
  activatedAt      DateTime?
  investments      Investment[]
  events           VaultEvent[]
  milestones       MilestoneRecord[]
}

model Investment {
  id           String   @id @default(uuid())
  vault        Vault    @relation(fields: [vaultAddr], references: [address])
  vaultAddr    String
  investor     String
  amount       BigInt
  claimedReturns BigInt @default(0)
  investedAt   DateTime
}

model VaultEvent {
  id         String   @id @default(uuid())
  vault      Vault    @relation(fields: [vaultAddr], references: [address])
  vaultAddr  String
  eventType  String
  data       Json
  blockNumber BigInt
  txHash     String
  timestamp  DateTime
}

model MilestoneRecord {
  id             String   @id @default(uuid())
  vault          Vault    @relation(fields: [vaultAddr], references: [address])
  vaultAddr      String
  milestoneId    Int
  status         String   @default("pending")
  evidenceHash   String?
  approvalCount  Int      @default(0)
  submittedAt    DateTime?
  approvedAt     DateTime?
}

model Pool {
  address             String   @id
  admin               String
  isAlpha             Boolean
  totalDeposits       BigInt   @default(0)
  totalAllocated      BigInt   @default(0)
  maxAllocationPerVault BigInt
  paused              Boolean  @default(false)
}

model ApiKey {
  id        String   @id @default(uuid())
  key       String   @unique
  name      String
  rateLimit Int      @default(100)
  createdAt DateTime @default(now())
  active    Boolean  @default(true)
}

model OraclePayment {
  id         String   @id @default(uuid())
  vault      String
  amount     BigInt
  nonce      BigInt
  status     String   @default("pending")
  txHash     String?
  error      String?
  attempts   Int      @default(0)
  createdAt  DateTime @default(now())
  processedAt DateTime?
}
```

---

## 6. Oracle Service Detail

### Payment Flow
```
Merchant's billing system
         │
    x402 payment event
         │
         ▼
POST /api/v1/oracle/payment
    {
      vault: "0x...",
      amount: 1000000000,  // 1000 USDC (6 decimals)
      paymentSource: "invoice-12345",
      merchantAddress: "0x..."
    }
         │
         ▼
  Oracle Service:
    1. Validate: vault exists, settlement active, amount ≤ maxPayment
    2. Check rate limit: block.timestamp ≥ lastPayment + minInterval
    3. Get next nonce from DB (monotonically increasing)
    4. Sign payment proof: ECDSA(keccak256(nonce, vault, amount, source, timestamp))
    5. Build tx: PaymentRouter.executePayment(from, to, amount, nonce, deadline, signature)
    6. Submit tx to Base with gas estimation
    7. Wait for confirmation (3 blocks)
    8. Record in DB: OraclePayment { status: "confirmed", txHash }
         │
         ▼
  On failure:
    - Record error, increment attempts
    - Queue for retry (exponential backoff: 30s, 60s, 120s, 240s, max 5 attempts)
    - Alert on 3+ consecutive failures for same vault
```

### Key Security
- Oracle private key: stored in environment variable (dev) → HSM/KMS (production)
- Key rotation: `PaymentRouter.setOracle(newOracle)` by admin, then update backend config
- Never log or expose the oracle key

---

## 7. Keeper Service Detail

```javascript
// Every 5 minutes:
async function runKeeper() {
  // 1. Scan expired fundraising vaults
  const expiredVaults = await getVaultsInState("Fundraising")
    .filter(v => v.deadline < now && v.totalRaised < v.target * 80 / 100);
  for (const vault of expiredVaults) {
    await vault.autoCancelExpired(); // permissionless
  }

  // 2. Scan defaulting vaults
  const repayingVaults = await getVaultsInState("Repaying")
    .filter(v => v.shouldDefault());
  for (const vault of repayingVaults) {
    await vault.markDefault(); // permissionless
  }

  // 3. Process pool returns for completed/repaying vaults
  // (check WaterfallDistributed events → credit pool allocations)
}
```

All calls are idempotent — if the vault is already cancelled/defaulted, the tx reverts harmlessly.

---

## 8. Frontend Integration Spec

### Wallet Provider Switch
```
REMOVE: @solana/wallet-adapter-*
ADD:    wagmi, viem, @web3modal/wagmi (or @rainbow-me/rainbowkit)
CHAIN:  Base Sepolia (chainId: 84532) → Base Mainnet (chainId: 8453)
```

### Data Source Replacement

| Page | Current Source | New Source |
|---|---|---|
| Home | Mock stats | `GET /api/v1/platform/stats` |
| Vaults | `lib/mockData.ts` | `GET /api/v1/vaults` |
| VaultDetail | Mock vault | `GET /api/v1/vaults/:address` + `/waterfall` + `/milestones` |
| Portfolio | Mock portfolio | `GET /api/v1/portfolio/:address` |
| MerchantDashboard | Mock merchant | `GET /api/v1/merchants/:address` + `/vaults` |
| LiquidityPools | Mock pools | `GET /api/v1/pools` |
| X402Demo | `lib/x402MockData.ts` | `GET /api/v1/oracle/health` + WebSocket events |

### Transaction Flows (wallet signing)
- **Invest**: User clicks "Invest" → API returns unsigned tx → wagmi `useSendTransaction` → confirm
- **Claim**: Similar flow with `claim_returns` tx
- **Create Vault**: Merchant fills form → API returns `createVault` tx → sign
- **Deposit to Pool**: LP fills amount → API returns `deposit` tx → sign

---

## 9. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Smart Contracts | Solidity 0.8.24, Foundry, OpenZeppelin | 5 existing + 1 new (MilestoneRegistry) |
| Chain | Base L2 | Sepolia testnet → Mainnet |
| Backend | Node.js 20+, Express, TypeScript | API-first architecture |
| Database | PostgreSQL 15+ via Prisma | Events, vaults, merchants, API keys |
| Oracle | ethers.js v6, ECDSA | Webhook → sign → submit → retry |
| Frontend | Vite, React 18, wagmi, viem | Replace Solana wallet with EVM wallet |
| Styling | TailwindCSS, shadcn/ui | Already in place |
| State | Zustand | Already scaffolded |
| Indexer | ethers.js WebSocket | Event subscription → PostgreSQL |
| API Auth | API keys + rate limiting | For external protocol integration |
| Docs | OpenAPI/Swagger | Auto-generated from routes |

---

## 10. Deployment Pipeline

### Testnet (Base Sepolia)
```bash
# 1. Deploy contracts
cd base-contracts
forge script script/Deploy.s.sol --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast --verify

# 2. Post-deploy wiring
# (setFactory, setPaymentRouter called in Deploy.s.sol)

# 3. Start backend
cd backend
npm install
npx prisma migrate dev
npm run dev

# 4. Start frontend
cd frontend
npm install
npm run dev
```

### Production (Base Mainnet)
- Same Deploy.s.sol with mainnet RPC + real USDC address
- Backend on Railway/Fly.io/AWS
- PostgreSQL on managed instance (Neon/Supabase/RDS)
- Frontend on Vercel (already has `.vercel` config)
- Oracle key in AWS KMS / GCP Secret Manager
