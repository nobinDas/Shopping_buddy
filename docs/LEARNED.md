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
