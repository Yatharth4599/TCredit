# TCredit / TigerPay - Programmable Credit Network

## Project Overview

A DeFi lending protocol on Base (Sepolia testnet) that enables revenue-backed lending for merchants. Merchants can create vaults, investors can fund them, and repayments are routed automatically on-chain.

## Architecture

### Frontend (`/frontend`)
- React + TypeScript + Vite
- Tailwind CSS + Radix UI + shadcn components
- wagmi + RainbowKit for wallet connectivity (Base Sepolia)
- React Query for data fetching
- Runs on port **5000**

### Backend (`/backend`)
- Node.js + Express + TypeScript
- Prisma ORM with PostgreSQL
- Indexes blockchain events from Base Sepolia
- Background services: event indexer, keeper, webhook processor, oracle retry
- Runs on port **3001**

### Smart Contracts (`/base-contracts`)
- Solidity contracts (Foundry)
- Deployed on Base Sepolia
- Contracts: AgentRegistry, LiquidityPool, MerchantVault, MilestoneRegistry, PaymentRouter, VaultFactory

### SDK (`/sdk`)
- TypeScript SDK for interacting with the protocol

## Development Setup

### Workflows
- **Start application**: `cd frontend && npm run dev` (port 5000, webview)
- **Backend API**: `cd backend && npm run dev` (port 3001, console)

### Environment Variables
- `DATABASE_URL` - PostgreSQL connection (Replit managed)
- `BASE_RPC_URL` - Base Sepolia RPC endpoint
- `CHAIN_ID` - 84532 (Base Sepolia)
- Contract addresses: `AGENT_REGISTRY_ADDRESS`, `PAYMENT_ROUTER_ADDRESS`, `VAULT_FACTORY_ADDRESS`, `SENIOR_POOL_ADDRESS`, `GENERAL_POOL_ADDRESS`, `MILESTONE_REGISTRY_ADDRESS`, `USDC_ADDRESS`
- `PORT` - Backend port (3001)
- `VITE_API_URL` - Frontend API URL (set to `/api` for Vite proxy)
- `ORACLE_PRIVATE_KEY` - Optional: private key for oracle tx submission

### Frontend-to-Backend Connectivity
The frontend uses a Vite proxy to route `/api` requests to `localhost:3001`. This avoids CORS issues in the Replit environment.

### Database
- Replit PostgreSQL (heliumdb)
- Prisma schema in `backend/prisma/schema.prisma`
- Models: Merchant, Vault, Investment, VaultEvent, IndexerState, MilestoneRecord, Pool, WebhookEndpoint, WebhookDelivery, OraclePayment

## Key Files
- `frontend/vite.config.ts` - Vite config with host, port, proxy settings
- `backend/src/config/env.ts` - Backend env validation (Zod)
- `backend/src/app.ts` - Express app setup
- `backend/src/index.ts` - Server entry point + background services
- `base-contracts/deployments/contracts.ts` - ABI exports (copied to backend on dev/build)

## Frontend Animations
- `frontend/src/components/ui/TigerCanvas.tsx` - Animated pixel tiger with blink, roar, nostril smoke, particles, post-roar shockwave
- `frontend/src/components/ui/AnimatedPixelIcons.tsx` - Animated pixel-art icons for Problem section: AnimatedCoinStackIcon (toppling coins), AnimatedVaultIcon (slamming vault door), AnimatedLockIcon (glitching padlock)
- `frontend/src/components/ui/ProblemBackground.tsx` - Themed background canvas behind problem cards: falling coins (card 0), rotating gears/rings (card 1), glitch scanlines/pixels (card 2); cross-fades between themes
- Problem section uses a single-card carousel with auto-advance every 4s and dot navigation
