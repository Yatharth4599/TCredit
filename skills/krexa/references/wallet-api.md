# Krexa Wallet API Reference

Base URL: `https://api.krexa.xyz/api/v1`

All POST endpoints return an unsigned transaction: `{to: string, data: string, description: string}`.
Sign with `cast send $TO $DATA --rpc-url <RPC> --private-key <KEY>`.

---

## GET /wallets

List all agent wallets.

```bash
curl -s https://api.krexa.xyz/api/v1/wallets | jq
```

Response:
```json
{
  "wallets": [
    {
      "address": "0x...",
      "owner": "0x...",
      "operator": "0x...",
      "dailyLimit": "1000000000",
      "perTxLimit": "200000000",
      "spentToday": "0",
      "frozen": false,
      "whitelistEnabled": false,
      "creditVault": "0x0000000000000000000000000000000000000000",
      "remainingDaily": "1000000000"
    }
  ],
  "total": 1
}
```

Note: All monetary values are in USDC wei (6 decimals). `1000000000` = 1000 USDC.

---

## GET /wallets/by-owner/{ownerAddress}

Find a wallet by its owner address.

```bash
curl -s https://api.krexa.xyz/api/v1/wallets/by-owner/0xOWNER | jq
```

---

## GET /wallets/{address}

Get full wallet state.

```bash
curl -s https://api.krexa.xyz/api/v1/wallets/0xWALLET | jq
```

Response: same shape as individual wallet object above.

---

## GET /wallets/{address}/balance

Get USDC balance held by the wallet.

```bash
curl -s https://api.krexa.xyz/api/v1/wallets/0xWALLET/balance | jq
```

Response:
```json
{
  "address": "0x...",
  "balanceUsdc": "50000000"
}
```

---

## GET /wallets/{address}/history

Get recent PaymentExecuted events (transfers out of the wallet).

```bash
curl -s https://api.krexa.xyz/api/v1/wallets/0xWALLET/history | jq
```

Response:
```json
{
  "events": [
    {
      "to": "0xRECIPIENT",
      "amount": "10000000",
      "blockNumber": "12345678",
      "txHash": "0x..."
    }
  ],
  "total": 1
}
```

---

## POST /wallets/create

Create a new agent wallet.

```bash
curl -s -X POST https://api.krexa.xyz/api/v1/wallets/create \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "0xOPERATOR_ADDR",
    "dailyLimitUsdc": "1000",
    "perTxLimitUsdc": "200"
  }' | jq
```

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| operator | string | yes | — | Address that can spend from wallet |
| dailyLimitUsdc | string | no | "1000" | Max USDC spendable per day |
| perTxLimitUsdc | string | no | "200" | Max USDC per transaction |

The **owner** is whoever signs and submits this transaction.

---

## POST /wallets/{address}/deposit

Build unsigned USDC transfer into the wallet. Anyone can deposit.

```bash
curl -s -X POST https://api.krexa.xyz/api/v1/wallets/0xWALLET/deposit \
  -H "Content-Type: application/json" \
  -d '{"amountUsdc": "100"}' | jq
```

**Important**: The depositor must first approve USDC spending for the wallet address:
```bash
cast send 0x036CbD53842c5426634e7929541eC2318f3dCF7e \
  "approve(address,uint256)" 0xWALLET 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff \
  --rpc-url https://sepolia.base.org --private-key $KEY
```

---

## POST /wallets/{address}/transfer

Build unsigned transfer tx. The **operator** must sign this.

```bash
curl -s -X POST https://api.krexa.xyz/api/v1/wallets/0xWALLET/transfer \
  -H "Content-Type: application/json" \
  -d '{"to": "0xRECIPIENT", "amountUsdc": "50"}' | jq
```

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| to | string | yes | Recipient address |
| amountUsdc | string | yes | Amount in USDC |

Fails if: wallet is frozen, amount exceeds per-tx limit, or daily limit exhausted.

---

## POST /wallets/{address}/set-limits

Update daily and per-tx spending limits. **Owner** signs.

```bash
curl -s -X POST https://api.krexa.xyz/api/v1/wallets/0xWALLET/set-limits \
  -H "Content-Type: application/json" \
  -d '{"dailyLimitUsdc": "2000", "perTxLimitUsdc": "500"}' | jq
```

---

## POST /wallets/{address}/set-operator

Change the operator address. **Owner** signs.

```bash
curl -s -X POST https://api.krexa.xyz/api/v1/wallets/0xWALLET/set-operator \
  -H "Content-Type: application/json" \
  -d '{"operator": "0xNEW_OPERATOR"}' | jq
```

---

## POST /wallets/{address}/freeze

Freeze the wallet (blocks all transfers). **Owner** signs.

```bash
curl -s -X POST https://api.krexa.xyz/api/v1/wallets/0xWALLET/freeze | jq
```

---

## POST /wallets/{address}/unfreeze

Unfreeze a frozen wallet. **Owner** signs.

```bash
curl -s -X POST https://api.krexa.xyz/api/v1/wallets/0xWALLET/unfreeze | jq
```

---

## POST /wallets/{address}/toggle-whitelist

Enable or disable whitelist mode. **Owner** signs.

```bash
curl -s -X POST https://api.krexa.xyz/api/v1/wallets/0xWALLET/toggle-whitelist \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}' | jq
```

---

## POST /wallets/{address}/whitelist

Add or remove an address from the whitelist. **Owner** signs.

```bash
curl -s -X POST https://api.krexa.xyz/api/v1/wallets/0xWALLET/whitelist \
  -H "Content-Type: application/json" \
  -d '{"recipient": "0xADDRESS", "allowed": true}' | jq
```

---

## POST /wallets/{address}/link-credit

Link a credit vault to the wallet. **Owner** signs.

```bash
curl -s -X POST https://api.krexa.xyz/api/v1/wallets/0xWALLET/link-credit \
  -H "Content-Type: application/json" \
  -d '{"vault": "0xVAULT_ADDR"}' | jq
```

---

## POST /wallets/{address}/emergency-withdraw

Withdraw all USDC from the wallet. **Owner** signs.

```bash
curl -s -X POST https://api.krexa.xyz/api/v1/wallets/0xWALLET/emergency-withdraw \
  -H "Content-Type: application/json" \
  -d '{"to": "0xRECIPIENT"}' | jq
```
