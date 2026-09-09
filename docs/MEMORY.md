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

**Phase:** 1 — Subscription tracker MVP. Phase 0, 1a, 1b, and 1.5 are all
complete. Phase 1c (real Google/Microsoft OAuth) is next. A mobile-first
UI/UX redesign (ADR-009) just landed across every existing screen —
UI/UX only, no backend/schema changes, so phase completion status is
unaffected.
**Last updated:** 2026-09-09

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

Phase 1b — complete:

- Dashboard (`(dashboard)/page.tsx`): monthly + annualised burn,
  upcoming-billing list (recomputed next billing date, not the stored
  column), empty state
- `app/(dashboard)/subscriptions/[id]/page.tsx`: per-subscription detail —
  current price, recomputed next billing date, notes, and price history
  (oldest first) with delta copy per `DESIGN.md` ("Went from $15.49 to
  $17.99"), the increase coloured in the oxblood `flag` token. Real data
  throughout, no mocks — the write path already populates `price_history`
  correctly. Added `getPriceHistoryForSubscription` to
  `db/queries/subscriptions.ts` (ordered by `effectiveFrom` ascending) and
  linked subscription names on the list page to this screen

Phase 1.5 — in progress (see ADR-007), two of nine items done:

- shadcn/ui installed (`--base radix`, `--preset nova`; `-d`'s actual
  default pulled in Base UI and a stray Geist font — both removed) and every
  semantic token in `globals.css` remapped onto the existing `DESIGN.md`
  palette rather than shadcn's own grayscale, with no dark theme (DESIGN.md
  specifies one light surface, not a toggle). Fixed a circular
  `--font-sans: var(--font-sans)` shadcn's init introduced, and moved the
  font-variable classNames from `<body>` to `<html>` so shadcn's
  `html { @apply font-sans }` base rule can actually resolve them. Installed
  card/badge/separator/table/alert/skeleton/tabs/dialog/dropdown-menu/
  tooltip; fixed a real `exactOptionalPropertyTypes` type error in the
  generated `dropdown-menu.tsx`. `TooltipProvider` wraps the root layout.
  Ran `pnpm format` across the whole repo while here — formatting had
  drifted on files `pnpm verify` doesn't check
- Burn ribbon (`components/dashboard/BurnRibbon.tsx`), wired into the real
  dashboard, real data: one band per billing *occurrence* in the next twelve
  months (not one per subscription — a monthly sub bills up to twelve times
  in the window), positioned on a continuous day-resolution timeline, height
  scaled by amount, same-day occurrences offset side by side so clustering
  stays visible rather than fully overlapping. Radix Tooltip shows the same
  detail on hover and keyboard focus (verified live: tab-focusing a band
  shows its tooltip exactly like hovering it does). Below 768px the whole
  chart transposes to a vertical timeline (months top-to-bottom, amount as
  bar length) rather than horizontally scrolling — verified live at 390px.
  New domain function `occurrencesInWindow` in `billing-cycle.ts` (8 tests)
  makes this possible: unlike `computeNextBillingDate`, it returns every
  occurrence in a date range, not just the next one
- `app/(dashboard)/accounts/page.tsx` (1c, mock data): a provider dropdown
  ("Connect an inbox"), a table of accounts with status badges, a
  needs-reauth `Alert` using DESIGN.md's own example copy ("Gmail
  connection expired. Reconnect to resume syncing."), and an
  `AlertDialog`-confirmed disconnect that leaves the row visible in a
  disconnected state (with Reconnect/Remove) rather than deleting it
- `app/(dashboard)/review/page.tsx` (1e, mock data): proposal cards for all
  five `reconciliation_proposals` types (confirm/price_update/date_update/
  discovery/cancellation), every card showing its `reasoning` per
  CLAUDE.md's "no silent recommendations" rule, colour-coded per DESIGN.md's
  three signal colours, Accept/Reject moving a card between Pending/Resolved
  `Tabs`
- `app/(dashboard)/insurance/page.tsx` (Phase 2, mock data) + a
  `RenewalReminder` component added to the *real* dashboard: a
  Dialog-based add-policy form (auto vs medical, each its own real term
  length), cards with due-soon highlighting once inside the configurable
  reminder lead time. First screen to use the shadcn input/label/select/
  textarea primitives
- `app/(dashboard)/shopping/page.tsx` (Phase 3, mock data): four named
  lists switched via `Tabs`, items with quantity/store/notes, a per-list
  total that correctly excludes unpriced items rather than treating them as
  zero (DESIGN.md: "'$0.00' and '—' mean different things")
- `app/(dashboard)/trips/page.tsx` (Phase 4, mock data): real leave-by-time
  arithmetic computed backward from a due time across multiple stops, each
  stop's arrival checked against mock store hours for feasibility (flagged
  when a stop would arrive before opening or after closing); one trip
  consolidates two shopping lists into a single multi-stop trip
- `app/(dashboard)/watchlist/page.tsx` (Phase 5, mock data): three watched
  items, each a hand-rolled SVG sparkline (2px round-joined line, one
  sparse endpoint label, per the dataviz skill's mark spec) plus a
  buy-now-or-wait badge and written reasoning. A real bug caught by manual
  verification: the endpoint label clipped into the card above it when a
  trend's last point sat near the chart's own top edge — fixed by reserving
  dedicated headroom in the SVG geometry rather than positioning the label
  directly off the point

Phase 1.5 closed out with an accessibility/states audit across everything
above:

- A post-build contrast audit (computed WCAG relative-luminance ratios, not
  eyeballed) found and fixed two real failures: `--color-pending` (the ochre
  badge text in the review queue and watchlist) measured 2.92–3.24:1 against
  DESIGN.md's own surfaces, below the 4.5:1 text minimum — darkened to
  `#7A5216` (≥5.4:1 on both). Form-control borders (`--input`, used by every
  shadcn Input/Select/Textarea) measured 1.39:1 via `--color-rule`, below
  WCAG 1.4.11's 3:1 floor for a UI component boundary — added a dedicated
  `--color-control-border` token (`#787B76`) rather than darkening `--rule`
  itself, which stays untouched for decorative dividers/table borders that
  1.4.11 doesn't govern. Both changes recorded in `DESIGN.md`'s token table
  with the measured numbers, per that file's own "revise deliberately" rule
- A live keyboard-navigation check surfaced a real, more serious bug no
  contrast calculation would have caught: `--accent` (the hover/focus
  highlight shadcn's Select and DropdownMenu items use) and `--popover`
  (the panel they sit inside) both resolved to the identical `surface-2`
  value, making keyboard focus genuinely invisible when tabbing through
  either component's options — confirmed by tabbing through a real Select
  and seeing zero visual change. Fixed by pointing `--accent` at
  `--color-rule` instead, confirmed fixed the same way afterward
- Added a global `prefers-reduced-motion` override in `globals.css`:
  `tw-animate-css` (the animation utilities shadcn's Dialog/AlertDialog/
  Select/DropdownMenu draw on) has no built-in reduced-motion handling —
  checked its source directly rather than assuming
- Added the empty/loading/error states the checklist asked for: empty-state
  guards on `trips`/`watchlist` (the only two screens missing one — every
  other mock screen already had one from when it was first built), a shared
  `(dashboard)/loading.tsx` skeleton, a `(dashboard)/error.tsx` boundary
  that never renders `error.message` (could carry internal detail
  CLAUDE.md's security rules don't want surfaced), and a styled
  `(dashboard)/not-found.tsx` — before this, `notFound()` calls in the
  subscription detail/edit pages fell through to Next's unstyled default,
  confirmed live by visiting a nonexistent subscription id
- Manually re-checked one thing that turned out NOT to be a bug: the
  accounts table appeared to clip its Actions column at a narrow viewport
  screenshot, but scrolling within it confirmed shadcn's `Table` already
  wraps itself in `overflow-x-auto` and the content was reachable by
  scroll, not lost — worth recording so it isn't "fixed" again by mistake

Verification:

- `pnpm verify` green throughout: typecheck, lint, 93 unit tests, 11
  integration tests (unchanged since the burn ribbon — every screen after
  it is client-side mock state, nothing new to unit/integration-test)
- Every one of the eight items above independently exercised live in a
  real browser (not just typechecked): subscription CRUD end to end against
  real Postgres; the detail page's price-history delta rendering; the burn
  ribbon at desktop and 390px mobile with keyboard-focus tooltip parity;
  the accounts table's connect/reconnect/disconnect/remove flow including
  the AlertDialog confirmation; the review queue's accept/reject moving
  cards between tabs; the insurance dialog form actually adding a policy;
  the shopping list's tab switching and empty state; the trip screen's
  leave-by/feasibility math checked by hand against the rendered output;
  and the watchlist sparkline bug found and re-verified fixed. Any seeded
  test data cleaned up from Postgres afterward each time
- The accessibility fixes each verified live and independently: the
  contrast fix by re-reading the rendered badges, the focus fix by tabbing
  through a real Select and a real DropdownMenu before and after, the
  not-found boundary by visiting a nonexistent subscription id
- Committed and pushed to `origin/main` through `53c0bd6` (the six screens);
  this session's accessibility/states pass not yet committed. Per explicit
  user request, commits in this repo omit the `Co-Authored-By: Claude`
  trailer

Mobile-first redesign (2026-09-09, ADR-009) — every existing screen
restyled to match a user-authored Claude Design mock (`Overhead Mobile`),
UI/UX only:

- New persistent shell: `app/(dashboard)/layout.tsx` +
  `components/dashboard/BottomNav.tsx`, a 5-tab bottom nav (Dashboard,
  Subscriptions, Review, Shopping, More) replacing the previous nav-less
  flat routing
- New `/more` screen (nav hub for Accounts/Preferred stores/Insurance/
  Trips/Watchlist/Sign out) and new `/stores` ("Preferred stores" —
  mock data, fits Phase 3's already-scoped store-preference concept)
- Dashboard: `domain/burn.ts` gained `groupOccurrencesByMonth` (unit
  tested), backing a new `components/dashboard/BurnMonths.tsx` — a
  tap-a-month bar chart with a drill-down occurrence list, replacing
  `BurnRibbon.tsx` (deleted) and its hover-tooltip interaction, which has
  no touch equivalent
- Subscriptions list/detail/form restyled; Archive moved from the list
  row to the detail screen; `SubscriptionForm` now uses shadcn
  Input/Label/Textarea/Select (previously raw elements) and a segmented
  cycle control instead of a `<select>`
- Review, Shopping, Accounts, Insurance, Trips, Watchlist all restyled to
  the mobile density (flat blocks/checklist rows instead of shadcn
  Table/Card in most cases) — same mock fixture data and logic throughout,
  Shopping and Trips gained real (client-state, not persisted) checkbox
  interactions the mock specified
- Login restyled to match; same `requestMagicLink` action
- Verified live in a real browser end to end: created and archived a real
  subscription against real Postgres, exercised the tap-a-month chart,
  the shopping checklist/store-editor, the trips stop-expand checklist,
  and sign-out → login redirect; test data cleaned up from Postgres
  afterward. `pnpm verify` green throughout (typecheck, lint, 101 unit —
  93 + 8 new for `groupOccurrencesByMonth` — 11 integration)
- See ADR-009 in `DECISIONS.md` for two real gaps this pass surfaced but
  didn't fix, deliberately out of UI-only scope: no unarchive/restore
  action exists in `subscription.service.ts` (the mock's Restore button
  has no backend to call), and the mock's per-occurrence "price changes
  here" row highlight was dropped for real data — the app has no concept
  of a scheduled future price change to highlight

### In progress

Nothing mid-task. Phase 1.5 remains complete; the mobile-first redesign
above is UI/UX only and doesn't change any phase's completion status.

### Next

Phase 1c: real Google OAuth (read-only scope), then Microsoft OAuth,
refresh-token storage encrypted at rest, and incremental sync with a
per-account cursor. The accounts screen already exists (now restyled
mobile-first, still mock data) — this phase replaces its mock state with
real queries against a new `email_accounts` table, not a new UI. See
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
- Restore/unarchive: `subscription.service.ts` only archives, one-way. The
  mobile design's detail screen has a Restore action with nothing to call.
  Worth a small real fix whenever Phase 1a-adjacent work is next touched,
  or deliberately deferred with a reason recorded here if not.

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

### 2026-09-09 — Mobile-first redesign implemented from a user-authored Claude Design mock
**Did:** Imported and implemented `Overhead Mobile.dc.html` (a mobile UI/UX
mock the user built in Claude Design) via the `DesignSync` MCP tool —
`/design-login` authorized access, then `get_project`/`list_files`/
`get_file` pulled the design's markup and token values, which matched
`globals.css` exactly (no palette change needed). Built a persistent
bottom-nav shell (`(dashboard)/layout.tsx`, `BottomNav.tsx`), restyled
every existing screen to match, added `/more` and `/stores` (new,
mock data), replaced the burn ribbon with a tap-a-month chart backed by
a new tested `groupOccurrencesByMonth` in `domain/burn.ts`, and deleted
the now-unused `BurnRibbon.tsx`. UI/UX only, per explicit user scoping —
no schema or backend changes; every mock screen kept its existing mock
data, every real screen (dashboard, subscriptions) kept its existing
Postgres queries. Full detail in the Current State section above.
Verified live in a real browser: created a real subscription, exercised
every screen's core interaction, cleaned up the test row from Postgres
afterward. `pnpm verify` green (101 unit incl. 8 new, 11 integration).
Not yet committed.
**Decided:** Recorded as ADR-009 in `DECISIONS.md` — mobile-first is now
the standing design direction for all future UI/UX work, not a one-off
redesign; the "More" IA and persistent tab shell came directly from the
design's own state machine, not an independent choice. Two real gaps the
pass surfaced were deliberately left unfixed as out of UI-only scope: no
unarchive/restore action exists on the backend (mock detail screen shows
a static "Archived" label instead of a Restore button), and the mock's
per-occurrence price-change highlight was dropped from the real dashboard
since the app has no concept of a scheduled future price change to
highlight against.
**Next:** Phase 1c — real Google/Microsoft OAuth (unchanged from before
this session). Separately, consider a small pass to add real unarchive to
`subscription.service.ts` so the detail screen's Restore action has
something to call.

---

### 2026-09-01 — RLS enabled on every public table
**Did:** Supabase's security advisor flagged `phase0_healthcheck` for missing
RLS. Checking the rest of the schema found `subscriptions` and
`price_history` — both holding real data — had the same gap, which
`SECURITY.md`'s own checklist had already called out as required. Added
`.enableRLS()` to all three tables in `schema.ts`, generated and applied
migration `0002_fluffy_ozymandias.sql`. `pnpm verify` stays green afterward,
confirming the server's direct `DATABASE_URL` connection (which owns the
tables) is unaffected while the PostgREST anon/authenticated API is now
deny-all.
**Decided:** RLS enabled with zero policies rather than per-row ownership
policies, since the app has no owner column by design and never queries
these tables through PostgREST/anon key — see ADR-008 in `DECISIONS.md`.
**Next:** Phase 1c: real Google OAuth, then Microsoft OAuth (unchanged from
before this session).

---

### 2026-08-25 — Phase 1.5 closed out: accessibility and states audit
**Did:** Closed Phase 1.5's last two checklist items with a real audit, not
a self-check — see the Phase 1.5 section under Current State above for the
full list. Computed WCAG contrast ratios (relative-luminance formula, not
eyeballed) for every colour pair actually in use and found two real
failures: `--color-pending`'s badge text (2.92–3.24:1, needs 4.5) and form
input borders via `--input` (1.39:1, needs 3:1 per WCAG 1.4.11) — fixed
both and recorded the new values in `DESIGN.md` with the numbers. A live
keyboard-navigation check then surfaced a more serious bug no contrast
calculation would catch: Select and DropdownMenu focus was completely
invisible because `--accent` and `--popover` resolved to the same colour —
confirmed by tabbing through a real dropdown, fixed, and reconfirmed the
same way. Added a global `prefers-reduced-motion` override (checked
tw-animate-css's source first — it has none built in), a shared
`(dashboard)/loading.tsx`, an `(dashboard)/error.tsx` that never renders
`error.message`, a styled `(dashboard)/not-found.tsx` (previously fell
through to Next's unstyled default — confirmed by visiting a nonexistent
subscription id), and empty-state guards on `trips`/`watchlist`. Checked
one suspected bug (accounts table clipping at a narrow width) and
confirmed it wasn't one — shadcn's `Table` already scrolls internally.
Checked off both remaining `PHASES.md` items — **Phase 1.5 is complete**.
**Decided:** Fixed the WCAG failures by darkening the specific tokens
(`--color-pending`, adding `--color-control-border`) rather than the
generic `--color-rule`, to avoid changing decorative dividers/table
borders that WCAG 1.4.11 doesn't govern — a scoped fix over a broad one.
**Next:** Phase 1c — real Google/Microsoft OAuth, replacing the accounts
screen's mock data with a real `email_accounts` table and real queries.

---

### 2026-08-25 — Phase 1.5's six mock-data screens
**Did:** Built all six remaining mock-data screens: `accounts` (1c),
`review` (1e), `insurance` (Phase 2, plus a real dashboard `RenewalReminder`
banner), `shopping` (Phase 3), `trips` (Phase 4), `watchlist` (Phase 5) —
see the Phase 1.5 section under Current State above for what each one
covers. Installed the shadcn input/label/select/textarea primitives for the
first form-heavy screens (insurance, shopping). Ran `pnpm verify` and
manually exercised every screen live in the browser after building it, not
just at the end — this caught a genuine label-collision bug in the
watchlist's hand-rolled SVG sparkline immediately rather than at a final
pass, fixed by reserving headroom in the chart geometry, per the dataviz
skill's "a label that won't fit doesn't get clipped." Checked off all six remaining screen items in
`PHASES.md` — Phase 1.5 is now 7 of 9 done.
**Decided:** Nothing new scoping-wise — this was straight execution against
Phase 1.5's already-agreed item list (ADR-007), verifying and committing
one screen at a time per the user's explicit "keep going through them one
at a time" instruction, rather than batching them into one large commit.
**Next:** Phase 1.5's final two items — empty/loading/error states and the
DESIGN.md quality-floor pass, both cross-cutting over every screen rather
than new screens of their own.

---

### 2026-08-25 — Phase 1.5 started: shadcn/ui and the burn ribbon
**Did:** Installed shadcn/ui (`radix` base, `nova` preset) and remapped every
generated semantic token onto the existing `DESIGN.md` palette instead of
shadcn's own — see the Phase 1.5 section under Current State above for the
full list of what that involved (a circular font-var bug, a
`<body>`→`<html>` font-scoping fix, an unused `@base-ui/react` dep, a real
`exactOptionalPropertyTypes` type error in generated `dropdown-menu.tsx`).
Built the burn ribbon (`components/dashboard/BurnRibbon.tsx`) on the real
dashboard against real subscription data — a continuous day-resolution
timeline, one band per billing occurrence (not per subscription), height
scaled by amount, same-day occurrences offset instead of overlapping, a
Radix Tooltip with hover/focus parity, and a transposed vertical layout
below 768px per `DESIGN.md`. Added `occurrencesInWindow` to
`billing-cycle.ts` to make the "every occurrence in a window" query
possible. `pnpm verify` green (93 unit, 11 integration). Manually verified
live with six varied real subscriptions at both desktop and 390px mobile
widths, including a real keyboard-focus tooltip check. Checked off both
items in `PHASES.md`. Ran `pnpm format` across the whole repo — formatting
had drifted on files outside `pnpm verify`'s scope.
**Decided:** No dark mode — shadcn's init scaffolds one by default, but
`DESIGN.md` specifies a single light "paper" surface, not a toggle, so the
`.dark` block was removed rather than left unused.
**Next:** Phase 1.5, continued — mock-data screens for 1c (connected
accounts) and 1e (review queue) next, then Phases 2–5.

---

### 2026-08-25 — Per-subscription detail with price history
**Did:** Built `app/(dashboard)/subscriptions/[id]/page.tsx` — 1b's last open
checklist item. Added `getPriceHistoryForSubscription` to
`db/queries/subscriptions.ts` (ordered oldest-first, with an integration
test covering both the ordering and the empty case), and linked subscription
names on the list page to the new detail screen. Price history renders as
`DESIGN.md` specifies — "Went from $15.49 to $17.99" — with increases
coloured in the oxblood `flag` token; the starting price gets its own
"Started at" line rather than a delta. `pnpm verify` green (85 unit, 11
integration). Manually verified live: created a subscription, edited its
price once, confirmed both the starting and the changed price_history rows
rendered correctly with the right colouring and dates. Test data cleaned up
afterward. Checked off 1b's last item in `PHASES.md` — Phase 1b is now fully
complete.
**Decided:** Nothing new — this was real data throughout (no mocks), since
the backend for it already existed from the previous session's write-path
work.
**Next:** Phase 1.5 — frontend design pass, starting with shadcn/ui and the
burn ribbon.

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
