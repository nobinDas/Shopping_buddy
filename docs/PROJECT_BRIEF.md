# Project brief

The document to hand a new session, a new tool, or a new collaborator. Read this
first, then `MEMORY.md` for where things actually stand.

## What this is

Overhead is a single-user personal finance and life-logistics agent. It exists to
make recurring spending visible, then to reduce the friction around the decisions
that spending implies — what to buy, where, when, and in what order.

It is built in phases, and the phases are sequenced by dependency and by value
delivered, not by how interesting they are to build.

## The core insight

Recurring cost is invisible by structure. It arrives across multiple inboxes,
some of it leaves no email trail at all, and the individual amounts are small
enough to never trigger scrutiny. The aggregate is the thing that matters and the
aggregate is the thing nobody sees.

Two design consequences follow, and they are the spine of Phase 1:

**Manual entry is the primary data source, not a fallback.** It gives a complete
picture immediately rather than waiting for a parser to observe a full billing
cycle for every service. It captures subscriptions that email cannot see — cash
payments, family-plan add-ons, employer-provided services the user still wants
tracked.

**Email detection is confirmatory and supplementary.** Its job is to verify the
amounts and dates the user entered, catch price increases they did not notice,
and surface subscriptions they forgot to list. It is never the authority when the
two sources disagree; it raises a flag for the user to resolve.

## Phase 1 scope

A recurring-cost tracker:

- Connect one or more email accounts with **read-only** OAuth
- Manual subscription entry as a first-class create/edit path
- LLM-based classification and extraction of subscription signals from email
- Cross-inbox deduplication (the same Netflix receipt in two inboxes is one event)
- Reconciliation between manual records and detected signals
- A dashboard: every recurring cost, next billing date, monthly and annual burn

## Explicitly out of scope

**Automated insurance re-quoting** was considered and removed. There is no clean
public API for multi-insurer quoting; the services that do it are businesses
built on scraping and partnership deals. Building it means either depending on
one of those as an intermediary or accepting a fragile, narrow, manual-assisted
version. Insurance stays in the product as a *tracked recurring cost with renewal
reminders* — not as an action the agent takes. This is a deliberate trade: the
automation was the least reliable part of the original concept and the tracking
delivers most of the practical value.

**Anything from a later phase.** Shopping, routing, and price timing are real
plans with real scope, and building them early would couple them to a data model
that has not been proven yet.

## Non-goals

- Multi-user or multi-tenant. Single user. If that changes it is a rewrite of the
  auth and data-isolation layer, and that is fine — but it is not designed for now.
- A budgeting app. Overhead tracks committed recurring cost, not discretionary
  spending, and does not attempt categorised budgets.
- Bank or card integration. Email plus manual entry only, for Phase 1. Aggregator
  APIs are a possible later addition and a separate decision.

## Principles

1. **Scope decisions carry their rationale.** Every removal or deferral gets a
   written *why* in `DECISIONS.md`. A choice without a reason cannot be revisited
   intelligently later.
2. **Each phase has a bounded, shippable scope.** A phase ends when its exit
   criteria pass, not when the next idea gets interesting.
3. **The user is the authority on their own money.** The system proposes, flags,
   and reconciles. It does not overwrite what the user asserted.
4. **Every automated financial suggestion is auditable.** A `reasoning` record is
   written alongside any recommendation, so it can be inspected rather than
   trusted blindly.
5. **Read-only until proven otherwise.** Inbox access, and any future integration,
   starts at the minimum scope that does the job.
