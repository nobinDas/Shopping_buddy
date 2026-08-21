/**
 * Normalises a subscription's display name into its `vendor_key`: lowercased,
 * punctuation stripped, whitespace collapsed. See docs/DATA_MODEL.md.
 *
 * Called both when a subscription is created (so `vendor_key` exists from
 * day one) and, later, by domain/reconcile.ts to normalise a detected
 * signal's vendor string the same way — an exact `vendor_key` match only
 * fires if both sides go through this same function.
 */
export function normalizeVendorKey(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics (café → cafe)
    .replace(/[^a-z0-9\s]/g, '') // strip punctuation
    .trim()
    .replace(/\s+/g, ' '); // collapse internal whitespace
}
