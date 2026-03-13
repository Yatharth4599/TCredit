# Krexa Backend

Express + TypeScript + Prisma 6 + viem — REST API for the Krexa programmable credit protocol.

## Stack

| Technology | Role |
|---|---|
| Express.js | HTTP server + routing |
| TypeScript | Type safety throughout |
| Prisma 6 | ORM for PostgreSQL |
| PostgreSQL 16 | Primary database |
| viem | Base Sepolia chain reads + tx building |
| zod | Environment variable validation |

## Directory Structure

```
backend/
├── src/
│   ├── api/
│   │   ├── routes/            # 8 route files mounted at /api/v1/
│   │   │   ├── health.ts      # GET /health — DB + chain verification
│   │   │   ├── vaults.ts      # CRUD + waterfall, tranches, milestones, repayments
│   │   │   ├── merchants.ts   # Profile, vaults, stats, register, credit-score
│   │   │   ├── pools.ts       # List, detail, deposit, withdraw, allocate
│   │   │   ├── platform.ts    # Stats, config, indexer status, keeper status
│   │   │   ├── investments.ts # invest, claim, refund, portfolio
│   │   │   ├── payments.ts    # Payment operations
│   │   │   └── oracle.ts      # ECDSA sign + submit, health, payment list
│   │   └── middleware/
│   │       └── error.ts       # AppError + global error handler
│   ├── chain/                 # viem wrappers for on-chain reads
│   │   ├── client.ts          # publicClient + oracleAccount + walletClient
│   │   ├── agentRegistry.ts
│   │   ├── paymentRouter.ts
│   │   ├── vaultFactory.ts
│   │   ├── merchantVault.ts
│   │   ├── liquidityPool.ts
│   │   └── milestoneRegistry.ts
│   ├── services/
│   │   ├── vault.service.ts   # formatVault, listAllVaults, pagination
│   │   └── oracle.service.ts  # ECDSA sign, submit, exponential retry queue
│   ├── indexer/
│   │   └── indexer.ts         # getLogs polling (15s / 2000 blocks), 12 event types
│   ├── keeper/
│   │   └── keeper.ts          # autoCancelExpired, markDefault, deactivateSettlement
│   └── config/
│       ├── env.ts             # Zod-validated environment variables
│       ├── contracts.ts       # Deployed addresses + ABIs
│       └── abis.ts            # ABI definitions
├── prisma/
│   ├── schema.prisma          # 11 models
│   └── migrations/
├── docker-compose.yml         # PostgreSQL 16
└── package.json
```

## Quick Start

```bash
# 1. Start PostgreSQL
docker compose up -d

# 2. Install deps + generate Prisma client
npm install
npx prisma generate

# 3. Run migrations
npx prisma migrate dev

# 4. Start server (development)
npx tsx src/index.ts
```

Server starts on `http://localhost:3001`

## Environment Variables

Create `.env` (see `.env.example`):

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tcredit"
BASE_SEPOLIA_RPC_URL="https://sepolia.base.org"
ORACLE_PRIVATE_KEY="0x..."   # Deployer/oracle wallet private key
PORT=3001
```

## API Design

**All write endpoints return unsigned transactions:**
```json
{ "to": "0x...", "data": "0x..." }
```

The frontend signs these with the connected wallet via wagmi. The backend never holds user private keys.

**All routes under `/api/v1/` with `/api/` backward-compat alias.**

## Background Services

### Event Indexer
- Polls `publicClient.getLogs()` every 15 seconds
- Processes 2000 blocks per poll
- Decodes 12 event types across all 6 contracts
- Updates denormalized `Vault`, `Merchant`, `Investment` tables
- Backtracks from deployment block `38,200,000` on first run
- `IndexerState` table preserves `lastIndexedBlock` across restarts
- Idempotent: unique constraint on `(txHash, logIndex)` — safe to replay

**Events indexed:** `VaultCreated`, `Invested`, `TrancheReleased`, `RepaymentProcessed`, `WaterfallDistributed`, `VaultDefaulted`, `VaultStateChanged`, `AllocatedToVault`, `CreditScoreUpdated`, `MilestoneSubmitted`, `MilestoneApproved`, `PaymentExecuted`

### Keeper / Crank Service
Runs every 5 minutes:
1. Scans `fundraising` vaults → simulates `autoCancelExpired()` → submits if eligible
2. Scans `repaying` vaults → checks `shouldDefault()` view → submits `markDefault()` if true
3. On default: calls `PaymentRouter.deactivateSettlement(agent)` — stops x402 routing to defaulted vault

All calls simulate before submit (reverts skipped silently — idempotent).

### Oracle Service
Processes x402 payment webhooks:
1. Validate: vault exists, settlement active, amount ≤ max, rate limit respected
2. Nonce: monotonically increasing per sender, stored in `OraclePayment` DB
3. Sign: `keccak256(nonce, vault, amount, source, timestamp)` via ECDSA
4. Submit: `PaymentRouter.executePayment()` with gas estimation + simulation
5. Wait: 3 block confirmations
6. Retry: exponential backoff — 30s → 60s → 120s → 240s (max 5 attempts)
7. Expiry: payments past deadline are expired instead of retried

## Database Models

| Model | Description |
|---|---|
| `Merchant` | Agent profile — `address`, `creditScore`, `creditTier`, `scoreUpdated` |
| `Vault` | Vault snapshot — all lifecycle fields, denormalized from events |
| `Investment` | Per-investor position — `amount`, `claimedReturns`, `vaultAddr`, `investor` |
| `VaultEvent` | Raw event log — `eventType`, `data JSON`, `blockNumber`, `txHash`, `logIndex` |
| `IndexerState` | Singleton — `lastBlock` for resume-on-restart |
| `MilestoneRecord` | Per-tranche milestone — `status`, `evidenceHash`, `approvalCount` |
| `Pool` | Pool snapshot — `totalDeposits`, `totalAllocated`, `paused` |
| `OraclePayment` | Payment queue — `status`, `txHash`, `attempts`, `nextRetryAt`, `deadline` |
| `WebhookEndpoint` | Registered webhook URLs with event subscriptions |
| `WebhookDelivery` | Delivery log with status + retry state |
| `ApiKey` | API key registry with per-key rate limits |

## Deployed Contracts (Base Sepolia)

| Contract | Address |
|---|---|
| AgentRegistry | `0xAEa7C5CCACebB1423b163b765d3214752f1496A4` |
| PaymentRouter | `0xf8A5ED433222dFfb9514637243C3599cCE87f977` |
| VaultFactory | `0xf8fDa17F877dEFFCD80784E0465F33d585644360` |
| SeniorPool | `0xDf980d0734b00888e4Ac350027515B4D6E473bBa` |
| GeneralPool | `0x7E7D8082572C0AD2f51074D272A501180Db06Fb2` |
| MilestoneRegistry | `0x48a471eEB88f84a867bEBC0f6DFF848660BC8c84` |
