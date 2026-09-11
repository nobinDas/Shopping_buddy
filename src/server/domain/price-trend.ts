/**
 * True when `current` is strictly lower than `previous`. `previous` is
 * null before an item has ever been checked, in which case there's
 * nothing to compare against — not a drop.
 */
export function didPriceDrop(current: number, previous: number | null): boolean {
  if (previous === null) return false;
  return current < previous;
}
