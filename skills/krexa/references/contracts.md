# Krexa Contract Reference

## Network: Base Sepolia

| Setting | Value |
|---------|-------|
| Chain ID | 84532 |
| RPC URL | `https://sepolia.base.org` |
| Block Explorer | `https://sepolia.basescan.org` |

## Contract Addresses

| Contract | Address |
|----------|---------|
| AgentWalletFactory | `0x391130B4AFf2a7E9d15e152852795C4c09cA461f` |
| USDC (Mock) | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| VaultFactory | `0xf8fDa17F877dEFFCD80784E0465F33d585644360` |
| PaymentRouter | `0xf8A5ED433222dFfb9514637243C3599cCE87f977` |
| AgentRegistry | `0xAEa7C5CCACebB1423b163b765d3214752f1496A4` |
| AgentIdentity | `0xdF4749EF86d2B9cee49e34A1dF5E17E0159b83a8` |
| SeniorPool | `0xDf980d0734b00888e4Ac350027515B4D6E473bBa` |
| GeneralPool | `0x7E7D8082572C0AD2f51074D272A501180Db06Fb2` |
| MilestoneRegistry | `0x48a471eEB88f84a867bEBC0f6DFF848660BC8c84` |
| Facilitator | `0xf71A29c158750B1036cCD3965DD043f29DEdA6eb` |

## Key Function Signatures

### AgentWalletFactory

```bash
# Create wallet (owner signs)
cast send 0x391130B4AFf2a7E9d15e152852795C4c09cA461f \
  "createWallet(address,uint256,uint256)" \
  OPERATOR_ADDR DAILY_LIMIT_WEI PER_TX_LIMIT_WEI \
  --rpc-url https://sepolia.base.org --private-key $KEY

# Read wallets
cast call 0x391130B4AFf2a7E9d15e152852795C4c09cA461f "getAllWallets()" --rpc-url https://sepolia.base.org
cast call 0x391130B4AFf2a7E9d15e152852795C4c09cA461f "ownerToWallet(address)" OWNER_ADDR --rpc-url https://sepolia.base.org
```

### AgentWallet (per-wallet contract)

```bash
# Transfer USDC (operator signs)
cast send WALLET_ADDR "transfer(address,uint256)" RECIPIENT AMOUNT_WEI \
  --rpc-url https://sepolia.base.org --private-key $OPERATOR_KEY

# Emergency withdraw (owner signs)
cast send WALLET_ADDR "emergencyWithdraw(address)" RECIPIENT \
  --rpc-url https://sepolia.base.org --private-key $OWNER_KEY

# Set limits (owner signs)
cast send WALLET_ADDR "setLimits(uint256,uint256)" DAILY_WEI PER_TX_WEI \
  --rpc-url https://sepolia.base.org --private-key $OWNER_KEY

# Freeze / unfreeze (owner signs)
cast send WALLET_ADDR "freeze()" --rpc-url https://sepolia.base.org --private-key $OWNER_KEY
cast send WALLET_ADDR "unfreeze()" --rpc-url https://sepolia.base.org --private-key $OWNER_KEY

# Read state
cast call WALLET_ADDR "owner()" --rpc-url https://sepolia.base.org
cast call WALLET_ADDR "operator()" --rpc-url https://sepolia.base.org
cast call WALLET_ADDR "dailyLimit()" --rpc-url https://sepolia.base.org
cast call WALLET_ADDR "getRemainingDaily()" --rpc-url https://sepolia.base.org
cast call WALLET_ADDR "frozen()" --rpc-url https://sepolia.base.org
```

### USDC

```bash
# Check balance
cast call 0x036CbD53842c5426634e7929541eC2318f3dCF7e "balanceOf(address)" ADDR \
  --rpc-url https://sepolia.base.org

# Approve spending
cast send 0x036CbD53842c5426634e7929541eC2318f3dCF7e \
  "approve(address,uint256)" SPENDER 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff \
  --rpc-url https://sepolia.base.org --private-key $KEY
```

## USDC Decimals

USDC uses 6 decimals. To convert:
- 1 USDC = `1000000` wei
- 100 USDC = `100000000` wei
- 1000 USDC = `1000000000` wei
