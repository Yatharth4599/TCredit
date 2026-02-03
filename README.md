# TigerPay Tokenized Debt Protocol - Smart Contracts

## Overview
Blockchain-based BNPL/Lending platform with tokenized debt securities for UAE merchants.

## Project Structure
```
contracts/
├── DebtToken.sol           # ERC-20 debt token representing vault shares
├── MerchantVault.sol       # Core vault managing fundraising and repayments
├── VaultFactory.sol        # Factory for deploying new vaults
├── MilestoneOracle.sol     # Oracle for milestone verification
└── PaymentProcessor.sol    # Repayment processing and distribution

test/
├── DebtToken.test.ts
├── MerchantVault.test.ts
├── VaultFactory.test.ts
├── MilestoneOracle.test.ts
└── PaymentProcessor.test.ts

scripts/
└── deploy.ts               # Deployment scripts

deploy/
└── (network-specific deployment data)
```

## Technology Stack
- **Solidity**: 0.8.24
- **Framework**: Hardhat with TypeScript
- **Libraries**: OpenZeppelin Contracts
- **Testing**: Hardhat Toolbox (Ethers, Chai, etc.)
- **Networks**: Polygon, Base (L2s for low gas costs)

## Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your RPC endpoints and API keys
```

### 3. Compile Contracts
```bash
npx hardhat compile
```

### 4. Run Tests
```bash
npx hardhat test
```

### 5. Test Coverage
```bash
npx hardhat coverage
```

### 6. Deploy to Testnet
```bash
npx hardhat run scripts/deploy.ts --network polygonMumbai
```

## Contract Architecture

### DebtToken (ERC-20 Variant)
- Represents fractional ownership of merchant debt
- Each vault has unique debt tokens
- Includes transfer restrictions and investor whitelisting
- Pausable for emergencies
- Burnable for repayment scenarios

### MerchantVault
**States**: FUNDRAISING → ACTIVE → REPAYING → COMPLETED → DEFAULTED

**Key Functions**:
- `invest()` - Investors deposit funds, receive debt tokens
- `releaseTranche()` - Release funds to merchant upon milestone verification
- `makeRepayment()` - Merchant makes installment payment
- `claimReturns()` - Investors claim their proportional returns

### VaultFactory
- Uses EIP-1167 minimal proxy pattern for gas-efficient deployment
- Maintains registry of all vaults
- Allows vault template upgrades

### MilestoneOracle
- Multi-signature milestone verification
- Integrates with off-chain TigerPay data
- Dispute resolution mechanism
- Chainlink backup integration

### PaymentProcessor
- Tracks repayment schedules
- Calculates late payment penalties
- Handles early repayment bonuses
- Automatic distribution to token holders

## Security Features
- ✅ OpenZeppelin audited base contracts
- ✅ ReentrancyGuard on all fund transfers
- ✅ Role-based access control (RBAC)
- ✅ Pausable emergency stops
- ✅ Multi-signature for critical operations
- ✅ Time-locks on state transitions
- ✅ Input validation and bounds checking

## Testing Strategy
- Unit tests for all contracts (target: 95%+ coverage)
- Integration tests for contract interactions
- Fuzzing tests with Echidna
- Gas optimization analysis
- Security audit with Slither
- Manual code review

## Deployment Workflow

### Testnet (Polygon Mumbai or Sepolia)
1. Deploy VaultFactory
2. Deploy template contracts
3. Initialize factory with templates
4. Create test vaults
5. Validate full lifecycle

### Mainnet (Polygon or Base)
1. Final security audit
2. Deploy to mainnet
3. Verify contracts on explorer
4. Configure multi-sig ownership
5. Transfer ownership to multi-sig
6. Monitor with Tenderly

## Gas Optimization
- Use L2 networks (Polygon, Base) for low fees
- Claim-based distribution to avoid high gas on auto-distribution
- Minimal proxy pattern for vault deployment
- Optimized storage patterns
- **Target**: < $5 per transaction

## Development Status

### Phase 0: Foundation ✅
- [x] Hardhat project setup
- [x] TypeScript configuration
- [x] OpenZeppelin integration
- [x] Project structure

### Phase 1: Smart Contracts (In Progress)
- [ ] DebtToken.sol
- [ ] MerchantVault.sol
- [ ] VaultFactory.sol
- [ ] MilestoneOracle.sol
- [ ] PaymentProcessor.sol
- [ ] Comprehensive testing
- [ ] Security audit

## Resources
- [Hardhat Documentation](https://hardhat.org/docs)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts)
- [Solidity Documentation](https://docs.soliditylang.org/)
- [EIP-1167 Minimal Proxy](https://eips.ethereum.org/EIPS/eip-1167)

## License
MIT

## Team
Blockchain Developer - Smart Contract Development
