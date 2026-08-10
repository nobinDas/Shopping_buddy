# Memory — project state

**Purpose:** the handoff file. A new Claude Code session, a different AI tool, or
future-you after three weeks away should be able to read this and know exactly
where things stand without re-reading the repo.

**Update it at the end of any session that changed project state.** Not every
session — a session that only answered questions changes nothing.

> **Note on the name.** Claude Code has its own automatic memory at
> `~/.claude/projects/<project>/memory/MEMORY.md`. That one is machine-local: it
> does not travel with the repo, across machines, or to another tool. This file is
> committed to the repo, which is what makes it portable. They coexist; keep this
> one authoritative for project state.

---

## Current state

**Phase:** 0 — Foundation, in progress (4 of 9 checklist items done)
**Last updated:** 2026-08-10

### Done

- Project scoped through five phases
- Phase 1 design settled: manual entry primary, email detection confirmatory,
  reconciliation between them
- Insurance re-quoting descoped with rationale recorded
- Documentation set written
- Stack chosen (see `TOOLS.md`)
- Repo initialised, pushed to `github.com/nobinDas/Shopping_buddy`
- TypeScript strict config, ESLint (flat config, boundary rules for
  `domain/` and `lib/`), Prettier — all wired and verified
- Next.js App Router skeleton, Tailwind v4 wired to the `DESIGN.md` tokens
- Real Supabase project (`shopping buddy`), Drizzle configured, one trivial
  migration applied and independently verified (see ADR-006)
- Single-user auth: Supabase magic-link sign-in, middleware-gated routes,
  sign-out — working end to end against real email delivery (Gmail SMTP)

### In progress

Nothing mid-task. Phase 0 checklist items 0.5–0.9 not yet started.

### Next

Phase 0.5 — Vitest configured with one passing unit test, then 0.6 Playwright,
0.7 `pnpm verify`, 0.8 CI, 0.9 finish `.env.example`.

### Blocked

Nothing.

---

## Open questions

Things genuinely undecided. Resolving one means moving it to `DECISIONS.md` with
its rationale and deleting it here.

- Encryption key management for OAuth tokens: env var for now, but what is the
  rotation story?
- Timezone handling for billing dates — the user's zone, or the vendor's? They
  diverge for annual renewals near month boundaries.
- Sync frequency: daily is the assumption. Is it enough to catch a trial
  conversion before it bills?

---

## How to update this file

At the end of a working session, rewrite the sections above to reflect reality —
this is a snapshot, not a log. Then append a dated entry to the log below.

Keep the snapshot short. If it grows past a screen, detail has leaked in that
belongs in `PHASES.md` (progress), `DECISIONS.md` (choices), or `LEARNED.md`
(insight).

---

## Session log

Newest first. One entry per working session. Four lines each:

```
### YYYY-MM-DD — short title
**Did:** what changed
**Decided:** any choice made, with a link to the DECISIONS.md entry
**Next:** the immediate next action
```

Say what was *actually done*, not what was discussed. A session that explored
options and settled nothing should say so — that is useful information for the
next session, and pretending otherwise wastes its time.

---

### 2026-08-10 — Phase 0.1–0.4 done: tooling, skeleton, Supabase, auth
**Did:** Repo/TS/ESLint/Prettier set up and verified. Next.js App Router
skeleton with Tailwind wired to `DESIGN.md` tokens. Real Supabase project
created, Drizzle configured, first migration applied and confirmed via
`list_tables`. Single-user magic-link auth built, debugged, and confirmed
working end to end (real email received, real click-through, real session).
Three real bugs found and fixed along the way, recorded in `LEARNED.md`:
Supabase's PostgREST exposes every table by default (RLS must be explicit
per table going forward — now a `SECURITY.md` checklist item), Gmail's
link-prefetching silently burns magic-link tokens before the user clicks
(fixed with a click-to-confirm page instead of verify-on-GET), and Gmail
SMTP requires an App Password, not the account password or any other
credential — this got confused with the database password mid-session and
cost real time.
**Decided:** Real Supabase project for local dev too, not Docker Postgres —
see ADR-006. Rationale: Phase 0.4 needed real Supabase Auth, which Docker
Postgres alone can't provide.
**Next:** Phase 0.5 — Vitest configured with one passing unit test.

---

### 2026-08-08 — Project scoped and documented
**Did:** Settled the project shape across five phases. Wrote the documentation set.
Chose the stack: self-built Next.js app with Claude API for classification, over
an enterprise agent platform or a local model.
**Decided:** Manual entry is the primary data source. Insurance re-quoting is out
of scope. Phase 0 added ahead of Phase 1 for foundation work. See `DECISIONS.md`.
**Next:** Phase 0 — repo initialisation and app skeleton.
