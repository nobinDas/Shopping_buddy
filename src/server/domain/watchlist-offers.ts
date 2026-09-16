import { normalizeVendorKey } from './vendor-key';

/**
 * One seller's current price for an already-resolved product —
 * `providers/google-shopping.ts#getProductOffers` (the `google_product`
 * engine) is the only producer of this shape, at check-time.
 */
export interface ProductOffer {
  unitPriceMinor: number;
  currency: string;
  sellerName: string | null;
  productLink: string | null;
}

/**
 * Narrows `offers` to the ones from a seller the user actually listed
 * for this item, then returns the lowest-priced match — or null if none
 * of the tracked sellers currently have it. Reuses `normalizeVendorKey`
 * (lowercase, strip punctuation/diacritics, collapse whitespace) rather
 * than a new normalization function — the same job this app already
 * solved for matching vendor names in reconciliation ("Best Buy" vs
 * "Best Buy Marketplace" is exactly "Netflix" vs "netflix-noreply" with
 * different names). The match is bidirectional-substring, since either
 * side can be the more specific one ("Amazon" tracked, "Amazon.com"
 * returned — or the reverse, "Best Buy" tracked, "Best Buy Marketplace"
 * returned).
 *
 * Never falls back to an untracked seller when nothing matches — an
 * empty result here means "not found," not "search anywhere," per the
 * whole point of the user specifying sellers at all.
 */
export function pickTrackedLowestOffer(
  offers: ProductOffer[],
  trackedSellers: string[],
): ProductOffer | null {
  const normalizedTracked = trackedSellers.map(normalizeVendorKey).filter((s) => s.length > 0);

  const matching = offers.filter((offer) => {
    if (!offer.sellerName) return false;
    const normalizedSeller = normalizeVendorKey(offer.sellerName);
    if (normalizedSeller.length === 0) return false;
    return normalizedTracked.some(
      (tracked) => normalizedSeller.includes(tracked) || tracked.includes(normalizedSeller),
    );
  });

  if (matching.length === 0) return null;
  return matching.reduce((min, offer) => (offer.unitPriceMinor < min.unitPriceMinor ? offer : min));
}
