# Purleen

A single-user personal finance and life-logistics app. It starts from one
question — *what am I actually paying for every month?* — and grows into
shopping, store routing, and price-timing on top of that same foundation.

> **Name is a placeholder.** Rename before the repo goes public.

## The problem

Recurring costs are invisible by design. They're spread across inboxes, card
statements, family plans, and services with no email trail at all. By the
time the aggregate is visible, it's been wrong for months.

## What's built

**Manual entry is the primary data source; email detection confirms and
supplements it — never the other way around.**

- **Subscriptions** — recurring costs entered manually, each with amount,
  billing cycle, and next billing date; a dashboard shows monthly/annual
  burn and an upcoming-billing timeline.
- **Insurance** — tracked as a recurring cost alongside subscriptions, with
  renewal reminders.
- **Inbox detection** — connect a Gmail inbox read-only; Claude classifies
  and extracts renewals, price changes, trial conversions, and payment
  failures, deduplicated across inboxes. Detected signals are reconciled
  against what you entered and surfaced in a review queue — they confirm or
  supplement manual entries, never override them silently.
- **Shopping lists** — items with quantity, notes, and an optional preferred
  store.
- **Preferred stores** — name and address, resolved against Google Places
  for opening hours. Address entry uses Places Autocomplete: you pick from
  real suggested addresses, a hand-typed address can't be submitted.
- **Trips** — outstanding shopping stops grouped by store into one
  continuous route view, with real drive times and an open-now/closed-now
  indicator per store (Google Routes + Places APIs).
- **Watchlist** — track a price-drop target for big-ticket items; a monthly
  cron checks tracked items across stores automatically (Google Shopping
  via SerpApi), and every automated suggestion writes a `reasoning` record —
  no silent recommendations.

See `docs/PHASES.md` for the full phase-by-phase breakdown and exit
criteria, and `docs/MEMORY.md` for exactly where things stand right now.

## Documentation

| File | What is in it |
| --- | --- |
| `CLAUDE.md` | Standing instructions for Claude Code |
| `AGENTS.md` | Same, for other AI coding tools |
| `docs/PROJECT_BRIEF.md` | Full project description and scope rationale |
| `docs/PHASES.md` | Phase 0–5 breakdown with exit criteria |
| `docs/ARCHITECTURE.md` | Folder structure, boundaries, data flow |
| `docs/DATA_MODEL.md` | Schema and reconciliation algorithm |
| `docs/DESIGN.md` | Visual direction, design tokens, Higgsfield usage |
| `docs/TOOLS.md` | Which tool or library for which job, and why |
| `docs/TESTING.md` | Test strategy, coverage targets, fixtures |
| `docs/SECURITY.md` | Token handling, PII, threat model |
| `docs/DECISIONS.md` | Architecture decision records |
| `docs/GLOSSARY.md` | Domain vocabulary |
| `docs/MEMORY.md` | Rolling project state for session handoff |
| `docs/LEARNED.md` | Learning log for the portfolio write-up |

## Stack

TypeScript · Next.js (App Router) · Supabase Postgres · Drizzle ORM ·
Tailwind + shadcn/ui · Vitest + Playwright · Anthropic SDK (email
classification) · Google OAuth (Gmail, read-only) · Google Maps Platform
(Places + Routes) · SerpApi (Google Shopping)

## Getting started

```bash
pnpm install
cp .env.example .env.local     # fill in the values — see comments in the file
pnpm db:migrate
pnpm dev
```

Requires Node 20+, pnpm, and a Supabase project. `.env.example` documents
every variable the app reads and where to get it (Supabase, Google OAuth,
Google Maps Platform, Anthropic, SerpApi, cron secret).

## Commands

```
pnpm dev              # local dev server
pnpm test             # unit tests (Vitest)
pnpm test:int         # integration tests (Vitest + test DB)
pnpm test:golden      # golden-fixture tests against the live Claude API
pnpm test:e2e         # Playwright
pnpm typecheck        # tsc --noEmit
pnpm lint             # eslint
pnpm verify           # typecheck + lint + test + test:int
```

## Non-negotiables

- Manual entry is the primary data source; email detection never overrides it silently.
- Inboxes are read-only — no send, modify, label, delete, or draft access.
- Email bodies, subjects, and OAuth/refresh tokens are never logged or printed.
- Every automated financial suggestion writes a `reasoning` record.

Full rationale in `docs/SECURITY.md` and `CLAUDE.md`.

## Status

Phases 0 through 5 are complete and live-verified against real accounts and
APIs (Supabase, Gmail, Google Maps Platform, Google Shopping via SerpApi,
Claude). Inbox detection (Phase 1d) is implementation-complete for Gmail;
Microsoft OAuth is deferred. Current state of play is always in
`docs/MEMORY.md`.
