import 'server-only';

/**
 * Shared timeout for every external, non-LLM network call this app makes
 * (Gmail, Google Places/Routes/OAuth, SerpApi) — matches
 * `providers/anthropic.ts#PER_CALL_TIMEOUT_MS`'s existing 30s convention
 * for LLM calls. Added after an audit (2026-09-16, see docs/LEARNED.md)
 * found every one of these `fetch()` calls had no timeout of its own at
 * all, unlike the LLM calls — a hung external API would otherwise rely
 * entirely on Vercel's much coarser ~300s function-execution ceiling as
 * the only backstop, and nothing bounds it at all in local dev.
 * `AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS)` passed to `fetch`'s
 * `signal` option aborts the request itself once this elapses.
 */
export const EXTERNAL_FETCH_TIMEOUT_MS = 30_000;
