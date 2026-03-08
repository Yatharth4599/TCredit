# Krexa Credit API Reference

Base URL: `https://api.krexa.xyz/api/v1`

Credit lines let agents borrow USDC through vault contracts. Funds are released in tranches and repaid over time.

---

## POST /credit/agent-line

Create a new credit line vault for an agent.

```bash
curl -s -X POST https://api.krexa.xyz/api/v1/credit/agent-line \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "0xAGENT_ADDR",
    "targetAmountUsdc": "5000",
    "interestRateBps": 1200,
    "durationDays": 180,
    "numTranches": 3,
    "repaymentRateBps": 2000
  }' | jq
```

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| agent | string | yes | — | Agent address (borrower) |
| targetAmountUsdc | string | yes | — | Total credit amount in USDC |
| interestRateBps | number | no | 1200 | Interest rate in basis points (1200 = 12%) |
| durationDays | number | no | 180 | Loan duration in days |
| numTranches | number | no | 3 | Number of tranches for fund release |
| repaymentRateBps | number | no | 2000 | Revenue repayment rate (2000 = 20%) |

Returns unsigned `createVault` tx. The agent signs and submits it.

---

## GET /credit/{agentAddress}/lines

List all credit line vaults for an agent.

```bash
curl -s https://api.krexa.xyz/api/v1/credit/0xAGENT/lines | jq
```

Response:
```json
{
  "lines": [
    {
      "address": "0xVAULT",
      "state": "active",
      "targetAmount": "5000000000",
      "totalRepaid": "1000000000",
      "totalToRepay": "5600000000",
      "tranchesReleased": 1,
      "numTranches": 3,
      "interestRateBps": 1200
    }
  ],
  "total": 1
}
```

Vault states: `fundraising`, `active`, `repaying`, `completed`, `defaulted`, `cancelled`.

---

## POST /credit/{vaultAddress}/draw

Draw from a credit line by releasing the next tranche.

```bash
curl -s -X POST https://api.krexa.xyz/api/v1/credit/0xVAULT/draw | jq
```

Returns unsigned `releaseTranche` tx. The agent signs to receive the next portion of funds.

---

## Credit Flow (End-to-End)

### 1. Create credit line
```bash
TX=$(curl -s -X POST https://api.krexa.xyz/api/v1/credit/agent-line \
  -H "Content-Type: application/json" \
  -d '{"agent": "0xAGENT", "targetAmountUsdc": "5000"}')
TO=$(echo $TX | jq -r '.to')
DATA=$(echo $TX | jq -r '.data')
cast send $TO $DATA --rpc-url https://sepolia.base.org --private-key $KEY
```

### 2. Link vault to agent wallet
```bash
TX=$(curl -s -X POST https://api.krexa.xyz/api/v1/wallets/0xWALLET/link-credit \
  -H "Content-Type: application/json" \
  -d '{"vault": "0xVAULT_ADDR"}')
TO=$(echo $TX | jq -r '.to')
DATA=$(echo $TX | jq -r '.data')
cast send $TO $DATA --rpc-url https://sepolia.base.org --private-key $KEY
```

### 3. Draw funds (release tranche)
```bash
TX=$(curl -s -X POST https://api.krexa.xyz/api/v1/credit/0xVAULT/draw)
TO=$(echo $TX | jq -r '.to')
DATA=$(echo $TX | jq -r '.data')
cast send $TO $DATA --rpc-url https://sepolia.base.org --private-key $KEY
```

### 4. Check balance increased
```bash
curl -s https://api.krexa.xyz/api/v1/wallets/0xWALLET/balance | jq
```

---

## GET /merchants/{address}/stats

Check credit score and borrowing history.

```bash
curl -s https://api.krexa.xyz/api/v1/merchants/0xAGENT/stats | jq
```

Response includes `creditTier`, `creditRating`, `totalBorrowed`, `totalRepaid`, and vault counts.
