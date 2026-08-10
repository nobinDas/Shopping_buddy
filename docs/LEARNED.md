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
