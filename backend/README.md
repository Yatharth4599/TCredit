# TigerPay Backend

## Tech Stack
- **Runtime**: Node.js (v18+) / Bun
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Cache**: Redis
- **Queue**: BullMQ
- **API**: REST + WebSocket (for React frontend)

## Directory Structure
```
backend/
├── src/
│   ├── api/               # API routes
│   │   ├── routes/        # Route definitions
│   │   ├── controllers/   # Request handlers
│   │   └── middleware/    # Auth, validation, etc.
│   ├── services/          # Business logic
│   │   ├── vault.service.ts
│   │   ├── investor.service.ts
│   │   ├── merchant.service.ts
│   │   └── icm.service.ts
│   ├── solana/            # On-chain interactions
│   │   ├── client.ts      # Solana connection
│   │   ├── instructions/  # TX builders
│   │   └── listeners/     # Event listeners
│   ├── db/
│   │   ├── models/        # Database models
│   │   └── migrations/    # SQL migrations
│   ├── jobs/              # Background jobs
│   │   ├── sync-vaults.ts
│   │   └── process-events.ts
│   ├── utils/
│   └── types/
├── tests/
└── package.json
```

## Key Services
- **Vault Service**: Vault CRUD, state management
- **Investor Service**: Portfolio tracking, claims
- **Merchant Service**: KYC, vault creation
- **ICM Service**: Equity offerings, dividends
- **Indexer**: Sync on-chain events to DB
