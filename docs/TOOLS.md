# Tools

Which tool for which job, and why. The *why* matters more than the choice — it is
what lets a choice be revisited when circumstances change rather than inherited
as an unexamined default.

## Core stack

| Job | Tool | Why this one |
| --- | --- | --- |
| Language | TypeScript (strict) | Money and dates are exactly where type errors are expensive |
| Framework | Next.js, App Router | One deployable for UI, API, and cron; Server Components keep secrets server-side by default |
| Database | Postgres via Supabase | Relational is right for this data; Supabase gives auth and hosting without a separate service. Plain Postgres works too — nothing depends on Supabase-specific features |
| ORM | Drizzle | SQL-shaped, typed end to end, migrations are readable files. Prisma is the reasonable alternative; it is heavier and its generated client is more opaque |
| Validation | Zod | Same schemas validate HTTP input, provider payloads, and LLM output. Infers TypeScript types from one definition |
| Styling | Tailwind | Design tokens from `DESIGN.md` become theme values; no separate stylesheet to drift |
| Components | shadcn/ui | Copied into the repo, so it can be restyled to the tokens without fighting a library. Accessible by default |
| Package manager | pnpm | Faster, strict about phantom dependencies |

## Per-task

### Email access

| Task | Tool | Notes |
| --- | --- | --- |
| Gmail read | Gmail API, `gmail.readonly` scope | `users.history.list` with a stored history ID for incremental sync — never re-scan the mailbox |
| Outlook read | Microsoft Graph, `Mail.Read` | Delta query with a stored delta token |
| OAuth flow | Provider SDKs directly | An abstraction layer over two providers is more code than the duplication it saves |
| Token storage | AES-256-GCM via node `crypto` | Encrypted at rest, key from env, never in application logs |

**Read-only scopes only.** If a task appears to need write access, stop and ask —
it means the requirement changed.

### Classification and extraction

| Task | Tool | Notes |
| --- | --- | --- |
| Pre-filter | Plain TypeScript in `domain/prefilter.ts` | Sender domain, header heuristics, keyword match. Most mail is obviously irrelevant; filtering it deterministically costs nothing |
| Classification | Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) | Cheap and fast, and classification is a narrow task. Volume here is a personal inbox, not a pipeline |
| Extraction | Same call, structured JSON output | One call classifies and extracts. Two calls doubles the cost for no accuracy gain |
| Hard cases | Claude Sonnet 5 (`claude-sonnet-5`) | Escalation path when Haiku returns low confidence, and for the Phase 5 reasoning layer |
| SDK | `@anthropic-ai/sdk` | |
| Output validation | Zod | Model output is untrusted input. Validate, and discard-and-log on failure rather than persisting a malformed signal |

Prompt in a versioned file, not inline in application code — changing a prompt is
a change to behaviour and belongs in the diff.

### Scheduling

| Task | Tool | Notes |
| --- | --- | --- |
| Daily sync | Vercel Cron → route handler | Sufficient at one user. Revisit if sync exceeds the function timeout |
| Renewal reminders | Same cron, separate handler | |
| Job queue | *Deferred* | Not warranted yet. Escape hatch if sync outgrows cron |

### Testing

| Task | Tool |
| --- | --- |
| Unit and integration | Vitest |
| Property-based (money, dates) | fast-check |
| E2E | Playwright |
| Test database | Postgres in Docker, or a Supabase branch |
| HTTP mocking | MSW |

### Frontend

| Task | Tool | Notes |
| --- | --- | --- |
| Data tables | TanStack Table | Headless, so it takes the design tokens rather than imposing a look |
| Burn ribbon | Hand-written SVG | It is one bespoke chart. A charting library is a large dependency for a single custom visual |
| Any other chart | Recharts | Only if a second, conventional chart appears |
| Dates | date-fns | Tree-shakeable, immutable |
| Forms | React Hook Form + Zod resolver | Reuses the Zod schemas already written for the API boundary |
| Icons | Lucide | |

### Visual assets

| Task | Tool | Notes |
| --- | --- | --- |
| Brand, illustration, empty-state art | Higgsfield | Generation only — see `DESIGN.md` for the scoping rationale |
| Portfolio stills and walkthrough video | Higgsfield | Synthetic data only, never real figures |
| Functional UI | shadcn/ui + Tailwind | Needs to be accessible, typed, and testable |

### Later phases

Listed so the choices are pre-reasoned, not committed.

| Phase | Job | Likely tool | Note |
| --- | --- | --- | --- |
| 3 | Store price data | Kroger API or Instacart | API availability varies sharply by retailer; some comparison needs scraping, which is slower, more fragile, and has ToS implications. Scope Phase 3 to one store with a real API |
| 4 | Route optimisation | Google Maps Directions + Distance Matrix | Handles multi-stop optimisation directly. The most tractable piece of the project |
| 4 | Store hours | Google Places | |
| 5 | Price history | Own Postgres tables | Accumulated from Phase 3. No external history service is trustworthy enough to build on |

## Development environment

| Job | Tool |
| --- | --- |
| Agentic coding | Claude Code |
| Cross-tool portability | `AGENTS.md` mirrors `CLAUDE.md` |
| Version control | Git, conventional commits |
| CI | GitHub Actions running `pnpm verify` |
| Hosting | Vercel |
| Secrets | Vercel env vars; `.env.local` locally, never committed |

## Rejected

Recorded so they are not silently reconsidered.

| Considered | Rejected because |
| --- | --- |
| Gemini Enterprise / Azure AI Foundry as the platform | Built for governed org-scale agent deployment. This needs a custom relational schema, custom reconciliation logic, and a bespoke UI — that is a normal application, and those platforms would be fought rather than used |
| Local LLM for classification | Volume is a personal inbox, so hosted cost is trivial. Extraction edge cases — ambiguous price-change wording, annual renewals that look like one-off receipts — are exactly where smaller models degrade, and their errors are silent. Privacy is the one legitimate counter-argument; weigh it explicitly rather than defaulting either way |
| Separate backend service | A network boundary and a second deployment, buying nothing at single-user scale |
| Insurance quote-comparison APIs | No viable public API. Comparison engines are businesses built on scraping and partnerships. Descoped — see `PROJECT_BRIEF.md` |
| Plaid / bank aggregation | Real option as a third reconciliation source, but a significant new security surface and a decision of its own. Not Phase 1 |
