# TigerPay EVM Contracts (Legacy)

## Overview
This directory contains the original Ethereum/EVM-compatible smart contracts for TigerPay. 

**Note**: The primary protocol is now built on Solana. These contracts are maintained for reference and potential multi-chain deployment.

## Tech Stack
- **Framework**: Hardhat
- **Language**: Solidity ^0.8.20
- **Libraries**: OpenZeppelin Contracts

## Directory Structure
```
evm-contracts/
├── contracts/          # Solidity contracts
│   ├── MerchantVault.sol
│   ├── DebtToken.sol
│   ├── VaultFactory.sol
│   ├── MilestoneOracle.sol
│   ├── interfaces/
│   ├── security/
│   └── mocks/
├── test/              # Hardhat tests
├── scripts/           # Deployment scripts
├── deploy/            # Deploy configurations
├── artifacts/         # Compiled contracts
└── hardhat.config.js  # Hardhat configuration
```

## Commands
```bash
# Install dependencies
npm install

# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test

# Deploy to network
npx hardhat run scripts/deploy.js --network <network>
```

## Primary Protocol
For the production Solana implementation, see [../solana-programs/](../solana-programs/)
