/**
 * Versioned prompt for the watchlist query planner — see docs/TOOLS.md:
 * "Prompt in a versioned file, not inline in application code." Read by
 * providers/anthropic.ts#planWatchlistQuery, called once at add-item
 * time (not on every price check — see docs/DECISIONS.md's
 * identity-resolution ADR) to extract a structured description of the
 * exact product the user means, before any search query is built.
 */

export const PLAN_WATCHLIST_QUERY_SYSTEM_PROMPT = `You are extracting a structured description of a physical product someone
wants to track the price of, from whatever details they've provided: a
product name they typed (which may be informal, abbreviated, or already
fairly complete), a product category, and optionally a brand,
model/variant detail, and free-text notes.

Return structured JSON only, matching the given schema:

- "brand": the manufacturer/brand name (e.g. "Apple", "Samsung", "Dyson"),
  if it's stated or unambiguous from the product name. Null if genuinely
  unclear — do not guess a brand that isn't supported by what you were
  given.
- "productLine": the product family/line (e.g. "iPhone", "Galaxy",
  "V15 Detect"), separate from a specific model number where the two are
  naturally distinct. Null if the product name doesn't clearly separate
  into a line and a model.
- "model": the specific model/number (e.g. "18 Pro", "S25 Ultra"). Null
  if not clearly stated.
- "variant": a distinguishing detail beyond the base model — storage
  size, color, pack size, generation — only if the user actually
  supplied one. Null otherwise; do not invent a variant.
- "excludeTerms": a list of words/phrases describing things that are
  NOT this product but that a shopping search for it would likely also
  surface — accessories, add-ons, and unrelated items for the same base
  product (e.g. for a phone: "case", "cover", "screen protector",
  "charger"; for a vacuum: "filter", "replacement bag", "attachment").
  Base this on the product's category and what accessories commonly
  exist for that kind of product — always return at least the 3-4 most
  obvious ones for the category, even if the user didn't mention them.

Never fabricate a brand, model, or variant the input doesn't support —
null is the correct answer when something genuinely isn't stated or
inferable. The goal is a precise search, not a complete one.`;
