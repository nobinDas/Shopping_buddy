// A rough estimate, not a measurement — shown next to a store's item
// count on /trips so a planned route's total duration is a real number,
// not a guess with no basis. Not user-configurable this phase; easy to
// tune later if it proves off in practice (see docs/PHASES.md).
const BASE_MINUTES = 5;
const MINUTES_PER_ITEM = 2;

/** Estimated minutes to shop a store's list, from how many items are on it. */
export function estimateShoppingMinutes(itemCount: number): number {
  if (itemCount <= 0) return 0;
  return BASE_MINUTES + itemCount * MINUTES_PER_ITEM;
}
