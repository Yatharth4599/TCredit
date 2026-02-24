# TigerPayX — AI Agent Development Rules

These rules are mandatory for all AI agents working on the TigerPayX codebase. They ensure professional grade, audit-ready code and prevent "vibecoding" (lazy patterns/placeholders).

## 1. Project Architecture
- **lib.rs (Thin Router):** `lib.rs` MUST only contain program ID, imports, instruction routing (thin wrappers), and `#[derive(Accounts)]` structs. No business logic allowed.
- **Instruction Logic:** All logic lives in `src/instructions/`. Use the `_ops.rs` suffix for files that conflict with state names (e.g., `pool_ops.rs` vs `state/pool.rs`).
- **State Definitions:** All structs live in `src/state/`.
- **Error Handling:** All custom errors must be defined in `src/errors.rs`. Never reuse unrelated error codes.
- **Event Emission:** Every significant state change must emit an event defined in `src/events.rs`.

## 2. Code Integrity (Anti-Vibecoding)
- **No Placeholders:** `TODO`, `FIXME`, or `placeholder` comments are forbidden. Implement it or don't.
- **No Magic Numbers:** All numbers (time intervals, fee bps, thresholds) must be pulled from the constants block in `lib.rs`.
- **CHECK Justifications:** Every `/// CHECK:` comment must provide a technical explanation of *why* the account is unchecked and *how* safety is ensured by other constraints.
- **Math Safety:** Always use `.checked_add()`, `.checked_mul()`, or `.saturating_` methods. Avoid `.unwrap()` on arithmetic.

## 3. Financial Logic Rules
- **Structural Repayment (x402):** Repayment is enforced via x402 settlement routing. It is **Structural**, not **Behavioral**.
- **The Sequential Waterfall:** Repayment payouts MUST follow this order:
    1. **Senior Tranche (Jupiter/Treasury)**
    2. **Liquidity Pools (Alpha/Co-owned)**
    3. **Community Tranche (Retail Investors)**
- **Waterfall Progress:** Always update `total_senior_repaid`, `total_pool_repaid`, and `total_user_repaid` in the vault state.
- **Late Fees:** Calculated strictly using `SECONDS_PER_DAY` (86,400) and `REPAYMENT_INTERVAL_SECS` (30 days).

## 4. Git & Tooling
- **Gitignore:** Maintain a clean root `.gitignore`. Never stage `target/`, `.anchor/`, or `Cargo.lock` unless specifically asked.
- **Naming:** Follow Rust naming conventions (snake_case for files/vars, PascalCase for Structs).

## 5. Decision Log
- Before implementing major logic changes, reference the `TODO.md` roadmap to ensure alignment with the production state.
