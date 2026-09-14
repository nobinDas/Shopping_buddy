# Phases

Seven phases. Each has a bounded scope and explicit exit criteria. A phase is
done when its exit criteria pass — not when the next phase starts looking
interesting.

Progress lives here as checkboxes. `MEMORY.md` holds the narrative state.

**Build order deliberately differs from the numbering below, as of
2026-09-10 (see ADR-010 in `DECISIONS.md`).** 1d and 1e — the two phases
that touch an LLM — are built last, together, once every other phase is
real. Actual order: 1a → 1b → 1.5 → 1c (Google done; Microsoft optional) →
**Phase 2 → Phase 3 → Phase 4 → Phase 5 → 1d → 1e**. The numbering stays
as originally scoped (1d/1e are conceptually still "Phase 1," and Phase
2–5 still depend on each other in the order already documented below —
this only moves the LLM-touching pair to the end of the whole queue).

---

## Phase 0 — Foundation

**Not in the original plan; added because every later phase assumes it.** Doing
this first means Phase 1 is feature work rather than feature work tangled with
setup, and it means the test harness exists before there is anything to test.

Small — a few days, not weeks. If it grows past that, something is being
over-built.

- [x] Repo, TypeScript config, lint, formatter
- [x] Next.js app skeleton with the folder structure from `ARCHITECTURE.md`
- [x] Supabase project, Drizzle configured, one trivial migration applied end to end
- [x] Single-user auth working
- [x] Vitest configured with one passing unit test
- [x] Playwright configured with one passing smoke test
- [x] `pnpm verify` script wired and green
- [x] CI running `pnpm verify` on push
- [x] `.env.example` complete and documented

**Exit criteria:** a deployed skeleton behind auth, CI green, `pnpm verify`
passing locally and in CI.

---

## Phase 1 — Subscription tracker MVP

The core of the product. Everything else is built on the patterns proven here.

### 1a — Manual entry

Built first, deliberately. It is the primary data source, it delivers standalone
value with no dependency on OAuth or LLM classification, and it forces the schema
to be settled before anything writes to it automatically.

- [x] `subscriptions` schema with money as integer minor units
- [x] Create, edit, archive a subscription
- [x] Billing cycle handling: monthly, quarterly, annual, custom interval
- [x] Next-billing-date computation, with tests for month-end and leap-year edges
- [x] List view

### 1b — Dashboard

- [x] Total monthly burn and annualised burn
- [x] Upcoming billing timeline
- [x] Per-subscription detail with price history
- [x] Empty state that guides toward first entry

### 1c — Multi-inbox connection

- [x] Google OAuth, read-only scope, refresh-token storage encrypted at rest
- [ ] Microsoft OAuth, read-only scope
- [x] Connect, list, and disconnect multiple accounts
- [x] Token refresh handling and a clear reconnect path when refresh fails
- [ ] Incremental sync with a per-account cursor

### 1d — Detection

Uses Claude Haiku 4.5 as the primary classifier, with Claude Sonnet 5
escalation triggered by two specific, evidence-based checks on Haiku's
*output* (ADR-017 in `DECISIONS.md`) — not the confidence-threshold
design ADR-016/ADR-004 originally specified, which turned out not to
work (confidence tracks input ambiguity, not model failure; see
`docs/LEARNED.md`'s 2026-09-13/2026-09-14 entries). Amounts and billing
dates are extracted as verbatim text and parsed deterministically in code
(`domain/parse-amount-span.ts`, `domain/parse-date-span.ts`), not
computed by the model. The original ADR-016 model choice (Claude over
Gemini/Ollama) is unaffected and still stands. Produces real
`detected_signals` rows; no new UI this phase — `/review` stays on Phase
1.5's mock data until 1e (a separate future phase) builds real
reconciliation against them.

- [x] Cheap pre-filter (sender/heuristic) before any LLM call —
      live-verified 2026-09-14: a real first sync scanned 50 messages
      from a real Gmail inbox and only 3 passed through to become
      signals, confirming the pre-filter actually screens the majority
      of real mail before any LLM call, not just in unit tests
- [x] LLM classification and extraction with Zod-validated JSON output —
      live-verified via `pnpm test:golden` against 25 real anonymised
      emails, and separately via a real end-to-end Gmail sync (3 real
      signals with sensible extracted fields — vendor, signal type,
      amount/date correctly left null when the email didn't state them)
- [x] Signal types: new subscription, renewal, price change, trial conversion, cancellation —
      all 5 covered by the golden-file fixtures, all passing
- [ ] Cross-inbox deduplication — implemented, unit-tested; live
      verification needs a second real connected inbox to exercise
      cross-account matching, which isn't set up yet — genuinely still
      pending, not exercised by the single-account live sync
- [x] Golden-file test set of real anonymised emails with expected
      outputs — 25 real fixtures in `tests/golden/fixtures/files/`
      (20 original + 5 added to isolate a currency-formatting bug —
      see `docs/LEARNED.md`, 2026-09-14), `pnpm test:golden` green
      against the real Claude API
- [x] **Live end-to-end verification against a real Gmail account
      (2026-09-14)** — found and fixed a real, unrelated bug along the
      way: a 3-day-old stale dev server process was serving broken code
      for an existing Watchlist query, masking as a runtime error on
      every dashboard page; killing it and restarting resolved it.
      Then hit a genuine 403 from the Gmail API — root-caused to the
      connected account's OAuth grant having been revoked outside the
      app at some point (confirmed directly on
      myaccount.google.com/permissions, which no longer listed the app
      at all) while the local `email_accounts` row was stale and still
      "active". Fixed with 🛑-approved disconnect + fresh reconnect,
      confirmed via the OAuth callback log that `gmail.readonly` was
      actually granted this time. Full sync then succeeded: "50 scanned
      · 3 new signals", real `detected_signals` rows with sensible
      fields, `sync_cursor`/`last_synced_at` updated correctly, a
      second sync a clean no-op (0 scanned, 0 new, same 3 rows, no
      duplicates), and the dev server log confirmed to contain zero
      email subject/body/content anywhere — only route timing and the
      account id.
- [x] **Remove LangSmith tracing before touching a real inbox
      (2026-09-13, removed 2026-09-14)** — was wired into
      `providers/anthropic.ts` for local debugging only (full
      prompt/response content, including email subject/body, sent to
      LangSmith's servers — a third party beyond Gmail and Anthropic that
      `docs/SECURITY.md`'s data-flow rules never accounted for). Fully
      removed ahead of live Gmail sync verification: the `wrapAnthropic()`
      wrap, the `traceLabel` plumbing through `detection.service.ts` and
      the golden test, the `langsmith` dependency, and the
      `LANGSMITH_*` env vars (from both `.env.example` and `.env.local`)
      are all gone. `pnpm verify` confirmed green after removal.

### 1e — Reconciliation

The crux of the phase. Algorithm and match rules are in `DATA_MODEL.md`.

- [ ] Candidate matching between detected signals and manual records
- [ ] Confirm: detection agrees with the manual record
- [ ] Update proposal: detection disagrees, user resolves
- [ ] Discovery: detected subscription with no manual record, surfaced for review
- [ ] Review queue UI
- [ ] `reasoning` record written for every proposal

**Exit criteria:** two inboxes connected; a manually entered subscription
confirmed by a real email; a real price increase detected and surfaced; a
subscription discovered that was never manually entered; no duplicates across
inboxes; reconciliation logic at high unit-test coverage.

**Idea captured for this phase, not yet scoped — shopping list price agent
(2026-09-10):** Once the structured AI agent from 1d/1e exists, extend it to
Phase 3's shopping list: when the user writes just an item name (no price),
the agent searches the web (SerpApi to start, per ADR-012 — swap later if a
better source turns up) for the best/most affordable match, writes a note
under the item naming the specific product/company it found, and updates the
item's price field in the same spot Phase 3's manual "check price" already
uses — **whether or not the user typed in a price themselves**, and
overwriting it whenever the agent's finding doesn't match what's there. This
is agent-initiated (on item creation/edit), distinct from Phase 3's existing
one-click manual price check. Needs real design before building, not just
wiring up: a rate-limit-aware trigger strategy (same 250/month SerpApi
concern that made Phase 3's checks manual-only), a `reasoning` record per
CLAUDE.md's "no silent recommendations" rule, and likely a new
`item_price_history.source` value (e.g. `'agent'`) distinct from the existing
`'manual'`/`'walmart'` so an agent-written price stays distinguishable from a
user-triggered one. Revisit when 1d/1e are actually being built.

**Idea captured for this phase, not yet scoped — failed/declined payment
handling (2026-09-13):** Neither the `signal_type` enum
(`new`/`renewal`/`price_change`/`trial_conversion`/`cancellation`) nor
`classify-email.ts`'s prompt nor the reconciliation proposal types
(`confirm`/`price_update`/`date_update`/`discovery`/`cancellation`) have any
concept of a payment failure — a real "your card was declined, please
update your payment method" email has nowhere correct to go today. Tested
directly: no golden fixture covers this case, and reasoning through the
existing 5 signal types shows the LLM would likely be forced to call it
`renewal` (the closest fit), which is actively wrong — it implies the
charge succeeded when it didn't. Needs, at minimum: a new `payment_failed`
(or similar) signal type, a corresponding prompt update, a schema migration,
and a review-queue treatment distinct from the existing 5 proposal types
(this isn't a discovery, a price change, or a confirm — it's its own kind
of alert). Revisit when 1e's reconciliation logic is actually being
designed.

**Idea captured for this phase, not yet scoped — missing-expected-email
detection (2026-09-13):** Everything built through 1d is purely reactive —
it only ever processes emails that actually arrive. There is no mechanism
anywhere (not in `domain/`, not in the reconciliation design in
`DATA_MODEL.md`) that watches for an *absence* — e.g. a subscription that
normally bills on the 5th, give or take a few days, where no matching
`detected_signal` shows up at all that month. This is a structurally
different capability from anything else in 1d/1e (detecting a missing
event, not classifying a present one) and would need real design, not
just wiring: computing each subscription's expected next billing date
(`domain/billing-cycle.ts#computeNextBillingDate` already does this for
the dashboard's upcoming-renewals list), a grace window (e.g. ±3 days),
a scheduled check for "expected date + grace period has passed with no
matching signal," and a new kind of alert distinct from the existing
proposal types. Revisit when 1e is actually being designed — don't let
this quietly fall out of scope by omission.

---

## Phase 1.5 — Frontend design pass

**Not in the original plan; added by explicit decision after 1a and most of 1b
were built with real, wired-up data (see ADR-007).** Every phase from here on
— 1c, 1e, and Phases 2 through 5 — is a real backend integration (OAuth, an
LLM pipeline, a mapping API, retailer price feeds) behind a screen that
doesn't exist yet. Building the backend first, phase by phase, means the
product's shape only becomes visible one feature at a time. This phase
inverts that: design and build every remaining screen against mock/static
data first, so the whole concept can be clicked through end to end before any
of the harder backend work begins. It does not change the order real data
gets wired in — that still happens phase by phase, exactly as scoped below —
it only front-loads what each of those screens looks like.

- [x] shadcn/ui installed and wired to the `DESIGN.md` tokens (`components/ui/`
      is currently empty; `DESIGN.md` already specifies shadcn as the
      functional-component layer, and nothing built so far uses it)
- [x] Burn ribbon — the signature dashboard element from `DESIGN.md` (twelve
      months, every recurring commitment as a band positioned by billing date
      and scaled by amount), including its vertical-below-768px responsive
      behaviour
- [x] 1b: per-subscription detail screen with price history — real data, no
      backend work needed (schema and price_history writes already exist);
      the one item still open on 1b's own checklist
- [x] 1c: connected-accounts screen — connect, list, disconnect, and a
      reconnect-needed state (mock data)
- [x] 1e: review queue screen — confirm / price-update / discovery /
      cancellation proposal cards, with `reasoning` shown on each (mock data)
- [x] Phase 2: insurance entry form and list, renewal reminder surfaced on the
      dashboard (mock data)
- [x] Phase 3: shopping lists — list switcher, items with quantity/notes,
      store price per item, list total (mock data)
- [x] Phase 4: route/deadline planner — trip view, leave-by time, consolidated-
      trip view (mock data)
- [x] Phase 5: price timing — price history chart, buy-now-or-wait card,
      price-drop watchlist (mock data)
- [x] Empty, loading, and error states designed for every screen above, not
      only the dashboard's
- [x] `DESIGN.md`'s quality floor met screen by screen: responsive to 375px,
      visible keyboard focus, `prefers-reduced-motion` respected, WCAG AA
      contrast

**Exit criteria:** every screen in the product — across every remaining phase
— renders in the browser against mock data (except 1b's detail screen, which
is real), styled per `DESIGN.md`, and is navigable end to end.

**Explicitly not included:** any real OAuth flow, LLM call, mapping API, or
retailer integration. Screens here are shells over fixture data — wiring each
one to its real backend happens inside that screen's own phase, exactly as
already scoped below.

---

## Phase 2 — Insurance as a recurring cost

Small phase. Mostly proves the recurring-cost model generalises beyond
subscriptions.

- [x] Insurance as a cost category: policy number, insurer, premium, term, renewal date
- [x] Renewal reminders with configurable lead time
- [x] Medical and auto handled as distinct types with different renewal rhythms
- [x] Insurance folded into the dashboard's aggregate burn

**Explicitly not included:** automated re-quoting. See `PROJECT_BRIEF.md`.

**Exit criteria:** a policy tracked end to end, appearing in the aggregate, with a
renewal reminder that fires at the right time.

---

## Phase 3 — Shopping list, single-store price check

Deliberately narrow. One store, one price source. Prove the loop before
generalising to comparison across retailers.

- [x] Multiple named lists (grocery, household, personal, one-off)
- [x] Items with quantity, notes, and an optional store preference
- [x] One store integration, price lookup per item
- [x] Estimated list total
- [x] Price history per item

**Exit criteria:** a real list priced against a real store with an accurate total.

**Note (2026-09-11):** the per-item price-check built here (Walmart via
SerpApi) was retired in Phase 5 in favor of a standalone Watchlist feature
for big-ticket items — see ADR-014 in `DECISIONS.md`. The checklist above
stays checked because it was genuinely built and live-verified at the
time; the code path itself no longer exists. `unitPriceMinor`/`currency`/
`lastPriceCheckedAt` and the historical `item_price_history` rows remain
in the database, untouched and unused.

---

## Phase 4 — Continuous route and duration view

Redesigned from the original "deadline-driven, discrete trip" framing —
see ADR-013 in `DECISIONS.md` for why. Due dates live on individual
shopping items; `/trips` is always a live view of what's currently
outstanding, not something separately planned or completed per trip.

- [x] Item-level due dates (optional, set from the shopping-item edit
      panel), with urgency sorting and an overdue flag on `/trips`
- [x] Every outstanding item across every list automatically consolidated
      into one continuous view, grouped by store — no manual "combine
      these lists into a trip" step
- [x] On-demand multi-stop route optimisation (shortest path from a saved
      home address) across the currently outstanding stores
- [x] Drive duration between stops and an estimated shopping duration per
      store (from item count), shown as plain numbers — no leave-by clock
      time, no rendered map
- [x] Store hours (fetched automatically via Google Places when a store
      is added) shown as an open-now/closed-now indicator per store

**Exit criteria:** a real optimized route across real outstanding stores,
with real drive-time and shopping-duration numbers, computed from a real
saved home address and real store addresses.

---

## Phase 5 — Watchlist: price-drop tracking for big-ticket items

Redesigned from the original "price timing and stock check" scope, which
was built on top of Phase 3's per-item price-check — see ADR-014 in
`DECISIONS.md`. A watchlist item is a standalone entity (not a shopping
list item with a target price bolted on): a big, deliberate, long-tracked
purchase, priced via Google Shopping (lowest price across sellers, not
one retailer), with no target price — the only trigger is a drop relative
to the item's own previous recorded price.

- [x] Standalone watchlist items with price history accumulation
      (`watchlist_items` / `watchlist_price_history`, independent of
      shopping lists)
- [x] Price-drop detection relative to the item's own previous price (no
      target-price threshold — dropped from the original scope)
- [x] A two-level nav badge on a drop: a dot on the bottom nav's More tab,
      a dot on the Watchlist row inside More, cleared once `/watchlist` is
      opened — no push/email alert (no notification infrastructure exists)
- [x] A lightweight stock-availability signal for watchlist items only
      ("a listing was found" — Google Shopping has no dedicated in-stock/
      out-of-stock field, so this is a real precision limit, not a true
      inventory feed, and is worded honestly in the UI)

**Exit criteria:** a real watchlist item checked against Google Shopping,
its price history accumulating across real checks, and a real price drop
correctly surfacing the two-level nav badge.

**Explicitly not included:** a buy-now-or-wait suggestion with written
reasoning (dropped along with the target-price concept), and any stock
check for regular shopping-list items or tied to a specific physical
store trip (the Walmart-store-specific approach that would have enabled
that no longer fits — see ADR-014).

**Exit criteria:** a timing suggestion that proves correct in a real purchase, and
a stock check that prevents a wasted trip.

---

## Backlog

Real ideas, unscheduled. Not scope until pulled into a phase.

- Return-window tracking after purchase
- Duplicate/overlap detection across subscriptions
- Coupon and loyalty-pricing check before store selection
- Loyalty points factored into true cost
- Unified calendar across billing, renewals, and shopping deadlines
- Card-statement import as a third reconciliation source
