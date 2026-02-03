# TigerPay Frontend

## Tech Stack
- **Framework**: React 18 with Vite
- **Routing**: React Router v6
- **Styling**: TailwindCSS + shadcn/ui
- **Web3**: @solana/web3.js + @solana/wallet-adapter-react
- **State**: Zustand
- **API**: Axios + React Query

## Directory Structure
```
frontend/
├── src/
│   ├── components/
│   │   ├── ui/            # Reusable UI components (shadcn)
│   │   ├── vault/         # Vault-specific components
│   │   ├── icm/           # ICM/Equity components
│   │   ├── wallet/        # Wallet connection
│   │   └── layout/        # Layout components
│   ├── pages/
│   │   ├── Home.tsx
│   │   ├── Vaults.tsx
│   │   ├── VaultDetail.tsx
│   │   ├── MerchantDashboard.tsx
│   │   ├── ICM.tsx
│   │   └── Portfolio.tsx
│   ├── hooks/             # Custom React hooks
│   │   ├── useVault.ts
│   │   ├── useInvestment.ts
│   │   ├── useSolana.ts
│   │   └── useWallet.ts
│   ├── lib/
│   │   ├── solana/        # Solana program interactions
│   │   ├── api/           # API client
│   │   └── utils.ts
│   ├── store/             # Zustand stores
│   ├── types/             # TypeScript types
│   ├── App.tsx
│   └── main.tsx
├── public/                # Static assets
└── index.html
```

## Key Routes
- `/` - Landing page
- `/vaults` - Browse active vaults
- `/vaults/:id` - Vault details + invest
- `/merchant` - Merchant dashboard
- `/icm` - ICM/Equity offerings
- `/portfolio` - Investor portfolio

## Setup
```bash
npm create vite@latest . -- --template react-ts
npm install
npm run dev
```
