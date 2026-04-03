# Krexa — Project Rules

**Repo:** https://github.com/Yatharth4599/Krexa (formerly TCredit)
**Chain:** Solana (Anchor v0.30.1) — 5 on-chain programs on Devnet
**Also:** Base Sepolia EVM deployment (legacy)
**Stack:** Anchor/Rust | Express + TypeScript + Prisma | React + Vite | CSS Modules
**Brand:** Krexa · krexa.xyz · @krexa_xyz

---

## Rule 0: Git Protocol
- **NEVER commit or push without explicit user consent.** Wait for "push" / "commit" instruction.
- Default remote: `origin` → `https://github.com/Yatharth4599/Krexa.git`
- Backup remote: `backup` → `https://github.com/valtoosh/tpayx.git`

## Rule 1: Plugin & Skill Usage
Before executing tasks, use the relevant skill/plugin when available:

| Trigger | Skill to invoke |
|---------|----------------|
| Multi-step implementation task | `superpowers:writing-plans` — plan before coding |
| Creative/design work (UI, components, features) | `superpowers:brainstorming` — explore before building |
| About to claim work is done/passing | `superpowers:verification-before-completion` — run build/tests first |
| PR or major feature complete | `code-review` — review against plan and standards |
| 2+ independent tasks | `superpowers:dispatching-parallel-agents` — parallelize |
| Bug or test failure | `superpowers:systematic-debugging` — diagnose before fixing |
| End of session / context getting long | `remember` — save state for next session |
| Frontend page/component work | `krexa-design` — follow the design system |
| Planning a feature or multi-step task | `claude-mem:make-plan` — create phased plan with doc discovery |
| Executing a plan with subagents | `claude-mem:do` — run the plan |
| Need info from previous sessions | `claude-mem:mem-search` — search cross-session memory |
| Exploring codebase structure | `claude-mem:smart-explore` — AST-based token-efficient search |
| Project history / timeline | `claude-mem:timeline-report` — generate development narrative |

**Don't invoke skills for trivial tasks** (single file edits, typo fixes, quick questions). Use judgment.

## Rule 2: Code Standards
- **No placeholders** — implement complete or skip entirely
- **No mock data in production paths** — all pages hit real backend API
- **Financial logic must be production-grade** — reference the protocol deep dive for formulas
- **CSS Modules only** — no inline Tailwind in JSX
- **Fonts:** Space Grotesk (headings) + JetBrains Mono (labels/values)
- **Colors:** Black #000, White #F9F9F9, Navy #034694, Teal #2DD4BF
- **No border-radius** — everything boxy (brutalist theme)

## Rule 3: Model Guidance
- **Sonnet:** UI/UX work, frontend, backend tweaks, general tasks
- **Opus:** Complex crypto logic, multi-contract interactions, financial edge cases, deep reviews
- Always ask when Opus is needed — user will switch immediately

## Rule 4: Architecture
- Backend builds unsigned transactions — users sign with wallet
- All routes under `/api/v1/`
- Oracle key: never log, never commit, never expose
- Krexit Score: 200-850, FairScale base (0-100 → 200-850) + flat on-chain modifiers
- Credit Levels: L1 ($500) → L4 ($500K)
- Waterfall: Protocol Fee → Senior → Mezzanine → Junior → Insurance
- See `memory/project_architecture.md` for full protocol spec

## Rule 5: Security Fix Depth
**Auth is not authorization. Validation is not verification. Never mark a security bug resolved after surface-level patches.**

Every security fix must trace the full execution path:
1. **Who calls it** — is the caller authenticated AND authorized (owns the resource)?
2. **What proves it** — on-chain state, PDA ownership, wallet binding — not just "valid API key"
3. **Does the encoding match** — PDA seeds, instruction discriminators, account order must match the on-chain ABI byte-for-byte
4. **External data is hostile** — validate bounds, types, allowlists on every field from external APIs (FairScale, Sumsub, etc.)
5. **Trace through all layers** — a fix in backend is worthless if SDK/MCP bypasses it. Check: frontend → SDK → MCP → backend → on-chain

Before claiming any security fix is complete:
- If it touches on-chain interaction: verify PDA derivation, discriminator, account layout against the Anchor program
- If it adds auth: ask "can someone with a valid API key but no wallet ownership still exploit this?"
- If it rewrites an algorithm: verify the data pipeline underneath actually reads/writes the right accounts
- If it touches one file in a chain: read the adjacent files (updater↔fetcher↔engine, routes↔services↔chain)
