# Phases

Seven phases. Each has a bounded scope and explicit exit criteria. A phase is
done when its exit criteria pass — not when the next phase starts looking
interesting.

Progress lives here as checkboxes. `MEMORY.md` holds the narrative state.

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
- [ ] Per-subscription detail with price history
- [x] Empty state that guides toward first entry

### 1c — Multi-inbox connection

- [ ] Google OAuth, read-only scope, refresh-token storage encrypted at rest
- [ ] Microsoft OAuth, read-only scope
- [ ] Connect, list, and disconnect multiple accounts
- [ ] Token refresh handling and a clear reconnect path when refresh fails
- [ ] Incremental sync with a per-account cursor

### 1d — Detection

- [ ] Cheap pre-filter (sender/heuristic) before any LLM call
- [ ] LLM classification and extraction with Zod-validated JSON output
- [ ] Signal types: new subscription, renewal, price change, trial conversion, cancellation
- [ ] Cross-inbox deduplication
- [ ] Golden-file test set of real anonymised emails with expected outputs

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

- [ ] shadcn/ui installed and wired to the `DESIGN.md` tokens (`components/ui/`
      is currently empty; `DESIGN.md` already specifies shadcn as the
      functional-component layer, and nothing built so far uses it)
- [ ] Burn ribbon — the signature dashboard element from `DESIGN.md` (twelve
      months, every recurring commitment as a band positioned by billing date
      and scaled by amount), including its vertical-below-768px responsive
      behaviour
- [ ] 1b: per-subscription detail screen with price history — real data, no
      backend work needed (schema and price_history writes already exist);
      the one item still open on 1b's own checklist
- [ ] 1c: connected-accounts screen — connect, list, disconnect, and a
      reconnect-needed state (mock data)
- [ ] 1e: review queue screen — confirm / price-update / discovery /
      cancellation proposal cards, with `reasoning` shown on each (mock data)
- [ ] Phase 2: insurance entry form and list, renewal reminder surfaced on the
      dashboard (mock data)
- [ ] Phase 3: shopping lists — list switcher, items with quantity/notes,
      store price per item, list total (mock data)
- [ ] Phase 4: route/deadline planner — trip view, leave-by time, consolidated-
      trip view (mock data)
- [ ] Phase 5: price timing — price history chart, buy-now-or-wait card,
      price-drop watchlist (mock data)
- [ ] Empty, loading, and error states designed for every screen above, not
      only the dashboard's
- [ ] `DESIGN.md`'s quality floor met screen by screen: responsive to 375px,
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

- [ ] Insurance as a cost category: policy number, insurer, premium, term, renewal date
- [ ] Renewal reminders with configurable lead time
- [ ] Medical and auto handled as distinct types with different renewal rhythms
- [ ] Insurance folded into the dashboard's aggregate burn

**Explicitly not included:** automated re-quoting. See `PROJECT_BRIEF.md`.

**Exit criteria:** a policy tracked end to end, appearing in the aggregate, with a
renewal reminder that fires at the right time.

---

## Phase 3 — Shopping list, single-store price check

Deliberately narrow. One store, one price source. Prove the loop before
generalising to comparison across retailers.

- [ ] Multiple named lists (grocery, household, personal, one-off)
- [ ] Items with quantity, notes, and an optional store preference
- [ ] One store integration, price lookup per item
- [ ] Estimated list total
- [ ] Price history per item

**Exit criteria:** a real list priced against a real store with an accurate total.

---

## Phase 4 — Route and deadline planner

Technically the most tractable piece — a mapping API does the heavy lifting.

- [ ] Multi-stop route optimisation across selected stores
- [ ] Deadline-driven planning: given a due time, compute leave-by time
- [ ] Trip consolidation: merge lists due in the same window into one trip
- [ ] Store hours factored into feasibility

**Exit criteria:** a real multi-stop trip planned with an accurate leave-by time.

---

## Phase 5 — Price timing and stock check

Last because it is the most fragile and depends on price history that only exists
after Phase 3 has been running for a while.

- [ ] Price history accumulation and trend detection
- [ ] Buy-now-or-wait suggestion with a written reason
- [ ] Local stock check before a trip is finalised
- [ ] Price-drop watchlist with target-price alerts

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
