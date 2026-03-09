# Kickstart API Reference

Base URL: `https://api.krexa.xyz/api/v1`

All endpoints interact with [EasyA Kickstart](https://kickstart.easya.io) — a fair launch launchpad on Base mainnet (chain ID 8453).

---

## POST `/kickstart/upload-metadata`

Upload token metadata to Kickstart. Returns a metadata URI for on-chain token creation.

**Request:**
```json
{
  "name": "My Agent Token",
  "ticker": "MAT",
  "description": "A token for AI agent coordination",
  "imageUrl": "https://example.com/logo.png"
}
```

**Response:**
```json
{
  "uri": "ipfs://Qm...",
  "description": "Metadata uploaded for My Agent Token ($MAT)"
}
```

**curl:**
```bash
curl -s -X POST https://api.krexa.xyz/api/v1/kickstart/upload-metadata \
  -H "Content-Type: application/json" \
  -d '{"name": "My Agent Token", "ticker": "MAT", "description": "A token for AI agent coordination"}'
```

---

## POST `/kickstart/create-token`

Build an unsigned `createToken` transaction for the Kickstart factory on Base mainnet.

**Request:**
```json
{
  "name": "My Agent Token",
  "symbol": "MAT",
  "uri": "ipfs://Qm...",
  "initialBuyEth": "0.01",
  "deadlineSeconds": 86400
}
```

**Response:**
```json
{
  "to": "0x07DFAEC8e182C5eF79844ADc70708C1c15aA60fb",
  "data": "0x...",
  "value": "10000000000000000",
  "chainId": 8453,
  "description": "Create token My Agent Token ($MAT) on Kickstart"
}
```

**Sign and submit:**
```bash
cast send 0x07DFAEC8... --data 0x... --value 10000000000000000 \
  --rpc-url https://mainnet.base.org --private-key $KEY
```

---

## POST `/kickstart/buy-token`

Build an unsigned buy transaction for an existing Kickstart bonding curve token.

**Request:**
```json
{
  "curveAddress": "0xCURVE_ADDRESS",
  "ethAmount": "0.1",
  "minTokensOut": "0"
}
```

**Response:**
```json
{
  "to": "0xCURVE_ADDRESS",
  "data": "0x...",
  "value": "100000000000000000",
  "chainId": 8453,
  "description": "Buy tokens on Kickstart curve 0xCURVE for 0.1 ETH"
}
```

---

## POST `/kickstart/credit-and-launch`

Combined flow: draw credit from Krexa vault (Base Sepolia) + create token on Kickstart (Base mainnet). Returns ordered steps.

**Request:**
```json
{
  "vaultAddress": "0xVAULT_ADDRESS",
  "name": "My Agent Token",
  "symbol": "MAT",
  "description": "A token for AI agent coordination",
  "imageUrl": "https://example.com/logo.png",
  "initialBuyEth": "0.01"
}
```

**Response:**
```json
{
  "steps": [
    {
      "step": 1,
      "network": "base-sepolia",
      "chainId": 84532,
      "action": "draw_credit",
      "description": "Draw from credit line (release next tranche)",
      "tx": { "to": "0xVAULT", "data": "0x..." }
    },
    {
      "step": 2,
      "network": "off-chain",
      "chainId": 0,
      "action": "upload_metadata",
      "description": "Upload metadata via POST /api/v1/kickstart/upload-metadata",
      "note": "Upload token metadata to get a metadata URI."
    },
    {
      "step": 3,
      "network": "base-mainnet",
      "chainId": 8453,
      "action": "create_token",
      "description": "Create My Agent Token ($MAT) on Kickstart",
      "tx": { "to": "0x07DFAEC8...", "data": "0x...", "value": "10000000000000000" },
      "note": "Use /kickstart/create-token with the URI from step 2."
    }
  ],
  "totalSteps": 3,
  "note": "Step 1 draws credit on Base Sepolia. Step 2 uploads metadata off-chain. Step 3 creates the token on Base mainnet."
}
```

---

## GET `/kickstart/tokens`

List recently created tokens from the Kickstart factory.

**Query params:** `start` (default 0), `count` (default 20)

**Response:**
```json
{
  "tokens": [
    { "curve": "0xCURVE1", "token": "0xTOKEN1" },
    { "curve": "0xCURVE2", "token": "0xTOKEN2" }
  ],
  "total": 2
}
```

---

## GET `/kickstart/config`

Get Kickstart factory configuration.

**Response:**
```json
{
  "factory": "0x07DFAEC8e182C5eF79844ADc70708C1c15aA60fb",
  "chainId": 8453,
  "virtualEth": "1000000000000000000",
  "virtualToken": "1000000000000000000000",
  "targetEth": "4500000000000000000"
}
```
