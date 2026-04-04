---
name: krexa
description: AI agent skill for Krexa Protocol — programmable credit infrastructure on Solana. Covers agent registration, USDC borrowing with Krexit Score-based underwriting, Revenue Router auto-repayment, x402 service monetization, vault LP operations, and on-chain credit scoring. Use when building agents that need working capital, credit lines, or revenue-based repayment on Solana.
---

# Krexa Protocol — Credit Infrastructure for AI Agents

Krexa gives AI agents on-chain credit. Agents register, get scored (200-850), borrow USDC, and repay automatically through the Revenue Router. No collateral required at L1.

## Quick Start

### CLI (fastest)
```bash
npx @krexa/cli init          # Register agent + PDA wallet + score
npx @krexa/cli faucet        # Get 100 devnet USDC
npx @krexa/cli borrow 500    # Borrow USDC from the vault
npx @krexa/cli status        # Score, balance, health
npx @krexa/cli repay 50      # Manual repay (auto-repay via Revenue Router)
npx @krexa/cli swap USDC SOL 50  # Trade via Jupiter
npx @krexa/cli portfolio     # View token balances
npx @krexa/cli yield         # Scan yield opportunities
npx @krexa/cli price SOL         # Get SOL price
npx @krexa/cli pools --token USDC # List LP pools
npx @krexa/cli history            # Transaction history
```

### MCP (for Claude Code / Cursor)
```bash
claude mcp add krexa --scope user -- npx -y @krexa/cli mcp
```
Then ask anything: "Swap 50 USDC to SOL", "What's my portfolio?", "Find best USDC yield", "Show SOL price"

### SDK (programmatic)
```typescript
import { KrexaSDK } from "@krexa/sdk";

const krexa = new KrexaSDK({
  chain: "solana",
  agentAddress: "YOUR_AGENT_PUBKEY",
  apiKey: "YOUR_API_KEY",
});

// Check status
const status = await krexa.agent.getStatus();

// Request credit
const result = await krexa.agent.requestCredit({ amount: 500 });

// Trade via Jupiter
const swap = await krexa.agent.swap({
  from: "USDC", to: "SOL", amount: 50,
  ownerAddress: "YOUR_OWNER_PUBKEY",
});

// Repay
await krexa.agent.repay({ amount: 50 });
```

## Core Concepts

### Agent Types
- **Type A (Trader):** Borrows to trade on DEXs. NAV monitored. Auto-liquidation if NAV < 90%.
- **Type B (Service):** Borrows for infrastructure. Earns via x402. Revenue velocity monitored. Wind-down if zero revenue 14 days.
- **Type C (Hybrid):** Trades AND serves. Dual enforcement.

### Credit Levels
| Level | Max Credit | APR | Daily Rate | Requirement |
|-------|-----------|-----|-----------|-------------|
| L1 Micro | $500 | 36.50% | 0.10% | New agent |
| L2 Standard | $20,000 | 29.20% | 0.08% | Score >= 500 |
| L3 Growth | $50,000 | 21.90% | 0.06% | Score >= 650 |
| L4 Prime | $500,000 | 18.25% | 0.05% | Score >= 750 |

### Krexit Score (200-850)
Composite score from 5 on-chain behavioral signals:
- Repayment History (30%) — on-time vs late vs missed
- Profitability (25%) — P&L ratio, Sharpe, max drawdown
- Behavioral Health (20%) — time in Green/Yellow/Orange/Red zones
- Usage Patterns (15%) — venue entropy, transaction consistency
- Account Maturity (10%) — age, lifetime volume, completed cycles

Score is stored on-chain as a PDA. Any Solana program can read it via CPI.

### Revenue Router (Auto-Repayment)
Every dollar of agent revenue flows through the Revenue Router BEFORE reaching the agent:
```
Payment: $1.00 -> Revenue Router
  Protocol fee (10%):  $0.10 -> Treasury
  Debt service:        $0.40 -> Reduces outstanding balance
  Agent receives:      $0.50 -> Agent PDA wallet
```

### PDA Wallets
Every agent gets a Program Derived Address wallet with no private key.
8 safety layers on every outbound payment:
1. Wallet not frozen
2. Per-trade limit (20% of balance)
3. Daily spend limit
4. Per-venue concentration (50% max)
5. Health factor gate
6. Venue whitelisted
7. Credit level sufficient
8. Venue exposure tracking

### Credit Vault (Structured Lending)
LPs deposit USDC into three risk tranches:
- **Senior (50%):** 10% APR, last to lose
- **Mezzanine (30%):** 12% APR, balanced
- **Junior (20%):** 20% APR, first-loss (protocol-owned)

Share-based accounting. Utilization capped at 80%. Idle capital routed to Meteora Dynamic Vaults for additional yield.

## Programs (Solana Devnet)

| Program | Address |
|---------|---------|
| Agent Registry | `ChJjAXy7sE4d4jst9VViG7ScanVKqH9Q1cFxtdcH78cG` |
| Agent Wallet | `35t8yWLsUZNTLT71ej7DF59P81HrtZTx2uZeMhwuhhf6` |
| Credit Vault | `26SQx3rAyujWCupxvPAMf9N3ok4cw1awyTWAVWDQfr9N` |
| Credit Router | `2Zy3d7C28Z9dfazdysKVBQUXnvvWNshxtDEFKftG83u8` |
| Krexit Score | `2GwtAXnjY5LehfZfT77ZH3XSshwbni8LP9zXeA84WUqh` |
| Service Plan | `Eqc48c6TtKAPRosTMoC6Nasi85iqdLuzwbu6WBrsPFdt` |
| Venue Whitelist | `HyWQrHG14Sw6KpKYSMiBDmVj5u7PXfLWvim6FHbBLmua` |

## API Reference

Base URL: `https://tcredit-backend.onrender.com/api/v1`

```bash
# Agent status
curl https://tcredit-backend.onrender.com/api/v1/solana/wallets/AGENT_ADDRESS

# Score lookup
curl https://tcredit-backend.onrender.com/api/v1/solana/score/AGENT_ADDRESS

# Faucet (devnet, 100 USDC/24h)
curl -X POST https://tcredit-backend.onrender.com/api/v1/solana/faucet/usdc \
  -H "Content-Type: application/json" \
  -d '{"recipient":"WALLET","amountUsdc":100}'

# Vault stats
curl https://tcredit-backend.onrender.com/api/v1/solana/vault/stats

# Credit eligibility
curl https://tcredit-backend.onrender.com/api/v1/solana/credit/AGENT/eligibility

# Swap quote
curl -X POST https://tcredit-backend.onrender.com/api/v1/solana/trading/AGENT/quote \
  -H "Content-Type: application/json" \
  -d '{"from":"USDC","to":"SOL","amount":50}'

# Portfolio
curl https://tcredit-backend.onrender.com/api/v1/solana/trading/AGENT/portfolio
```

## MCP Tools (22 total)

One connection. Everything your agent needs.

| Category | Tools |
|----------|-------|
| Credit | krexa_register_agent, krexa_check_balance, krexa_draw_credit, krexa_repay, krexa_get_score |
| Payments | krexa_pay |
| Trading | krexa_swap, krexa_quote, krexa_trade, krexa_limit_order, krexa_cancel_order, krexa_positions |
| Liquidity | krexa_lp_add, krexa_lp_remove, krexa_lp_positions, krexa_lp_pools |
| Data | krexa_price, krexa_portfolio, krexa_yield_scan, krexa_history |
| Vault | krexa_vault_deposit, krexa_vault_stats |

Every transaction flows through your PDA wallet. Revenue Router auto-repays on every trade.

## Building an x402 Service Agent

```typescript
import express from "express";

const app = express();

app.get("/api/research", (req, res) => {
  const payment = req.headers["x-payment"];
  if (!payment) {
    return res.status(402).json({
      "x-payment-required": true,
      "x-payment-amount": "0.25",
      "x-payment-currency": "USDC",
      "x-payment-recipient": "REVENUE_ROUTER_ADDRESS",
      "x-payment-network": "solana:devnet",
    });
  }
  res.json({ result: "research data" });
});

app.listen(3777);
// Revenue Router auto-repays your Krexa credit from every payment
```

## Links
- Website: https://krexa.xyz
- Docs: https://krexa.mintlify.app/docs/quickstart
- GitHub: https://github.com/Yatharth4599/Krexa
- X: https://x.com/krexa_xyz
