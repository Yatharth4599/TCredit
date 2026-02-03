# TigerPay Frontend

## Tech Stack (Recommended)
- **Framework**: Next.js 14 with App Router
- **Styling**: TailwindCSS + shadcn/ui
- **Web3**: @solana/web3.js + @solana/wallet-adapter
- **State**: Zustand or Jotai
- **API**: tRPC or REST

## Directory Structure
```
frontend/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Auth routes (login, signup)
│   ├── (dashboard)/       # Protected dashboard routes
│   │   ├── vaults/        # Vault management
│   │   ├── investments/   # Investor dashboard
│   │   └── icm/           # ICM/Equity dashboard
│   ├── api/               # API routes
│   └── layout.tsx
├── components/
│   ├── ui/                # Reusable UI components
│   ├── vault/             # Vault-specific components
│   ├── icm/               # ICM components
│   └── wallet/            # Wallet connection
├── hooks/                 # Custom React hooks
│   ├── useVault.ts
│   ├── useInvestment.ts
│   └── useSolana.ts
├── lib/                   # Utilities
│   ├── solana/            # Solana program interactions
│   ├── api/               # API client
│   └── utils.ts
├── types/                 # TypeScript types
└── public/                # Static assets
```

## Key Pages
- `/` - Landing page
- `/vaults` - Browse active vaults
- `/vaults/[id]` - Vault details + invest
- `/merchant` - Merchant dashboard
- `/icm` - ICM/Equity offerings
- `/portfolio` - Investor portfolio
