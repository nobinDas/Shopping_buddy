/**
 * `ProductCandidate` is the shared shape between `providers/google-shopping.ts`
 * (which produces it, parsing SerpApi's `google_shopping` response) and
 * everything downstream (`services/watchlist.service.ts`, the add-item
 * UI). Defined here rather than in the provider file so that domain/
 * functions operating on it don't need to import from providers/ —
 * providers/ and services/ import this type from domain/, never the
 * other way, matching `domain/reconcile.ts`'s `CandidateSubscription`
 * pattern.
 */
export interface ProductCandidate {
  productId: string;
  // The handle every later price check actually polls by
  // (`providers/google-shopping.ts#getImmersiveProductOffers`) — `productId`
  // is kept for display/debugging only, since SerpApi's `google_product`
  // engine that once polled by it was shut down by Google (confirmed live,
  // 2026-09-15, see docs/LEARNED.md). Nullable because a stray candidate
  // missing `immersive_product_page_token` shouldn't be dropped outright;
  // it just can't be checked for a price later (see
  // `services/watchlist.service.ts#checkWatchlistItemPrice`'s null check).
  pageToken: string | null;
  title: string;
  unitPriceMinor: number;
  currency: string;
  sellerName: string | null;
  productLink: string | null;
}

/**
 * Google Shopping can return the same product listed by several sellers
 * as separate result rows — for presenting "which product is this"
 * choices to the user at add-time, those collapse into one card per
 * `productId`. Keeps whichever row has the lowest price as the
 * representative one; the actual cross-seller price comparison happens
 * later, at check-time, via
 * `providers/google-shopping.ts#getImmersiveProductOffers` against the
 * confirmed `pageToken` — this is only about not showing the same product
 * to the user three times over.
 */
export function dedupeByProductId(candidates: ProductCandidate[]): ProductCandidate[] {
  const byId = new Map<string, ProductCandidate>();
  for (const candidate of candidates) {
    const existing = byId.get(candidate.productId);
    if (!existing || candidate.unitPriceMinor < existing.unitPriceMinor) {
      byId.set(candidate.productId, candidate);
    }
  }
  return [...byId.values()];
}

/**
 * Drops candidates priced outside the user's expected range — applied
 * client-side against the raw candidate list, not as a search-time API
 * parameter. Confirmed live (2026-09-15) that SerpApi's `google_shopping`
 * engine silently ignores both its documented `tbs=mr:1,price:1,ppr_min:
 * X,ppr_max:Y` filter and the `low_price`/`high_price` params: an
 * impossible range ($99,999–$100,000) still returned ordinary $25–$75
 * phone cases unfiltered, proving neither param does anything for this
 * engine (see docs/LEARNED.md). This is the real fix that superseded
 * `watchlist-query.ts`'s now-removed `buildPriceRangeFilter` — accessory
 * listings are almost always priced far outside a real product's
 * expected range, so filtering the already-fetched candidates by price
 * removes most of them just as effectively, without depending on a
 * provider feature that doesn't work. A missing bound is treated as
 * unconstrained on that side; when the user set no range at all, every
 * candidate passes through unchanged.
 */
export function filterByExpectedPriceRange(
  candidates: ProductCandidate[],
  minMinor: number | null,
  maxMinor: number | null,
): ProductCandidate[] {
  return candidates.filter((candidate) => {
    if (minMinor !== null && candidate.unitPriceMinor < minMinor) return false;
    if (maxMinor !== null && candidate.unitPriceMinor > maxMinor) return false;
    return true;
  });
}
