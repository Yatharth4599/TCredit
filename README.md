# Krexa — On-Chain Credit for AI Agents

**Chain:** Solana Devnet · **Status:** Live · **Frontend:** [krexa-dashboard.vercel.app](https://krexa-dashboard.vercel.app) · **API:** [tcredit-backend.onrender.com](https://tcredit-backend.onrender.com)

Krexa is a **programmable credit network for AI agents on Solana**. AI agents get their own on-chain identity, a credit score (KrexitScore), a PDA-based spending wallet, and a credit line backed by LP liquidity. No human co-signer. Credit decisions are made by an oracle that reads on-chain behaviour.

> **Core insight: AI agents are the next class of borrowers. They transact on-chain, their behaviour is fully auditable, and their repayment can be structurally enforced — no trust required.**

---

## Live Deployment — Solana Devnet

### Programs

| Program | Address |
|---|---|
| Agent Registry | `ChJjAXy7sE4d4jst9VViG7ScanVKqH9Q1cFxtdcH78cG` |
| Agent Wallet | `35t8yWLsUZNTLT71ej7DF59P81HrtZTx2uZeMhwuhhf6` |
| Credit Vault | `26SQx3rAyujWCupxvPAMf9N3ok4cw1awyTWAVWDQfr9N` |
| Credit Router | `2Zy3d7C28Z9dfazdysKVBQUXnvvWNshxtDEFKftG83u8` |
| KrexitScore | `2GwtAXnjY5LehfZfT77ZH3XSshwbni8LP9zXeA84WUqh` |
| Service Plan | `Eqc48c6TtKAPRosTMoC6Nasi85iqdLuzwbu6WBrsPFdt` |
| Venue | `HyWQrHG14Sw6KpKYSMiBDmVj5u7PXfLWvim6FHbBLmua` |

### Infrastructure

| Service | URL |
|---|---|
| Frontend (Vercel) | `https://krexa-dashboard.vercel.app` |
| Backend API (Render) | `https://tcredit-backend.onrender.com` |
| USDC Mint (devnet) | `H2SYsnzdRXrXpHpcDkedARksoxiQLGXjtAvkJg158ETP` |
| Oracle Pubkey | `DsPPrsGWzZdiFVMLPfdYEQnkWaRV94uvH3RnNvgbj5tS` |

---

## How It Works

### The Agent Credit Lifecycle

```
1. REGISTER        — AI agent registers on-chain with a name, type (Trader/Service/Hybrid), and owner wallet
2. SCORE           — KrexitScore oracle reads on-chain behaviour and writes a credit score (200–850) to a PDA
3. CREATE WALLET   — Agent gets a PDA-based credit wallet with a daily spending limit
4. DEPOSIT         — Agent deposits USDC collateral into the vault, improving their health factor
5. REQUEST CREDIT  — Agent + oracle co-sign a request_credit transaction; credit line is opened on-chain
6. SPEND           — Agent draws from the credit line via the router; USDC moves to agent's token account
7. REPAY           — Agent repays principal + interest; credit line resets
```

### KrexitScore

Every agent has a **KrexitScore** (200–850) stored in a PDA derived from their AgentProfile. The score is computed by the oracle daemon from transaction volume, repayment history, collateral ratio, and account age.

Unregistered wallets get a **preview score** based on raw Solana activity (tx count, wallet age, SOL balance) — visible on the Score Lookup page without any registration.

### PDA Wallets

The agent-wallet program creates a **Program Derived Address** wallet for each agent. This account has no private key — it is controlled entirely by the program. The agent's owner wallet signs transactions to authorize draws and repayments. The program verifies the owner signature, checks credit limit and health factor, then moves USDC. LP funds live in the vault's token account and flow to the agent's PDA on successful credit requests.

### Oracle Co-Signing

Credit requests require **two signatures** on the same transaction:
1. **Agent (owner wallet)** — proves the agent consents to the draw
2. **Oracle** — proves Krexa approved the credit based on current score and collateral

The backend `/solana/oracle/sign-credit` endpoint handles the oracle's partial signature. The frontend collects both signatures and submits the completed transaction to devnet.

### LP Vault

Liquidity providers deposit USDC into the Credit Vault. The vault has three tranches — senior, mezzanine, junior — with different risk/return profiles. LP positions are tracked as on-chain `DepositPosition` PDAs. Interest is distributed pro-rata on repayment. Utilisation is capped by `utilization_cap_bps` to protect LPs.

---

## Project Structure

```
krexa/
├── solana-programs/         # 7 Anchor programs (Rust)
│   ├── krexa-agent-registry/     # Agent identity + credit profile
│   ├── krexa-agent-wallet/       # PDA wallets + credit lines + spending
│   ├── krexa-credit-vault/       # LP vault + tranche deposits
│   ├── krexa-credit-router/      # Payment routing
│   ├── krexa-krexit-score/       # On-chain credit score PDAs
│   ├── krexa-service-plan/       # Service plan registry
│   └── krexa-venue/              # Venue program
│
├── app/                     # Vite + React + @solana/wallet-adapter
│   └── src/
│       ├── pages/
│       │   ├── LandingPage.tsx        # Public landing page
│       │   ├── Dashboard.tsx          # Agent dashboard (profile, wallet, credit, faucet)
│       │   ├── CreditPage.tsx         # Request credit + repay
│       │   ├── LPPage.tsx             # LP deposit + withdraw
│       │   ├── VaultPage.tsx          # Vault stats
│       │   └── ScoreLookupPage.tsx    # Look up any wallet's KrexitScore
│       ├── hooks/
│       │   ├── useAgentProfile.ts     # Fetch on-chain AgentProfile PDA
│       │   ├── useAgentWallet.ts      # Fetch on-chain AgentWallet PDA
│       │   ├── useCreditLine.ts       # Fetch on-chain CreditLine PDA
│       │   ├── useVaultStats.ts       # Vault config + utilisation
│       │   ├── useScoreLookup.ts      # On-chain score + preview fallback
│       │   ├── useFaucet.ts           # Devnet USDC faucet
│       │   ├── useRegisterAgent.ts    # Register agent transaction
│       │   ├── useCreateWallet.ts     # Create PDA wallet transaction
│       │   ├── useDepositCollateral.ts
│       │   ├── useRepay.ts
│       │   ├── useDepositLP.ts
│       │   └── useWithdrawLP.ts
│       └── sdk/
│           ├── client.ts              # Borsh deserializers for all on-chain accounts
│           ├── pda.ts                 # PDA derivation helpers
│           ├── transactions.ts        # Transaction builders
│           └── types.ts               # TypeScript interfaces matching Rust structs
│
├── backend/                 # Express + TypeScript + Prisma
│   └── src/
│       ├── api/routes/
│       │   ├── solana-oracle.routes.ts    # POST /solana/oracle/sign-credit
│       │   ├── solana-score.routes.ts     # GET /solana/score/:agent
│       │   ├── solana-faucet.routes.ts    # POST /solana/faucet/usdc
│       │   ├── agent-wallet.routes.ts     # Agent wallet state
│       │   ├── agent-credit.routes.ts     # Credit eligibility
│       │   └── solana-vault.routes.ts     # Vault stats
│       ├── chain/solana/
│       │   ├── connection.ts          # Solana RPC connection
│       │   ├── programs.ts            # Program IDs + PDA helpers
│       │   └── builder.ts             # Transaction instruction builders
│       └── services/
│           └── credit-score.ts        # Credit scoring logic
│
└── oracle/                  # Score updater daemon (Node.js)
    └── src/
        └── scoring/
            ├── updater.ts         # Polls registry, computes scores, writes PDAs
            └── fetcher.ts         # Fetches on-chain agent data
```

---

## API Reference

Base URL: `https://tcredit-backend.onrender.com/api/v1`

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check — status, db, chain |
| GET | `/solana/score/:agent` | KrexitScore for any wallet. On-chain if registered, preview if not |
| POST | `/solana/faucet/usdc` | Mint test USDC on devnet (10 USDC default, 100 max, 24h rate limit per address) |
| POST | `/solana/oracle/sign-credit` | Oracle partial-sign for request_credit transaction |
| GET | `/solana/vault` | Vault config, utilisation, tranche stats |
| GET | `/solana/wallets/:agent` | Agent wallet state |
| GET | `/solana/credit/:agent/eligibility` | Credit eligibility check |

### Faucet Example

```bash
curl -X POST https://tcredit-backend.onrender.com/api/v1/solana/faucet/usdc \
  -H "Content-Type: application/json" \
  -d '{"recipient":"YOUR_DEVNET_PUBKEY","amountUsdc":10}'
```

```json
{
  "signature": "5PBQiJ...",
  "ata": "Dn2gXrMD...",
  "amountUsdc": 10,
  "mint": "H2SYsnzd...",
  "explorerUrl": "https://explorer.solana.com/tx/5PBQiJ...?cluster=devnet"
}
```

### Score Lookup Example

```bash
curl https://tcredit-backend.onrender.com/api/v1/solana/score/YOUR_WALLET
```

```json
{
  "score": 480,
  "source": "preview",
  "isRegistered": false,
  "preview": {
    "walletAge": 120,
    "txActivity": 80,
    "solBalance": 30
  }
}
```

---

## Local Development

### Prerequisites

- Rust + Anchor CLI (`cargo install --git https://github.com/coral-xyz/anchor anchor-cli`)
- Node.js ≥ 20
- Solana CLI (`sh -c "$(curl -sSfL https://release.solana.com/stable/install)"`)
- Docker (for PostgreSQL)

### Frontend

```bash
cd app
npm install
cp .env.example .env
# Set VITE_API_URL=http://localhost:3001
npm run dev     # http://localhost:5173
```

### Backend

```bash
cd backend
npm install
cp .env.example .env
# Set DATABASE_URL, SOLANA_RPC_URL, SOLANA_ORACLE_PRIVATE_KEY, SOLANA_FAUCET_PRIVATE_KEY
docker compose up -d
npx prisma generate && npx prisma migrate dev
npm run dev     # http://localhost:3001
```

### Oracle Daemon

```bash
cd oracle
npm install
cp .env.example .env
# Set SOLANA_ORACLE_PRIVATE_KEY, SOLANA_SCORE_PROGRAM_ID
npm start
```

### Environment Variables

**Backend (key ones)**

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SOLANA_RPC_URL` | Solana RPC endpoint (default: devnet) |
| `SOLANA_ORACLE_PRIVATE_KEY` | Oracle keypair — bs58 string or JSON byte array |
| `SOLANA_FAUCET_PRIVATE_KEY` | Faucet mint authority — bs58 string or JSON byte array |
| `SOLANA_USDC_MINT` | USDC mint address |
| `SOLANA_REGISTRY_PROGRAM_ID` | Agent registry program ID |
| `SOLANA_WALLET_PROGRAM_ID` | Agent wallet program ID |
| `SOLANA_VAULT_PROGRAM_ID` | Credit vault program ID |
| `CORS_ORIGIN` | Allowed frontend origin (comma-separated) |

---

## Full User Journey (Devnet)

1. Open [krexa-dashboard.vercel.app](https://krexa-dashboard.vercel.app) and connect Phantom (set to devnet)
2. On the Dashboard — click **"Get 10 Test USDC"** to fund your wallet via the faucet
3. Click **"Register Agent"** — give your agent a name and type, sign the transaction
4. Click **"Create Wallet"** — sets up your agent's PDA spending wallet on-chain
5. Go to the **Credit page** — deposit USDC collateral, then click **"Request Credit"**
6. The backend oracle evaluates your score and co-signs; the credit line opens
7. Visit **/score/YOUR_WALLET** to see any wallet's KrexitScore (registered or not)
8. Go to **LP** to deposit USDC as a liquidity provider and earn yield

---

## Roadmap

| Phase | Description | Status |
|---|---|---|
| 1 | 7 Anchor programs written, tested, deployed to devnet | ✅ Complete |
| 2 | Backend API — agent, wallet, vault, oracle, score, faucet | ✅ Complete |
| 3 | Frontend — full agent lifecycle with Solana wallet adapter | ✅ Complete |
| 4 | Borsh deserializers — TypeScript structs matching deployed Rust | ✅ Complete |
| 5 | Oracle co-signing — two-party request_credit flow | ✅ Complete |
| 6 | Score anyone — preview scores for unregistered wallets | ✅ Complete |
| 7 | Devnet USDC faucet — in-app + API | ✅ Complete |
| 8 | Mainnet deployment + production RPC | ⬜ Pending |
| 9 | Agent SDK — npm package for AI agents to self-register and draw credit | ⬜ Pending |
| 10 | Credit bureau — cross-protocol reputation aggregation | ⬜ Pending |

---

## Links

- **App:** [krexa-dashboard.vercel.app](https://krexa-dashboard.vercel.app)
- **API:** [tcredit-backend.onrender.com](https://tcredit-backend.onrender.com)
- **Solana Explorer (devnet):** [explorer.solana.com/?cluster=devnet](https://explorer.solana.com/?cluster=devnet)
- **Devnet SOL Faucet:** [faucet.solana.com](https://faucet.solana.com)

---

*Krexa — Programmable Credit for AI Agents on Solana*
