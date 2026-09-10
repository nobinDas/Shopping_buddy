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
