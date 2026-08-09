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

**Phase:** 0 — Foundation, not started
**Last updated:** _(set on first real update)_

### Done

- Project scoped through five phases
- Phase 1 design settled: manual entry primary, email detection confirmatory,
  reconciliation between them
- Insurance re-quoting descoped with rationale recorded
- Documentation set written
- Stack chosen (see `TOOLS.md`)

### In progress

Nothing yet.

### Next

Phase 0 checklist in `PHASES.md`. First real task: repo initialisation and the
Next.js skeleton matching `ARCHITECTURE.md`.

### Blocked

Nothing.

---

## Open questions

Things genuinely undecided. Resolving one means moving it to `DECISIONS.md` with
its rationale and deleting it here.

- Local development database: Docker Postgres or a Supabase branch?
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

### 2026-08-08 — Project scoped and documented
**Did:** Settled the project shape across five phases. Wrote the documentation set.
Chose the stack: self-built Next.js app with Claude API for classification, over
an enterprise agent platform or a local model.
**Decided:** Manual entry is the primary data source. Insurance re-quoting is out
of scope. Phase 0 added ahead of Phase 1 for foundation work. See `DECISIONS.md`.
**Next:** Phase 0 — repo initialisation and app skeleton.
