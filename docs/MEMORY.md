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

**Phase:** 1 — Subscription tracker MVP. Phase 0 complete and deployed. 1a
fully done; 1b done except one item. A new Phase 1.5 (frontend design pass)
is now inserted before 1c — see ADR-007.
**Last updated:** 2026-08-21

### Done

Phase 0 (see `PHASES.md` for the full checklist — repo/tooling, Supabase +
Drizzle, single-user auth, Vitest/Playwright, `pnpm verify`, CI, `.env.example`,
Vercel production deploy).

Phase 1a — complete:

- `subscriptions` and `price_history` schema, money as integer minor units,
  migrated to the real Supabase Postgres (migration `0001`)
- `domain/billing-cycle.ts`: `computeNextBillingDate`, pure/deterministic,
  tests cover month-end rollover, leap years (incl. Feb 29 anchors), DST
  boundaries, and custom-interval validation
- `domain/vendor-key.ts`: `normalizeVendorKey` — lowercase, strip punctuation
  and diacritics, collapse whitespace. Used at create/edit time so
  `vendor_key` exists from day one, and written to be reused unchanged by
  `domain/reconcile.ts` (Phase 1e, not built) for exact vendor matching
- `lib/validation/subscription.ts`: Zod boundary schema for subscription
  create/edit — added the `zod` dependency for this, per `CLAUDE.md`'s
  "Zod-validate at every boundary." Cross-checks `cycle`/`cycleDays`
  agreement, same rule `billing-cycle.ts` enforces internally
- `services/subscription.service.ts`: `createSubscription`,
  `updateSubscription`, `archiveSubscription`. Update writes a
  `price_history` row only when amount/currency actually changed; create
  writes a *starting* price_history row effective from the anchor date —
  a real bug caught by manual browser testing (not the type system): without
  it, a subscription's original price became unrecoverable after its first
  edit. Both wrapped in `db.transaction`, and every function accepts an
  optional `DbClient` so it nests as a savepoint under a test's outer
  transaction rather than opening an isolated, invisible one
- `db/queries/subscriptions.ts`: added `insertSubscription`,
  `updateSubscriptionRow`, `getSubscriptionById`, `getAllSubscriptions`,
  `insertPriceHistory`
- `app/(dashboard)/subscriptions/`: `actions.ts` (server actions, Zod-parsed
  `FormData`), `page.tsx` (list view — all subscriptions regardless of
  status, edit/archive per row), `new/page.tsx`, `[id]/edit/page.tsx`;
  `components/subscription/SubscriptionForm.tsx` shared between create/edit
- `lib/money.ts`: added `parseAmountToMinorUnits` / `minorUnitsToAmountString`
  — string-arithmetic dollar↔cents conversion for form fields, never float
  multiplication
- `domain/burn.ts`: `calculateMonthlyBurn`, normalizes every cycle to a
  monthly-equivalent, rounds at each conversion, buckets by currency
- `lib/dates.ts`: `formatDate`

Phase 1b — done except price history detail:

- Dashboard (`(dashboard)/page.tsx`): monthly + annualised burn,
  upcoming-billing list (recomputed next billing date, not the stored
  column), empty state

Verification:

- `pnpm verify` green: typecheck, lint, 85 unit tests, 9 integration tests
- Manually exercised in a real browser against the real Supabase Postgres:
  create → dashboard burn updates correctly → edit price → confirmed the
  `price_history` row directly in Postgres → archive → dashboard correctly
  falls back to the empty state. Test rows cleaned up afterward
- Committed (`13f8cd0`) and pushed to `origin/main` as of the last session;
  this session's changes not yet committed

### In progress

Nothing mid-task.

### Next

Phase 1.5 — frontend design pass (see ADR-007): every remaining screen in
the product, across every remaining phase, built against mock data before
any further real backend work. Starts with 1b's last open item
(per-subscription detail with price history — real data, no backend work
needed) and shadcn/ui installation, then the mock-data screens for 1c, 1e,
and Phases 2–5. Only after that does 1c's real OAuth work begin. See
`PHASES.md`.

### Blocked

Nothing.

---

## Open questions

Things genuinely undecided. Resolving one means moving it to `DECISIONS.md` with
its rationale and deleting it here.

- Encryption key management for OAuth tokens: env var for now, but what is the
  rotation story?
- Supabase Auth's "Site URL" setting can only point at one place — currently
  `localhost:3000`, kept there deliberately so local magic-link testing keeps
  working. Production (`shopping-buddy-beta.vercel.app`) is deployed and its
  auth *gate* works, but a magic-link request made from production would
  currently email a localhost link. Revisit when the app moves from "being
  built" to "in real daily use" — likely needs separate dev/prod Supabase
  projects (a real cost: two schemas to keep in sync) rather than the single
  shared project from ADR-006, or accept manually flipping Site URL when
  testing production auth end to end.
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

### 2026-08-21 — Subscription write path: create, edit, archive
**Did:** Built out the rest of Phase 1a — `domain/vendor-key.ts`,
`lib/validation/subscription.ts` (added the `zod` dependency),
`services/subscription.service.ts`, the remaining `db/queries/subscriptions.ts`
functions, and the `/subscriptions` list/new/edit pages with a shared
`SubscriptionForm` client component. Found and fixed a real bug via manual
browser testing rather than the type/test layers: `createSubscription` wasn't
writing a starting `price_history` row, so a subscription's original price
became unrecoverable after its first edit — fixed, with an integration test
added for it. Manually verified the full flow live (real browser, real
Postgres): create, dashboard burn update, price edit, `price_history` row
confirmed directly in Postgres, archive, dashboard falling back to the empty
state. Checked off the rest of 1a and 1b's remaining non-price-history items
in `PHASES.md`. `pnpm verify` green (85 unit, 9 integration). Not yet
committed.
**Decided:** `price_history` gets a row at creation time too, not just on
later changes — undocumented in `DATA_MODEL.md` as an explicit rule, but the
only reading of "never update a subscription's amount in place; write
history and recompute" that keeps the original price recoverable. Also
inserted a new Phase 1.5 — frontend design pass — between Phase 1 and Phase
2 in `PHASES.md`, by explicit user request: every remaining screen across
every remaining phase gets built against mock data before any further real
backend work, so the whole product concept is clickable early. See ADR-007.
**Next:** Phase 1.5 — starting with 1b's per-subscription detail (real data)
and shadcn/ui installation.

---

### 2026-08-20 — Dashboard wired to real active subscriptions
**Did:** Added `getActiveSubscriptions` (read-only, accepts an optional
transaction client), `formatMoney`/`formatDate` display helpers, and a
`DbClient` type. Wired the dashboard page to real query results — monthly
burn, annualised burn, and an upcoming-billing list computed from
`billing-cycle.ts` + `burn.ts` (built in the prior session) instead of
placeholder data. Added a shared test fixture builder for subscription rows
and an integration test for status filtering against real Postgres.
`pnpm verify` green (typecheck, lint, 49 unit + 3 integration tests).
Committed and pushed to `origin/main` (`13f8cd0`). Checked off the now-true
items in `PHASES.md`: 1a's schema/billing-cycle/next-billing-date, and 1b's
burn totals/upcoming timeline/empty state.
**Decided:** Nothing new — continues the manual-entry-first design already
recorded in `DECISIONS.md`.
**Next:** 1a's write path — create/edit/archive a subscription. No UI or
server action writes to `subscriptions` yet; everything so far is read-only.

---

### 2026-08-10 — Phase 0 complete: 0.5–0.9 plus a real Vercel deploy
**Did:** Vitest, Playwright, `pnpm verify`, CI, and `.env.example` finished —
all with real content, not placeholders (see each item's own commit message
for specifics; summarized in Current State above). Linked and deployed the
project to Vercel production (`nobindas-projects/shopping-buddy`), set the
three required env vars via `vercel env add` piped from `.env.local` (never
typed into chat), and verified the live deployment's auth gate with curl —
same checks used locally throughout Phase 0.4. GitHub's Vercel integration
failed to auto-connect (would need re-authorizing the Vercel GitHub App
separately); deploys are CLI-triggered for now, not automatic on push.
**Decided:** Leave Supabase Auth's Site URL on localhost rather than switching
to production — added as an open question above rather than silently
resolved either way.
**Next:** Phase 1a — subscriptions schema and manual entry, the first Phase 1
feature and the primary data source per `PROJECT_BRIEF.md`.

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
