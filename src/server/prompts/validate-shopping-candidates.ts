/**
 * Versioned prompt for the LLM-fallback candidate validator — see
 * docs/TOOLS.md: "Prompt in a versioned file, not inline in application
 * code." Read by providers/anthropic.ts#validateShoppingCandidates, the
 * second (LLM) pass after domain/watchlist-result-filter.ts's cheap
 * heuristic pass — called on whatever candidate titles the heuristic
 * didn't already exclude as an obvious accessory, batched into one call
 * per add-item search rather than one call per candidate.
 */

export const VALIDATE_SHOPPING_CANDIDATES_SYSTEM_PROMPT = `You are checking a list of shopping search result titles against one
target product, to filter out listings that are not actually that
product — a different product entirely, an accessory for it, a bundle
that isn't primarily it, or a part/replacement/refill for it.

You will be given the target product description and a numbered list of
candidate titles. Return structured JSON only, matching the given schema:
a "matches" array of booleans, exactly one per candidate, in the same
order, where true means "this listing is genuinely the target product
itself" and false means "this is not the target product" (wrong item,
accessory, bundle, part, or anything else that isn't the product itself).

A listing for a different variant of the same base product (different
storage size, color, pack count) still counts as true — it's the same
product, not an accessory or a different product. Only mark false when
the listing is not actually the product being searched for.`;
