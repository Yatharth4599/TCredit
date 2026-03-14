# Krexa Research Agent — Demo Service

An AI-powered token research API that charges per call via x402 on Solana.
This is the "business" an AI agent runs using borrowed capital from the Krexa credit protocol.

## The Demo Flow

```
Agent registers → Gets $50 credit (Level 1, zero collateral)
      ↓
Deploys this service → Charges $0.25/call via x402
      ↓
Customer pays → PaymentRouter auto-splits:
  30% → LP repayment
  10% → Krexa protocol fee
  60% → Agent revenue
      ↓
After ~200 calls → Loan fully repaid → Credit score increases
```

## Endpoints

| Endpoint | Price | Description |
|---|---|---|
| `GET /health` | Free | Service status |
| `GET /api/analyze/:tokenAddress` | $0.25 USDC | AI analysis of a Solana token |
| `GET /api/trending` | $0.50 USDC | Top 5 trending tokens with brief analysis |

## x402 Payment Flow

Every paid endpoint follows HTTP 402:

1. **No receipt header** → Server returns `402` with payment instructions
2. **Client pays** → Sends USDC to `MERCHANT_WALLET` on Solana
3. **Client retries** → Adds `X-Payment-Receipt: <tx_signature>` header
4. **Server verifies** → Checks tx is confirmed and recent (< 5 min)
5. **Access granted** → Analysis runs and result is returned

## Setup

```bash
cd demo/agent-service
npm install
cp .env.example .env
# Fill in .env values
npx tsx src/server.ts
```

## Environment Variables

```
ANTHROPIC_API_KEY    — Claude API key
SOLANA_RPC_URL       — Solana RPC endpoint (default: mainnet-beta)
MERCHANT_WALLET      — Agent's Krexa settlement address (receives payments)
KREXA_API_URL        — Krexa API base URL (default: https://api.krexa.xyz)
PORT                 — Server port (default: 3001)
```

## Test Calls

```bash
# Health check (free)
curl http://localhost:3001/health

# Token analysis — expect 402 first
curl http://localhost:3001/api/analyze/So11111111111111111111111111111111111111112

# With payment receipt
curl http://localhost:3001/api/analyze/So11111111111111111111111111111111111111112 \
  -H "X-Payment-Receipt: <your_tx_signature>"

# Trending — expect 402 first
curl http://localhost:3001/api/trending
```

## Example 402 Response

```json
{
  "status": 402,
  "message": "Payment required",
  "payment": {
    "amount": "250000",
    "currency": "USDC",
    "recipient": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "network": "solana",
    "facilitator": "https://api.krexa.xyz/v1/x402/pay",
    "memo": "GET:/api/analyze/So111..."
  }
}
```

## Example Analysis Response

```json
{
  "token": "So11111111111111111111111111111111111111112",
  "analysis": {
    "riskScore": 2,
    "summary": "Wrapped SOL is the canonical wrapped native token on Solana with deep liquidity across all major DEXs.",
    "recommendation": "Hold",
    "metrics": {
      "marketCapEstimate": "Multi-billion USD",
      "liquidityLevel": "High",
      "ageEstimate": "3+ years",
      "holderConcentration": "Low"
    }
  },
  "meta": {
    "poweredBy": "Krexa Research Agent",
    "paidVia": "x402 on Solana",
    "paymentTx": "5KtPn1LGuxhFiwjxErkxTb...",
    "creditStatus": "Repaying via Krexa Revenue Router"
  }
}
```
