# Security

This application holds read-only OAuth tokens for personal email accounts and a
record of personal financial commitments. That is a small blast radius by user
count and a large one by sensitivity.

## Threat model

Realistic concerns, in order:

1. **Token compromise.** OAuth refresh tokens grant ongoing inbox read access. A
   leaked refresh token is worse than a leaked password — it is silent and it
   persists.
2. **Accidental logging.** The most likely leak is not an attacker; it is an email
   body or token appearing in a log, an error report, or a debug print.
3. **Client bundle leakage.** A server module imported into a client component
   ships secrets to the browser.
4. **Committed secrets.** `.env.local` in a commit, a real email in a test fixture.

Not in scope: nation-state attackers, and multi-user isolation (there is one user).

## Rules

### Tokens

- **Read-only scopes only.** Google `gmail.readonly`; Microsoft `Mail.Read`. If a
  feature seems to need more, stop and reconsider the feature.
- Access and refresh tokens encrypted at rest with AES-256-GCM before they touch
  the database. Never stored plaintext.
- Encryption key from an environment variable, never committed, never logged.
- Tokens never leave `src/server/`. Never returned from an API route, never in a
  Server Component's serialised props.
- Disconnecting an account revokes the token with the provider *and* deletes the
  local record. Deleting locally without revoking leaves live access behind.

### Email content

- **Email bodies are never persisted.** Extraction happens in memory; only the
  structured signal is stored. See `detected_signals` in `DATA_MODEL.md` — there
  is no body column, deliberately.
- Never log message bodies or subjects, including in error paths. An exception
  handler that dumps its input is the most common version of this leak.
- Redact before sending anything to an error-reporting service.
- Email content sent to the Anthropic API is limited to pre-filtered candidates.

### Logging

Never log: tokens, email bodies, subject lines, email addresses beyond the
account identifier, full request bodies.

Safe to log: message IDs, vendor keys, amounts, signal types, timing, error types.

Use a logger with a redaction list rather than relying on discipline at each call
site. Discipline fails once and the failure is permanent.

### Code boundaries

- Client components never import from `src/server/**`. Enforce with an ESLint
  `no-restricted-imports` rule so it fails in CI rather than in review.
- Env vars without the `NEXT_PUBLIC_` prefix are server-only. Nothing sensitive
  ever gets that prefix.
- Validate every external input with Zod — provider payloads and LLM output are
  both untrusted.

### Repository

- `.env.local` and any `.env.*` except `.env.example` are gitignored.
- `.env.example` documents every variable with a placeholder, never a real value.
- Secret scanning enabled on the repo.
- **Test fixtures are anonymised.** Real vendor names, amounts, dates, and
  structure stay — that is what is being tested. Customer names, addresses,
  account numbers, and order IDs are replaced.
- Never commit a screenshot of a real dashboard. Portfolio assets use synthetic data.

## Incident response

If a token is suspected compromised:

1. Revoke it with the provider immediately — Google Account permissions or Entra ID
2. Delete the local record
3. Rotate the encryption key and re-encrypt remaining tokens
4. Check provider access logs for unexpected reads
5. Write it up in `LEARNED.md`

If a secret is committed: rotate first, then remove from history. Rotation is the
fix; history rewriting is cleanup. A committed secret is compromised the moment it
is pushed, regardless of how quickly it is removed.

## Review checklist

Before any phase is declared complete:

- [ ] No secrets in the repo or in git history
- [ ] All tokens encrypted at rest
- [ ] No email content or tokens in any log path, including error handlers
- [ ] Client bundle contains no server imports (`next build` output inspected)
- [ ] All OAuth scopes still read-only and still minimal
- [ ] Test fixtures anonymised
- [ ] Dependencies audited (`pnpm audit`)
