# Learned

A running log of things learned building this — for two audiences.

**Now:** stopping to write down why something was wrong is how the correction
actually sticks.

**Later:** this is the raw material for the portfolio write-up. "Built a
subscription tracker" is a sentence anyone can write. "Discovered that email
detection was quietly overwriting manually entered subscriptions, and inverted the
data model so detection can only propose" is evidence of engineering judgement.
The second one only exists if it was written down when it happened.

## What belongs here

- A wrong assumption that got corrected
- A bug whose cause was more interesting than its fix
- A trade-off understood only after building the wrong version first
- A tool or API that behaved differently than the docs suggested
- A design decision reversed, and what forced the reversal

## What does not

- Things looked up and immediately understood. That is reference, not learning.
- Routine syntax and API usage.
- Anything that would read as "learned how to use X." The interesting part is
  always what X got wrong, or what using it revealed about the problem.

## Format

```
### YYYY-MM-DD — Short title
**Context:** what was being worked on
**What I thought:** the assumption going in
**What was actually true:** what turned out to be the case
**Why it matters:** the transferable part — the thing that applies beyond this bug
**Portfolio-worthy:** yes / no
```

The **why it matters** line is the one that does the work. It is the difference
between a debugging note and an insight, and it is what makes the entry usable in
a write-up months later.

Mark entries `Portfolio-worthy: yes` sparingly — five strong entries make a better
project description than thirty thin ones.

---

## Entries

_Newest first._

### 2026-09-16 — SerpApi's `google_product` engine is dead; Google shut down the surface it scraped
**Context:** Live-verifying the watchlist search fix end to end (previous
entry), the "Find this product" step worked, but checking the newly-added
item's price immediately failed: `SerpApi (google_product) responded 400`.
This was the *other* half of the watchlist identity-resolution design
(ADR-021) — resolution (search) had just been fixed, but checking
(polling the resolved identity) was untouched and had never been
re-verified live in this session.
**What I thought:** This would be another provider-behavior quirk like the
day's earlier two (the inert price filter, the inverting exclude-terms) —
something to work around with different parameters or parsing.
**What was actually true:** It's not a bug to work around. The 400 body
read `"The Google Product service is no longer offered by Google."` —
reproduced with three different, previously-valid `product_id`s, so not
item- or account-specific. A web search confirmed this: Google
discontinued the classic product-page surface in September 2025, and
SerpApi's own docs point to a replacement engine,
`google_immersive_product`, keyed by a `page_token` instead of a
`product_id`. That token turned out to already be present on every
`google_shopping` search result (`immersive_product_page_token`) — no
extra call needed to obtain it, just a new field to capture at
resolution-time. See `docs/DECISIONS.md` ADR-022 for the fix.
**Why it matters:** Not every "the provider behaves oddly" investigation
ends in a workaround — sometimes the honest answer is "this stopped
existing," and no amount of adjusting query syntax or parameter names
would have found that; a plain error-message read plus one web search
settled it in minutes, versus however long a purely code-side investigation
(retrying, tweaking parameters, re-reading the old response shape) would
have burned trying to fix something that no longer works at all. It's also
a reminder that "identity-anchored, poll forever" designs (ADR-021, this
app's version of the CamelCamelCamel/Keepa ASIN pattern) carry a real,
easy-to-miss dependency: the *anchor itself* is a third-party handle with
its own lifecycle, not a property of the product. The new `page_token`'s
own long-term validity is still unverified for the same reason — that
question can only be answered by waiting real time between checks, not by
reasoning about it up front.
**Portfolio-worthy:** yes

### 2026-09-15 — Negated words in a SerpApi google_shopping query don't exclude that term — they invert the result set toward it
**Context:** Same watchlist fix, after removing the ineffective price
filter (see the entry below) and re-verifying end to end. A live run for
"iPhone 17 Pro 256GB" still returned zero candidates once accessories were
properly excluded — because the *query itself* was returning nothing but
accessories in its top 40 results, before any downstream filtering even
ran. This looked at first like a continuation of the quoted-negated-phrase
bug documented in the entry two below (correctly quoted syntax, correctly
capped at 6 terms, one word at a time) — but that fix turned out to be
necessary and not sufficient.
**What I thought:** Once the negation syntax itself was correct (unquoted,
single words, under the count that returns zero results outright),
`-case -cover -screen -protector ...` would do what it says: exclude
listings containing those words, the same way it does for a plain Google
web search.
**What was actually true:** Isolated with four live queries, controlling
one variable at a time. `"Apple iPhone 17 Pro 256GB"` alone (no exclude
terms) returned 22 of 40 results as genuine phone listings in the
$800-$1200 range, from real retailers. Adding **a single** `-case` to the
exact same query dropped that to 0 of 40 — every top result an *"...Case
with MagSafe"* listing, i.e. exactly the thing being excluded, now
dominating the result set instead of being filtered out of it. `-cover`
alone reproduced the same collapse. The full 8-term production exclude
list did too. This isn't the already-documented "too many negated words
returns zero results" failure (a different, also-real bug, see two entries
below) — this is a *single*, well-formed negation making relevance
actively worse, present as of this test.
**Why it matters:** A search operator behaving oddly at the edges (too
many terms, a quoted phrase) is a bug that stays contained to those edges.
An operator that inverts the intended effect under completely ordinary
use — one common word, correctly formatted — means the operator can't be
trusted for its stated purpose *at all*, at any count. The fix wasn't a
smaller cap or different formatting; it was removing exclude-term query
syntax entirely (`domain/watchlist-query.ts#buildShoppingQuery` no longer
touches `excludeTerms`) and relying only on filtering already-fetched
results — title-heuristic and LLM-based, both applied after the fact,
where a bad match affects one candidate instead of poisoning the entire
returned set. The general lesson: when a provider operator produces a
result opposite to its documented meaning, adjusting *how* you use it is
the wrong instinct — the fix is to stop depending on it and move the same
logic to a layer you control.
**Portfolio-worthy:** yes

### 2026-09-15 — SerpApi's google_shopping price-range filter (tbs/low_price/high_price) doesn't actually filter anything — and an earlier "confirmed live" entry for it was wrong
**Context:** Same watchlist identity-resolution fix as the entry below. After
fixing the quoted-negation query bug, live testing still showed a real
search ("Apple iPhone 17 Pro 256GB") returning 40/40 accessory listings and
zero real phones. The fix built at the time was to add SerpApi's documented
price-range operator, `tbs=mr:1,price:1,ppr_min:X,ppr_max:Y`, to the search
itself — and a live test that day appeared to confirm it worked (real phone
listings showed up after adding it), so it shipped as the core fix, with
code comments and a unit test asserting the exact `tbs` string passed to
the provider.
**What I thought:** The `tbs` price-range filter was a real, working
search-time filter for the `google_shopping` engine, with `ppr_min`/
`ppr_max` in this app's existing integer-minor-units convention — "confirmed
live," per the code comments and LEARNED.md-adjacent notes written at the
time.
**What was actually true:** It does nothing. Re-tested during a follow-up
debugging session (a live end-to-end run still returned "no listings
found" even with the filter wired all the way through): the exact same
query returns byte-for-byte identical results, in identical order, whether
`tbs` is omitted, set with `ppr_min`/`ppr_max` in cents, or set with them in
plain dollars (the format SerpApi's own blog documents). The decisive test:
an *impossible* range (`ppr_min:99999,ppr_max:100000`, i.e. "$99,999-
$100,000") on a `phone case` search still returned ordinary $25-$75 phone
cases, unfiltered — proof the parameter is inert for this engine, not just
misconfigured. The same held for the documented `low_price`/`high_price`
params. A GitHub search turned up a SerpApi roadmap issue about adding
custom price-range filtering to Google Shopping after a Google layout
change, consistent with this: the real mechanism (a `shoprs` filter token
read back from a `filters` block in an unfiltered response) isn't a
hand-constructable query parameter at all. The original "confirmed live"
result was very likely a false positive — a coincidental change in results
(a different exclude-term set, a different moment in Google's index, or
similar) mistaken for the filter working, because no impossible-range
control test was run at the time.
**Why it matters:** "Confirmed live" is only as strong as the control you
tested against. Comparing "with filter" vs "without filter" once and seeing
different results is not enough when the query itself was also different
each time — the only test that actually isolates the filter's effect is one
where the *expected* outcome is unambiguous regardless of anything else in
play (here: an impossible range must return zero results if the filter
does anything at all). The real fix ended up not needing the provider's
cooperation at all: every candidate already carries its own price, and the
user's expected range was already being collected — filtering the returned
candidates in application code
(`domain/watchlist-candidates.ts#filterByExpectedPriceRange`) achieves the
same practical result (accessories are almost always priced far outside a
real product's range) without depending on an external parameter that
turned out not to work.
**Portfolio-worthy:** yes

### 2026-09-15 — A quoted negated phrase silently zeroes out Google Shopping results, undocumented
**Context:** Building Phase 5's watchlist identity-resolution fix, specifically
`domain/watchlist-query.ts#buildShoppingQuery` — turning a structured query
plan (brand/model/exclude terms) into an actual search string for SerpApi's
`google_shopping` engine.
**What I thought:** Standard search-operator syntax would apply here the way
it does for plain Google web search — a negated multi-word phrase gets
quoted, e.g. `-"screen protector"`, the same way a positive multi-word phrase
does. This was flagged as an open, unverified assumption in the plan rather
than treated as certain, but the first implementation still used it.
**What was actually true:** Tested directly against the real API before
trusting it (per this project's own standing practice of verifying rather
than assuming provider behavior). A quoted negated phrase returns **zero**
results outright — `"Google hasn't returned any results for this query"` —
even though the identical query with the phrase quoted but *not* negated
returns 40 results, and the same exclude term split into separate
single-word negations (`-screen -protector`) also returns the full 40.
Isolated with four back-to-back real calls varying one thing at a time. Not
documented anywhere in SerpApi's own docs — found empirically, not by
reading.
**Why it matters:** An unverified assumption about external API syntax
doesn't fail loud — it fails by silently returning "no results" for a
plausible-looking, syntactically-reasonable query, which is nearly
indistinguishable from "this product genuinely isn't listed anywhere." Live
in the app, this showed up as the "Find this product" step's empty state —
correct UI behavior for a real empty result, wrong diagnosis for what was
actually a malformed query. The fix (never quote a negated phrase; split it
into separate single-word negations) is one line, but finding it required
testing the actual failing query against the real API rather than debugging
the application code in isolation, since the application code was working
exactly as written — the syntax it was taught to produce was the bug.
**Portfolio-worthy:** yes

### 2026-09-14 — Wiring up the actual cron schedule surfaced a real auth gap the manual "Sync now" button never could
**Context:** Turning on `/api/cron/sync`'s real Vercel Cron schedule
(`vercel.json`), after it had sat unscheduled since Phase 1d — protected by
`CRON_SECRET`, tested only ever via the logged-in "Sync now" button.
**What I thought:** The route was already correctly gated — it checks
`CRON_SECRET` itself, so wiring up `vercel.json` plus setting the env var in
Vercel's dashboard should be the whole job.
**What was actually true:** `src/middleware.ts` runs before any route
handler and redirects every unauthenticated request to `/login` unless the
path is in a short public-paths allowlist (`/login`, `/auth`). A scheduled
Vercel Cron invocation is a server-to-server request with no Supabase
session cookie — so it hit the same `!user` branch a logged-out browser
would, and got redirected to `/login` before the route's own `CRON_SECRET`
check ever ran. Confirmed live with `curl`: an unauthenticated request to
`/api/cron/sync` came back `307 → /login`, not the route's `401
Unauthorized` — the real auth the route implements was unreachable. The
manual "Sync now" button never exposed this because it's only ever clicked
from inside an already-logged-in browser session, where `user` is always
present regardless of the route's own path-level rules. Fixed by adding
`/api/cron` to the middleware's public-paths list — not actually
"unauthenticated," just exempted from the *session* check, since the route
enforces its own bearer-token auth.
**Why it matters:** A route's own auth check being correct doesn't mean the
route is reachable — a broader gate sitting in front of it (middleware,
a proxy, a load balancer rule) can silently intercept exactly the caller
that check exists for, and the only way this surfaces is testing the actual
caller shape (an unauthenticated `curl`, not a browser with a session)
rather than trusting that "the button already works" implies the underlying
route does too.
**Portfolio-worthy:** yes

### 2026-09-14 — A tolerance window needs a moving anchor, or drift eventually breaks it regardless of tolerance width
**Context:** Walking through Phase 1e's live verification with the user right
after building it. They pointed out, from real experience with their own
Tello line, that its billing date shifts by about a day every month
(apparently payment-processing timing, not a clean calendar cycle).
**What I thought:** A ±3-day tolerance on the billing-date match was already
generous enough to absorb that kind of jitter — a 1-day-per-month drift is
well inside a 3-day window.
**What was actually true:** The tolerance width was never the problem — the
fixed reference point was. `confirm` (the outcome that verifies a signal
against the record) updated `source`/`last_verified_at` but never touched
`anchor_date`, so every future match kept comparing against the *original*
anchor, however many cycles ago that was. A 1-day-per-month drift is
individually well inside ±3 days, but it is cumulative against a frozen
reference: after 4 months it is 4 days off the original anchor, which is
outside the tolerance — not because anything is actually wrong, but because
the comparison point never moved. A tolerance window only stays meaningful
if what it is centered on tracks the real, current state; centered on a
value that is itself allowed to go stale, it is really just a slower way to
fail the same way a zero-tolerance check would, delayed by however many
cycles it takes to accumulate past the window. My first fix attempt
(recomputing the comparison date live from today() at match time) missed
this distinction entirely and made things worse for the common case: it
recomputed the comparison date live from today() instead, which always
projects "the next occurrence on/after today" — landing *after* a billing
date that already happened by the time a sync catches up to the email, the
normal case. That attempt was reverted; re-anchoring on confirm was the
actual fix.
**Why it matters:** Any time a system compares a live, moving quantity
against a stored "expected" value with some tolerance, ask whether the
stored value is itself kept current by the same events that get compared
against it. If not, the tolerance is protecting against noise today but
guarantees a failure eventually, once accumulated drift exceeds the window
— and that failure will look like "a real mismatch" rather than what it
actually is, drift from staleness. The fix is almost never "widen the
tolerance" (which just delays the same failure); it's re-anchoring the
comparison point to the most recent real observation every time one occurs.
**Portfolio-worthy:** yes

### 2026-09-14 — Cross-inbox dedup was only ever comparing one inbox against itself
**Context:** Wiring Phase 1e's reconciliation into `syncAccount`, right after the
existing dedup step. Re-reading that step closely before adding a call after it.
**What I thought:** Phase 1d's "Cross-inbox deduplication" checklist item said
"implemented, unit-tested" — the domain logic (`dedupeSignals`) genuinely is
correct and well-tested, so the feature was assumed to actually run correctly.
**What was actually true:** `syncAccount` fed `dedupeSignals` from
`getPendingSignalsForAccount(accountId)` — scoped to the one account currently
syncing. The same receipt landing in a *second*, different connected inbox would
never be compared against the first inbox's already-created signal at all, since
that query only ever sees one account's own pending rows. The pure function was
correct; the query call site around it silently defeated the entire point of
`contentHash` for the one scenario it exists for ("the same receipt forwarded to
two inboxes has two message IDs and is one event" — schema.ts's own comment).
Fixed by switching to a new account-agnostic `getAllPendingSignals()` query.
**Why it matters:** "Implemented and unit-tested" describes the pure function, not
the system. A domain function can be exhaustively correct and still be wired up
wrong one layer up, and unit tests for the pure function will never catch that —
only an integration test that actually spans two accounts would, and Phase 1d
never had a second real inbox to write one against (its own checklist already
flagged this as "genuinely still pending" for live verification, which is exactly
the gap that let this hide). Worth checking call sites of "already tested" pure
functions when building the next thing that depends on their stated behavior, not
just trusting the checklist.
**Portfolio-worthy:** yes

### 2026-09-14 — Nested per-signal transactions in a loop exhausted the shared test-DB connection pool
**Context:** `pnpm test:int` passed running each integration test file in
isolation, then started timing out — including in an unrelated file
(`watchlist-service.test.ts`) — the moment all 17 files ran together as part of
`pnpm verify`.
**What I thought:** A timeout inside newly-added reconciliation tests meant a real
deadlock in the new code — most likely the new `client.transaction()` call nested
inside `reconcileOneSignal`'s per-signal loop, itself called from inside
`runReconciliation`, itself called from inside `syncAccount`'s own transaction in
the detection-service tests.
**What was actually true:** The nesting itself is fine — drizzle-orm creates a
real SAVEPOINT on the same connection, the same pattern `subscription.service.ts`
already used safely. Running the exact same test file in isolation (`vitest run
tests/integration/reconciliation-service.test.ts`) passed instantly; running all
17 integration files with `--no-file-parallelism` also passed, at roughly the same
total wall-clock time as before. The actual cause: Vitest runs test files across
several parallel worker processes by default, each with its own `postgres()`
client and its own connection pool, all pointed at the same Supabase Postgres —
and reconciliation now holds a connection open for materially longer per test (one
extra nested transaction per signal, on top of every existing transaction), which
was apparently enough to tip already-marginal parallel connection usage over the
limit. Fixed by adding `--no-file-parallelism` to the `test:int` script —
integration tests already share one real database and gain nothing from
file-level parallelism the way unit tests do.
**Why it matters:** A timeout that appears alongside new code is not proof the new
code is the bug — an unrelated test file failing in the same run was the actual
tell that this was resource contention, not a logic deadlock. Bisecting by running
the suspect file alone first (fast, and it passed) before assuming the nested
transaction itself was wrong saved a lot of wasted time chasing a deadlock that
was never there.
**Portfolio-worthy:** no

### 2026-09-14 — "new" vs "trial_conversion"/"price_change" needed one rule, not per-case patches
**Context:** Three fixtures kept failing the same general shape of
boundary: `hulu-trial-started` (a trial *starting*, with the future
conversion charge previewed) got classified `trial_conversion` instead
of `new`; `netflix-extra-member-addon` (a new incremental charge added
to an existing plan) got classified `price_change` instead of `new`; and
`spotify-gift-subscription` (a gift period starting, with a future
downgrade-if-unpaid previewed) had intermittently failed the same way
across earlier sessions.
**What I thought:** These looked like three separate, unrelated
ambiguities — each fixture's specific wording seemed like its own
one-off edge case, and my first instinct was to consider a targeted
counter-example for each.
**What was actually true:** All three share one underlying confusion:
the model was classifying based on *what future event the email
mentions* rather than *what event the email is actually announcing
right now*. A trial-start email that previews its own future conversion
date reads, superficially, like a conversion notice; a member-addon
email that mentions a new charge reads, superficially, like a price
notice. One rule fixed all three at once: distinguish by which event is
being announced, not by whether a later event is referenced anywhere in
the text. Verified 3 full runs (41/41 fixtures, 3 for 3) against the
real API to rule out this being another instance of the documented
run-to-run non-determinism on this exact boundary rather than an actual
fix.
**Why it matters:** When several fixtures fail in *the same shape* even
though their content looks unrelated on the surface, that's a signal to
look for one general principle before writing N specific counter-
examples — the same lesson as the earlier vendor-name/date-substitution
investigations, but this time caught before spending five rounds of
narrow patches to get there.
**Portfolio-worthy:** yes

### 2026-09-14 — Forced into the wrong category, a model hallucinates a plausible answer instead of leaving it null
**Context:** Two edge-case fixtures (`audible-payment-failed`,
`equinox-membership-pause`) described events that don't fit any of the
5 `signal_type` values that existed at the time. Both got classified as
`renewal` — the closest wrong fit.
**What I thought:** Every other "doesn't fit" case this codebase had
handled so far — an irrelevant email, an unrecognized date format, an
unparseable amount — resulted in a clean `null`, because the whole
discard-and-log design (`docs/TOOLS.md`) is built around models failing
by omission when they're uncertain. I expected the same here: a
mismatched category would just come back with sparse/null fields the
same way an unfamiliar date format already reliably returns null from
`parse-date-span.ts`.
**What was actually true:** The payment-failure case did leave
`billingDate` null, but the pause case did not — Sonnet returned
`billingDate: "2026-11-14"`, fabricated from the email's *resume* date,
with `confidence: 0.75`. Forced to pick one of five labels for something
that was genuinely none of them, the model didn't hedge; it produced a
complete, confident, wrong answer. The failure mode wasn't missing data,
it was invented data that looked exactly like real data.
**Why it matters:** "The model will leave it null if it's not sure" is
an assumption that holds for *recognition* failures (an unfamiliar
format, ambiguous wording) but not for *taxonomy* failures (there is no
correct label to be uncertain between). The fix has to be two things
together, not one: a real category for the case so the model has
something true to say (`payment_failed`, `paused` — ADR-019), *and* a
deterministic post-hoc guarantee (`enforceNoConfirmedChargeInvariant`)
for the property that actually matters, because a wider taxonomy only
reduces how often the model is forced to guess — it doesn't guarantee
it will admit to guessing when it still has to.
**Portfolio-worthy:** yes

### 2026-09-14 — A fresh, uninvolved agent found a real bug I'd have been biased against finding myself
**Context:** Ran the deferred edge-case fixture-generation prompt — but
instead of generating the fixtures myself, spawned a genuinely fresh
agent (no memory of this project's specific prompt wording or bug
history) to do it, specifically to avoid tailoring fixtures toward cases
I already knew worked. It generated 16 new fixtures and ran them for
real: 10 passed, 6 failed.
**What I thought:** `parse-date-span.ts`'s regexes used `[A-Za-z]+` for
month names because every fixture up to that point (English, German,
Japanese) either used Latin letters or a wholly different format
(Japanese's `年月日`). This felt like a complete, if small, set of
formats — the doc comment even called it "not a general-purpose date
parser" on purpose, implying the gap was a known, accepted scope cut.
**What was actually true:** Two of the six failures were the exact same
root cause, in the one function I'd assumed was fully covered: a French
date ("14 octobre 2026") matched the day-month-year regex but failed the
English-only month lookup; an Arabic date ("14 أكتوبر 2026") didn't even
match the regex, since Arabic script isn't in `[A-Za-z]`. Both emails
extracted vendor/amount/currency correctly — only the date silently came
back null. Fixed by switching the regexes to `\p{L}` (Unicode "any
letter") and adding French/Arabic month-name maps looked up in sequence;
verified against the real API afterward (both fixtures now pass, 37/41
overall, no regressions).
**Why it matters:** I would not have picked "an Arabic-language email"
as a test case on my own — not because I'd deliberately avoid it, but
because the existing coverage (English/German/Japanese) felt
representative enough that the gap wasn't visible from inside the
codebase. A fresh agent with no attachment to what already "felt covered"
found it in one pass. The lesson isn't about dates specifically — it's
that self-testing has a blind spot shaped exactly like your own mental
model of the system, and the fix (delegate test-case generation to
someone/something without that model) is cheap and repeatable.
**Portfolio-worthy:** yes

### 2026-09-14 — Sonnet can return a response with zero text blocks, silently dropping a message from sync
**Context:** Live-verifying the new "needs review" brief feature
(ADR-018) by deleting and re-syncing 3 real signals. Xfinity and Tello
went through the full new pipeline correctly. The Gas South email — a
rate-plan-change notice — failed with `callModel: claude-sonnet-5
returned no text block`, both in the live sync and reproduced 3/3 times
against the real API directly afterward.
**What I thought:** This code path (Haiku → Sonnet escalation) was
already well-exercised by 25 golden fixtures and a prior successful live
sync of this exact email months earlier — a "no text block" response
looked like it should be rare enough to not matter in practice, and the
existing catch-and-skip handling seemed like sufficient defense.
**What was actually true:** It's reproducible, not a one-off fluke, for
at least this one real email — 3/3 direct calls against the real API.
`MAX_OUTPUT_TOKENS` was 512 for every call, including Sonnet's, and
Sonnet 5's adaptive thinking (already noted in ADR-017 as having
replaced manual sampling controls) was consuming that whole budget
internally on this longer/more structurally complex email, leaving
nothing for the actual JSON output. Confirmed, not just hypothesized:
splitting the constant into `HAIKU_MAX_OUTPUT_TOKENS = 512` (unchanged)
and `SONNET_MAX_OUTPUT_TOKENS = 2048` eliminated the failure 3/3 on
re-test, and the full pipeline (classification + the new
`writeReviewBrief` call) then produced a correct result for this exact
email on the first try.
**Why it matters:** "Discard and skip on failure" (the pattern this
codebase already uses everywhere for untrusted model output) is the
right response to a validation failure, but a response with literally no
text isn't the same failure mode as a malformed one — it's silent data
loss for a message that would otherwise have been correctly detected,
with no signal to the user that anything was missed at all. A low,
shared `max_tokens` budget across models with very different output
strategies (fixed-format extraction vs. adaptive thinking) is a
narrower assumption than it looks — the fix was giving each model its
own budget, not raising a single shared one and hoping it's enough for
both.
**Portfolio-worthy:** yes

### 2026-09-14 — A single vendor name broke date extraction on an otherwise-identical email, proven by a swap test
**Context:** Even after the transcription fix (2026-09-13 entry below), two
golden fixtures — both INR-denominated — kept intermittently returning
`billingDate: null` on far-future dates. Suspected the INR currency
formatting itself (bare integer, no decimal shown, comma thousands
separator, "Rs." prefix vs. "₹" symbol).
**What I thought:** Building 5 controlled fixtures, each varying exactly
one INR-formatting property, would isolate which formatting quirk was
the trigger.
**What was actually true:** None of the formatting variants reproduced
the bug except one (a comma-formatted amount, a real and separate
finding). The actual failing fixture — a `ZEE5` renewal — didn't fit any
formatting pattern; a structurally near-identical fixture (`SonyLIV`,
same bare-integer INR, same ~1-year-out date) was 100% reliable across
every trial. Isolated the true cause with a direct swap test: took each
fixture's exact content and swapped *only* the vendor name between them.
The failure followed the name in both directions, 5/5 each way — content
that always worked broke the moment it was renamed "ZEE5"; content that
always failed was fixed the moment it was renamed "SonyLIV." No feature
of the email content explained it (a follow-up test renaming to "Zee
Play," removing just the embedded digit, still failed 4/5) — the string
"ZEE5" itself was sufficient, on its own, to break extraction of an
unrelated field.
**Why it matters:** Some model failures are spurious correlations picked
up during training with no logical connection to the task, and they are
fundamentally unpredictable from the input in advance — there is no
prompt wording that guards against an input feature you don't know is a
trigger. The only real defense is checking the *output shape* after the
fact (a missing field where one is normally expected, regardless of why)
rather than trying to anticipate every input that could break the model.
This directly shaped the escalation design in `providers/anthropic.ts`:
two evidence-based checks on Haiku's output (`hasSuspectBillingDate`,
`hasMissingBillingDateOnATypeThatUsuallyHasOne`) replaced a confidence
threshold, which — per the entry below — was never going to catch either
of these anyway.
**Portfolio-worthy:** yes

### 2026-09-13 — Verbatim transcription beats asking a model to compute — and confidence doesn't track this kind of failure
**Context:** Haiku 4.5 was confirmed, reproducibly substituting a
different date (whatever reference date the prompt happened to supply —
no reference at all, "today's date," or the email's own received date,
tried in that order) for the real, far-future billing date stated in an
email — every time, regardless of increasingly explicit prompt
instructions not to.
**What I thought:** This was a prompt-engineering problem — with a
strong enough instruction (or the right context, like grounding the
model in a real reference date), the model would stop substituting the
wrong value.
**What was actually true:** Three different prompt-wording attempts
failed the same way, each substituting whichever new reference value had
just been added to the prompt. The fix wasn't better wording — it was
changing what the model was asked to *do*: instead of asking it to
compute an ISO date from the email's date, the prompt now asks it to
copy the date span verbatim (`billingDateText`), and a separate,
deterministic function (`domain/parse-date-span.ts`) converts it to ISO
in code. Confirmed live: the model's own self-reported `confidence` was
consistently high (0.9+) on every wrong answer, identical to its
confidence on correct ones — it was never uncertain, so no rubric or
few-shot example could have elicited a lower number. The same fix
pattern, applied to amounts (`amountText` + `parse-amount-span.ts`),
independently fixed a second, unrelated-seeming bug (Haiku multiplying a
zero-decimal JPY amount by 100 anyway).
**Why it matters:** When a model confidently computes a wrong value from
a valid input, that's a computation bug, not an uncertainty bug — the
fix is moving the computation into deterministic code the model doesn't
touch, not more prompt engineering. Verbalized confidence tracks input
*ambiguity*, not model *failure*: it's real signal for "the email itself
was unclear," and no signal at all for "the model made a mistake it felt
sure about." That distinction directly ruled out several standard
mitigation techniques for this specific bug: self-consistency (sampling
the same call multiple times) and token log-probabilities both measure
how *stable or probable* an answer was, not whether it was *correct* —
useless against an error that's stable and confident by construction.
**Portfolio-worthy:** yes

### 2026-09-11 — A "free tier" rate limit can be a hard wall, not friction
**Context:** Phase 1d's classification calls to `gemini-3.6-flash` were
failing intermittently — 503s, timeouts, and one incomplete extraction —
during golden-file testing. Built a retry-with-backoff and model-fallback
chain to ride it out (docs/DECISIONS.md's ADR-015 already anticipated
"free-tier rate limits are a real ceiling").
**What I thought:** This was transient overload on a very new model —
the kind of thing exponential backoff across a few attempts, and falling
back to a second model on repeated failure, would smooth over.
**What was actually true:** The real cause was a flat **20
requests-per-day-per-project** quota on the free tier — confirmed
directly from Google's own `429` error body
(`GenerateRequestsPerDayPerProjectPerModel-FreeTier`, `quotaValue: 20`),
not a per-minute rate that recovers on its own. No amount of backoff
helps a quota that resets once a day; repeated test runs during
development burned through it in minutes. Separately, while adjusting the
retry logic, a `504 DEADLINE_EXCEEDED` also turned up once a per-call
timeout was added — the SDK sends an `X-Server-Timeout` header, and
Gemini's own server actively returns 504 near that deadline rather than
the connection just hanging.
**Why it matters:** "Free tier" on an LLM API can mean two very different
things — a soft, self-healing rate limit (typical for Anthropic/OpenAI's
paid tiers, and their own default starting tiers) or a hard daily quota
that development traffic alone can exhaust before any real usage happens
(Gemini's free tier here). Whether a captured error is really transient
or actually load-bearing is worth reading the *exact* error body for
(`quotaId`, `RESOURCE_EXHAUSTED` vs a plain rate-limit code) before
building retry logic around an assumption. Ended in ADR-016 reverting to
the originally-planned provider.
**Portfolio-worthy:** yes

### 2026-09-11 — Local models can legally satisfy a JSON schema by omitting everything optional
**Context:** Evaluating `granite3.3:8b` via Ollama's structured-outputs
feature (`format` as a JSON Schema) as a free, fully local alternative to
a hosted classification API, using the same schema shape already proven
against Gemini (`required: ['relevant', 'confidence']` only — every other
field nullable but optional).
**What I thought:** Schema-constrained decoding would behave the same
regardless of which engine enforced it — the model would fill in every
field it had an answer for, same as observed with Gemini's own structured
output under the identical schema.
**What was actually true:** Given the real, detailed production prompt,
Granite's output legally satisfied the schema by returning *only* the
required keys (`relevant`, `confidence`) and omitting every optional
field outright — a valid JSON object per the schema, just not a useful
one. Marking every field `required` (with `null` as a permitted value for
the ones that are conceptually optional) fixed it immediately. Gemini's
own implementation never did this under the exact same lenient schema.
**Why it matters:** "Required" in a JSON Schema is a floor, not a
suggestion to the model to fill in the rest — different constrained-
decoding engines resolve that ambiguity differently, and the gap only
shows up by inspecting raw output, not by checking JSON validity (which
passes either way). If a field matters, mark it required and make null an
explicit legal value, rather than relying on convention.
**Portfolio-worthy:** yes

### 2026-09-10 — A Next.js dev-console warning caught a real token leak, not a cosmetic one
**Context:** Wiring the real Google OAuth connect flow (Phase 1c stage
2). `accounts/page.tsx` (a Server Component) fetched every connected
account with `getAllEmailAccounts()` and passed the full rows straight
into `<AccountsList accounts={accounts} />`, a Client Component. Live
testing surfaced a console error: "Binary data with a toJSON method...
is serialized through toJSON instead of as binary," pointing at
`accessTokenEnc`/`refreshTokenEnc` — the encrypted OAuth token columns.
**What I thought:** This read as a Next.js RSC serialization nitpick —
Buffers don't cross the server/client boundary cleanly, fix the type,
move on.
**What was actually true:** The real problem wasn't *how* the Buffer
serialized, it was that it was crossing that boundary **at all**. Every
row's `accessTokenEnc`/`refreshTokenEnc` — AES-256-GCM ciphertext, but
still the encrypted tokens — was being embedded in the RSC payload sent
to the browser. That's exactly what `docs/SECURITY.md` already
prohibits: "Tokens never leave `src/server/`. Never returned from an API
route, never in a Server Component's serialised props." Encryption at
rest protects the database; it does nothing once the value is shipped to
a client bundle regardless. Fixed by adding `getAllEmailAccounts`'s
column-level `select({...})` (excluding the two token columns entirely,
so there's nothing to forget to strip later) and a narrower
`EmailAccountSummary` type for anything a Client Component receives.
**Why it matters:** a console warning framed as a type/serialization
issue can be the visible symptom of a much worse underlying bug — the
framework was actually complaining about the exact shape of the leak,
not an unrelated technicality. Worth treating any "this value can't
serialize cleanly" warning on a table with sensitive columns as a
security question first, a type-annotation question second. Also worth
noting: `docs/SECURITY.md`'s rule existed and was read earlier in this
same session before this code was written — the rule alone wasn't
enough, only live testing caught the violation in practice.
**Portfolio-worthy:** yes.

### 2026-09-10 — `server-only` throws under Vitest unless aliased
**Context:** Writing unit tests for `providers/crypto.ts` (Phase 1c —
AES-256-GCM token encryption). The file opens with `import 'server-only'`,
the same guard `providers/supabase.ts` already uses, per
`docs/ARCHITECTURE.md`'s rule that anything importing a secret lives in
`src/server/`.
**What I thought:** `server-only` is a no-op marker package — importing it
anywhere should be harmless, since its whole job is just to fail a build
if a *client* bundle pulls it in.
**What was actually true:** it is not a no-op at the package level at
all — `node_modules/server-only/index.js` unconditionally throws. The
"no-op in a server context" behavior only exists because Next.js's
webpack resolver swaps the import for an empty module when bundling for
the server. Outside that resolver — i.e. under Vitest, which runs plain
Node — the real, throwing file loads every time, so any test importing a
`server-only`-guarded module (even indirectly) fails immediately.
**Why it matters:** any Next.js convention that depends on the bundler
doing a resolver-level swap is invisible from reading the source of the
package itself — the docs and the code both look like a pure marker.
Fixed with a one-line `resolve.alias` in `vitest.config.mts` pointing
`'server-only'` at a local no-op file, mirroring exactly what Next's
webpack config does. Worth checking for the same class of issue with any
other "marker" package before assuming it's inert outside its intended
bundler.
**Portfolio-worthy:** no.

### 2026-08-10 — Magic links die on contact with Gmail's link scanner
**Context:** Wiring up Phase 0.4's single-user auth with Supabase magic
link. The route handler at `/auth/confirm` looked correct, matched
Supabase's own docs examples, and the redirect logic tested clean —
but every real attempt came back "Email link is invalid or has
expired," immediately, every time.
**What I thought:** The bug was in my code — a wrong query param name, a
misconfigured redirect URL, something in the PKCE vs. token_hash
distinction I'd gotten backwards. (I did find and fix a real instance of
that: the route was reading `token_hash`/`type`, but `@supabase/ssr`'s
default PKCE flow sends `code` instead. Fixing that was necessary but
not sufficient — the failures continued after.)
**What was actually true:** Supabase's auth logs showed a `login` event
succeeding at their end, moments before the user's own click failed with
`otp_expired`. Their troubleshooting docs name this exactly: email
security scanners (Gmail's among them) prefetch links in incoming mail
to check for phishing, silently consuming the one-time-use token via a
plain `GET` before the human ever clicks. The token isn't expired by
time — it's expired by an invisible second request. No amount of fixing
the query-param handling touches this, because the request that
actually breaks things never reaches application code at all.
**Why it matters:** A "flaky" auth failure that reproduces 100% of the
time isn't flaky — it's deterministic, which means something is racing
predictably, not intermittently. The fix, also from Supabase's own docs,
is structural rather than a config tweak: never let a plain `GET`
perform a state-changing, single-use action. `/auth/confirm` is now a
page with a "Sign in" button — a Server Action only fires on the actual
form submission, so a prefetcher can fetch the page all it wants without
spending the token. Any one-time link (password reset, email
verification, invites) sent to an address that might sit behind
enterprise or Gmail-style link scanning needs the same shape: land, then
click — never verify-on-load.
**Portfolio-worthy:** yes

### 2026-08-10 — Supabase exposes every public table by default
**Context:** Standing up the Supabase project and running the first Drizzle
migration in Phase 0.3 — a single throwaway `phase0_healthcheck` table just to
prove the pipeline works end to end.
**What I thought:** A table only becomes reachable once something in the app
deliberately queries it. Creating a table is a schema change, not an exposure
change.
**What was actually true:** Supabase's advisors flagged the new table
immediately: Row Level Security is off by default on every table, and with it
off, the table is fully readable and writable by anyone holding the anon /
publishable key — which is meant to be public, and will end up in the client
bundle the moment Supabase Auth is wired in (Phase 0.4). The table doesn't
need to be queried from the app for this to be a real exposure; PostgREST
exposes it the moment it exists.
**Why it matters:** On a platform that auto-exposes schema over REST, "create
the table" and "ship the table" are the same action unless RLS is configured
first. Every table Phase 1a+ creates that holds anything real — `subscriptions`,
`price_history`, `email_accounts` (encrypted tokens or not) — needs an explicit
RLS policy before it's populated, not as a follow-up hardening pass. Left off
deliberately on `phase0_healthcheck` only because it's empty, unqueried
plumbing that Phase 1a deletes outright.
**Portfolio-worthy:** no

### 2026-08-08 — Manual entry as primary source, not fallback
**Context:** Scoping the Phase 1 data model, before writing any code.
**What I thought:** Email parsing is the product, and manual entry is the fallback
for whatever the parser misses.
**What was actually true:** That ordering has two failures. Email detection cannot
see a complete picture until it has observed a full billing cycle for every
service — so the dashboard is wrong for weeks and the user cannot tell which parts
are missing. And some subscriptions leave no email trail at all: cash payments,
family-plan add-ons, employer-provided services. Those are never caught, no matter
how good the parser is. Inverting it — manual entry as the authoritative source,
detection as confirmation — gives a complete picture on day one and turns the
parser's job into verification, which is a much easier problem than discovery.
**Why it matters:** When a system has an automated source and a human source, the
question is not which is more accurate. It is which one is *complete*, and which
failure mode is visible to the user. An automated source that is silently
incomplete is worse than a manual one that is obviously partial. The reconciliation
invariant — detection may confirm or propose, never overwrite — falls straight out
of this.
**Portfolio-worthy:** yes

### 2026-08-08 — Descoping the hardest feature made the project viable
**Context:** The original concept had the agent re-quoting auto insurance monthly
to find cheaper policies.
**What I thought:** It is a lot of integration work, but it is the highest-value
feature — the one that saves real money.
**What was actually true:** There is no viable public API for multi-insurer
quoting. The comparison engines are themselves businesses built on scraping and
partnership deals. Building it means depending on one of them as an intermediary
or accepting something fragile and manual-assisted. Meanwhile, insurance as a
*tracked* recurring cost with renewal reminders is nearly free — it is the same
data model as a subscription — and delivers most of the practical benefit, because
the reason people overpay is usually that the renewal passed unnoticed, not that
they could not find the comparison site.
**Why it matters:** The most compelling feature and the most feasible one are
often not the same, and the gap is usually a data-access problem rather than an
engineering one. Checking whether the data is actually reachable, before designing
around it, is cheap. Removing the feature and keeping the underlying value is
often available if you look for it.
**Portfolio-worthy:** yes
