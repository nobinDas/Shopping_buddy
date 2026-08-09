# Phases

Six phases. Each has a bounded scope and explicit exit criteria. A phase is done
when its exit criteria pass — not when the next phase starts looking interesting.

Progress lives here as checkboxes. `MEMORY.md` holds the narrative state.

---

## Phase 0 — Foundation

**Not in the original plan; added because every later phase assumes it.** Doing
this first means Phase 1 is feature work rather than feature work tangled with
setup, and it means the test harness exists before there is anything to test.

Small — a few days, not weeks. If it grows past that, something is being
over-built.

- [ ] Repo, TypeScript config, lint, formatter
- [ ] Next.js app skeleton with the folder structure from `ARCHITECTURE.md`
- [ ] Supabase project, Drizzle configured, one trivial migration applied end to end
- [ ] Single-user auth working
- [ ] Vitest configured with one passing unit test
- [ ] Playwright configured with one passing smoke test
- [ ] `pnpm verify` script wired and green
- [ ] CI running `pnpm verify` on push
- [ ] `.env.example` complete and documented

**Exit criteria:** a deployed skeleton behind auth, CI green, `pnpm verify`
passing locally and in CI.

---

## Phase 1 — Subscription tracker MVP

The core of the product. Everything else is built on the patterns proven here.

### 1a — Manual entry

Built first, deliberately. It is the primary data source, it delivers standalone
value with no dependency on OAuth or LLM classification, and it forces the schema
to be settled before anything writes to it automatically.

- [ ] `subscriptions` schema with money as integer minor units
- [ ] Create, edit, archive a subscription
- [ ] Billing cycle handling: monthly, quarterly, annual, custom interval
- [ ] Next-billing-date computation, with tests for month-end and leap-year edges
- [ ] List view

### 1b — Dashboard

- [ ] Total monthly burn and annualised burn
- [ ] Upcoming billing timeline
- [ ] Per-subscription detail with price history
- [ ] Empty state that guides toward first entry

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
