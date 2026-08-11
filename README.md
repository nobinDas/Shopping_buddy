# Overhead

A personal finance and life-logistics tool. It answers one question first —
*what am I actually paying for every month?* — and grows from there into
shopping, routing, and price-timing.

> **Name is a placeholder.** Rename before the repo goes public.

## The problem

Recurring costs are invisible by design. They are spread across inboxes,
card statements, family plans, and services with no email trail at all. By the
time the aggregate is visible, it has been wrong for months.

## Phase 1 (current)

A recurring-cost tracker built on two sources that check each other:

- **Manual entry** — you list what you know you pay for. This is the primary
  source. It gives a complete picture on day one and it captures the things
  email never sees: cash payments, family-plan add-ons, employer-provided
  services worth tracking.
- **Email detection** — connect one or more inboxes read-only. An LLM
  classification pass extracts renewals, price changes, and trial conversions,
  deduplicated across inboxes.
- **Reconciliation** — detection confirms or updates what you entered, and
  flags subscriptions you are paying for but never listed.

Output is a dashboard: every recurring cost, its next billing date, its monthly
and annual burn, and the aggregate.

Later phases add insurance as a tracked cost, shopping lists with price checks,
route and deadline planning, and price timing. See `docs/PHASES.md`.

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

## Getting started

```bash
pnpm install
cp .env.example .env.local     # fill in the values
pnpm db:migrate
pnpm dev
```

Requires Node 20+, pnpm, and a Supabase project.

## Status

Phase 0 (foundation) complete, deployed to Vercel. Starting Phase 1
(subscription tracker MVP). Current state of play is always in
`docs/MEMORY.md`.
