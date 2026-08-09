# Glossary

Precise terms for the concepts this project keeps confusing. Use these words in
code, in commits, and in the UI — inconsistent vocabulary is how two developers
(or a developer and an agent) build two different mental models of the same system.

**Subscription** — a canonical recurring-cost record. What the user sees and what
the dashboard sums. Not necessarily software: insurance policies and utilities are
subscriptions in the data model.

**Signal** — a single piece of evidence extracted from one email. A renewal
receipt is a signal. A signal is *not* a subscription; several signals over time
relate to one subscription.

**Detection** — the pipeline that turns emails into signals: pre-filter,
classify, extract, validate.

**Reconciliation** — matching signals against subscriptions and deciding the
outcome. The crux of Phase 1; specified in `DATA_MODEL.md`.

**Proposal** — a suggested change awaiting user resolution. Detection produces
proposals, never direct edits, except for confirmations.

**Confirmation** — a signal agreeing with an existing subscription. The only
reconciliation outcome applied automatically, because it asserts nothing new.

**Discovery** — a signal with no matching subscription: something being paid for
that was never entered. Surfaces as a proposal, never as a silent insert.

**Vendor key** — a normalised matching string derived from a vendor name
(lowercased, punctuation stripped). Used for matching. Distinct from the display
name, which the user controls.

**Content hash** — sender + subject + amount + date, hashed. The cross-inbox
deduplication key. Deliberately not the message ID: the same receipt in two
inboxes has two message IDs and is one event.

**Burn** — total recurring cost over a period. *Monthly burn* normalises every
cycle to a monthly figure; *annual burn* to a yearly one. Always state which.

**Cycle** — the billing interval. `monthly`, `quarterly`, `semiannual`, `annual`,
or `custom` with an explicit day count.

**Anchor date** — the reference billing date all future dates are derived from.
Distinct from `next_billing_date`, which is computed and never hand-edited.

**Minor units** — the integer representation of money. 1299 = $12.99. Every stored
amount is minor units plus a currency code. Never a float.

**Pre-filter** — the cheap deterministic pass that discards obviously irrelevant
mail before any LLM call.

**Golden files** — the anonymised email corpus in `tests/fixtures/emails/` paired
with expected extraction output. The regression suite for classification accuracy.

**Reasoning record** — the written explanation attached to every proposal. Required,
not optional; it is what makes a financial suggestion auditable rather than trusted
blindly.
