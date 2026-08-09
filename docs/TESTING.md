# Testing

## The rule

**After completing any task that closes a checklist item in `PHASES.md`, run
`pnpm verify` and report the result. Do not mark work complete on a red suite.**

`pnpm verify` runs typecheck, lint, unit tests, and integration tests. E2E runs
separately and at phase boundaries, because it is slow enough that running it per
task would make the rule get ignored.

At the end of a phase, before its exit criteria are declared met, run the full
suite including `pnpm test:e2e`.

The mechanically enforced version of this rule lives in `.claude/rules/testing.md`,
which loads automatically when test files are touched. This file is the reasoning
behind it.

## Why the emphasis

This project's failure mode is not a crash. It is a total that is quietly wrong.

A reconciliation bug that merges two distinct subscriptions, or a billing-date
calculation that skips a month-end, produces a dashboard that looks completely
normal and is incorrect. There is no exception, no red screen, and no way for the
user to notice — the entire point of the app is that they do not already know the
right answer.

That is why `src/server/domain/` is pure. Logic with no I/O can be tested
exhaustively and fast, and exhaustive testing is the only defence against silent
wrongness.

## Layers

### Unit — `tests/unit/`

Vitest. Mirrors `src/server/domain/`. Fast, no database, no network.

Target **≥ 90% coverage on `domain/`.** Coverage elsewhere is not a goal; chasing
a global percentage produces tests that assert framework behaviour.

Priority order, by how expensive a silent bug would be:

1. `reconcile.ts` — every branch of the match matrix in `DATA_MODEL.md`, plus all
   the enumerated edge cases at the end of that file
2. `billing-cycle.ts` — month-end rollover (Jan 31 → Feb), leap years, annual on
   Feb 29, DST boundaries, custom intervals
3. `dedupe.ts` — hash collisions, near-misses that must *not* collapse, forwarded
   receipts arriving weeks apart
4. `burn.ts` — mixed cycles normalised to monthly, mixed currencies, zero and
   negative cases
5. `money.ts` — rounding at every cycle conversion; assert no float ever appears

Property-based tests (`fast-check`) are worth it for money and dates specifically.
Invariants like *normalising to monthly and back preserves the annual total* catch
the rounding bugs that example-based tests miss.

### Integration — `tests/integration/`

Vitest against a real Postgres test database. External providers mocked at the
adapter boundary in `src/server/providers/` — never mock Drizzle, or the tests
stop testing the queries.

Covers:

- Migrations apply cleanly from empty
- Repository queries return what they claim, including the unique constraints
  that make sync retries idempotent
- Full sync pipeline against fixture emails, provider mocked
- Reconciliation proposals persist correctly and resolve correctly
- Token encryption round-trips
- Re-running sync over the same messages produces no duplicate signals

Each test runs in a transaction rolled back afterwards. No shared state between
tests, no ordering dependency.

### Golden files — `tests/fixtures/emails/`

The most valuable asset in the test suite, and the one that has to be built by
hand.

A corpus of real, anonymised subscription emails paired with expected extraction
output. Every classification bug found in real use gets added here as a case
before it is fixed. Over time this becomes the thing that lets prompts and models
change without silent accuracy regressions.

Anonymisation rules: replace real addresses, names, account numbers, and order
IDs. Keep vendor names, amounts, dates, and structure — those are what is being
tested. **Never commit a fixture containing real personal data.**

Extraction is non-deterministic, so assert on the structured fields (vendor,
amount, date, signal type), never on prose. Set a floor — for example, ≥ 95% of
the corpus classified correctly — and fail the suite below it rather than
asserting per-case perfection.

### E2E — `tests/e2e/`

Playwright. Small and stable — a handful of flows, not comprehensive coverage.
Every flaky E2E test costs more trust than it provides.

- Sign in
- Add a subscription manually, see it in the dashboard total
- Connect an inbox (OAuth mocked)
- Accept a reconciliation proposal, see the record update
- Reject a proposal, see the record unchanged

## Conventions

- Test file next to what it tests in the mirrored tree: `domain/reconcile.ts` →
  `tests/unit/domain/reconcile.test.ts`
- Name tests as behaviour: `it('flags a price increase rather than applying it')`
- Arrange-Act-Assert, visibly separated
- No conditionals in tests. A test with an `if` is two tests.
- One assertion concept per test. Multiple `expect`s on the same concept are fine.
- Builders in `tests/fixtures/builders.ts` for object construction, so a schema
  change touches one file
- Fixed clock in every date-sensitive test. Never `new Date()` in a test.

## Bug protocol

A bug gets a failing test that reproduces it **before** the fix. The test proves
the bug exists, then proves it is fixed, then prevents its return. This applies
especially to reconciliation, where the failure is invisible and the regression
would be too.

## CI

On every push: `pnpm verify`. On pull request and before deploy: add
`pnpm test:e2e`. A red suite blocks merge — a green-only-locally rule is not a
rule.
