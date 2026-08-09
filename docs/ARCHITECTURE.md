# Architecture

## Shape

A single Next.js application. One deployable, one repo, one language.

This is a deliberate choice over a separate API service. The app is single-user,
the traffic is negligible, and the only genuinely asynchronous work is inbox
sync — which a cron-triggered route handles fine. A split frontend/backend would
add a network boundary, a second deployment, and duplicate types, and buy nothing
at this scale. If background work outgrows a cron route, the escape hatch is a
queue, not a rewrite.

## Layers

```
Browser (React Server Components + client islands)
   │
   ▼
Route handlers / Server Actions          ← validation, auth, HTTP concerns
   │
   ▼
src/server/services/                     ← orchestration; talks to DB and providers
   │
   ├──▶ src/server/domain/               ← pure functions, no I/O, fully unit-tested
   ├──▶ src/server/db/                   ← Drizzle schema and queries
   └──▶ src/server/providers/            ← Gmail, Graph, Anthropic, maps
```

**The rule that matters:** business logic lives in `domain/` as pure functions.
Reconciliation, billing-date maths, deduplication, burn aggregation — all of it
takes data in and returns data out with no database and no network. That is what
makes it testable at speed and in volume, and reconciliation is the part of this
system most likely to be wrong in a way nobody notices.

`services/` is allowed to do I/O. `domain/` is not. If a domain function needs a
database, the design is wrong.

## Data flow: email to reconciled subscription

```
cron (daily)
  → for each connected account:
      fetch new messages since cursor        [providers/gmail | providers/graph]
      cheap pre-filter on sender + headers   [domain/prefilter]        ← no LLM cost
      classify + extract survivors           [providers/anthropic]
      validate against Zod schema            → discard and log on failure
      persist as detected_signal             [db]
  → deduplicate signals across accounts      [domain/dedupe]
  → match signals to manual subscriptions    [domain/reconcile]
  → write proposals + reasoning records      [db]
  → user resolves in the review queue        [UI]
```

The pre-filter exists because most inbox mail is obviously irrelevant. Sending
all of it to an LLM is slow and expensive for no accuracy gain. Cheap
deterministic filtering first, model only on plausible candidates.

Deduplication happens *before* reconciliation, not after. The same receipt in two
inboxes must collapse into one signal before anything tries to match it against a
subscription, or the matcher sees phantom duplicates.

## Folder structure

```
overhead/
├── CLAUDE.md
├── AGENTS.md
├── README.md
├── CHANGELOG.md
├── .env.example
├── .claude/
│   └── rules/
│       └── testing.md              # path-scoped: loads when touching test files
├── docs/                           # everything in the README doc table
│
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── (auth)/
│   │   ├── (dashboard)/
│   │   │   ├── page.tsx            # burn overview
│   │   │   ├── subscriptions/
│   │   │   ├── review/             # reconciliation queue
│   │   │   └── accounts/           # connected inboxes
│   │   └── api/
│   │       ├── auth/[provider]/    # OAuth callbacks
│   │       └── cron/sync/          # scheduled inbox sync
│   │
│   ├── components/
│   │   ├── ui/                     # shadcn primitives, unmodified
│   │   └── <feature>/              # feature components
│   │
│   ├── server/
│   │   ├── domain/                 # PURE. no I/O. the interesting logic.
│   │   │   ├── billing-cycle.ts    # next date, proration, cycle normalisation
│   │   │   ├── prefilter.ts
│   │   │   ├── dedupe.ts
│   │   │   ├── reconcile.ts        # ← the crux
│   │   │   └── burn.ts             # aggregate monthly/annual cost
│   │   ├── services/               # orchestration, I/O allowed
│   │   │   ├── sync.service.ts
│   │   │   ├── detection.service.ts
│   │   │   └── subscription.service.ts
│   │   ├── providers/              # one adapter per external system
│   │   │   ├── gmail.ts
│   │   │   ├── graph.ts
│   │   │   ├── anthropic.ts
│   │   │   └── crypto.ts           # token encryption at rest
│   │   └── db/
│   │       ├── schema.ts
│   │       ├── queries/
│   │       └── migrations/
│   │
│   └── lib/                        # shared, client-safe only
│       ├── money.ts                # minor-unit helpers, formatting
│       ├── dates.ts
│       └── validation/             # Zod schemas shared across boundaries
│
└── tests/
    ├── unit/                       # mirrors src/server/domain/
    ├── integration/                # real test DB, mocked external providers
    ├── e2e/                        # Playwright
    └── fixtures/
        └── emails/                 # anonymised golden-file corpus
```

## Boundaries

| Rule | Why |
| --- | --- |
| Client components never import `src/server/**` | One accidental import leaks secrets into the browser bundle |
| `domain/` imports nothing from `services/`, `providers/`, or `db/` | Keeps it pure and fast to test |
| Providers return domain types, not raw API shapes | A Gmail schema change is contained to one file |
| Every external input passes a Zod schema | LLM output and provider payloads are both untrusted |
| Money crosses boundaries as `{ amount: number, currency: string }` | Never a bare number; the currency must travel with it |

## External dependencies

| System | Used for | Failure mode |
| --- | --- | --- |
| Supabase Postgres | All persistence | Hard dependency; app is down |
| Gmail API | Inbox read | Degraded; manual entry keeps working |
| Microsoft Graph | Inbox read | Degraded; same |
| Anthropic API | Classification and extraction | Degraded; signals queue for retry |
| Vercel Cron | Sync scheduling | Sync delayed; manual trigger available |

Only Postgres is a hard dependency. That is deliberate — manual entry, the
primary source, keeps working when every integration is down.

## Deferred

Written down so they are choices rather than omissions.

- **Job queue.** Cron is enough at one user and a handful of inboxes. Revisit if
  sync exceeds the serverless timeout.
- **Caching layer.** No read volume to justify it.
- **Multi-tenancy.** Single user. Row-level isolation would be a real project.
- **Card/bank aggregation.** A plausible third reconciliation source, and a
  separate decision with its own security surface.
