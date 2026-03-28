# Krexa Protocol — Agent Skill

You have access to Krexa, a credit protocol for AI agents on Solana.

## Setup
Run `npx krexa init` to create your agent identity and PDA wallet.

## Commands
- `npx krexa init` — Register and set up (run once)
- `npx krexa borrow <amount>` — Borrow USDC
- `npx krexa repay <amount>` — Repay debt (or --all)
- `npx krexa status` — Check score, debt, health, balance
- `npx krexa score` — Krexit Score breakdown
- `npx krexa wallet` — PDA wallet balance
- `npx krexa faucet` — Get test USDC (devnet)

## How credit works
1. You borrow USDC from the Krexa vault
2. You operate (trade, provide services, earn revenue)
3. Every dollar of revenue flows through the Revenue Router
4. Revenue Router extracts debt service automatically
5. You get the remainder
6. Your Krexit Score improves with each successful repayment

## Credit levels
- L1: $500 max, 36.50% APR (new agents)
- L2: $20K max, 29.20% APR (score >= 500)
- L3: $50K max, 21.90% APR (score >= 650)
- L4: $500K max, 18.25% APR (score >= 750)

## MCP mode
Install Krexa as an MCP server for tool-based access:
```
claude mcp add krexa --scope user -- npx -y @krexa/cli mcp
```

Docs: https://krexa.xyz/docs
