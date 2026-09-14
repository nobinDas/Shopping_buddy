# Decisions

Architecture decision records. One entry per significant choice, newest first.

A decision without a recorded reason cannot be revisited intelligently — six
months later nobody remembers whether a constraint was fundamental or incidental,
so it gets treated as fundamental and the project calcifies around it.

Write an ADR when a choice is **expensive to reverse** or **non-obvious to a
newcomer**. Not for routine implementation choices.

## Format

```
## ADR-NNN — Title
**Date:** YYYY-MM-DD
**Status:** proposed | accepted | superseded by ADR-NNN
**Context:** the forces at play
**Decision:** what was chosen
**Consequences:** what this costs, not just what it buys
**Alternatives considered:** what else, and why not
```

The **consequences** section should always contain something negative. Every real
decision has a cost, and an ADR that reads as pure upside is a decision that was
not actually examined.

---

## ADR-019 — Two new signal types (`payment_failed`, `paused`) instead of forcing a fit

**Date:** 2026-09-14
**Status:** accepted
**Context:** The edge-case golden-fixture run (see `LEARNED.md`) proved,
live against the real API, a bug already predicted months earlier as an
unscoped idea in `PHASES.md`: `signal_type` has no slot for "this
happened, but it isn't a billing event." A declined-payment email
(`audible-payment-failed`) got classified as `renewal` with a real
`amountMinor` — reporting a failed charge as a successful one. A
membership-pause email (`equinox-membership-pause`) got classified as
`renewal` too, but with a **hallucinated** `billingDate` fabricated from
the pause's resume date, not left null. The second finding matters more
than the first: forced into a mismatched category, the model doesn't
fail loudly or leave fields empty — it confidently invents a
plausible-looking value.
**Decision:** Add two distinct signal types, `payment_failed` and
`paused` (not one merged catch-all — more precise and queryable later,
and matches the type name already proposed in `PHASES.md`). Three parts:
(1) `classify-email.ts`'s prompt gains two new categories with explicit
counter-examples ("never call this renewal," mirroring this project's
established fix pattern for prompt instructions that need to actually
stick); (2) `enforceCancellationInvariant` generalizes to
`enforceNoConfirmedChargeInvariant`, deterministically forcing
`billingDate: null` for `cancellation`, `paused`, and `payment_failed`
alike — the actual fix for the hallucination bug, since it doesn't rely
on the model complying; (3) a new `needsReviewBrief()` predicate routes
both new types into the review-brief pipeline already built in ADR-018,
regardless of whether `amountMinor` happens to be populated (a
`payment_failed` signal legitimately keeps its attempted-charge amount,
so ADR-018's original "all three fields null" check alone wouldn't have
caught it). No new UI, no new database concept beyond the two enum
values — this reuses ADR-018's machinery entirely.
**Consequences:** `signal_type` now has 7 values instead of 5 — every
place that pattern-matches over it (there are exactly three:
`ClassificationSchema`, `ClassificationResult`, and the escalation-
trigger set in `anthropic.ts`) needed updating, and any future addition
repeats that audit. The enum migration (`ALTER TYPE ... ADD VALUE`) is
additive and irreversible-by-normal-means (Postgres doesn't support
`DROP VALUE`) — an accepted, permanent schema commitment for what could
still turn out to be a narrow case. Doesn't fix the model's underlying
tendency to hallucinate when forced into the wrong category generally —
only the two specific instances proven live; a third undiscovered
category-shaped gap would fail the same way until found.
**Alternatives considered:** One merged type (e.g. `"other"`).
Rejected on user preference — less precise for future filtering/stats,
even though it would have been a smaller schema/prompt/fixture diff and
needed no distinguishing logic (the review brief's own prose already
explains the specific situation either way). Waiting for Phase 1e and
representing these as reconciliation proposal types instead. Rejected
for the same reason ADR-018 rejected it for the original unclear-
extraction case: these have no manual subscription record to reconcile
against, and forcing them into that shape means building 1e's data model
early just to accommodate a different kind of row.

## ADR-018 — A real "needs review" slice on /review ahead of full Phase 1e reconciliation

**Date:** 2026-09-14
**Status:** accepted
**Context:** Live sync against the real Gmail account produced 3 real
`detected_signals` rows (Xfinity, Gas South, Tello) where even Sonnet's
escalated result (ADR-017) still had `amountMinor`/`currency`/`billingDate`
all null — genuinely subscription-relevant emails (a one-time payment, a
rate-change deadline notice, a tabular invoice) that don't fit the
"renewal receipt" shape the schema/prompt were built around. `PHASES.md`
scopes `/review` to stay on Phase 1.5's mock data until Phase 1e builds
full reconciliation, and 1e itself is scoped strictly to
confirm/price-update/date-update/discovery/cancellation proposals against
manual subscriptions — not this "extraction came back empty" case. Leaving
these 3 rows as bare nulls with no way to act on them wastes real,
already-detected signal.

Separately, `docs/SECURITY.md` states email bodies are never persisted —
worth an explicit read on whether persisting an LLM-derived *summary* of
one conflicts with that.
**Decision:** Build a narrow, self-contained real slice: when a
classified signal's amount/currency/billingDate all come back null
(regardless of signal type, cancellations included), a Sonnet-only call
(`providers/anthropic.ts#writeReviewBrief`, `prompts/write-review-brief.ts`)
writes a short plain-English brief — explicitly instructed to paraphrase,
never quote the email verbatim, keeping it inside the spirit of "email
bodies are never persisted" even though the letter of that rule is about
the raw body, not a derived paraphrase. The brief and an `actionRequired`
flag are stored on the signal itself (`review_brief`, `action_required`,
plus `resolved_at` for archiving) and surfaced in a new, visually separate
section on `/review` — `components/review/NeedsReviewSection.tsx` — never
mixed into the existing mock proposal cards
(`components/review/ReviewProposalTabs.tsx`). Two actions only, no accept/
reject: "Go to email" (a plain link to the Gmail message, no status
change) and "Archive" (the only action that moves a card from pending to
resolved). Archived cards stop appearing after one month but are never
deleted from the database.
**Consequences:** `/review` is no longer purely mock — two real,
independently-evolving code paths now exist on the same page, which the
eventual Phase 1e cutover will need to reconcile or replace, not just add
to. An extra Sonnet call runs for every unclear-extraction signal, on top
of the classification escalation that already ran to produce that null
result — real, if small, additional cost and latency. The Gmail deep link
hardcodes `u/0` since `email_accounts` has no per-account "login slot" to
compute it from; wrong if this app is ever used against a browser logged
into multiple Google accounts in a different order, accepted for a
single-account app.
**Alternatives considered:** Waiting for Phase 1e and modeling this as a
sixth `reconciliation_proposals` proposal type. Rejected for now — 1e's
proposal types are specifically about matching against manual
subscription records, and this case has no manual record to match
against at all; forcing it into that shape would mean building 1e's data
model early just to accommodate a fundamentally different kind of row.
Silently leaving the 3 rows as unreviewable nulls. Rejected — the signal
was already paid for (two LLM calls per email) and already correctly
identified as subscription-relevant; discarding it wastes real, working
detection.

**Note (2026-09-14):** The "visually separate section, never mixed"
part of the Decision above was explicitly reversed the same day, on
direct user request: the two-section layout read as two disconnected
review queues rather than one. `components/review/NeedsReviewSection.tsx`
and `ReviewProposalTabs.tsx` were merged into one
`components/review/ReviewList.tsx`, rendering both sources as one
interleaved, date-sorted list under a single Pending/Resolved tab pair.
"Go to email" was also extended to the 5 mock proposal cards for visual
consistency, using invented placeholder message IDs — explicitly not
real, on record as a known, accepted stub until Phase 1e gives mock data
a real linked signal. Nothing else in the Decision changed: the brief-
generation trigger, the two real actions (Go to email / Archive), and
the one-month resolved-display window are all unaffected.

## ADR-017 — Escalation triggered by evidence, not a confidence threshold

**Date:** 2026-09-14
**Status:** accepted
**Context:** ADR-016 (and, before it, ADR-004) specified escalating from
Haiku to Sonnet when Haiku's self-reported `confidence` fell below 0.7.
In practice this never fired for the failures that mattered. Two
confirmed, reproducible Haiku bugs surfaced during Phase 1d verification
— both explained fully in `docs/LEARNED.md`'s 2026-09-13 and 2026-09-14
entries — and Haiku reported *high* confidence (0.9+) on every wrong
answer in both, identical to its confidence on correct ones. Directly
queried Sonnet independently on one of these cases and got the same
high-confidence-and-wrong result, confirming this isn't Haiku-specific.
Research (see this session's exchange with a second model, reproduced
in spirit here) confirms the general pattern: verbalized confidence
tracks input *ambiguity*, not model *failure* — a model that
confidently computes a wrong answer from an unambiguous input was never
"uncertain" in the first place, so no amount of rubric or few-shot
calibration would have produced a lower number. The same reasoning rules
out self-consistency (sampling the same call multiple times) and token
log-probabilities as fixes: both measure how stable or probable an
answer was, not whether it was correct, and a deterministic,
high-probability wrong answer scores as maximally trustworthy on both.
**Decision:** Replace the confidence threshold with two specific,
evidence-based checks on Haiku's *output* (`providers/anthropic.ts`):
`hasSuspectBillingDate` (the billing date exactly matches the email's
received date — the signature of the first confirmed bug) and
`hasMissingBillingDateOnATypeThatUsuallyHasOne` (billingDate is null on
a signal type — new/renewal/price_change/trial_conversion — that
normally has one; catches the second bug, which had no predictable
trigger in the input itself — see the 2026-09-14 LEARNED.md entry, where
the actual cause turned out to be one specific vendor name). Also added:
`enforceCancellationInvariant`, a deterministic (non-escalating)
correction for a *guaranteed* contradiction the prompt already implies
(a cancellation categorically has no billingDate) — corrected in code
rather than re-asked, since there's no uncertainty about the right
answer to get a second opinion on.
**Consequences:** The second check is deliberately blunt — it also
escalates genuinely-correct null cases (a real email that truly states
no next charge date), not just bugs. Verified this doesn't introduce
regressions: those cases still correctly return null after Sonnet
re-derives them, across two full golden-file runs, but it does mean some
previously free, fully deterministic Haiku-only cases now take a
non-deterministic second call on every run, not just when something's
actually wrong — a real, accepted cost at this app's volume. Confidence
remains in the schema and gets stored, but is no longer read anywhere to
gate behavior — kept as one-sided, weak evidence only (worth noting if
low; proves nothing if high), matching the framing that motivated this
change. This is inherently incomplete: it catches the two known failure
signatures, not an unbounded class of future ones — a new, differently-shaped
bug still needs its own check once discovered, the same way these two
were.
**Alternatives considered:** A better-calibrated confidence rubric with
few-shot examples — rejected; addresses genuine ambiguity, not the
confident-and-wrong class of error this session actually hit. Self-consistency
(sample N times, escalate on disagreement) — rejected for a deterministic
error (temperature: 0 already produces the same wrong answer every time
for a given input; agreement is not correctness). Token log-probabilities
— rejected for the same reason, and unconfirmed whether the Messages API
even exposes them. Multi-model cross-checking on every request — not
adopted as the default (doubles cost for every email, not just suspect
ones); the two targeted checks approximate this more cheaply by
triggering the cross-check only when there's a concrete reason to.

---

## ADR-016 — Claude replaces Gemini for Phase 1d classification, reinstating ADR-004

**Date:** 2026-09-11
**Status:** accepted
**Context:** ADR-015 switched Phase 1d's classification from the
originally-planned Claude (ADR-004) to Gemini Flash, for its free tier.
That ADR's own Consequences section already flagged the risk: "Free-tier
rate limits... are a real ceiling this app has never had to design around
before." That risk materialized concretely: `gemini-3.6-flash`'s free
tier turned out to cap at **20 requests per day per project**, confirmed
directly from Google's own `429 RESOURCE_EXHAUSTED` error body
(`quotaId: GenerateRequestsPerDayPerProjectPerModel-FreeTier`), not a
soft or negotiable rate limit — testing during this same session
exhausted it outright. Before switching back, a genuinely free and fully
private alternative was evaluated directly rather than assumed away:
three local Ollama models (`granite3.3:8b`, `qwen3:8b`, `gemma4:latest`)
were run against the same 5 real golden fixtures already used for
Gemini. Results: `granite3.3:8b` 3/5 correct (~5s/call), `qwen3:8b` 4/5
correct (~25s/call, thinking-mode overhead), `gemma4:latest` 1/5 correct
(~25s/call) with a **systematic bug** — it consistently returned only the
last two digits of the amount as `amountMinor` (e.g. $17.99 → 99 instead
of 1799). All three pinned `confidence` at or near 1.0 regardless of
whether the answer was actually correct. This is exactly what ADR-004
predicted for local models on this task ("exactly where smaller models
degrade, and they fail *silently*") — now confirmed empirically rather
than assumed.
**Decision:** Reinstate ADR-004's original design as-is: Claude Haiku 4.5
(`claude-haiku-4-5-20251001`) for primary classification/extraction,
escalating to Claude Sonnet 5 (`claude-sonnet-5`) when Haiku's own
reported confidence is below 0.7 (`src/server/providers/anthropic.ts`),
via native structured output (`output_config.format` with a Zod schema,
schema-guaranteed by the API — a cleaner mechanism than Gemini's JSON
mode or Ollama's grammar-constrained decoding, which was observed
dropping non-required optional fields entirely under the same schema
shape). Uses the SDK's built-in retry (`maxRetries`, honors
`retry-after`) rather than a hand-rolled retry loop — no observed need
for more, unlike Gemini's actual instability.
**Consequences:** Reintroduces a real per-call cost and the training-data
question closes rather than needing a future revisit — Anthropic doesn't
train on API customer data by default, resolving the open question
`docs/MEMORY.md` was tracking for Gemini's free tier. At personal-inbox
volume the cost is trivial (low single-digit dollars/month even under
generous volume assumptions), and Claude's current paid pricing for
Haiku 4.5 ($1/$5 per MTok) is comparable to or cheaper than Gemini's own
paid tier per call — so this isn't a cost regression, just a return to
paying for reliability instead of tolerating a free tier's ceiling. New
organizations start on Anthropic's Evaluation tier (below-standard rate
limits until usage history builds) — unlike Gemini's fixed daily cap,
these are per-minute request/token limits on a continuously-replenishing
token bucket with no daily reset, and advance automatically; not expected
to reproduce today's blocker at this app's volume, but unverified until
live-tested against the real key. The local-Ollama option is now closed
off rather than left dangling — the empirical evidence above is
reasonably strong given the confidence-calibration failure was consistent
across all three models tried, not a one-off.
**Alternatives considered:** Enable Gemini's paid tier instead of
switching providers — rejected; would have kept a second full provider
integration (with its own retry/model-fallback code, since
`gemini-3.6-flash` also showed real instability under load this session)
for no cost advantage over Claude. Local Ollama models — rejected after
direct testing, not assumption; see Context. Gemini Flash with a larger
Gemini model as escalation, matching the two-tier shape without leaving
the Gemini ecosystem — not pursued; once paying per call, Claude's
already-proven two-tier design (ADR-004, `docs/TOOLS.md`) was the more
natural target than re-deriving an equivalent Gemini-only design.

**Note (2026-09-14):** The escalation *trigger* described above
(confidence below 0.7) turned out not to work and was replaced —
confidence was never a reliable signal for the failures actually
encountered. See ADR-017. The model choice and two-tier shape decided
here are unaffected and still stand.

---

## ADR-015 — Gemini (Google AI Studio) replaces Claude for Phase 1d classification

**Date:** 2026-09-11
**Status:** superseded by ADR-016
**Context:** `docs/TOOLS.md` pre-reasoned Claude Haiku 4.5 (classification)
with a Sonnet 5 escalation path for low-confidence cases, via
`@anthropic-ai/sdk`. When Phase 1d actually started, the user asked to
use Gemini via Google AI Studio instead, specifically for its free tier.
Verified via research rather than assumed: a genuine no-billing-required
free tier exists (current models Gemini Flash/Flash-Lite; Gemini Pro
moved behind billing in May 2026), with JSON Schema structured output
that Zod validates against cleanly, via the official `@google/genai` SDK.
**Decision:** Classification/extraction uses Gemini Flash
(`providers/gemini.ts`), single-tier — **no paid escalation model**. The
original two-tier design (cheap model + expensive fallback for hard
cases) assumed an affordable escalation path; since Gemini Pro isn't
free, the user chose to drop escalation entirely rather than reintroduce
a cost Gemini was chosen specifically to avoid. A low-confidence result
is surfaced as an ambiguous match in Phase 1e's (not yet built)
reconciliation — the existing 0.4–0.7 "ambiguous, show both candidates"
band in `docs/DATA_MODEL.md` already covers this, so nothing new needed
designing for it.
**Consequences:** **Free-tier inputs and outputs may be used by Google to
improve their models** — a real, disclosed difference from a paid tier
(and from Claude's API, which doesn't train on customer data by default).
This app sends pre-filtered, subscription-likely email content through
it. The user explicitly accepted this "for now," with an intent to
revisit after the development phase — recorded as an open question in
`docs/MEMORY.md` so it isn't silently forgotten. Classification accuracy
on genuinely ambiguous emails is weaker without an escalation path — those
cases surface to the user instead of getting a second, stronger-model
attempt, meaning more manual review than the original design implied.
Free-tier rate limits (per-minute and per-day caps, low double digits to
low thousands depending on the exact model) are generous for a personal
inbox but are a real ceiling this app has never had to design around
before with an LLM provider.
**Alternatives considered:** Claude Haiku + Sonnet escalation, per the
original `docs/TOOLS.md` pre-reasoning — rejected per the user's explicit
preference for a free option. Gemini Flash with Gemini Pro as a paid
escalation path — rejected by the user in favor of a fully single-tier
design; the cost avoidance was the point of switching providers at all.
Enabling Gemini's paid tier from the start (to avoid the training-data
question entirely) — rejected for now; the user wants to develop against
the free tier first and revisit after the development phase.

---

## ADR-014 — Phase 3's per-item price-check retired; Phase 5 becomes a standalone Watchlist on Google Shopping

**Date:** 2026-09-11
**Status:** accepted
**Context:** Phase 3 built a per-item Walmart price-check on regular
shopping-list items (`providers/serpapi.ts`'s `searchWalmartPrice`,
`item_price_history`). Phase 5's original scope built on top of that:
price-history trend detection, buy-now-or-wait suggestions with a target
price, a local stock check tied to store trips, all for regular items.
Talking through Phase 5's plan, the user redirected significantly: regular
shopping-list items are small, short-lived, one-time buys — never the
right target for long-term price tracking. Price tracking belongs to a
separate class of thing entirely: big-ticket items (a TV, a robot vacuum)
explicitly added to watch over time.
**Decision:** Phase 3's regular-item price-check is retired —
`providers/serpapi.ts`, `checkItemPrice`, `checkItemPriceAction`, and the
`/shopping` magnifier icon + "Priced subtotal" UI are all removed.
`shoppingListItems.unitPriceMinor`/`currency`/`lastPriceCheckedAt` and the
historical `item_price_history` rows are **not** migrated or dropped —
only the application code that used them goes; the data stays, unused,
rather than being destroyed for a feature retirement (see the project's
delete/edit-approval rule). In its place: a standalone `watchlist_items` /
`watchlist_price_history` schema (Phase 5), priced via a new
`providers/google-shopping.ts` (SerpApi's `google_shopping` engine — same
account/key as the retired Walmart check, just a different engine),
picking the **lowest**-priced listing across sellers rather than Phase 3's
"take the top result." No target price — the only trigger is a price drop
relative to the item's own previously recorded price
(`domain/price-trend.ts#didPriceDrop`), surfaced as a two-level nav
badge (a dot on the bottom nav's More tab → a dot on the Watchlist row
inside More → the item itself, once opened) rather than a push/email
alert, since no notification infrastructure exists. "Stock check" is
scoped to watchlist items only, and is a real precision compromise: Google
Shopping's API has no dedicated in-stock/out-of-stock field, so "at least
one priced listing was found" stands in for availability — not a true
inventory feed, and the UI says "no listing found right now," not "out of
stock," to avoid overclaiming certainty the data doesn't support.
**Consequences:** A real feature (per-item Walmart pricing) that was built,
live-verified, and shipped in Phase 3 is now dead code walking — the
underlying data isn't lost, but nothing in the app reads or writes it
again barring a future revival. Anyone reading `schema.ts` cold will see
`unitPriceMinor`/`item_price_history` on `shoppingListItems` with no
application code path touching them — worth this ADR existing so that
reads as a deliberate, explained retirement rather than an oversight.
The stock-availability signal is genuinely weaker than the checklist's
original "prevents a wasted trip" framing implied — a listing existing
online says nothing about whether a specific physical store has it, which
is a real gap for someone hoping to check before driving somewhere for a
watchlist purchase (this app doesn't have that granularity at all
anymore; it never really did for non-Walmart stores, and now it doesn't
even for Walmart specifically).
**Alternatives considered:** Reusing shopping-list items with an optional
target-price field, rather than a separate `watchlist_items` entity —
rejected by the user as not matching how these items are actually used
(big, deliberate, long-considered purchases, not grocery-list entries).
Keeping the Walmart-only price source for the Watchlist too — rejected in
favor of Google Shopping, since the user explicitly wants the lowest price
across sellers, not one retailer's price. Dropping the schema/historical
data along with the code — rejected; there's no reason to destroy real
collected data for a feature retirement when leaving it costs nothing.

---

## ADR-013 — Phase 4 redesigned as a continuous, item-level-due-date view instead of discrete deadline-driven trips

**Date:** 2026-09-10
**Status:** accepted
**Context:** `PHASES.md`'s original Phase 4 scope was a discrete "trip"
entity with its own due time, computing a leave-by clock time backward
from that deadline — matching the Phase 1.5 mock. Talking through the
plan surfaced a real gap: a trip covering two stores where the user only
visits one has no clear next step for the other store's items under that
model — reschedule it? Leave it stuck in a half-finished trip forever?
The user redirected the design instead of asking for a reschedule
feature: due dates belong on individual shopping items, not on a trip,
and `/trips` should be a continuous view of whatever is currently
outstanding rather than a series of discrete, completable events. The
user also asked to drop the leave-by/arrive-by clock time entirely —
due dates are dates, not times, so a countdown to departure doesn't
apply — in favor of plain drive-time and shopping-duration numbers.
**Decision:** `shoppingListItems` gained `dueAt` (optional, per item) and
`checkedAt` (stamped on check, cleared on uncheck). There is no `trips`
table, no trip entity at all. `/trips` queries every outstanding
(unchecked) item across every list on each load, groups by store, sorts
by urgency (soonest `dueAt` first, no-due-date items last), and shows an
overdue flag on any item whose `dueAt` has passed. Route optimization
(Google Routes API, `optimizeWaypointOrder`) and per-store hours (Google
Places) run on demand from this same live query — never against a
persisted "trip." A checked item stays visible (struck through) through
the rest of the day it was checked, then drops out of `/shopping`'s view
(not deleted — `domain/shopping-visibility.ts`).
**Consequences:** There's no history of past trips, no "trip complete"
state, and no leave-by clock time — a real, deliberate loss if a future
need for scheduled-arrival planning (e.g., "I must be at this store by
6pm before it closes") turns up; that would need to be designed back in,
not just re-enabled, since the whole model no longer carries a
scheduled-time concept anywhere. The "two stores, only visit one" problem
this was meant to solve is resolved for free by the continuous model —
whatever wasn't bought simply remains visible, sorted by urgency, the
next time the view opens — but at the cost of no explicit UI ever telling
the user "you didn't finish something," relying instead on the same
passive urgency/overdue indicators that cover every other outstanding
item.
**Alternatives considered:** Keeping discrete trips with an explicit
reschedule flow (detect an unfinished trip, prompt the user to plan
another one for the remaining stores before their due date) — rejected as
meaningfully more moving parts (a trip-completion concept, a reschedule
prompt, a way to track which stops were actually visited) for a problem
the continuous model resolves structurally. Keeping a leave-by clock time
by also collecting a due *time* alongside the due *date* — rejected per
the user's explicit preference for plain durations over a scheduled
departure time.

---

## ADR-012 — SerpApi's Walmart engine as Phase 3's price source, not Walmart's own APIs

**Date:** 2026-09-10
**Status:** accepted
**Context:** Phase 3 needed one store with a real, per-item price lookup.
The user chose Walmart. Walmart has no public self-serve product/price
API — the two official options are the Affiliate API (gated behind
Impact.com approval, built for affiliate-marketing sites driving
click-through sales to earn commission, not a personal read-only price
check) and Marketplace/Supplier APIs (for sellers listing products on
Walmart.com, not for reading prices as a shopper). The user pushed back
on an initial recommendation to drop Walmart entirely and pointed at
third-party data providers (SerpApi, Apify) to verify instead. Researched
both: SerpApi's Walmart search engine wraps real Walmart search results
as structured JSON, free tier 250 searches/month with a 50/hour cap, $25/mo
for 1,000 if outgrown; Apify's Walmart scraper runs on a $5/month platform
credit with per-result pricing that becomes harder to bound at low volume.
**Decision:** SerpApi's `engine=walmart` search endpoint
(`src/server/providers/serpapi.ts`), called per-item, on-demand only —
never automatically or in bulk — exactly because the free tier's 250/month
and 50/hour caps make an automatic or bulk-check design actively harmful,
not just wasteful. The provider takes the top organic result as-is with no
fuzzy SKU/unit-size matching.
**Consequences:** Price data is a scraped-search-result proxy for Walmart's
real catalog, not an authoritative Walmart API — result quality depends on
how well an item's free-text `name` matches Walmart's own search ranking,
and a poorly-named item ("stuff for the thing") will return a wrong or no
match with no way to disambiguate. The 250/month cap is a real ceiling: at
even light daily use across multiple lists it will be exhausted well before
a billing cycle ends, and there is no in-app warning when the cap is close
— a future phase item, not built now. Introduces a paid-if-scaled
third-party dependency (SerpApi) sitting between the app and Walmart's own
site, which could change its scraping approach, pricing, or terms at any
time.
**Alternatives considered:** Walmart Affiliate API — rejected, purpose-built
for driving affiliate sales traffic and gated behind an approval process
this app's use case (personal price checks) wouldn't plausibly clear.
Walmart Marketplace/Supplier APIs — rejected, built for sellers managing
listings, not for reading prices as a shopper. Apify's Walmart scraper —
considered viable and cheaper at very low volume, but SerpApi's flat
searches/month model is easier to reason about against a hard monthly cap
than Apify's per-result credit consumption. No price integration at all
(manual price entry only) — rejected because Phase 3's own exit criteria
("a real list priced against a real store") requires an actual lookup, not
just a place to type a number in.

---

## ADR-011 — Insurance reuses subscriptions' cycle model, not a parallel one

**Date:** 2026-09-10
**Status:** accepted
**Context:** Phase 2 needed a shape for a tracked insurance policy:
insurer, policy number, premium, a term length, a renewal date, a
reminder lead time. The Phase 1.5 mock built this with `termMonths:
number` + `renewalDate: string` (a static, stored date). `docs/PHASES.md`
frames the whole phase as proof that "the recurring-cost model
generalises beyond subscriptions" — taken literally, an insurance
policy's premium/term/renewal shape isn't a *different* problem from a
subscription's amount/cycle/anchor-date shape, it's the same one: both
are "an amount that recurs on a schedule, starting from some anchor."
**Decision:** `insurance_policies` reuses `subscriptions`' existing
`cycleEnum` (`monthly | quarterly | semiannual | annual | custom`) and
`statusEnum` directly (same Postgres enum types, not duplicates) instead
of a parallel `termMonths`/`renewalDate` concept. A 6-month auto policy
is `cycle: 'semiannual'`; a 12-month medical policy is `cycle: 'annual'`.
`nextBillingDate` is derived by the exact same
`domain/billing-cycle.ts#computeNextBillingDate` subscriptions already
use, never hand-edited — same convention, same function, zero new domain
code. The dashboard's aggregate burn concatenates policies into the same
`BurnSubscription[]` list subscriptions build and calls
`domain/burn.ts#calculateMonthlyBurn` unchanged.
**Consequences:** A future reader of `schema.ts` sees `insurance_policies`
carrying `cycle`/`cycleDays`/`anchorDate` columns that read as
subscription vocabulary applied to a different domain — worth this ADR
existing so that reads as a deliberate choice, not a copy-paste mistake.
The type/rhythm distinction the checklist asks for ("medical and auto...
different renewal rhythms") is captured implicitly, by each policy's own
`cycle` value, rather than by an explicit per-type code branch — someone
looking for "where auto policies are handled differently from medical
ones" in the code won't find a dedicated function, because there isn't
one. If a real-world insurance concept ever needs a shape a subscription
truly can't express (e.g. a policy that isn't strictly periodic), this
reuse would need to be revisited rather than extended.
**Alternatives considered:** A parallel `termMonths: integer` +
`renewalDate: date` (stored, not derived) concept, matching the original
mock exactly — rejected because it would mean writing and testing a
second, near-identical implementation of next-renewal-date math and
burn normalization, duplicating logic `billing-cycle.ts`/`burn.ts`
already get right (month-end rollover, leap years, DST boundaries) for
no real gain, and would leave the renewal date stored rather than
derived, breaking the "never hand-edited from the UI" convention every
other date in this app already follows.

---

## ADR-010 — LLM-touching phases (1d, 1e) deferred to the end of the build

**Date:** 2026-09-10
**Status:** accepted
**Context:** Phase 1c stage 2 (real Google OAuth) just landed and was
verified live. The originally scoped order (`PHASES.md`, as written) puts
1d (detection — the first phase that calls the Anthropic API) and 1e
(reconciliation) immediately next, before Phases 2–5. The user wants
every phase that doesn't touch an LLM built and real first, and wants the
eventual AI integration to be a deliberately designed, structured piece
of the system — not, in the user's words, "randomly just feed anything
to llm and let it work as it wishes" — built once, once every other
phase already exists as real, working software it can sit on top of.
**Decision:** Reorder the *build* sequence (not the phase numbering
itself) to: 1c (done for Google) → Phase 2 → Phase 3 → Phase 4 → Phase 5
→ 1d → 1e. 1d and 1e move together, since 1e has nothing to reconcile
without 1d's `detected_signals` output — deferring one without the other
isn't meaningful. Phases 2–5 keep their already-documented internal
order and dependencies (Phase 4 needs Phase 3's shopping lists, Phase 5
needs price history Phase 3 has been accumulating).
**Consequences:** The dashboard's Review queue stays mock data for
longer than originally planned — it won't show a real detected signal
until 1d and 1e are both built, now near the end of Phase 1's overall
timeline rather than the middle. The upside is real: by the time the LLM
integration is designed, every other data model, UI pattern, and
provider-adapter convention in the app will already be settled and
proven, so the detection/classification design isn't guessing at
conventions that don't exist yet — and the "structured, not
freeform-prompted" AI design the user wants gets designed once, with the
full shape of the app already known, rather than retrofitted.
**Alternatives considered:** Keeping the original order (1d/1e right
after 1c) — rejected per the user's explicit preference, not a technical
objection to that order. Splitting 1d and 1e apart (build 1d's detection
pipeline now, defer only 1e) — rejected because detected signals with no
reconciliation UI to resolve them would be dead weight sitting in a
table, unverifiable as "working" until 1e exists to surface them.

---

## ADR-009 — Mobile-first redesign, persistent bottom-nav shell, "More" IA

**Date:** 2026-09-09
**Status:** accepted
**Context:** The user designed the full app UI/UX in Claude Design
(`Overhead Mobile.dc.html`) as a 390×844 mobile shell — a persistent
5-tab bottom nav (Dashboard, Subscriptions, Review, Shopping, More) with
everything else (Accounts, Preferred stores, Insurance, Trips, Watchlist)
folded behind "More" — and asked for it to be implemented, with all
future UI/UX work targeting mobile-first from here on. Confirmed with the
user this stays the same Next.js web app (not a PWA wrapper, not a native
rewrite): a mobile-first responsive redesign costs nothing if the app is
later wrapped for app-store distribution (Capacitor-style), and doesn't
add work even in a hypothetical future native rewrite, since the domain
layer (`src/server/domain/`) is plain TypeScript with no DOM dependency
either way — only the UI layer was ever going to be rebuilt for React
Native.
**Decision:** Added `src/app/(dashboard)/layout.tsx` + `BottomNav.tsx` as
a persistent shell wrapping every screen under `(dashboard)/`. Every
existing screen restyled to the mobile design's density (flat blocks, no
rounded corners on primary actions, mono-uppercase micro-labels) while
keeping its existing data source unchanged — real screens (dashboard,
subscriptions) still query Postgres, mock screens (accounts, review,
insurance, shopping, trips, watchlist) still use local fixture state, only
presentation changed. Added two new screens: `/more` (the nav hub) and
`/stores` ("Preferred stores" — fits Phase 3's already-scoped "optional
store preference," not new product scope). The dashboard's burn ribbon
(hover-tooltip occurrence bands) was replaced with a tap-a-month bar chart
+ drill-down list, backed by a new pure `groupOccurrencesByMonth` in
`src/server/domain/burn.ts` (unit tested) — the design's own interaction
model, not an independent choice.
**Consequences:** The old `BurnRibbon.tsx` component and its
hover-tooltip interaction are gone — anyone wanting that exact desktop
ribbon back would need to rebuild it; the new `BurnMonths.tsx` replaces
it entirely rather than living alongside it. `subscription.service.ts`
had no "restore/unarchive" function, so the archived-subscription detail
view showed a static "Archived" label rather than the mock's Restore
button — implementing real unarchive was out of this pass's UI-only
scope. **Closed same-day**: `restoreSubscription` added to the service,
wired to a real `restoreSubscriptionAction`, detail page now has a
working Restore button — see `docs/MEMORY.md`'s 2026-09-09 "Restore/
unarchive backend added" entry. The
mock's per-occurrence "this is the exact month a price change lands"
row-highlighting was dropped for real dashboard data: the app has no
concept of a scheduled *future* price change (only historical
`price_history`), so fabricating that highlight would mean inventing a
signal the data doesn't support — every dashboard drill-down row renders
in plain ink instead.
**Alternatives considered:** Keeping the old flat, nav-less routing and
just restyling colors/spacing — rejected because the design's own state
machine (`goTab`, `hasBack`/`backLabel`) is explicit about a persistent
tab shell and a More-section hierarchy; a restyle without the navigation
change wouldn't match what was actually designed. Building real unarchive
now to make the detail screen match the mock exactly — rejected as
backend work outside this pass's explicit "UI/UX only" scope.

---

## ADR-008 — RLS enabled with zero policies, not per-row ownership policies

**Date:** 2026-09-01
**Status:** accepted
**Context:** Supabase's security advisor flagged `public.phase0_healthcheck`
for having RLS off (see `LEARNED.md`, 2026-08-10). Checking the other public
tables found the same gap on `subscriptions` and `price_history` — both hold
real data and were never given RLS despite `SECURITY.md`'s checklist item
requiring it. The app is single-user with no `user_id`/owner column on any
table (deliberate — see `SECURITY.md`: "Not in scope: multi-user isolation"),
and all DB access happens server-side in `src/server/db/index.ts` through a
direct Postgres connection (`DATABASE_URL`), never through the Supabase JS
client or PostgREST from a browser.
**Decision:** Enable RLS on all three public tables with no policies attached,
via Drizzle's `.enableRLS()` in `schema.ts` so it's captured declaratively and
regenerated by `pnpm db:generate` for any future table. This is a deliberate
deny-all posture for the PostgREST Data API (anon/authenticated roles get
zero rows, since no policy grants any), not a stand-in for policies to be
added later. The role behind `DATABASE_URL` is the Postgres owner role and
bypasses RLS, so the app's own queries are unaffected — confirmed by
`pnpm verify` staying green after the migration, including the connectivity
test in `tests/integration/db.test.ts` that writes through that same
connection.
**Consequences:** If a future feature ever queries these tables through
Supabase's REST/anon-key path (a client-side Supabase JS call, an edge
function using the anon key, etc.) it will silently see zero rows rather than
an authorization error, because no policy exists to grant access — that
failure mode needs to be kept in mind if that access pattern is ever
introduced. `subscriptions` and `price_history` still have no row-level
scoping by user, but that's consistent with the single-user, no-owner-column
design already in place, not a new gap this decision introduces.
**Alternatives considered:** Per-row policies keyed to `auth.uid()` — rejected
because there is no owner column to key them on, and adding one purely to
satisfy RLS would mean scaffolding multi-user infrastructure the project has
explicitly descoped. Leaving `phase0_healthcheck` un-migrated and fixing only
it — rejected because `subscriptions`/`price_history` hold real financial
data and are the actual exposure `SECURITY.md`'s checklist item was written
for.

---

## ADR-007 — Frontend design pass inserted between Phase 1 and Phase 2
**Date:** 2026-08-21
**Status:** accepted
**Context:** 1a is complete and 1b is nearly complete, both with real,
end-to-end wired data. Every phase after this point — 1c (OAuth), 1d (LLM
detection), 1e (reconciliation), and Phases 2–5 (insurance, shopping,
routing, price timing) — is substantial backend integration work, and none
of it has a screen yet. Built phase by phase as originally scoped, the
product's overall shape would only become visible incrementally, one backend
integration at a time.
**Decision:** A new phase, 1.5, inserted between Phase 1 and Phase 2: design
and build every remaining screen in the product against mock/static data
before doing any further real backend integration. Real data replaces the
mocks phase by phase afterward, in the same order already scoped in
`PHASES.md` — this phase doesn't reorder that, it only front-loads what each
screen looks like. The one exception is 1b's remaining item
(per-subscription detail with price history), which gets built for real
inside this phase since its backend already exists.
**Consequences:** Delays 1c/1d/1e and Phases 2–5 by however long a full-app
UI pass takes, and that work is provisional — screens built against
fixtures may need rework once real data shapes (OAuth account states, LLM
signal payloads, retailer price responses) turn out to differ from the
mocks. In exchange, the whole product concept becomes clickable and
reviewable before committing to the harder backend work in each later phase,
and later phases build their backend to fit an already-decided screen
instead of discovering the screen while also building the integration.
**Alternatives considered:** Keep building phase by phase as originally
scoped, designing each screen alongside its backend. Rejected per explicit
user request — the goal here is to see and adjust the whole concept early,
which a phase-by-phase build doesn't provide until every phase is done.

---

## ADR-006 — Real Supabase project for local dev, not Docker Postgres
**Date:** 2026-08-10
**Status:** accepted
**Context:** `MEMORY.md` left this open since scoping: develop locally against
Docker Postgres, or against a real hosted Supabase project from day one. Phase
0.4 needed Supabase Auth (magic-link sign-in) working, which only exists on
the hosted product — Docker Postgres alone can't provide it.
**Decision:** One real Supabase project (`shopping buddy`), used for both
local development and, later, production. No Docker Postgres.
**Consequences:** Local dev now depends on network access and Supabase's
uptime — offline development isn't possible the way it would be against a
local container. Schema changes go through the real project rather than a
disposable local database, so a broken migration is a broken shared
environment, not a wipe-and-restart. In exchange: Auth, RLS, and the
Postgres-pooler behavior get exercised for real from the start instead of
being simulated and re-verified later against the hosted product.
**Alternatives considered:** Docker Postgres for dev, real Supabase only for
staging/production. Rejected for now — Phase 0.4 needed real Supabase Auth
immediately, and running two divergent setups (Docker schema-only locally,
full Supabase later) would mean re-doing the auth verification work this
phase already did. Revisit if hosted-project friction (network dependency,
shared-schema risk) becomes a real problem before Phase 1 ships.

## ADR-005 — Phase 0 added before Phase 1
**Date:** 2026-08-08
**Status:** accepted
**Context:** The original plan started at the subscription tracker. But every
checklist item in it assumes a repo, a database, auth, and a test harness already
exist. Without those, foundation work gets done inside feature work, half-configured.
**Decision:** A short Phase 0 covering repo setup, schema tooling, auth, CI, and a
working test harness. Days, not weeks.
**Consequences:** Delays the first visible feature. Mitigated by keeping Phase 0
tight — if it grows past a few days, something is being over-built. In exchange the
test harness exists before there is anything to test, which is the only order that
results in tests actually being written.
**Alternatives considered:** Folding setup into Phase 1a. Rejected — it makes the
first feature's scope unbounded and hides how much of the time went to setup.

## ADR-004 — Claude API over a local model for classification
**Date:** 2026-08-08
**Status:** accepted
**Context:** Email classification and extraction needs an LLM. Local inference
avoids sending email content to a third party.
**Decision:** Hosted Claude API — Haiku 4.5 for classification and extraction,
Sonnet 5 as an escalation path for low-confidence cases.
**Consequences:** Email content leaves the machine. Mitigated by the fact that only
pre-filtered candidate emails are sent, never the whole inbox, and by using the API
rather than a consumer product. Introduces a per-call cost, though at personal-inbox
volume that is negligible. Adds a network dependency — but detection is already the
degraded-mode path, and manual entry keeps working without it.
**Alternatives considered:** A local 7B–13B model. Rejected on accuracy, not cost:
the hard cases here — ambiguously worded price-increase notices, annual renewals
that read like one-off receipts, trial conversions buried in marketing copy — are
exactly where smaller models degrade, and they fail *silently*, corrupting the
dashboard rather than erroring. Privacy is the one genuine argument for local, and
worth revisiting if the threat model changes.

## ADR-003 — Self-built app over an enterprise agent platform
**Date:** 2026-08-08
**Status:** accepted
**Context:** Gemini Enterprise and Azure AI Foundry were considered as the build
platform, versus writing the application directly.
**Decision:** A self-built Next.js application, with the Claude API as one
component inside it.
**Consequences:** More code to write and own — OAuth flows, scheduling, and the
dashboard are all hand-built rather than configured. In exchange: full control of
the relational schema the reconciliation logic depends on, no platform constraints
when later phases add routing and price checking, and no vendor lock-in.
**Alternatives considered:** Both enterprise platforms. They are built for governed,
org-scale agent deployment against enterprise connectors — genuinely good at that.
This project is a custom relational data model, bespoke reconciliation logic, and a
custom UI for one user. That is a normal application, and those platforms would be
fought rather than used.

## ADR-002 — Insurance re-quoting descoped
**Date:** 2026-08-08
**Status:** accepted
**Context:** The original concept had the agent automatically re-quoting auto
insurance monthly to find cheaper policies.
**Decision:** Removed. Insurance stays as a manually tracked recurring cost with
renewal reminders (Phase 2). No automated shopping.
**Consequences:** Loses the feature that would have saved the most money in the
best case. Accepted, because the best case was not reachable: no viable public
multi-insurer quoting API exists, and the comparison engines are businesses built
on scraping and partnership deals. Building it means depending on one as an
intermediary or shipping something fragile. Tracking the renewal captures most of
the real benefit, since overpaying usually comes from a renewal passing unnoticed.
**Alternatives considered:** Scraping a comparison site (fragile, ToS risk);
integrating one as an intermediary (a dependency and a business relationship);
manual-assisted re-quoting (little better than a calendar reminder, which is what
Phase 2 provides).

## ADR-001 — Manual entry is the primary data source
**Date:** 2026-08-08
**Status:** accepted
**Context:** Two possible sources for subscription data: email detection and
manual entry. Which is authoritative determines the entire reconciliation design.
**Decision:** Manual entry is primary and authoritative. Email detection is
confirmatory and supplementary. Detection may confirm a record or raise a
proposal; it may never overwrite a user-entered value.
**Consequences:** Requires up-front effort from the user before the app is useful,
and the onboarding has to make that worth doing. Adds a review queue and a
proposal model that a detection-authoritative design would not need. In exchange
the dashboard is complete from day one, subscriptions with no email trail are
captured at all, and a mis-extraction can never silently corrupt the record the
user trusts most.
**Alternatives considered:** Detection-primary with manual entry as fallback.
Rejected: incomplete until every service has been observed through a full billing
cycle, permanently blind to cash and family-plan subscriptions, and its errors are
invisible to a user who by definition does not already know the right answer.
