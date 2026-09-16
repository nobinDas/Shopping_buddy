/**
 * The structured object `providers/anthropic.ts#planWatchlistQuery`
 * extracts before any search string is built — see
 * `prompts/plan-watchlist-query.ts`. Defined here (not in the provider
 * file) so this pure builder, and anything else that needs the shape,
 * doesn't import from providers/. `excludeTerms` is no longer consumed by
 * `buildShoppingQuery` (see its doc comment) but stays on the plan — it's
 * still used post-fetch, against each candidate's title, by
 * `watchlist-result-filter.ts#isLikelyAccessory`.
 */
export interface WatchlistQueryPlan {
  brand: string | null;
  productLine: string | null;
  model: string | null;
  variant: string | null;
  excludeTerms: string[];
}

/**
 * Deterministically builds a search query string from a structured plan
 * — e.g. `"Apple iPhone 18 Pro 256GB"`. The identifying fields join into
 * one quoted phrase. Never appends `-word` exclude clauses: confirmed
 * live (2026-09-15) that SerpApi's `google_shopping` engine inverts
 * intent when *any* negated word is present — a single `-case` on
 * `"Apple iPhone 17 Pro 256GB"` collapsed a search that otherwise
 * returned 22/40 genuine phone listings (real retailers, prices in the
 * expected range) down to 0/40, every result an accessory whose title
 * contained the very word being excluded. The same collapse happened
 * with the full exclude-term list, quoted or not. This isn't a "too many
 * negations" limit (an earlier version of this function capped the
 * count for that reason) — even one negated word makes results *worse*,
 * not better, so exclude terms are never turned into query syntax at
 * all. They're still useful downstream, just applied against each
 * candidate's title after the fact instead
 * (`watchlist-result-filter.ts#isLikelyAccessory`), where an inverted
 * match has no way to poison the whole result set the way a negated
 * query term does. Never computes anything the model didn't already
 * extract — same "verbatim data in, deterministic assembly in code"
 * split `parse-amount-span.ts` and `parse-date-span.ts` already use for
 * email extraction.
 */
export function buildShoppingQuery(plan: WatchlistQueryPlan): string {
  const coreParts = [plan.brand, plan.productLine, plan.model, plan.variant].filter(
    (part): part is string => part !== null && part.trim().length > 0,
  );
  const corePhrase = coreParts.join(' ').trim();
  return corePhrase.length > 0 ? `"${corePhrase}"` : '';
}
