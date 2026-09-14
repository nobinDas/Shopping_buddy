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
complete. **Phase 1c is mostly done**: real Google OAuth connect/
disconnect/refresh is live and verified against a real Google account —
3 of 5 checklist items checked off in `PHASES.md`. Remaining: Microsoft
OAuth, and incremental sync (`sync_cursor`) — deliberately deferred, see
below. **Phase 2 (Insurance) is complete** — all 4 checklist items, real
schema, live-verified. **Phase 3 (Shopping list, single-store price
check) is complete, but its per-item Walmart price-check was retired in
Phase 5** (see below) — the shopping-list CRUD/due-date/store/checked-off
scope stays real and live. **Phase 4 (redesigned as a continuous
route/duration view, ADR-013) is complete** — all 5 checklist items,
live-verified against the real Google Routes API and Places API (New).
**Phase 5 (redesigned as a standalone Watchlist, ADR-014) is complete** —
all 4 checklist items, live-verified against the real Google Shopping API
(via SerpApi), a real price-drop badge confirmed end to end across the
bottom nav → More → Watchlist. **Phase 1d (Detection) is
implementation-complete and fully live-verified end to end against a real
Gmail account**, LangSmith already removed: real `detected_signals`
schema, Gmail history.list sync, a pre-filter, Claude
classification/extraction (Haiku 4.5 primary, Sonnet 5 escalation
triggered by two specific evidence-based output checks, not a confidence
threshold — ADR-017 replaces the confidence-threshold design
ADR-016/ADR-004 originally specified, after it was confirmed not to catch
real failures; ADR-016's model choice itself — Claude over a Gemini
detour, ADR-015, and over local Ollama models — is unaffected and still
stands), amounts and billing dates extracted as verbatim text and parsed
deterministically in code (not computed by the model —
`domain/parse-amount-span.ts`, `domain/parse-date-span.ts`), and a "Sync
now" trigger on `/accounts`. `pnpm verify` green (214 unit, 77
integration) and `pnpm test:golden` green and stable across repeated runs
— 24/25 real fixtures pass against the live Claude API (the one failure
is a defensible signal-type judgment call, not a bug). A real end-to-end
sync against a real Gmail account succeeded: 50 messages scanned, only 3
passed the pre-filter and became real `detected_signals` rows (real
vendors — Xfinity, Gas South, Tello — with amount/date correctly left
null rather than guessed where the source email didn't state them),
`sync_cursor`/`last_synced_at` updated correctly, a second sync a clean
no-op, and the server log confirmed to contain zero email content. Along
the way, found and fixed a real, unrelated bug (a 3-day-stale dev server
process serving broken Watchlist-query code) and a real account-state
mismatch (the connected Gmail account's OAuth grant had been revoked
outside the app, but the local row still said "active" — fixed via a
🛑-approved disconnect and fresh reconnect). Cross-inbox dedup is the one
piece still genuinely unverified live — it needs a second connected
inbox, which doesn't exist yet; everything else in the pipeline is now
proven against real data, not just fixtures. **A narrow real slice of
`/review` (ADR-018) is also built and live-verified**: when a signal's
amount/currency/billingDate all come back null, a Sonnet-only call writes
a short paraphrased brief + action-required flag. Rendered in
`components/review/ReviewList.tsx`, one unified, date-sorted Pending/
Resolved list mixing these real signals with the still-mock proposal
cards (the two started as separate sections, merged into one the same
day on direct user request) — every card shows "Go to email" (real for
needs-review signals; an explicitly-placeholder id for the 6 mock
proposals, for visual consistency only), and needs-review cards
additionally get "Archive". `/review`'s mock cards themselves stay mock
data until Phase 1e. Live-verified via the browser for 2 of the 3 real
unclear-extraction emails found in the prior session (Xfinity, Tello);
the third (Gas South) surfaced and led to fixing a real bug — Sonnet
could return a response with zero text blocks when its adaptive thinking
consumed the whole shared token budget (`LEARNED.md`, 2026-09-14) — now
fixed with a per-model token budget and re-confirmed correct directly
against the real API. Per
ADR-010, Phase 1e (Reconciliation) is the one remaining full phase;
Microsoft OAuth is likewise unscheduled. A mobile-first UI/UX redesign
(ADR-009) landed across every existing screen earlier.
**Last updated:** 2026-09-14

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
- See ADR-009 in `DECISIONS.md` for a real gap this pass surfaced but left
  deliberately unfixed as out of UI-only scope: no unarchive/restore
  action existed in `subscription.service.ts` (the mock's Restore button
  had no backend to call) — **closed in a same-day follow-up**, see the
  entry immediately below. The mock's per-occurrence "price changes here"
  row highlight is still dropped for real data — the app has no concept
  of a scheduled future price change to highlight

Phase 1c, stage 1 (2026-09-10) — schema, encryption, query layer, no
OAuth yet:

- `email_accounts` table added to `schema.ts` (`emailProviderEnum`,
  `emailAccountStatusEnum`), migration `0003` generated and applied to
  the real Supabase Postgres, RLS enabled matching every other table.
  Token columns use a `bytea` custom type (`customType()` — Drizzle's
  pg-core has no built-in `bytea` helper); the `postgres` driver already
  parses it to/from a Node `Buffer` at the wire level, no mapping needed
- `providers/crypto.ts`: `encryptToken`/`decryptToken`, AES-256-GCM via
  Node's built-in `crypto` (no new dependency), key from
  `TOKEN_ENCRYPTION_KEY`. Output layout `iv || authTag || ciphertext`,
  self-contained. 8 unit tests: round-trip, tamper detection (GCM auth
  tag), wrong-key failure, missing/malformed-key failure
- Fixed a real test-infra gap found while writing those tests:
  `import 'server-only'` throws under plain Vitest (it's only a no-op via
  Next's webpack resolver, not the package itself) — added a
  `resolve.alias` in `vitest.config.mts` pointing it at a local no-op
  file. See `docs/LEARNED.md`, 2026-09-10
- `db/queries/email-accounts.ts`: full CRUD mirroring
  `queries/subscriptions.ts`'s shape, plus a real `deleteEmailAccount`
  (hard delete, not a status flag — `docs/SECURITY.md`'s explicit
  disconnect rule). `tests/fixtures/builders.ts` gained `buildEmailAccount`;
  7 new integration tests against real Postgres
- `.env.example` gained `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/
  `TOKEN_ENCRYPTION_KEY` with setup instructions; a real
  `TOKEN_ENCRYPTION_KEY` generated and added to `.env.local` (no external
  account needed for that one, unlike the Google credentials)
- `pnpm verify` green throughout (109 unit — 101 + 8 new — 20
  integration — 13 + 7 new)
- Committed (`b1e82a8`)

Phase 1c, stage 2 (2026-09-10) — the real Google OAuth connect flow:

- User set up a Google Cloud OAuth client (Testing mode, themselves as
  test user) with scopes `gmail.readonly` + `openid`/`email` — the
  latter two decided in-session: without them the app has no way to know
  *which* address a connection belongs to, which would make the accounts
  list unable to tell two connections apart. Neither grants extra Gmail
  access
- `providers/google.ts` (new): `buildAuthorizationUrl` (pure, unit
  tested — right scopes, `access_type=offline` + `prompt=consent` so a
  refresh token reliably comes back), `exchangeCodeForTokens`,
  `refreshAccessToken`, `revokeToken`, `getUserInfo` — one function per
  Google endpoint, matching the "one adapter per external system" rule
- `db/queries/email-accounts.ts` gained `getEmailAccountByProviderAndEmail`
  so connect and reconnect share one find-or-update code path rather than
  two, and (see security fix below) `getAllEmailAccounts` now
  column-selects everything except the two token buffers
- `services/email-account.service.ts` (new): `connectGoogleAccount`,
  `disconnectAccount` (revoke then delete, in that order —
  `docs/SECURITY.md`'s rule), `refreshAccountToken` (moves the account to
  `needs_reauth` on failure rather than throwing). 5 new integration
  tests against real Postgres with `providers/google.ts` mocked at the
  boundary, per `docs/TESTING.md`
- `api/auth/[provider]/start` and `.../callback` route handlers — 404 for
  any provider but `google`, CSRF `state` via a short-lived httpOnly
  cookie
- Accounts screen (`accounts/page.tsx`) converted from Phase 1.5's mock
  `'use client'` array to a real async Server Component + a new
  `components/accounts/AccountsList.tsx` client component
- **A real security bug found live, not by review**: the first version
  passed full `EmailAccountRow`s (including the encrypted token columns)
  from the server component into the client component — a Next.js
  console warning about Buffer serialization was the surface symptom of
  `docs/SECURITY.md`'s "tokens never leave `src/server/`" rule being
  violated. Fixed by column-selecting the token fields out at the query
  level (`EmailAccountSummary` type) rather than just satisfying the
  type checker. Full writeup: `docs/LEARNED.md`, 2026-09-10, marked
  portfolio-worthy
- Verified live end to end with a real Google account: connected
  (real consent screen, landed back on `/accounts` showing the real
  email), disconnected (confirmed the row deleted from Postgres via
  direct query, and the user independently confirmed at
  myaccount.google.com/permissions that Google-side access was actually
  revoked, not just locally deleted)
- `pnpm verify` green (115 unit, 25 integration). Committed (`a3c45fd`)

Phase 2 — Insurance as a recurring cost (2026-09-10), complete, all 4
checklist items:

- Core design call: `insurance_policies` reuses `subscriptions`'
  `cycleEnum`/`statusEnum` rather than a parallel `termMonths`/
  `renewalDate` concept — a 6-month auto policy is `cycle: 'semiannual'`,
  a 12-month medical policy is `cycle: 'annual'`. This means renewal
  reminders and burn fold-in reuse `domain/billing-cycle.ts`'s
  `computeNextBillingDate` and `domain/burn.ts`'s `calculateMonthlyBurn`
  completely unchanged — no new domain logic this phase at all. Matches
  `PHASES.md`'s own framing of the phase ("proves the recurring-cost
  model generalises")
- `insurance_policies` table (migration `0004`, reuses the existing
  `cycle`/`status` Postgres enum types, no duplicates), `policyTypeEnum`
  (`medical`/`auto`, a label only — each policy's own `cycle` already
  captures "different renewal rhythms")
- `lib/validation/insurance.ts`, `db/queries/insurance.ts`,
  `services/insurance.service.ts` — the last one shipped
  `archivePolicy` **and** `restorePolicy` together from the start,
  deliberately not repeating the gap subscriptions' service left (see
  2026-09-09 entry below)
- Real UI: `insurance/page.tsx` (server) + new
  `components/insurance/PolicyList.tsx` (client) — Dialog-based add/edit
  form (edit wasn't in the original mock; added since premiums
  realistically change at every real-world renewal), archive/restore per
  policy. A `nextBillingDate` computed server-side and passed down as a
  plain prop — `PolicyList.tsx` initially imported
  `computeNextBillingDate` directly from `src/server/domain/`, which
  violates `docs/ARCHITECTURE.md`'s "client components never import
  `src/server/**`" boundary; caught before committing, fixed by moving
  the computation into the server component
- Dashboard: `getActivePolicies()` folded into the same burn calculation
  as subscriptions (literal list concatenation, no separate math), and
  the single hardcoded `RenewalReminder` replaced with one banner per
  policy whose renewal falls inside its own `reminderLeadDays` — 0, 1, or
  many
- `pnpm verify` green (115 unit, 33 integration — 8 new this phase).
  Verified live end to end: added a real policy, confirmed the
  dashboard's monthly burn ($840/6mo → $140.00) and a live reminder
  banner both reflected it correctly, edited the premium, archived it
  (confirmed the dashboard's burn and empty-state gate both reacted
  correctly), restored it. One test row deleted from Postgres afterward
  — **with explicit permission first**, per the new delete-approval rule
  in `CLAUDE.md`

Phase 3 — Shopping list, single-store price check (2026-09-10), complete,
all 5 checklist items:

- Researched with the user which store/API to use: Walmart has no public
  self-serve price API; the Affiliate API is a purpose-mismatch (built
  for affiliate-marketing sites, not a personal backend), Marketplace/
  Supplier APIs are for sellers, not shoppers. **Decided: SerpApi's
  Walmart search engine** — free tier 250 searches/month, 50/hour cap.
  See ADR-012
- Four new tables (migration `0005`): `shoppingLists`, `shoppingListItems`
  (quantity/notes/store/unitPriceMinor/currency/checked — checked state
  now **persisted** server-side, unlike the old mock's ephemeral client
  state — /lastPriceCheckedAt), `itemPriceHistory` (append-only, same
  pattern as `price_history`), `preferredStores` (unique-indexed name).
  Seeded the four default lists (Grocery/Household/Personal/One-off) via
  a one-off `execute_sql` insert
- `providers/serpapi.ts` (new): `parseWalmartSearchResponse` (pure, 7
  unit tests) + `searchWalmartPrice` (the real `fetch` call). Live-
  verified against the real API: "Milk, 1gal" returned a real $5.37
  Walmart price
- `db/queries/shopping.ts` + `db/queries/stores.ts`, `services/
  shopping.service.ts` (`addItem`/`updateItem`/`deleteItem`/
  `toggleItemChecked`/`checkItemPrice` — the last returns a typed
  `found`/`not_found`/`error` result rather than throwing, so the UI
  shows real inline feedback), `shopping/actions.ts` + `stores/actions.ts`
- Real UI: `shopping/page.tsx` (server) + new
  `components/shopping/ShoppingLists.tsx` (client, the phase's biggest
  new file — Tabs by list, checkbox/check-price/edit/delete per item,
  inline price-check feedback) and `stores/page.tsx` (server) + new
  `components/stores/PreferredStoresList.tsx` (client). The shopping
  page's store `Select` now sources its options from real
  `getAllStores()` data
- **Design constraint, not an afterthought**: SerpApi's 250/month cap
  makes automatic or bulk price checks actively harmful, so every check
  is deliberately one-click, one-item, user-triggered — no "check all"
  button, no background sync
- Two real bugs self-caught before running tests: the edit panel's store
  `Select` initially wouldn't submit (same Radix pattern already fixed
  twice this session in `SubscriptionForm.tsx`/`PolicyList.tsx` — fixed
  with controlled state + a hidden mirror input), and the price-check
  "found" feedback read the stale outer `item` prop instead of the
  action's fresh return value
- `pnpm verify` green: 122 unit (115 + 7 new), 47 integration (33 + 14
  new). Verified live end to end in a real browser: added an item with
  quantity/notes, checked its real Walmart price ($5.37, confirmed as an
  `item_price_history` row in Postgres), edited it (quantity, notes),
  checked it off (dropped out of the priced subtotal, survived a full
  page reload — proving real persistence), added a preferred store
  ("Trader Joe's", confirmed it appeared in the shopping page's store
  picker), removed the store, deleted the item. The delete/remove-store
  UI actions doubled as test-data cleanup — no direct SQL deletion was
  needed, confirmed via `execute_sql` that all three tables are empty
  afterward

Phase 4 — Continuous route and duration view (2026-09-10), redesigned
mid-planning from the original deadline-driven/leave-by-time scope — see
ADR-013 for the full reasoning:

- `shoppingListItems` gained `dueAt` (optional per-item deadline, date
  only) and `checkedAt` (stamped on check, cleared on uncheck — drives
  the "stays visible through the day it was checked, then hides" rule).
  `preferredStores` gained `address` (plain text, now `.notNull()`),
  `placeId`, `openingHoursText`, `openingHoursPeriods` (Places-resolved,
  once, at store-add time). New single-row `userSettings` table holds the
  saved home address. **No `trips` table at all** — there is no discrete
  trip entity; `/trips` is computed live from outstanding items on every
  load (migration `0006`)
- Three new pure domain modules: `domain/shopping-urgency.ts`
  (urgency sort, per-store soonest-due-date, overdue check),
  `domain/shopping-visibility.ts` (the midnight-hide rule for checked
  items), `domain/store-hours.ts` (open-now check from normalized weekly
  periods), `domain/shopping-duration.ts` (a small, documented item-count
  → minutes estimate)
- `providers/google-maps.ts` (new): Places `searchText` for hours,
  Routes `computeRoutes` with `optimizeWaypointOrder` for the shortest
  visiting order — requested as a round trip (origin = destination = home
  address) so every stop can be freely reordered rather than one being
  pinned as "last," with the final return-to-home leg sliced off before
  returning, since the UI never shows a "drive home" duration. Neither
  function renders anything map-shaped — both return plain numbers
- `services/route.service.ts` (new, no DB write — a typed on-demand
  computation), `services/stores.service.ts` (new — inserts a store, then
  resolves its hours via Places; a miss isn't fatal), `shopping.service.ts`
  extended (`dueAt` on add/update, `checkedAt` stamped in
  `toggleItemChecked`)
- Real UI: new `/settings` screen (home address), `/stores` gained an
  address field + shows resolved hours per store, `/shopping`'s shared
  `EditPanel` gained an optional due-date field (now exported and reused,
  not duplicated, on `/trips`), and `/trips` rewritten from the
  Phase 1.5 mock into `components/trips/OutstandingStops.tsx` — every
  outstanding item across every list, consolidated and grouped by store,
  sorted by urgency, with click-to-reveal due-date badges, an overdue
  flag (tapping it opens the edit panel directly), an open-now/closed-now
  chip per store, an on-demand "Plan route" button, and drive-time
  dividers + a total-duration summary once a route is planned
- `pnpm verify` green: 149 unit (23 new), 56 integration (9 new)
- **A real client/server boundary bug found live, not by review**: the
  first version of `components/trips/OutstandingStops.tsx` (a Client
  Component) imported a helper directly from `db/queries/stores.ts`,
  pulling the `postgres` driver into the client bundle — Next.js's build
  failed outright with `Module not found: Can't resolve 'fs'` the moment
  `/trips` was opened in the browser. Fixed by moving the pure
  jsonb-reading helper (`readOpeningPeriods`) into `domain/store-hours.ts`
  instead, matching the same "client components never import
  `src/server/db` or `src/server/services`" boundary this session already
  fixed twice before (Phase 1c's token-leak bug, Phase 2's
  `computeNextBillingDate` import)
- **Live-verified everything reachable without the Google Maps key**: set
  a real home address (persisted, confirmed via Postgres), added a real
  store with a real address (hours correctly left null with a graceful
  "Hours not found" — the `resolvePlaceHours` failure path, since no key
  is configured yet), added two shopping items with due dates (one
  deliberately in the past), confirmed `/trips` groups by store, sorts by
  urgency, click-to-reveal badges show the right dates (store-level shows
  only the soonest date, no item names), the overdue flag renders and
  opens the edit panel on click, rescheduling clears the flag and
  re-sorts correctly, checking an item off drops it from `/trips`
  immediately while it stays struck-through on `/shopping` (confirming
  the midnight-hide design without needing to wait for midnight), and
  "Plan route" fails gracefully with `GOOGLE_MAPS_API_KEY is not set.`
  shown inline rather than crashing — confirming the whole UI→action→
  service→provider error path end to end even without a real key
- Two of the four test rows didn't clear through flaky UI clicks (the
  REMOVE/delete button occasionally not registering on the first click,
  same intermittent behavior seen in Phase 3); cleaned up the remaining
  "Milk, 1gal" item and "Trader Joe's" store directly via SQL, **with
  explicit `🛑 DELETE APPROVAL` first**, per `CLAUDE.md`'s rule. Left the
  placeholder home address in place — a single settings row the user will
  naturally overwrite with their real address, not something needing
  deletion
- `.env.example` gained `GOOGLE_MAPS_API_KEY` — and, while there, fixed a
  real pre-existing gap: Phase 3's `SERPAPI_API_KEY` was in `.env.local`
  but was never added to `.env.example`, so a fresh clone had no record
  it existed
- **Google Cloud setup completed by the user**: billing enabled, Routes
  API + Places API (New) enabled (legacy Places API disabled — unused by
  this app), the key restricted to just those two APIs with "None"
  application restriction (server-side calls have no HTTP referrer to
  restrict by), and — the real hard safety net, since GCP budgets are
  alert-only and don't stop billing — a **daily request quota** set well
  under each API's free tier: 150/day on Routes' `ComputeRoutes` (≈4,500/
  month vs. the 10,000/month free cap) and 100/day on Places'
  `SearchTextRequest` (≈3,000/month), so real cost risk stays at
  literally $0 regardless of any bug
- **A real bug found via direct `curl` testing against the live Routes
  API, not by review**: with exactly one intermediate stop,
  `computeRoutes` returns `optimizedIntermediateWaypointIndex: [-1]` — a
  sentinel, not a real index — which `parseRouteResponse` was blindly
  trusting. Fixed by validating the returned order is an actual
  permutation of `0..stopCount-1` before using it, falling back to
  natural order otherwise; added a regression test using the real
  response shape confirmed live. Multi-stop routing (2+ stops) was
  already correct — the returned order there is a real permutation
- **Live-verified the real Google API calls end to end**: added two real
  stores (Trader Joe's, Costco, both in Mountain View) and got back real
  weekly hours from Places; set a home address; added two shopping items
  across both stores; `/trips` showed real "OPEN NOW" chips from live
  Places data; "Plan route" returned a real optimized order (Costco
  first, then Trader Joe's) with real drive minutes (5 min home→Costco,
  11 min Costco→Trader Joe's) and a correct total (30 min = 16 min
  driving + 7+7 min shopping estimates)
- `pnpm verify` green: 150 unit (24 new), 56 integration (9 new)
- Committed (`bb1519c`, plus a follow-up fix for the `[-1]` bug)

Phase 5 — Watchlist, redesigned mid-planning from "price timing and stock
check" into a standalone big-ticket-item price-drop tracker (2026-09-11) —
see ADR-014 for the full pivot from Phase 3's per-item Walmart check:

- New `watchlist_items` / `watchlist_price_history` tables (migration
  `0007`), fully independent of `shopping_list_items` — no quantity,
  store, or due date. `domain/price-trend.ts#didPriceDrop` (pure, unit
  tested). `providers/google-shopping.ts` (new) — SerpApi's
  `engine=google_shopping`, picks the **minimum**-priced result across
  sellers (not the top one, a deliberate difference from Phase 3's
  pattern), doubling as the "was anything found at all" stock-availability
  proxy since Google Shopping has no dedicated in-stock field
- `services/watchlist.service.ts`: `checkWatchlistItemPrice` compares a
  new result against the item's *cached* previous price before
  overwriting it, sets `hasPriceDrop` on a real drop; `markWatchlistSeen`
  clears it — fired once when `/watchlist` mounts
- Real UI: `/watchlist` (list + sparkline, ported from the Phase 1.5
  mock's `PriceSparkline` component to real data + a "Check price"
  button), a two-level nav badge — a dot on the bottom nav's More tab
  (`(dashboard)/layout.tsx` now async, fetches `getWatchlistDropCount()`)
  → a dot on the Watchlist row inside `/more` — both clearing once
  `/watchlist` is opened
- **Phase 3's regular-item price-check fully retired**: deleted
  `providers/serpapi.ts` and its test outright; removed `checkItemPrice`/
  `PriceCheckResult` from `shopping.service.ts`, `checkItemPriceAction`
  from `shopping/actions.ts`, and the magnifier icon + "Priced subtotal"
  UI from `ShoppingLists.tsx`. `shoppingListItems.unitPriceMinor`/
  `currency`/`lastPriceCheckedAt` and the historical `item_price_history`
  rows are deliberately **not** touched — schema and data stay, only the
  now-dead application code was removed, per the project's delete/
  edit-approval rule (destroying real collected data for a feature
  retirement has no upside)
- **A real bug caught live, not by review**: the ported `PriceSparkline`
  right-aligns its endpoint price label — fine for the mock's always-6+-
  point fixture data, but a real item's *first-ever* check has exactly one
  point at the sparkline's left edge, so the label ("$31.92") clipped to a
  bare "2" off-canvas. Fixed by anchoring the label from whichever side
  keeps it on-canvas
- `pnpm verify` green: 152 unit (9 new), 65 integration (9 new)
- Live-verified against the real Google Shopping API (via SerpApi): a
  real item ("iPhone 17 Pro 256GB") returned a real $31.92 listing "at
  Walmart" — a genuinely mismatched product for that specific a search
  term, since the provider takes the absolute lowest price with no
  relevance filtering (the same "deliberately narrow, no fuzzy matching"
  tradeoff Phase 3 already accepted, now visibly surfaced) — worth the
  user knowing this is expected behavior, not a bug, if a future check
  returns something obviously wrong for a very specific/narrow query.
  Drop-detection and the two-level badge were verified by staging a
  scenario: an **insert-only** new test row created with `hasPriceDrop`
  already set (an UPDATE to the real item's cached price was requested
  first but blocked outright by Claude Code's own auto-mode safety
  classifier, a separate system guard beyond the user's own approval —
  worth knowing this exists as a hard floor under the project's own
  delete/edit-approval rule, not just a soft convention). Confirmed both
  nav dots appear and both clear together after opening `/watchlist`.
  Confirmed `/shopping` no longer shows any price-check UI while
  everything else (add/edit/due-date/store/checked-off) still works.
  Two browser-click deletions were flaky again (third time this session,
  same intermittent pattern as Phase 3/4) — fell back to direct SQL
  deletes, **with explicit `🛑 DELETE APPROVAL` first**
- Committed (`8119647`)

Small real-bug fixes and UI requests after Phase 5, each committed and
pushed separately (2026-09-11):

- `/more`'s Accounts/Preferred stores/Insurance badges were still Phase
  1.5's hardcoded mock numbers (`1 NEEDS REAUTH`/`4`/`2`) even after each
  screen went real — never wired up. Fixed: real counts from
  `getAllEmailAccounts`/`getAllStores`/`getActivePolicies` (`82d3299`)
- `/trips` now auto-plans the route on every visit using whichever store
  addresses are currently represented among outstanding items — no
  manual "Plan route" button anymore, per explicit request. Deleted the
  now-dead `trips/actions.ts`/`planRouteAction` (`8eb0fa3`)
- Bottom nav reordered to Dashboard, Shopping, Subs, Review, More
  (`f846b23`)
- Shopping list tabs were drifting — Grocery (seeded first) had ended up
  last after repeated test-data updates, since `getAllLists` had no
  `ORDER BY` and the four seeded rows all share one identical `createdAt`
  (one batch insert), so neither natural row order nor timestamp order
  was stable. Fixed with an explicit fixed display order in code, not a
  schema change — list creation isn't a feature (`ca2732a`)
- New feature: per-list **default stores**. `/settings` gained a Default
  stores section (Grocery/Household/Personal — One-off deliberately
  excluded). A new item added with no store chosen falls back to its
  list's default (`shoppingLists.defaultStore`, migration `0008`); a list
  with no default shows a banner on `/shopping` pointing at Settings
  instead of blocking item creation (`f8a60bc`)

### In progress

**Phase 1d (Detection) is implementation-complete and live-verified end
to end against a real Gmail account.** Classification-accuracy work was
committed and pushed (`9775a3b`): `detected_signals` schema (migration
`0009`), `domain/prefilter.ts`/`content-hash.ts`/`dedupe-signals.ts` (all
pure, unit-tested), a versioned prompt (`prompts/classify-email.ts` —
asks for verbatim `amountText`/`billingDateText` spans rather than
computed values), two new pure domain parsers
(`domain/parse-amount-span.ts`/`parse-date-span.ts`, both unit-tested
against every real number/date format seen in the fixtures) that do the
actual currency- and format-aware conversion in code instead of asking
the model to compute it, `providers/gmail.ts` (Gmail `history.list`
incremental sync + metadata/body fetch, extending the OAuth-only
`providers/google.ts`; `getMessageBody` extracts `receivedAt` from
Gmail's own `internalDate`), `providers/anthropic.ts` (Haiku 4.5
primary; Sonnet 5 escalation triggered by two specific, evidence-based
checks on Haiku's output — not a confidence threshold, see ADR-017 —
plus a deterministic, non-escalating correction for a guaranteed
contradiction the prompt already implies: a cancellation's `billingDate`
is always null; native Claude structured output via
`output_config.format` + `zodOutputFormat`), `services/detection.service.ts#syncAccount`
(the real orchestration — pre-filter before any full-body fetch or LLM
call, per `docs/SECURITY.md`), a "Sync now" button per connected account
on `/accounts`, and a `CRON_SECRET`-protected `/api/cron/sync` route (not
scheduled yet). `pnpm verify` green (214 unit, 77 integration) and
`pnpm test:golden` green and stable across repeated runs — 24/25 real
anonymised fixtures pass against the live Claude API, covering all 5
signal types (the one failure, `spotify-gift-subscription`, is a
defensible `trial_conversion`-vs-`new` judgment call, not a bug). **No UI
change to `/review`** — that's Phase 1e, still a separate future phase.

Before landing here, Gemini (ADR-015) was tried and retired (ADR-016):
its free tier turned out to cap at a hard 20 requests/day/model, not a
soft rate limit. Three local Ollama models were also evaluated directly
(`granite3.3:8b`, `qwen3:8b`, `gemma4:latest`) against the same 5
fixtures as a free, fully private alternative — rejected after real
testing (best case 4/5 correct at ~25s/call; worst case a systematic
amount-extraction bug; all three showed uncalibrated ~1.0 confidence
regardless of correctness), confirming ADR-004's original prediction
about small models on this task. Then, live-testing surfaced two
confirmed, reproducible Haiku bugs that the original confidence-threshold
escalation design never caught (Haiku was consistently *confident and
wrong* on both) — fixed by moving date/amount conversion out of the
model into deterministic code, and by replacing the confidence threshold
with evidence-based output checks (ADR-017). One of the two bugs was
root-caused all the way down to a single vendor name ("ZEE5") reliably
breaking an unrelated field's extraction, proven with a controlled swap
test — a genuinely unpredictable-in-advance failure mode, which is the
whole argument for checking output shape after the fact rather than
trying to prompt-engineer around it. Full detail: ADR-016 and ADR-017 in
`DECISIONS.md`, four entries in `LEARNED.md` dated 2026-09-11 through
2026-09-14.

A temporary LangSmith tracing wrap was added for local debugging, then
fully removed (2026-09-14, after the classification-accuracy commit) once
past golden-file testing and moving toward the real live sync — the wrap,
`traceLabel` plumbing, the `langsmith` dependency, and all `LANGSMITH_*`
env vars are gone; `pnpm verify` confirmed green and `pnpm test:golden`
identical (24/25) after removal.

The live sync itself surfaced two real, genuine issues unrelated to
anything built this session, both found and fixed along the way: a
3-day-stale `pnpm dev` process was silently serving broken code for an
existing (Phase 5) Watchlist query, masking as a runtime error on every
dashboard page — killing it and starting fresh resolved it immediately.
Then a real `403` from the Gmail API on the first sync attempt —
root-caused (not guessed) to the connected account's Google-side OAuth
grant having been revoked at some point outside the app (confirmed
directly on `myaccount.google.com/permissions`, which no longer listed
the app at all), while the local `email_accounts` row still said
`active` and its refresh mechanism kept "working" regardless. Fixed with
an explicit 🛑-approved disconnect (revokes + deletes the stale row) and
a fresh reconnect through the real Google consent screen; the OAuth
callback log confirmed `gmail.readonly` was actually granted this time.
The subsequent real sync succeeded cleanly: 50 messages scanned, 3
passed the pre-filter and became real `detected_signals` rows (real
vendors — Xfinity, Gas South, Tello — amount/currency/billingDate
correctly left null rather than guessed, since those particular emails
didn't state them), `sync_cursor`/`last_synced_at` updated, a second
sync a clean no-op (0 scanned, 0 new, still 3 rows, no duplicates), and
the server log confirmed to contain zero email subject/body/content —
only route timing and the account id, exactly matching
`docs/SECURITY.md`'s "safe to log" allowlist.

### Next

Commit and push everything since the last commit (`9775a3b`) — the
LangSmith removal and all of today's live-sync verification/doc updates
are currently uncommitted local work. **Phase 1e (Reconciliation) is the
one remaining phase** after that, per ADR-010's build order — the last
of the two LLM-touching phases deferred to the end of the build.
Cross-inbox dedup is the one Phase 1d checklist item still genuinely
unverified live (needs a second connected inbox, which doesn't exist
yet) — worth keeping in mind as Phase 1e's own testing will likely want
a second account anyway.

### Blocked

Nothing. Microsoft OAuth would need the user to register an Entra ID app
first (same shape of external dependency Google was), but that's not
scheduled yet, not an active blocker.

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
- **Vercel Cron schedule for `/api/cron/sync`** (Phase 1d): the route
  handler exists and is `CRON_SECRET`-protected, but no actual schedule is
  configured (`vercel.json`/dashboard). Turn it on once satisfied with
  classification accuracy against the golden-file set.
- **Anthropic Evaluation tier's real rate limits** (Phase 1d, ADR-016):
  the org is on the default starting tier — golden-file testing (5 calls)
  worked cleanly, but the actual per-minute request/token limits haven't
  been checked against `platform.claude.com/settings/limits`, and a real
  multi-account daily sync hasn't been run yet. Expected to be fine at
  this app's volume per ADR-016's reasoning, but unverified at that scale.
- **Escalation confidence threshold (0.7)** (`providers/anthropic.ts`):
  a reasonable starting value, not derived from real data — worth
  revisiting once enough real signals have gone through the two-tier path
  to see how often Haiku actually escalates and whether Sonnet's answers
  meaningfully differ from Haiku's on those cases.
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

### 2026-09-14 — Ran the deferred edge-case fixture prompt via a fresh agent; found and fixed a real date-parsing bug
**Did:** Instead of generating the deferred edge-case fixtures myself
(risking bias toward cases I already knew the pipeline handled), spawned
a fresh agent with no memory of this project's specific prompt/bug
history to write 16 new adversarial golden fixtures and run them for
real. Result: 10/16 passed, 6 failed, no regressions in the 25 existing
fixtures (baseline 24/25 held). Investigated the failures: 2 of the 6
(a French-language date, an Arabic-language date) turned out to share
one root cause — `parse-date-span.ts`'s regexes used `[A-Za-z]` for
month names, so French matched the pattern but failed an English-only
lookup, and Arabic didn't match the regex at all. Fixed by switching to
`\p{L}` (Unicode "any letter") and adding `FRENCH_MONTHS`/`ARABIC_MONTHS`
maps, looked up in sequence via a small shared `lookupMonth` helper — the
character-matching fix is language-agnostic, but which languages are
actually understood is still explicit and deliberate (an unsupported
language's month name still correctly returns null, not a guess). 6 new
unit tests. Re-ran both previously-failing fixtures against the real
API — both pass now — then the full golden suite: 37/41, no regressions.
The other 4 failures are real but separate issues, written up in
`LEARNED.md` and left unfixed pending a decision: a declined-payment
email read as a successful renewal, a membership pause forced into
`renewal` with a hallucinated date (both stem from the same gap — no
signal type exists for "not a billing event"), the recurring `new`/
`trial_conversion` boundary confusion, and the pre-existing known
gift-subscription judgment call.
**Decided:** Nothing new scoping-wise. Confirmed (again) that delegating
test-case generation to an uninvolved agent surfaces real gaps that
self-testing tends to miss — see the new `LEARNED.md` entry.
**Next:** Two real, unfixed correctness gaps are on the table if wanted
(payment-failure misclassification, pause-forced-into-renewal) — both
point toward needing a signal type for "not actually a billing event."
Otherwise, Phase 1e (Reconciliation) remains the next full phase.

---

### 2026-09-14 — Fixed the known 3-decimal-currency gap in parse-amount-span.ts
**Did:** `decimalPlacesFor()` only distinguished zero-decimal currencies
(JPY/KRW/VND) from a hardcoded 2-decimal default — a currency with a
*three*-decimal minor unit (BHD, IQD, JOD, KWD, LYD, OMR, TND — the
dinar/rial family still in active use) would have silently misparsed by
a factor of 10. This was a known, flagged-but-unfixed gap from earlier
work, not something a fixture caught failing (no golden fixture
exercised a 3-decimal currency). Added a `THREE_DECIMAL_CURRENCIES` set
and extended `decimalPlacesFor` to check it — the rest of the
split/compute logic (`splitIntegerAndFraction`, the final minor-units
calculation) was already fully generic over `decimalPlaces` and needed
no changes. 4 new unit tests (bare integer, thousands-separated, plain
decimal, case-insensitivity). `pnpm verify` green (223 unit, 80
integration).
**Decided:** Nothing new — a straightforward fix of an already-documented
gap, no scoping decision involved.
**Next:** Phase 1e (Reconciliation) remains the next full phase.

---

### 2026-09-14 — Needs-review brief + Gmail deep-link built and live-verified (ADR-018)
**Did:** The prior session's live sync left 3 real `detected_signals` rows
(Xfinity, Gas South, Tello) with amount/currency/billingDate all null even
after Sonnet escalation — real subscription-relevant emails (a one-time
payment, a rate-change deadline notice, a tabular invoice) that don't fit
the standard renewal shape. Built a narrow real slice on `/review`
(ADR-018): a new Sonnet-only call (`providers/anthropic.ts#writeReviewBrief`,
`prompts/write-review-brief.ts`) writes a short paraphrased brief +
`actionRequired` flag whenever a signal's extraction comes back fully
null (cancellations included, per explicit direction), wired into
`syncAccount` right where `body` is already in scope so no second Gmail
fetch is needed. New nullable columns (`review_brief`, `action_required`,
`resolved_at`) on `detected_signals` (additive migration `0010`). Built
the real signals as their own visually separate section at first
(`NeedsReviewSection.tsx` next to a renamed `ReviewProposalTabs.tsx`) —
then, on direct same-day follow-up request, merged both into one
`components/review/ReviewList.tsx`: a single, date-sorted Pending/
Resolved list mixing real needs-review signals and mock proposal cards
together, with "Go to email" extended to every card (a real Gmail deep
link for needs-review signals; an explicitly-placeholder, non-resolving
message id added to the 6 mock proposals purely for visual consistency —
on record as a known stub, not a bug) and "Archive" kept unique to
needs-review cards (mock cards keep their existing Accept/Reject).
`u/0` is hardcoded in the Gmail link — no per-account login-slot field
exists to compute it from. `pnpm verify` green (219 unit, 80 integration)
after both the initial build and the merge.
**Live re-verification:** deleted the 3 original rows under explicit 🛑
DELETE APPROVAL, then discovered deleting a row doesn't make Gmail's
history-based incremental sync treat its message as "new" again — had to
disconnect and reconnect the account (🛑 DELETE APPROVAL on that row too)
to force a real first-sync rescan. Xfinity and Tello went through the
full new pipeline correctly end to end in the browser: real briefs
rendered, "Go to email" opened the correct real Gmail message without
changing status, "Archive" moved a card to the resolved list correctly.
Gas South hit a separate, newly-found bug — see `LEARNED.md`'s
2026-09-14 "Sonnet can return zero text blocks" entry — reproduced 3/3
directly against the real API. Root cause confirmed: `MAX_OUTPUT_TOKENS`
was a single 512 budget shared by both models, and Sonnet's adaptive
thinking was consuming all of it internally on this email before writing
any output. Fixed by splitting it into `HAIKU_MAX_OUTPUT_TOKENS = 512`
(unchanged) and `SONNET_MAX_OUTPUT_TOKENS = 2048` in
`providers/anthropic.ts` — re-verified 3/3 with no more failures, then
re-ran the full classification + brief-generation pipeline for the exact
same email and got a correct result: `price_change`, still null amount/
date (the real unclear-extraction case), and an accurate brief flagging
the September 30 2026 plan-choice deadline with `actionRequired: true`.
`pnpm verify` stayed green throughout (219 unit, 80 integration).
**Decided:** ADR-018 — a deliberate, narrow exception to "no new UI on
`/review` until Phase 1e," scoped to exactly this unclear-extraction case,
written up with its own consequences and alternatives considered.
**Next:** Phase 1e (Reconciliation) is the next full phase. Nothing
outstanding from this session.

---

### 2026-09-14 — LangSmith removed; Phase 1d live-verified end to end against a real Gmail account
**Did:** Removed the temporary LangSmith tracing wrap entirely
(`providers/anthropic.ts`, `traceLabel` plumbing in
`detection.service.ts` and the golden test, the `langsmith` dependency,
all `LANGSMITH_*` env vars) now that testing against golden fixtures was
done and the next step was a real inbox — confirmed `pnpm verify` and
`pnpm test:golden` (still 24/25) unaffected by the removal. Committed and
pushed the whole classification-accuracy body of work (`9775a3b`, no
Co-Authored-By trailer per standing preference) before starting the live
sync. Then ran the actual live end-to-end verification: found the dev
server had been running unchanged since 2026-09-11 (three days), silently
serving broken code for an unrelated existing Watchlist query — killed it
and restarted, which fixed it immediately, confirming it was staleness,
not a real bug. The first real sync attempt then hit a genuine `403` from
the Gmail API; root-caused (not guessed at) by checking Google's own
`myaccount.google.com/permissions` page directly, which showed the app
had no active grant at all, while the local `email_accounts` row still
said `active`. Fixed with an explicit 🛑-approved disconnect (confirmed
the row was actually deleted, not soft-disabled) and a fresh reconnect
through the real Google consent screen — confirmed via the OAuth
callback's own log line that `gmail.readonly` was genuinely granted this
time, unlike whatever the stale connection had. The real sync then
succeeded: 50 messages scanned, 3 real `detected_signals` rows created
(Xfinity, Gas South, Tello — real recurring services from the actual
inbox, amount/currency/billingDate correctly left null rather than
guessed since those specific emails didn't state them),
`sync_cursor`/`last_synced_at` updated correctly, a second sync a clean
no-op, and the dev server log confirmed to contain zero email
subject/body/content anywhere. Updated `PHASES.md`'s Phase 1d checklist
to reflect all of this — pre-filter and classification are now both
live-verified, cross-inbox dedup remains the one genuinely-untested item
(needs a second connected inbox).
**Decided:** Nothing new scoping-wise — this was verification, a real
account-state bug fix, and cleanup against the already-committed design,
not a new architectural choice.
**Next:** Commit and push this session's LangSmith removal and doc
updates. Then Phase 1e (Reconciliation) — the one remaining phase.

---

### 2026-09-14 — Two confirmed Haiku bugs root-caused and fixed; confidence-threshold escalation replaced with evidence-based checks
**Did:** Continued Phase 1d verification. Set up LangSmith tracing for
local debugging (`providers/anthropic.ts` wraps the Claude client with
`wrapAnthropic()`, gated behind `LANGSMITH_TRACING`, testing-only — never
set in production; confirmed working end to end against the real
LangSmith API, including per-fixture-named runs). While debugging a
known billingDate extraction bug, found and fixed two separate,
confirmed, reproducible Haiku 4.5 failures. First: Haiku was
consistently substituting a reference date (whatever the prompt
happened to supply) for a real, far-future billing date, regardless of
increasingly explicit prompt instructions — fixed not by better wording
but by changing the task: the model now returns a verbatim date/amount
span (`billingDateText`/`amountText`) instead of a computed value, and
two new pure domain functions (`parse-date-span.ts`, `parse-amount-span.ts`,
both fully unit-tested against every real format in the fixture set)
convert it deterministically in code. This also independently fixed a
second, previously-unexplained bug: Haiku multiplying a zero-decimal JPY
amount by 100 anyway. Second: even after the transcription fix, two
fixtures kept intermittently failing. Root-caused via a controlled swap
test (built 5 new INR fixtures to isolate currency-formatting as a
candidate cause — ruled out for the main case; one comma-formatting
variant did reproduce a real, separate bug) down to a single vendor
name, "ZEE5," reliably breaking an unrelated field's extraction on
otherwise-identical content, proven by swapping only the vendor name
between a reliable and an unreliable fixture and watching the failure
follow the name in both directions, 5/5 each way. Along the way,
confirmed Haiku is not perfectly deterministic even at `temperature: 0`
(a real, documented phenomenon, not a bug) — a correction to an earlier,
overstated claim this same phase that two identical passing runs proved
determinism. Replaced the original confidence-threshold escalation
(`confidence < 0.7`) with two specific, evidence-based checks on Haiku's
output (`hasSuspectBillingDate`, `hasMissingBillingDateOnATypeThatUsuallyHasOne`)
plus a deterministic, non-escalating correction for cancellations (a
guaranteed contradiction, not a probabilistic one). `pnpm verify` green
(214 unit, 77 integration) and `pnpm test:golden` green and stable
across two full repeated runs — 24/25 fixtures (the last failure is a
defensible signal-type judgment call, not a bug this session touched).
**Decided:** ADR-017 — confidence-threshold escalation replaced with
evidence-based output checks; confidence itself is no longer read
anywhere to gate behavior. Full reasoning, including why self-consistency
and token log-probabilities would have failed on the same bug for the
same underlying reason (both measure output stability/probability, not
correctness), is in the ADR and in two new `LEARNED.md` entries dated
2026-09-13 and 2026-09-14.
**Next:** Live end-to-end sync verification against a real Gmail account,
removing the LangSmith wrap first (already flagged as a pre-deployment
blocker in `PHASES.md`), then commit and push. Phase 1e (Reconciliation)
after that.

---

### 2026-09-11 — Gemini retired for a hard free-tier quota; Claude reinstated after real Ollama testing
**Did:** Picked up Phase 1d mid-verification: `gemini-3.6-flash` was
failing intermittently during golden-file testing. Built the retry-with-
backoff + model-fallback chain the user specified, adding a per-call
timeout (`httpOptions.timeout`) after discovering the SDK doesn't bound a
single attempt by default. That surfaced the real cause: Google's own
`429` error body showed a flat **20 requests/day/project** free-tier quota
— not transient overload — already exhausted by repeated test runs.
Before switching providers, researched real per-call cost for Claude
Haiku 4.5 vs. Gemini paid tier (comparable, Gemini's current promo
pricing edges it out until 2027) and confirmed Anthropic has no
embeddings API at all (not needed by this app's design either way — the
reconciliation algorithm in `docs/DATA_MODEL.md` is Levenshtein-based,
not embedding-based). Then, at the user's request, built and ran a fully
isolated local-model comparison (`experiments/ollama-classify/`, a
standalone script with zero project dependencies) against
`granite3.3:8b`, `qwen3:8b`, and `gemma4:latest` — real results: 3/5,
4/5, and 1/5 correct respectively against the same 5 golden fixtures,
`gemma4` with a systematic amount-truncation bug, all three pinning
confidence near 1.0 regardless of correctness. The experiment was fully
removed afterward (`rm -rf experiments/`, one eslint-ignore line reverted)
once the user decided not to pursue local models — verified `pnpm verify`
stayed green before and after.

Built `src/server/providers/anthropic.ts` from scratch: Haiku 4.5
primary, Sonnet 5 escalating below 0.7 confidence, native Claude
structured output (`output_config.format` + `zodOutputFormat`, schema-
guaranteed by the API itself) rather than Gemini's JSON mode or a
tool-use workaround. Relies on the SDK's own built-in retry
(408/409/429/5xx, honors `retry-after`) instead of a hand-rolled loop —
no observed need for more. Retired Gemini entirely per the user's
explicit choice: deleted `gemini.ts`, its unit tests, `@google/genai`;
updated `detection.service.ts` and the integration test's mocks; the
golden-file test file was repointed at the new provider rather than
deleted outright, since the fixtures/methodology aren't Gemini-specific
— flagged this interpretation to the user rather than assuming silently.
First golden-file run against the real Claude API hit a `credit balance
too low` error — unlike Gemini, Anthropic requires a funded account
before *any* request succeeds, even on the Evaluation tier. After the
user added credits: 3/5 fixtures passed immediately (~11s total, no
instability); the other 2 failures were a real, symmetric prompt
ambiguity confirmed by directly querying both Haiku and Sonnet
independently on the same fixture (both missed the same "next payment
date" the local models had caught) — tightened
`prompts/classify-email.ts`'s billingDate instructions to distinguish
"next scheduled charge" from a cancellation's access-end date. All 5
fixtures pass after the fix. `pnpm verify` green throughout (187 unit, 77
integration — same counts as before the swap). Checked off 3 of Phase
1d's 5 checklist items in `PHASES.md` (classification/extraction,
signal-type coverage, golden-file set) — pre-filter and cross-inbox dedup
still need a real end-to-end Gmail sync to check off.
**Decided:** ADR-016 — Claude replaces Gemini, reinstating ADR-004's
original two-tier design as-is. Full context, evidence, and alternatives
considered in `DECISIONS.md`; ADR-015 marked superseded rather than
rewritten. Two `LEARNED.md` entries capture the transferable lessons: a
"free tier" can be a hard daily wall rather than a soft rate limit, and
different structured-output engines resolve a lenient (non-required,
nullable) JSON Schema differently — Gemini filled in optional fields by
convention, Ollama's local grammar decoding took the legal shortest-valid
path and omitted them.
**Next:** Live end-to-end sync verification against a real Gmail account
(not just classification in isolation), then commit and push everything
since the last commit. Then Phase 1e (Reconciliation) — the one remaining
phase.

---

### 2026-09-10 — Phase 4 redesigned mid-planning and built: continuous route/duration view
**Did:** Started Phase 4 against the original "deadline-driven trip,
leave-by time" scope. During planning, walked through a real gap with the
user (a two-store trip where only one gets visited has no clear next step
under that model) and the user redirected the whole phase: due dates move
to individual shopping items, `/trips` becomes a continuous live view
with no discrete trip entity, and the leave-by clock time is dropped
entirely in favor of plain drive-time/shopping-duration numbers — see
ADR-013 for the full reasoning and consequences. Implemented the
redesigned scope: `shoppingListItems.dueAt`/`checkedAt`,
`preferredStores.address`/`placeId`/`openingHoursText`/
`openingHoursPeriods`, a new single-row `userSettings` table (migration
`0006`), four new pure domain modules, `providers/google-maps.ts`
(Places hours + Routes optimized-order, both wrapped in typed results,
neither ever rendering a map), `services/route.service.ts` +
`services/stores.service.ts`, a new `/settings` screen, and
`/trips` rewritten into `components/trips/OutstandingStops.tsx`. `pnpm
verify` green (149 unit, 56 integration). Found and fixed a real
client/server boundary bug live (not by review): the first
`OutstandingStops.tsx` imported a query-layer helper directly, pulling
`postgres` into the client bundle and breaking the build the moment
`/trips` loaded — fixed by moving the pure helper into
`domain/store-hours.ts`. Live-verified everything reachable without a
real Google Maps key: home address, store add with a graceful
hours-unresolved fallback, due-date urgency sort/badges/overdue-flag/
reschedule, the midnight-hide checked-item rule, and "Plan route"'s
graceful `GOOGLE_MAPS_API_KEY is not set.` error path. Also fixed a
pre-existing gap found along the way: Phase 3's `SERPAPI_API_KEY` was
never added to `.env.example`.
**Decided:** ADR-013 — the full pivot from discrete deadline-driven trips
to a continuous, item-level-due-date view. Not a unilateral call: walked
through the design forks with the user via `AskUserQuestion` (route
output as plain durations vs. a leave-by clock; checked-item cleanup as
view-only vs. an actual delete) before writing the final plan.
**Next:** Committed. Live verification of the actual Google Places/Routes
API calls is blocked on the user setting up a Google Cloud billing
account and a `GOOGLE_MAPS_API_KEY` — flagged clearly, matching Phase
1c/3's credential hand-offs. Once that exists: a short follow-up pass to
verify a real hours lookup and a real route, then Phase 5.

---

### 2026-09-11 — Four post-Phase-5 UI/bug fixes, then Phase 1d (Detection) built
**Did:** Fixed four real issues found by the user checking the app
directly: `/more`'s three badges were still Phase 1.5 mock numbers never
wired to real data (`82d3299`); `/trips` now auto-plans its route on
every visit instead of needing a manual button click, per explicit
request (`8eb0fa3`); bottom nav reordered to put Shopping second
(`f846b23`); and a new per-list default-store setting so items land with
a sensible store even when none is chosen at creation, with a banner
nudging toward Settings when a list has no default yet (`f8a60bc`). Along
the way, fixed a real ordering bug: Grocery's tab had drifted to last
because `getAllLists` had no `ORDER BY` and the four seeded lists all
share one identical `createdAt` from a single batch insert — neither
natural Postgres row order nor timestamp order was actually stable;
fixed with an explicit fixed display order in code.

Then started Phase 1d (Detection) — the first LLM-touching phase, and by
far the largest/most security-sensitive one in the build so far. The user
redirected the classification provider from the `docs/TOOLS.md`-planned
Claude to Gemini (Google AI Studio) specifically for its free tier —
researched and confirmed for real (a genuine no-billing tier exists, with
Zod-compatible structured JSON output) rather than assumed, and the
two-tier cheap/escalation design was simplified to single-tier-only since
Gemini Pro isn't free anymore. Built the full pipeline: `detected_signals`
schema, a vendor-agnostic keyword/sender pre-filter that runs before any
full-body fetch or LLM call, Gmail `history.list` incremental sync
(`providers/gmail.ts`, extending the OAuth-only `providers/google.ts`
from Phase 1c), Gemini classification via a versioned prompt file, a pure
cross-inbox dedup function, and `services/detection.service.ts#syncAccount`
tying it together — plus a "Sync now" button on `/accounts` and a
`CRON_SECRET`-protected (but not yet scheduled) `/api/cron/sync` route.
`pnpm verify` green (187 unit, 77 integration — 35 new this phase). A
golden-file test harness (`pnpm test:golden`) exists and skips cleanly
with no key/fixtures present, ready for the user's real anonymised email
samples. Full detail in Current State above. Not yet committed — blocked
on the user adding `GEMINI_API_KEY` for live verification.
**Decided:** ADR-015 — Gemini over Claude, single-tier with no paid
escalation, the free-tier training-data tradeoff explicitly accepted "for
now." Every fork was discussed with the user via `AskUserQuestion` before
planning, not assumed.
**Next:** User adds `GEMINI_API_KEY`. Then live-verify (Sync now → real
`detected_signals` rows confirmed via `execute_sql`, no email content in
the server log, a repeat sync is a no-op), commit, push. Then Phase 1e
(Reconciliation) — the last remaining phase.

---

### 2026-09-11 — Phase 5 redesigned and built: standalone Watchlist, Phase 3's price-check retired
**Did:** Started Phase 5 against the original "price timing and stock
check" scope (built on Phase 3's per-item Walmart check). The user
redirected significantly during planning: regular shopping items aren't
the right target for price tracking — that becomes a new, standalone
Watchlist for big-ticket items, priced via Google Shopping (lowest price
across sellers, same SerpApi account as the retired Walmart check, a
different engine), with no target price — only a drop-vs-previous-price
trigger, surfaced as a two-level nav badge (bottom nav's More tab →
Watchlist row inside More) rather than a push notification. Phase 3's
regular-item price-check (`providers/serpapi.ts`, `checkItemPrice`, the
`/shopping` magnifier + Priced Subtotal UI) was fully removed — the
underlying schema and historical price data were deliberately left
untouched, only the dead application code went. Built the full redesigned
scope: `watchlist_items`/`watchlist_price_history` (migration `0007`),
`domain/price-trend.ts`, `providers/google-shopping.ts`,
`services/watchlist.service.ts`, a real `/watchlist` screen (the mock's
sparkline ported to real data), and the nav-badge plumbing through
`(dashboard)/layout.tsx` → `BottomNav.tsx` and `/more`. `pnpm verify`
green (152 unit, 65 integration). Found and fixed a real sparkline
clipping bug live (a single-point history's label rendered off-canvas —
the mock's always-multi-point fixtures never exercised that case).
Live-verified against the real Google Shopping API: a real price/seller
came back for a real search (surfacing a real, expected precision
limitation — a very specific query can match an unrelated cheap listing,
since the lowest-price selection does no relevance filtering). Verified
drop-detection and both nav badges via an insert-only staged test row,
after a direct UPDATE to stage the same test was blocked outright by
Claude Code's own auto-mode safety classifier. Cleaned up test data via a
mix of the app's own UI (flaky again, third time this session) and direct
SQL, the latter only after explicit `🛑 DELETE APPROVAL`. Checked off all
4 of Phase 5's redesigned checklist items in `PHASES.md`.
**Decided:** ADR-014 — the full pivot: Phase 3's price-check retired,
Watchlist as a standalone entity (not shopping items with a target price),
Google Shopping over Walmart-only, no target price, a nav-badge
notification model, and a lightweight (listing-presence-based, not a true
inventory feed) stock signal scoped to watchlist items only. Walked
through each fork with the user via `AskUserQuestion` before writing the
plan — not a unilateral redesign.
**Next:** Commit and push. Then Phase 1d/1e (LLM detection +
reconciliation), per ADR-010's build order — the last two phases, deferred
to the end of the build by explicit user request back in ADR-010, and
Phase 5 was the last non-LLM phase standing in front of them.

---

### 2026-09-10 — Phase 4 follow-up: real Google Maps API verification, closing the phase
**Did:** User set up Google Cloud billing, enabled Routes API + Places
API (New) (disabled the unused legacy Places API), restricted the key to
those two, and — the real safety net, since GCP budget alerts don't stop
billing — set a daily request quota well under each API's free tier
(150/day on Routes' `ComputeRoutes`, 100/day on Places'
`SearchTextRequest`). Diagnosed two setup issues along the way via direct
`curl` calls against the real endpoints (faster than guessing through the
UI): `API_KEY_SERVICE_BLOCKED` (the key's own API-restriction list
didn't include Places yet) and `SERVICE_DISABLED` (Places API (New)
wasn't enabled at the project level, a separate setting from the key
restriction). Live-verified the real thing end to end: two real stores
added (Trader Joe's, Costco) with real weekly hours from Places, a real
home address, two items split across both stores, `/trips` showing real
"OPEN NOW" chips, and "Plan route" returning a real optimized order (5
min home→Costco, 11 min Costco→Trader Joe's, 30 min total). **Found and
fixed a real bug via that same `curl` testing, not by review**: with
exactly one intermediate stop, Google's `computeRoutes` returns
`optimizedIntermediateWaypointIndex: [-1]` — a sentinel, not a real
index — which `parseRouteResponse` was passing through unvalidated.
Fixed by checking the returned order is an actual permutation before
using it, with a regression test built from the real response shape.
`pnpm verify` green (150 unit, 56 integration). Test data (2 items, 2
stores) cleaned up via the app's own delete/remove UI. Checked off
Phase 4's remaining 3 checklist items in `PHASES.md` — **Phase 4 is now
fully complete**.
**Decided:** Nothing new scoping-wise — this was verification and a bug
fix against the already-approved design, not a new choice.
**Next:** Phase 5 (Price timing and stock check), per ADR-010's build
order.

---

### 2026-09-10 — Phase 3: Shopping list, single-store price check, complete
**Did:** Researched Walmart's API landscape with the user (no public
self-serve price API exists) and settled on SerpApi's Walmart search
engine as the price source — see ADR-012 for the full trail. Built real
shopping lists/items/price-history/preferred-stores schema (migration
`0005`, four default lists seeded), a `providers/serpapi.ts` adapter, full
query/service/action layers, and real UI replacing both the shopping and
stores mock screens. Designed every price check as one-click/one-item/
user-triggered given SerpApi's 250-search/month cap — no automatic or
bulk checking. Self-caught and fixed two real bugs before running tests
(a non-submitting Radix Select, a stale-prop price-check message). `pnpm
verify` green (122 unit, 47 integration). Verified live end to end
against a real Google-free browser session and the real SerpApi/Postgres
stack: item CRUD, a real $5.37 Walmart price lookup written to price
history, edit, check-off persisting across a reload, preferred-store
add/remove reflected in the shopping page's store picker, item deletion.
All test data was cleaned up as a side effect of exercising the delete/
remove-store features themselves (confirmed empty via direct query) —
no separate DELETE APPROVAL step was needed since nothing remained to
delete afterward. All 5 of `PHASES.md`'s Phase 3 items checked off.
**Decided:** SerpApi over the Walmart Affiliate API or Apify — see
ADR-012. Every price check stays manual/per-item, never automatic, for
the life of this integration unless the rate-limit situation changes.
**Next:** Phase 4 (Route and deadline planner), per ADR-010's build
order.

---

### 2026-09-10 — Phase 2: Insurance as a recurring cost, complete
**Did:** Built real insurance policy tracking — schema (migration `0004`,
reusing `subscriptions`' `cycle`/`status` enums rather than a parallel
concept), validation, query/service layers (archive **and** restore
shipped together this time), and real UI (`insurance/page.tsx` +
`PolicyList.tsx`, with edit added beyond the original mock). Folded into
the dashboard's real aggregate burn and replaced the single hardcoded
renewal-reminder banner with a real per-policy one. Caught and fixed a
client/server import-boundary violation before committing (see Current
State above). Verified live end to end: added, watched the dashboard
burn and a real reminder banner both update, edited the premium,
archived, restored — burn and empty-state gate reacted correctly at each
step. One test row deleted afterward with explicit permission, per the
`CLAUDE.md` delete-approval rule this session added earlier. `pnpm
verify` green (115 unit, 33 integration). All 4 of `PHASES.md`'s Phase 2
items checked off.
**Decided:** Nothing new scoping-wise beyond what the approved plan
already covered — the cycle-model-reuse design was proposed and approved
during planning, not decided ad hoc while building.
**Next:** Phase 3 (Shopping list, single-store price check), per
ADR-010's build order.

---

### 2026-09-10 — Phase 1c, stage 2: real Google OAuth connect flow, live-verified
**Did:** Built the real thing stage 1 was waiting on: `providers/google.ts`
(OAuth endpoints), `services/email-account.service.ts` (connect/disconnect/
refresh), the `api/auth/[provider]/start|callback` routes, and converted
the accounts screen from Phase 1.5 mock state to real data. Decided with
the user in-session to request `openid`/`email` scope alongside
`gmail.readonly` so the app can identify which address it connected.
Found and fixed a real security bug via live testing, not review: the
first version leaked the encrypted token columns into a Server
Component's props to a Client Component — see `docs/LEARNED.md`. Verified
live end to end against the user's real Google account: connected
through the real consent screen, disconnected, confirmed via direct
Postgres query the row was really gone and via the user checking
myaccount.google.com/permissions that Google-side access was actually
revoked. `pnpm verify` green (115 unit, 25 integration — 6 + 5 new this
stage). Checked off 3 of `PHASES.md`'s 5 items for 1c. Full detail in
Current State above. Not yet committed.
**Decided:** `openid`/`email` scope addition (identity only, no extra
Gmail access) — talked through with the user rather than assumed, since
it meant them adding one more scope in Google Cloud Console. Connect and
reconnect share one code path (find-or-update by provider+email) rather
than two, to avoid a separate reconnect flow with its own edge cases.
**Next:** Commit. Then decide with the user: Microsoft OAuth next, or
skip to Phase 1d (detection) since Google alone already proves the
connect pipeline works.

---

### 2026-09-10 — Phase 1c, stage 1: email_accounts schema, token encryption, query layer
**Did:** Started Phase 1c. Scoped with the user up front (confirmed no
Google OAuth credentials exist yet) to build everything that doesn't need
them this pass: the `email_accounts` table (migration `0003`, applied to
real Postgres, confirmed via `list_tables`), `providers/crypto.ts`
(AES-256-GCM token encryption, Node's built-in `crypto`, no new
dependency), and a full `db/queries/email-accounts.ts` CRUD layer
including a real hard-delete (per `docs/SECURITY.md`'s disconnect rule).
Fixed a real Vitest/`server-only` incompatibility found while testing
crypto.ts (see `docs/LEARNED.md`). Added `.env.example` entries and a
real generated `TOKEN_ENCRYPTION_KEY` to `.env.local`. `pnpm verify`
green (109 unit, 20 integration — 15 new tests total this session). No
OAuth routes, no accounts-screen wiring, no Microsoft, no sync logic —
all deliberately deferred to a follow-up pass. Full detail in Current
State above. Not yet committed.
**Decided:** Nothing new scoping-wise — this followed `docs/DATA_MODEL.md`'s
already-specified `email_accounts` shape exactly, not a new design.
**Next:** Hand-off given to the user: set up a Google Cloud OAuth client
(steps in the approved plan / chat). Once `GOOGLE_CLIENT_ID`/
`GOOGLE_CLIENT_SECRET` exist, build the real connect/callback routes and
wire the accounts screen to real data.

---

### 2026-09-09 — Restore/unarchive backend added, closing ADR-009's gap
**Did:** Added `restoreSubscription` to `subscription.service.ts`
(symmetric to `archiveSubscription`, sets `status` back to `'active'`),
`restoreSubscriptionAction` in `subscriptions/actions.ts`, and wired the
subscription detail page's archived-state button to it — it previously
rendered a static "Archived" label with no action behind it. Added two
integration tests (`restoreSubscription` sets status to active; a full
archive-then-restore round trip). `pnpm verify` green (101 unit, 13
integration — up from 11). Verified directly against real Postgres (the
same active→archived→active transition the service now performs) since
this session's browser was signed out and re-authenticating needs a real
magic-link email click; the integration tests already exercise the actual
service functions end to end against a real transaction, so this was
confirmatory, not a substitute.
**Decided:** Nothing new scoping-wise — this was the exact follow-up
ADR-009 already called out as deferred, done as soon as asked for.
**Next:** Phase 1c — real Google/Microsoft OAuth (unchanged).

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
