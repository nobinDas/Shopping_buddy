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
