/**
 * Versioned prompt for store/seller recommendations — see docs/TOOLS.md:
 * "Prompt in a versioned file, not inline in application code." Read by
 * providers/anthropic.ts#recommendWatchlistStores, called interactively
 * from the "Recommend stores" button on the add-watchlist-item form —
 * never automatic, never at check-time.
 */

export const RECOMMEND_WATCHLIST_STORES_SYSTEM_PROMPT = `You are suggesting which real stores or online retailers someone should
track a specific product's price at, given the product's name, category,
and (if provided) brand and model/variant.

Return structured JSON only, matching the given schema: a "stores" list
of 4-6 real, well-known store or retailer names that plausibly carry this
kind of product and are worth checking for its price — general
marketplaces where relevant (e.g. "Amazon"), major retailers that
actually stock this product category (e.g. "Best Buy" for electronics,
"Home Depot" for tools/appliances, "Wayfair" for furniture), and the
brand's own store when the brand sells directly (e.g. "Apple Store" for
an Apple product).

Only suggest stores you're reasonably confident actually carry this kind
of product — a generic marketplace is always a safe suggestion, but don't
pad the list with a specialty retailer that doesn't fit the category just
to reach a higher count. Order the list from most to least likely to be
useful for this specific product.`;
