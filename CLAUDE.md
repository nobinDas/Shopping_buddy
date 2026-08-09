# Overhead — project instructions

<!-- Maintainer note, stripped before this file enters Claude's context.
     Keep under ~200 lines: this loads on EVERY session and long files reduce adherence.
     Deliberately uses NO @ imports. An @ import loads the whole target file at launch,
     so importing the docs set would add ~700 lines to every session for no benefit.
     Paths below are in backticks, which keeps them literal — Claude reads them on demand. -->

Overhead is a single-user personal finance and life-logistics app. Phase 1 is a
subscription and recurring-cost tracker: connect multiple inboxes read-only,
enter subscriptions manually, reconcile the two sources, show a billing dashboard.

Read on demand, not preloaded: `docs/PROJECT_BRIEF.md` (full scope and rationale),
`docs/PHASES.md` (current phase + checklists), `docs/MEMORY.md` (where things stand).
At the start of a session that will change code, read `docs/MEMORY.md` first.

## Non-negotiables

- **Manual entry is the primary data source.** Email detection confirms and
  supplements it. Never write code that treats email as authoritative over a
  user-entered record.
- **Inboxes are read-only.** Request read-only OAuth scopes. Never send, modify,
  label, delete, or draft mail. If a task seems to need write access, stop and ask.
- **Never log or print email bodies, subjects, OAuth tokens, or refresh tokens.**
  Redact in errors too. Rules and threat model: `docs/SECURITY.md`.
- **Every automated financial suggestion writes a `reasoning` record.** No silent
  recommendations.

## Commands

```
pnpm dev              # local dev server
pnpm test             # unit tests (Vitest), watch off
pnpm test:int         # integration tests (Vitest + test DB)
pnpm test:e2e         # Playwright
pnpm typecheck        # tsc --noEmit
pnpm lint             # eslint
pnpm db:generate      # generate Drizzle migration from schema
pnpm db:migrate       # apply migrations
pnpm verify           # typecheck + lint + test + test:int  <- run before declaring done
```

## Testing rule

After completing any task that closes a checklist item in `docs/PHASES.md`, run
`pnpm verify` and report the result. Do not mark work complete on a red suite.
Conventions load automatically from `.claude/rules/testing.md` when touching
tests or server logic. Rationale: `docs/TESTING.md`.

## Stack

TypeScript · Next.js (App Router) · Supabase Postgres · Drizzle ORM ·
Tailwind + shadcn/ui · Vitest · Playwright · Anthropic SDK for email classification.

Layout, boundaries, data flow: `docs/ARCHITECTURE.md`
Schema and the reconciliation algorithm: `docs/DATA_MODEL.md`
Which tool for which job, and why: `docs/TOOLS.md`

## Conventions

- Money is stored as **integer minor units** (cents) plus an ISO-4217 `currency`
  string. Never store money as a float. Never do arithmetic across currencies
  without an explicit conversion step.
- All timestamps stored UTC (`timestamptz`). Convert to the user's timezone only
  at the render layer.
- Server-only modules live under `src/server/`. Anything importing a secret must
  be inside it. Client components never import from `src/server/`.
- Domain logic goes in `src/server/domain/` as pure functions with no I/O, so it
  is unit-testable without a database. Reconciliation especially.
- Named exports only. No default exports except Next.js page/layout files.
- Zod-validate at every boundary: HTTP handlers, LLM JSON output, provider payloads.

## Working agreements

- Prefer clarifying over guessing when a requirement is ambiguous. State the
  assumption inline if proceeding.
- When a scoping decision is made, append it to `docs/DECISIONS.md` with the
  rationale — not just the choice.
- Update `docs/MEMORY.md` at the end of any session that changed project state.
- When something non-obvious is learned or a wrong assumption is corrected,
  append it to `docs/LEARNED.md`.
- Don't add a dependency without saying why in the same message.
- Don't scaffold future-phase features. Phase boundaries in `docs/PHASES.md` are
  deliberate.
