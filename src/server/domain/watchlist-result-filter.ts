/**
 * A small backstop list, in addition to whatever `excludeTerms` the
 * query planner extracted for this specific product — catches the
 * common accessory categories even if the planner's own list happened
 * to miss one. Not exhaustive by design; the LLM fallback
 * (`providers/anthropic.ts#validateShoppingCandidates`) is what catches
 * whatever this heuristic doesn't.
 */
const DEFAULT_ACCESSORY_TERMS = [
  'case',
  'cover',
  'screen protector',
  'charger',
  'cable',
  'skin',
  'holster',
  'stand',
  'mount',
  'strap',
  'sleeve',
  'pouch',
  'tempered glass',
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * True when `title` contains one of the exclude terms (the planner's own
 * list, plus the default backstop above) as a whole word/phrase — a
 * cheap, deterministic first pass before any LLM call.
 *
 * A known, accepted limitation: this can't distinguish a genuine
 * accessory listing from a product whose own name happens to contain an
 * exclude word (e.g. a hypothetical device literally named "X Case").
 * That's rare enough for the product categories this app deals with to
 * accept rather than build context-aware disambiguation for — the same
 * "deliberately narrow, no fuzzy matching" tradeoff already accepted
 * elsewhere in this app (e.g. the store price-check in Phase 3).
 */
export function isLikelyAccessory(title: string, excludeTerms: string[]): boolean {
  const terms = [...excludeTerms, ...DEFAULT_ACCESSORY_TERMS];
  return terms.some((term) => {
    const trimmed = term.trim();
    if (trimmed.length === 0) return false;
    const pattern = new RegExp(`\\b${escapeRegExp(trimmed)}\\b`, 'i');
    return pattern.test(title);
  });
}
