# TigerPayX — Base Contracts (x402 M2M Protocol)

Solidity smart contracts for the TigerPayX x402 machine-to-machine AI agent payment protocol on **Base network**.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Agent A (payer)  ──HTTP 402──▶  Agent B (service provider) │
│       │                              │                      │
│       └──── executePayment() ────────┘                      │
│                    │                                        │
│            PaymentRouter                                    │
│            ┌───────┴───────┐                                │
│         85% net         15% repayment                       │
│            │               │                                │
│        Agent B      MerchantVault                           │
│                    ┌───────┴───────┐                        │
│                 Waterfall Distribution                       │
│              Senior → Pool → Community                       │
└─────────────────────────────────────────────────────────────┘
```

## Contracts

| Contract | Description |
|---|---|
| `AgentRegistry.sol` | Permissionless AI agent identity & stats |
| `PaymentRouter.sol` | x402 payment execution, ECDSA sig verify, nonce replay protection, auto-split |
| `MerchantVault.sol` | Per-agent credit line with waterfall repayment |
| `VaultFactory.sol` | CREATE2 deployer + platform config |
| `LiquidityPool.sol` | LP capital management (senior & general) |

### Libraries

| Library | Description |
|---|---|
| `WaterfallLib.sol` | Pure waterfall math: Senior → Pool → Community |
| `SignatureLib.sol` | ECDSA x402 payment proof verification |
| `Errors.sol` | Custom errors for all contracts |

## Quick Start

```bash
# Install dependencies
forge install

# Build
forge build

# Run tests (35 tests including full E2E)
forge test -v

# Run specific test
forge test --match-contract E2ETest -vvv

# Gas report
forge test --gas-report
```

## Deploy

```bash
# Copy env
cp .env.example .env
# Fill in DEPLOYER_PRIVATE_KEY, ORACLE_ADDRESS, etc.

# Deploy to Base Sepolia
forge script script/Deploy.s.sol --rpc-url base-sepolia --broadcast --verify

# Deploy to Base Mainnet
forge script script/Deploy.s.sol --rpc-url base --broadcast --verify
```

## x402 Payment Flow (TranslateBot Example)

1. **Register**: TranslateBot calls `registry.registerAgent("ipfs://metadata")`
2. **Create Vault**: Admin creates a $50K credit vault via `factory.createVault()`
3. **Fund**: Senior pool allocates $40K, community invests $10K → vault auto-activates
4. **Release**: Admin releases tranches to TranslateBot for working capital
5. **Pay**: ShopBot calls `router.executePayment()` to pay TranslateBot
   - 15% auto-routed to vault as repayment
   - 85% goes directly to TranslateBot
6. **Waterfall**: Repayment flows Senior → Pool → Community (strict priority)
7. **Claim**: Investors call `vault.claimReturns()` for pro-rata distributions

## Test Coverage

- **Waterfall.t.sol** — 8 tests including fuzz testing
- **AgentRegistry.t.sol** — 7 tests (registration, auth, linking)
- **MerchantVault.t.sol** — 8 tests (invest, activate, repay, cancel, pause)
- **PaymentRouter.t.sol** — 5 tests (settlements, replay protection, signatures)
- **LiquidityPool.t.sol** — 6 tests (deposit, withdraw, allocate, limits)
- **E2E.t.sol** — 1 full integration test (complete TranslateBot demo flow)

## Configuration

- **Solidity**: 0.8.24
- **EVM**: Cancun
- **USDC (Base)**: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- **USDC (Base Sepolia)**: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`

## License

MIT
