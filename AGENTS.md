# AGENTS.md

Cross-tool instruction file for AI coding agents (Cursor, Copilot, Codex, Gemini,
Windsurf, Cline, and others). Claude Code reads `CLAUDE.md`, which contains the
same substance; this file exists so the project stays portable across platforms.

**If you are an agent starting fresh on this repo, read in this order:**

1. `docs/PROJECT_BRIEF.md` — what this is and why
2. `docs/MEMORY.md` — where the project actually stands right now
3. `docs/PHASES.md` — what is in scope for the current phase
4. `docs/ARCHITECTURE.md` and `docs/DATA_MODEL.md` — how it is built
5. `docs/TOOLS.md` — which library/service to use for which job
6. `.claude/rules/testing.md` — how and when to test

## Hard rules

- Manual subscription entry is the primary data source. Email detection is
  confirmatory and supplementary, never authoritative.
- Inbox access is read-only. Read-only OAuth scopes only.
- Never log, print, or persist raw email bodies, subjects, access tokens, or
  refresh tokens. Redact in error paths too.
- Money is integer minor units plus a currency code. Never floats.
- Run the full verification suite (`pnpm verify`) after any task that closes a
  checklist item in `docs/PHASES.md`.
- Do not build features from a later phase than the current one.

## Session handoff

Before ending a working session, update `docs/MEMORY.md` (state, decisions,
open threads) and append anything learned to `docs/LEARNED.md`. These two files
are the contract that lets a different tool, or a different session, pick up
without re-reading the whole repo.
