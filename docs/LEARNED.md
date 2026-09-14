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
