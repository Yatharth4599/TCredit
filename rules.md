# Krexa — AI Agent Development Rules

**Repo:** https://github.com/Yatharth4599/TCredit
**Chain:** Base L2 (EVM) — Solidity 0.8.24, Foundry
**Stack:** Solidity + Foundry | Vite + React + Zustand | Node.js + Express + Prisma

---

## 0. Rule Zero: Git Protocol
- **NEVER COMMIT OR PUSH TO GIT WITHOUT EXPLICIT USER CONSENT.** Even if a task is "complete," you must wait for the user to verify the changes and give the explicit go-ahead to commit or push.
- **Default remote is `origin` → `https://github.com/Yatharth4599/TCredit.git`**
- Backup remote is `backup` → `https://github.com/valtoosh/tpayx.git`

---

These rules are mandatory for all AI agents working on the Krexa codebase. They ensure professional-grade, audit-ready code and prevent "vibecoding" (lazy patterns, placeholders, shortcuts).

---
important always ask when Opus is needed i will switch the model immediately ensure the right model is selected for the best quality of output tokens can be compromised for quality 


## 1. Smart Contract Architecture (Solidity / Foundry)

- **Contract Structure:** Each contract has a clear single responsibility.
  - `AgentRegistry.sol` — identity + credit scoring
  - `PaymentRouter.sol` — x402 execution + oracle ECDSA
  - `VaultFactory.sol` — CREATE2 vault deployment + config
  - `MerchantVault.sol` — full loan lifecycle, waterfall, tranches
  - `LiquidityPool.sol` — LP deposits, allocations, returns
  - `MilestoneRegistry.sol` — evidence-based tranche gating
- **Libraries:** `WaterfallLib.sol`, `SignatureLib.sol` — pure/view only, no storage.
- **Errors:** All custom errors in `src/libraries/Errors.sol`. Never inline `require(false, "string")`.
- **Events:** Every state change emits an event. No silent mutations.
- **Interfaces:** All 4 interfaces in `src/interfaces/`. Keep in sync with contract implementations.
- **Tests:** All tests in `test/`. Run `forge test` before any commit. 160 tests must pass.

## 2. Solidity Code Standards

- **No Placeholders:** `TODO`, `FIXME`, or `placeholder` comments are forbidden. Implement it or don't.
- **No Magic Numbers:** All constants must be named (`REPAYMENT_INTERVAL`, `CREDIT_SCORE_MAX_AGE`, etc.). Never use raw numbers for time, fees, or thresholds.
- **Math Safety:** Solidity 0.8.24 has built-in overflow protection. Do NOT use unchecked blocks for financial arithmetic.
- **ERC20 Safety:** Always use `SafeERC20` + `forceApprove`. Never call raw `.transfer()` or `.approve()`.
- **Reentrancy:** Every function that moves funds must have `nonReentrant`.
- **Access Control:** Use `onlyAdmin`, `onlyPaymentRouter`, `onlyAuthorized` modifiers. Never skip.
- **Admin Transfers:** Always 2-step (proposeAdmin → acceptAdmin). Never single-step on any contract.
- **Pause Mechanisms:** All critical contracts must respect `notPaused` / `paused` state.
- **Compiler:** `solc 0.8.24`, `via_ir = true`, `optimizer_runs = 200`, `evm_version = "cancun"`.

## 3. Financial Logic Rules

- **Structural Repayment (x402):** Repayment is enforced via x402 settlement routing — it is **Structural**, not **Behavioral**. The `PaymentRouter` routes payment splits automatically.
- **The Sequential Waterfall:** Repayment MUST follow this order:
  1. **Senior Tranche** (first priority)
  2. **Liquidity Pools** (second priority)
  3. **Community Investors** (residual)
- **Late Fees:** Calculated on cumulative shortfall, not discrete missed payments. `daysLate` capped at `REPAYMENT_INTERVAL / 1 days` (30) per period to prevent quadratic compounding.
- **Waterfall Accounting:** Always update `totalSeniorRepaid`, `totalPoolRepaid`, `totalCommunityRepaid` in vault state.
- **Platform Fees:** Deducted before waterfall distribution. Max 500 bps enforced in VaultFactory.
- **Credit Gating:** Agents with tier D credit or expired scores are blocked from vault creation. Score expires after 90 days.

## 4. Testing Standards

- **Forge:** All tests use Foundry (`forge test`). No Hardhat, no Ethers.js tests.
- **Coverage:** Maintain ≥87% line coverage. Run `forge coverage` before PRs.
- **Test files mirror source files:** `MerchantVault.t.sol` for `MerchantVault.sol`, etc.
- **Fuzz tests:** Use `testFuzz_` prefix. Waterfall distribution is fuzz-tested.
- **No skip:** Never comment out or `vm.skip()` failing tests. Fix them.
- **Current count:** 160 tests, 0 failing — this is the baseline.

## 5. Backend Standards (Node.js / Express / Prisma)

- **API versioning:** All routes under `/api/v1/`.
- **Transaction building:** Backend builds unsigned transactions. Users sign with their wallet.
- **Oracle key:** Never log, never commit, never expose. Stored in env only.
- **Prisma migrations:** Always generate a migration for schema changes. Never edit the DB directly.
- **Error handling:** Structured errors with HTTP status codes. No raw stack traces to clients.

## 6. Frontend Standards (React / Vite / Zustand)

- **No Solana packages:** `@solana/*` packages are removed. Use `wagmi` + `viem` for EVM wallet.
- **No mock data in production paths:** `lib/mockData.ts` is dev-only. All production pages hit the backend API.
- **State:** Zustand store is the single source of truth. No prop drilling.
- **Wallet:** wagmi `useSendTransaction` for all on-chain actions. Never embed private keys.

## 7. Git & Tooling

- **Gitignore:** Never stage `out/`, `cache/`, `.env`, `node_modules/`, `target/`.
- **Naming:** Solidity files — PascalCase (`MerchantVault.sol`). Solidity vars/functions — camelCase. Test files — `ContractName.t.sol`.
- **Commit format:** Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`). Be descriptive.
- **`.env` files:** Never committed. `base-contracts/.env` and `backend/.env` are gitignored.

## 8. Decision Log

- Before implementing major logic changes, reference `TODO.md` to ensure alignment with the production roadmap.
- Before changing fee math, waterfall logic, or credit scoring — check `INFRA.md` for the canonical spec.
- Document any deviation from spec in a comment with reasoning.
