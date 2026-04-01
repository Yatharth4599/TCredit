# Krexit Score System

## Overview

The Krexit Score (200-850) determines an AI agent's creditworthiness on the Krexa protocol. It controls how much credit an agent can access, from $500 (L1) to $500,000 (L4).

The score is powered by **FairScale**, an external credit infrastructure provider that analyzes Solana wallet history across all protocols. Krexa-specific on-chain behavior (repayments, liquidations, account age) provides additional adjustments on top of FairScale's base score.

---

## How It Works

```
FairScale credit_score (0-100)
        |
        v
Base Krexit Score = 200 + (credit_score / 100) x 650
        |
        v
On-chain modifiers (Krexa behavior):
  + on-time repayments
  + account age
  + credit cycles completed
  + trading volume
  - late/missed payments
  - liquidations
  - defaults
  - overleveraged debt
        |
        v
Final Krexit Score (200-850)
        |
        v
Credit Level (L1-L4)
```

### Example

An agent with a FairScale credit score of 72, 6 months on Krexa, 5 completed credit cycles, and 3 on-time repayments:

- **Base score:** 200 + (72/100) x 650 = **668**
- **On-chain modifiers:** +30 (age) + 15 (cycles) + 48 (repayments) = **+93**
- **Final score:** 668 + 93 = **761** -> **L4** ($500K credit)

---

## Credit Levels

| Level | Credit Limit | Score Required | Age Required | FairScale Gate |
|-------|-------------|----------------|--------------|----------------|
| L1 | $500 | Default | None | None |
| L2 | $20,000 | >= 500 | None | Not "decline" |
| L3 | $50,000 | >= 650 | 3 months | max_credit_line >= $25K |
| L4 | $500,000 | >= 750 | 6 months | max_credit_line >= $100K |

Every agent starts at L1. Higher levels require:
1. A high enough FairScale credit score (wallet history across Solana)
2. Time on Krexa (age gates prevent instant L3/L4)
3. Good behavior on Krexa (repayments, no liquidations)

---

## On-Chain Modifiers

These are point adjustments based on the agent's behavior specifically on the Krexa protocol:

| Action | Points | Details |
|--------|--------|---------|
| On-time repayment | +8 | Recent repayments count more (2x in last 30 days) |
| Early repayment | +10 | Rewarded higher than on-time |
| Late repayment | -15 | |
| Missed repayment | -30 | |
| Liquidation | -40 | Matches on-chain penalty constant |
| Default | -100 | Near-unrecoverable |
| Account age | +5/month | Capped at +60 (1 year) |
| Credit cycles completed | +3/cycle | Capped at +30 (10 cycles) |
| Trading volume | +2 per $10K | Capped at +20 ($100K total) |
| Debt > 80% of limit | -10 | Overleveraged warning |
| FairScale "decline" | -50 | Extra penalty for declined wallets |

---

## FairScale Integration

### What FairScale Provides

FairScale analyzes entire Solana wallet history and returns:
- **credit_score** (0-100): Overall creditworthiness
- **risk_band**: prime, near_prime, subprime, deep_subprime, decline
- **max_credit_line**: Suggested maximum credit
- **debt_service_ratio**: Existing debt load across protocols
- **risk_flags**: Positive and negative signals (defaults, liens, clean history)
- **attestation hash**: Cryptographic proof of the score, verifiable on-chain

### API Usage

- **Daily scoring:** `/credit/quick` endpoint (1-2s response, lightweight)
- **Level promotions:** `/credit` full endpoint (5-15s, complete underwriting)
- **Cache:** 24-hour per wallet to stay within 5,000 calls/day quota
- **Fallback:** If FairScale is down, agents get a default base of 400 (L1 only)

### Attestation

Every FairScale response includes a signed `payload_hash`. We store this with every credit decision. FairScale also writes a Solana memo transaction per API call. This creates a two-sided audit trail for compliance and dispute resolution.

---

## When FairScale Is Unavailable

If FairScale's API is down, returns an error, or the wallet has no history:

- Base score defaults to **400**
- On-chain modifiers still apply
- Maximum possible score without FairScale: ~510 (after 12+ months of perfect behavior)
- Agents can reach L2 at best without FairScale, but realistically stay at L1
- This incentivizes wallets to build on-chain history that FairScale can analyze

---

## Repayment Outcome Reporting

FairScale wants repayment outcomes fed back so their model improves for our agents:

When a credit line closes, we send:
- Wallet address
- Loan ID
- Outcome (on-time, late, default, liquidated)
- Amounts and dates
- Krexit Score at origination

This is a two-way value exchange: our outcome data improves their scoring accuracy for our specific agent population.

---

## Interest Rates (On-Chain Constants)

| Level | APR | Daily Rate |
|-------|-----|------------|
| L1 | 36.50% | 0.10% |
| L2 | 29.20% | 0.08% |
| L3 | 25.55% | 0.07% |
| L4 | 21.90% | 0.06% |

---

## Key Design Decisions

1. **FairScale is the primary scoring authority** — they have infrastructure dedicated to wallet credit analysis across all Solana protocols. We don't try to replicate this.

2. **On-chain modifiers are simple flat points** — no complex financial math (Sharpe ratios, entropy). Just: did you repay on time? How long have you been here? How much have you traded?

3. **New agents start humble** — L1 ($500) regardless of FairScale score, because age gates prevent instant access to large credit lines.

4. **Graceful degradation** — if FairScale goes down, scoring still works (just limited to L1-L2 range).

5. **Audit trail** — every score has a FairScale attestation hash stored alongside it, verifiable on-chain.
