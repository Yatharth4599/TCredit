---
name: krexa
description: Manage agent wallets, send USDC payments, and access credit lines on Base using the Krexa protocol. Use this skill when an agent needs to hold funds, make payments, deposit USDC, check balances, or draw from a credit line.
metadata:
  author: krexa
  version: "1.0"
---

# Krexa — Agent Wallet Infrastructure on Base

Krexa gives AI agents their own smart contract wallets on Base with built-in spending limits, operator controls, whitelisting, and credit lines. Every wallet operation returns an **unsigned transaction** — your agent signs and submits it.

## Prerequisites

- A wallet with Base ETH (for gas)
- [Foundry](https://book.getfoundry.sh/getting-started/installation) installed (`cast` CLI)
- Krexa API: `https://api.krexa.xyz/api/v1`

No SDK, no API keys, no npm required.

## Quick Start

### Step 1: Create an Agent Wallet

```bash
# Get unsigned tx
TX=$(curl -s -X POST https://api.krexa.xyz/api/v1/wallets/create \
  -H "Content-Type: application/json" \
  -d '{"operator": "0xYOUR_OPERATOR_ADDR", "dailyLimitUsdc": "1000", "perTxLimitUsdc": "200"}')

# Extract to/data and sign with cast
TO=$(echo $TX | jq -r '.to')
DATA=$(echo $TX | jq -r '.data')
cast send $TO $DATA --rpc-url https://mainnet.base.org --private-key $PRIVATE_KEY
```

### Step 2: Deposit USDC into Wallet

```bash
# First approve USDC spending (one-time)
cast send 0x036CbD53842c5426634e7929541eC2318f3dCF7e \
  "approve(address,uint256)" YOUR_WALLET_ADDR 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff \
  --rpc-url https://mainnet.base.org --private-key $PRIVATE_KEY

# Get deposit tx
TX=$(curl -s -X POST https://api.krexa.xyz/api/v1/wallets/YOUR_WALLET_ADDR/deposit \
  -H "Content-Type: application/json" \
  -d '{"amountUsdc": "100"}')

TO=$(echo $TX | jq -r '.to')
DATA=$(echo $TX | jq -r '.data')
cast send $TO $DATA --rpc-url https://mainnet.base.org --private-key $PRIVATE_KEY
```

### Step 3: Send USDC (Operator Signs)

```bash
TX=$(curl -s -X POST https://api.krexa.xyz/api/v1/wallets/YOUR_WALLET_ADDR/transfer \
  -H "Content-Type: application/json" \
  -d '{"to": "0xRECIPIENT", "amountUsdc": "50"}')

TO=$(echo $TX | jq -r '.to')
DATA=$(echo $TX | jq -r '.data')
cast send $TO $DATA --rpc-url https://mainnet.base.org --private-key $OPERATOR_KEY
```

## API Cheat Sheet

Base URL: `https://api.krexa.xyz/api/v1`

| Action | Method | Endpoint | Body |
|--------|--------|----------|------|
| List wallets | GET | `/wallets` | — |
| Wallet by owner | GET | `/wallets/by-owner/{owner}` | — |
| Wallet detail | GET | `/wallets/{addr}` | — |
| USDC balance | GET | `/wallets/{addr}/balance` | — |
| Tx history | GET | `/wallets/{addr}/history` | — |
| Create wallet | POST | `/wallets/create` | `{operator, dailyLimitUsdc, perTxLimitUsdc}` |
| Deposit USDC | POST | `/wallets/{addr}/deposit` | `{amountUsdc}` |
| Transfer USDC | POST | `/wallets/{addr}/transfer` | `{to, amountUsdc}` |
| Set limits | POST | `/wallets/{addr}/set-limits` | `{dailyLimitUsdc, perTxLimitUsdc}` |
| Set operator | POST | `/wallets/{addr}/set-operator` | `{operator}` |
| Freeze | POST | `/wallets/{addr}/freeze` | — |
| Unfreeze | POST | `/wallets/{addr}/unfreeze` | — |
| Toggle whitelist | POST | `/wallets/{addr}/toggle-whitelist` | `{enabled: bool}` |
| Add/remove whitelist | POST | `/wallets/{addr}/whitelist` | `{recipient, allowed: bool}` |
| Link credit vault | POST | `/wallets/{addr}/link-credit` | `{vault}` |
| Emergency withdraw | POST | `/wallets/{addr}/emergency-withdraw` | `{to}` |

All POST endpoints return `{to, data, description}` — an unsigned transaction to sign.

## Credit Flow

Agents can borrow USDC through credit line vaults:

1. **Create credit line**: `POST /credit/agent-line` with `{agent, targetAmountUsdc}`
2. **Link vault to wallet**: `POST /wallets/{addr}/link-credit` with `{vault}`
3. **Draw funds**: `POST /credit/{vaultAddr}/draw` — releases next tranche into wallet
4. **Check credit lines**: `GET /credit/{agentAddr}/lines`

See `references/credit-api.md` for full details.

## Contract Addresses (Base Sepolia)

| Contract | Address |
|----------|---------|
| AgentWalletFactory | `0x391130B4AFf2a7E9d15e152852795C4c09cA461f` |
| USDC | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| VaultFactory | `0xf8fDa17F877dEFFCD80784E0465F33d585644360` |
| PaymentRouter | `0xf8A5ED433222dFfb9514637243C3599cCE87f977` |

Chain ID: 84532 | RPC: `https://sepolia.base.org` | Explorer: `https://sepolia.basescan.org`

See `references/contracts.md` for function signatures.

## Kickstart Integration

Agents can use Krexa credit to launch tokens on [EasyA Kickstart](https://kickstart.easya.io) — a fair launch launchpad on Base mainnet with bonding curves that graduate to Aerodrome DEX at ~4.5 ETH.

**Note:** Krexa contracts run on Base Sepolia (84532). Kickstart runs on Base mainnet (8453). The API handles both networks.

### Launch a Token with Credit

```bash
# 1. Draw credit from vault (Base Sepolia)
TX=$(curl -s -X POST https://api.krexa.xyz/api/v1/credit/YOUR_VAULT/draw)
TO=$(echo $TX | jq -r '.to') && DATA=$(echo $TX | jq -r '.data')
cast send $TO $DATA --rpc-url https://sepolia.base.org --private-key $KEY

# 2. Upload token metadata
META=$(curl -s -X POST https://api.krexa.xyz/api/v1/kickstart/upload-metadata \
  -H "Content-Type: application/json" \
  -d '{"name": "My Token", "ticker": "MTK", "description": "A cool token"}')
URI=$(echo $META | jq -r '.uri')

# 3. Create token on Kickstart (Base mainnet)
TX=$(curl -s -X POST https://api.krexa.xyz/api/v1/kickstart/create-token \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"My Token\", \"symbol\": \"MTK\", \"uri\": \"$URI\", \"initialBuyEth\": \"0.01\"}")
TO=$(echo $TX | jq -r '.to') && DATA=$(echo $TX | jq -r '.data') && VALUE=$(echo $TX | jq -r '.value')
cast send $TO --data $DATA --value $VALUE --rpc-url https://mainnet.base.org --private-key $KEY
```

### Combined Flow (Single API Call)

```bash
# Returns ordered steps across both networks
curl -s -X POST https://api.krexa.xyz/api/v1/kickstart/credit-and-launch \
  -H "Content-Type: application/json" \
  -d '{"vaultAddress": "0xVAULT", "name": "My Token", "symbol": "MTK", "description": "A cool token", "initialBuyEth": "0.01"}'
```

### Kickstart API Endpoints

| Action | Method | Endpoint | Body |
|--------|--------|----------|------|
| Upload metadata | POST | `/kickstart/upload-metadata` | `{name, ticker, description, imageUrl?}` |
| Create token | POST | `/kickstart/create-token` | `{name, symbol, uri, initialBuyEth?}` |
| Buy token | POST | `/kickstart/buy-token` | `{curveAddress, ethAmount, minTokensOut?}` |
| Credit + Launch | POST | `/kickstart/credit-and-launch` | `{vaultAddress?, name, symbol, description?, imageUrl?, initialBuyEth?}` |
| List tokens | GET | `/kickstart/tokens?count=20` | — |
| Factory config | GET | `/kickstart/config` | — |

See `references/kickstart-api.md` for full details.

## References

- `references/wallet-api.md` — Full wallet endpoint reference with curl examples
- `references/credit-api.md` — Credit line endpoint reference
- `references/contracts.md` — Contract addresses and function signatures for `cast`
- `references/kickstart-api.md` — Kickstart token launch endpoint reference
