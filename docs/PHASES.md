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
`detected_signals` rows; `/review` otherwise stays on Phase 1.5's mock
data until 1e (a separate future phase) builds real reconciliation
against them — with one deliberate, narrow exception, see ADR-018.

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
      outputs — 41 fixtures in `tests/golden/fixtures/files/` (20
      original + 5 added to isolate a currency-formatting bug + 16
      adversarial edge-case fixtures generated by a fresh, uninvolved
      agent specifically to avoid self-testing bias — see
      `docs/LEARNED.md`, 2026-09-14). **41/41 passing**, stable across 3
      full repeated runs against the real API. The 16 edge-case fixtures
      found and led to fixing 4 real bugs total (see below).
- [x] **Fixed live (2026-09-14): `parse-date-span.ts` couldn't parse
      French or Arabic dates** — found by the edge-case fixture run
      above. Both languages' month names extracted correctly by the LLM
      but were dropped by the deterministic parser: French matched the
      day-month-year regex but failed an English-only month lookup;
      Arabic didn't match the regex at all (`[A-Za-z]` doesn't include
      Arabic script). Fixed by switching to `\p{L}` (Unicode "any
      letter") and adding French/Arabic month-name maps. Re-verified
      both fixtures against the real API post-fix (both now pass, no
      regressions — 37/41 overall, up from 35/41).
- [x] **Fixed live (2026-09-14, ADR-019): added `payment_failed` and
      `paused` signal types** — resolves the "failed/declined payment
      handling" idea captured below, now proven as a real bug rather
      than a hypothesis: a declined-payment email was classified as
      `renewal` with a real amount (reporting a failed charge as
      successful), and a pause email was classified as `renewal` with a
      **hallucinated** billing date fabricated from the pause's resume
      date. Fixed with two new signal types, an explicit prompt
      counter-example for each, and a generalized deterministic
      invariant (`enforceNoConfirmedChargeInvariant`) that forces
      `billingDate: null` for `cancellation`/`paused`/`payment_failed`
      regardless of what the model returns — the actual fix for the
      hallucination, not just a prompt instruction. Both route into the
      existing ADR-018 review-brief pipeline via a new `needsReviewBrief()`
      predicate, no UI changes needed. Re-verified against the real API:
      both fixtures now pass, no regressions — 39/41 overall.
- [x] **Fixed live (2026-09-14): the `new`/`trial_conversion`/
      `price_change` boundary weakness** — the last 2 failing fixtures
      (`hulu-trial-started`, `netflix-extra-member-addon`) turned out to
      share one root cause with each other and with the older,
      intermittently-failing `spotify-gift-subscription`: the model was
      classifying by *which future event an email mentions*, not by
      *which event it's actually announcing*. A trial-start email that
      previews its own future conversion date isn't itself a conversion
      notice; a member-addon email that mentions a new charge isn't
      itself a price-change notice. One prompt clarification fixed all
      three at once, rather than three narrow counter-examples — see
      `docs/LEARNED.md`, 2026-09-14. Re-verified against the real API
      3 times in a row to rule out non-determinism: **41/41, 3 for 3.**
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
- [x] **Needs-review brief + Gmail deep-link for unclear-extraction
      signals (2026-09-14, ADR-018)** — a deliberate, narrow real-UI
      exception to "no new UI until 1e," built because the live sync
      above produced 3 real signals with amount/currency/billingDate all
      null even after Sonnet escalation. A new Sonnet-only call
      (`providers/anthropic.ts#writeReviewBrief`) writes a short
      paraphrased brief + an `actionRequired` flag whenever a signal's
      extraction comes back fully null (cancellations included), stored
      on the signal itself and surfaced on `/review`. Initially built as
      its own visually separate section; merged into one unified,
      date-sorted list (`components/review/ReviewList.tsx`) alongside the
      mock proposal cards the same day, on direct user request — see
      ADR-018's trailing note. Every card now gets "Go to email" (real
      link for needs-review signals; a placeholder, explicitly-not-real
      message id for the 6 mock proposals, added for visual consistency
      only). "Archive" (the only action that moves a needs-review card
      from pending → resolved; resolved rows stop appearing after one
      month but are never deleted) is unique to needs-review cards; mock
      cards keep their existing Accept/Reject. `pnpm verify` green
      (219 unit + 80 integration tests). **Live re-verification
      (2026-09-14):** the 3 original rows were deleted under explicit
      🛑 DELETE APPROVAL, the account disconnected and reconnected (to
      force a fresh first-sync scan, since Gmail's history-based
      incremental sync only returns messages new since the last
      historyId — deleting a `detected_signals` row doesn't make Gmail
      consider its message "new" again), and re-synced from scratch.
      Xfinity and Tello went through the full new pipeline correctly:
      real Sonnet-written briefs rendered on `/review`, "Go to email"
      opened the correct real Gmail message without changing status,
      "Archive" moved Xfinity to the resolved list. Gas South hit a
      separate, pre-existing bug (see below) that blocked it from this
      same browser-driven verification; after the fix, its
      classification + brief generation were re-confirmed correct via a
      direct call to the same `classifyEmail`/`writeReviewBrief`
      functions `syncAccount` uses (not re-run through the full
      disconnect/reconnect + browser click-through, to avoid asking for
      a third real Google OAuth consent screen in one session) — the UI
      rendering path itself was already proven correct by Xfinity and
      Tello using the identical component.
- [x] **Found and fixed live (2026-09-14): Sonnet sometimes returned a
      response with no text block at all**, surfaced by the Gas South
      email specifically — `callModel` threw `"claude-sonnet-5 returned
      no text block"` (this exact guard already existed before this
      session's changes; this was the first time it was observed to
      actually fire). Reproduced 100% (3/3) directly against the real
      API for this message before the fix. Root cause: `MAX_OUTPUT_TOKENS`
      was 512 for every call including Sonnet's, and Sonnet 5's adaptive
      thinking (docs/DECISIONS.md ADR-017 already notes it replaced
      manual sampling controls) was consuming that whole budget
      internally on this email, leaving nothing for the actual JSON
      output. Fixed by splitting the constant — `HAIKU_MAX_OUTPUT_TOKENS
      = 512` (unchanged, Haiku has no adaptive-thinking step), 
      `SONNET_MAX_OUTPUT_TOKENS = 2048` — in `providers/anthropic.ts`.
      Re-verified 3/3 directly against the real API post-fix (no more
      "no text block" errors), then re-ran the full pipeline
      (classification + the new `writeReviewBrief`) for this exact
      email: correctly classified as `price_change` with amount/
      currency/billingDate still null (the real unclear-extraction
      case), and produced an accurate brief — "rate plan expiring,
      choose a new plan before September 30, 2026 or be moved to a
      variable rate", `actionRequired: true` — matching the real
      email's content exactly. `pnpm verify` green after the fix
      (219 unit + 80 integration tests, unchanged).
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

- [x] Candidate matching between detected signals and manual records —
      `domain/reconcile.ts`, implemented exactly to `DATA_MODEL.md`'s
      weight table and thresholds, 27 unit tests covering every branch of
      the match matrix plus every enumerated edge case at the end of that
      doc (same-vendor different tiers, simultaneous annual/monthly
      plans, a currency change deliberately *not* auto-matched, a
      third-party billing vendor string, trial-to-paid as a price change
      from zero)
- [x] Confirm: detection agrees with the manual record — applies
      automatically (`source: 'manual_confirmed'`, new `last_verified_at`
      column), integration-tested against real Postgres
- [x] Update proposal: detection disagrees, user resolves — price_update
      and date_update proposals, Accept/Reject wired to real
      `reconciliation_proposals` rows on `/review`
- [x] Discovery: detected subscription with no manual record, surfaced
      for review — accepting one routes to a pre-filled "Add
      subscription" form rather than inserting a subscription directly,
      since no detected signal carries a billing cycle and manual entry
      stays primary (docs/DECISIONS.md ADR-020)
- [x] Review queue UI — `/review`'s six Phase 1.5 mock proposal cards are
      gone; the page now renders real `reconciliation_proposals` (joined
      with the matched subscription and originating signal for display)
      alongside the existing ADR-018 needs-review signals in the same
      unified Pending/Resolved list
- [x] `reasoning` record written for every proposal — `NOT NULL` column,
      populated by every code path including the auto-applied `confirm`
      case (CLAUDE.md: "no silent recommendations")

**Implementation-complete, integration-tested against real Postgres** (92
integration tests green, including
`tests/integration/reconciliation-service.test.ts`), **and partially
live-verified against a real Gmail account (2026-09-14)**. Also fixed
live in this same session, not a new feature: cross-inbox deduplication
(the 1d checklist item) was silently only deduping within one account's
own pending signals, never actually comparing across two different
connected accounts — the literal "same receipt in two inboxes" scenario
it exists for. See `docs/LEARNED.md`, 2026-09-14.

**A real, user-reported gap found and fixed during live verification,
not by review:** the ±3-day date-match tolerance compared every signal
against a subscription's stored `next_billing_date`, which only a
`confirm` outcome could ever refresh — and the original `confirm` path
didn't touch it at all, only `source`/`last_verified_at`. For a
subscription whose real billing date drifts by a day or two cycle to
cycle (the user's own example: a Tello line's billing date shifts by
about a day every month, apparently payment-processing timing), that
drift would accumulate cycle over cycle against a frozen anchor until a
genuinely correct renewal eventually fell outside the ±3-day window —
not from a real mismatch, but from staleness. Fixed: every `confirm`
outcome now re-anchors `anchor_date` (and recomputes `next_billing_date`
from it) to the signal's actual detected billing date, so the
comparison point always reflects the most recently confirmed real event.
A second fix attempted first — recomputing the comparison date live from
`computeNextBillingDate(asOf: today())` instead of trusting the stored
column — was tried and reverted: that function only ever returns a date
on or after "asOf", so it would project *past* a billing date that
already happened by the time a sync catches up to the email (the normal
case), breaking the common path to fix a rarer one. 2 new integration
tests cover the re-anchor behavior (`tests/integration/reconciliation-service.test.ts`).

**Live-verified against a real Gmail account:**
- **Discovery → real subscription, full round trip**: a real Tello
  renewal signal (extraction came back fully null, so no candidate could
  score above 0) produced a real `discovery` proposal; accepting it via
  the "Add subscription" link pre-filled `/subscriptions/new` with the
  detected vendor name, and submitting it created a real subscription
  (`Tello Maa`) and linked the proposal back to it, exactly as designed
- **`payment_failed` correctly excluded from reconciliation while still
  getting its ADR-019 review brief**: a real Xfinity payment-failure
  email produced a `pending` signal with a real Sonnet-written brief
  (`actionRequired: true`) and, confirmed directly in Postgres, **no**
  `reconciliation_proposals` row — exactly ADR-020's decision #3, now
  proven against a real email rather than only a unit test
- **A brand-new vendor's `price_change` signal (Gas South) correctly
  became a real `discovery` proposal** (no candidate scored above 0)
  *and* independently got its own review brief (its own extraction also
  came back null) — both mechanisms rendering correctly, side by side,
  on the same `/review` page against real data
- A real gap in the sync itself, unrelated to reconciliation, found
  along the way: Gmail's history-based incremental sync only ever
  returns messages new since the last `historyId` — a month-old email
  already sitting in the inbox before this session's syncs began would
  never surface through it. Worked around live by resetting the
  account's `sync_cursor` to null (🛑-approved single-field edit, not a
  disconnect/reconnect) so the next sync used the "first sync" 50-message
  fallback instead — this is what actually found the Gas South and
  Xfinity signals above. Not a reconciliation bug and not fixed as
  application code; recorded here since it shaped how this session's
  verification had to be done

**A second real Google account connected (2026-09-14)** —
`nirjhar212@gmail.com`, added as an OAuth test user (the Google Cloud
client is still in Testing publishing mode, capped at 100 lifetime test
users — nowhere close for two personal accounts) after first hitting
Google's "app has not completed verification" block, expected for an
unlisted OAuth client. Its first sync (68s, the bounded 50-message
first-sync fallback) found a real new signal (`anthropic`, `renewal`)
and correctly produced its own real `discovery` proposal, independent of
the first account's signals.

**Two exit criteria confirmed genuinely open, not fixable from here —
checked directly with the user rather than assumed:**
- **No duplicates across inboxes** — cannot be live-proven right now:
  the two connected accounts are the user's real personal inboxes and
  share no actual subscription, so no genuine cross-inbox duplicate
  email exists to collapse. Forwarding a receipt between them to
  manufacture one was considered and explicitly declined by the user —
  the fix (comparing pending signals across every account, not just the
  syncing one — see `docs/LEARNED.md`, 2026-09-14) stays verified at the
  code/`dedupeSignals`-unit-test level only, not by a live duplicate.
  Revisit if the two inboxes ever naturally share a subscription.
- **A `confirm`/`price_update` against a real, already-existing
  subscription** — the two real Tello subscriptions added this session
  have had no new matching email arrive since they were created
  (`source`/`last_verified_at` on both still null, confirmed directly in
  Postgres). Genuinely blocked on a real future billing event, not code.

**Exit criteria:** two inboxes connected ✅ (nirjhar121@gmail.com +
nirjhar212@gmail.com, 2026-09-14); a manually entered subscription
confirmed by a real email — open, blocked on a future real renewal; a
real price increase detected and surfaced — same; a subscription
discovered that was never manually entered ✅ (live-verified, Tello →
Tello Maa, 2026-09-14); no duplicates across inboxes — open, no real
duplicate currently exists between the two connected inboxes to prove it
against; reconciliation logic at high unit-test coverage ✅ (34 unit
tests across `reconcile.ts`/`levenshtein.ts`).

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

**Resolved (2026-09-14, ADR-019) — failed/declined payment handling**,
captured as an unscoped idea below on 2026-09-13: the exact prediction
("would get called `renewal`, which is actively wrong") was proven live
by the edge-case fixture run, and fixed with new `payment_failed` and
`paused` signal types routed into the ADR-018 review-brief pipeline —
see the checklist entry above. No reconciliation-proposal-type treatment
was needed after all; the review-brief mechanism already handled it.

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
- [x] A monthly automatic price check across every tracked seller
      (`/api/cron/watchlist-check`, `vercel.json` — 1st of the month,
      14:00 UTC), alongside the existing manual per-item check button —
      reuses `checkWatchlistItemPrice` unchanged per item, so a cron-driven
      check and a user-driven one behave identically

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
- **LLM-call safety audit across the whole app (2026-09-15, user request
  — deliberately deferred until the watchlist identity-resolution work
  is done)**: a full pass over every LLM call site (`classifyEmail`/
  `writeReviewBrief` in detection, and the three new watchlist calls —
  `planWatchlistQuery`/`recommendWatchlistStores`/
  `validateShoppingCandidates`), specifically checking:
  - Whether any call site could loop unboundedly — e.g. an escalation
    or retry path that could re-trigger itself, not just the
    already-bounded Haiku→Sonnet escalation (`providers/anthropic.ts`)
  - Whether every external network call (LLM and non-LLM — SerpApi's
    `google_shopping`/`google_immersive_product` calls in
    `providers/google-shopping.ts` currently have **no** explicit
    timeout, unlike `providers/anthropic.ts`'s `PER_CALL_TIMEOUT_MS`)
    has a real cap, so a single slow/hanging call can't block a request
    indefinitely
  - Prompt-injection exposure: this app's LLM calls only ever process
    already-fetched, structured text (an email body, a user-typed
    product name/details, search-result titles) — none of them
    currently hands a model raw content fetched *during* its own tool
    use (e.g. a scraped web page), which is the shape of prompt
    injection this concern is really about. Worth confirming that
    stays true as watchlist-adjacent features grow, and worth
    documenting the threat model explicitly rather than leaving it
    implicit
  - Whether wrapping LLM input/output through LangChain (or a similar
    framework) is worth adopting for this — evaluate deliberately
    against this app's existing direct-SDK approach
    (`@anthropic-ai/sdk` + Zod schemas + `output_config.format`, no
    framework), not assumed as a default improvement
  Not started — recorded here per explicit instruction to defer it
  until the current watchlist feature work is finished.
