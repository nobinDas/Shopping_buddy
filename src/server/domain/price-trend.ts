/**
 * True when `current` is strictly lower than `previous`. `previous` is
 * null before an item has ever been checked, in which case there's
 * nothing to compare against — not a drop.
 */
export function didPriceDrop(current: number, previous: number | null): boolean {
  if (previous === null) return false;
  return current < previous;
}

/**
 * True when this check's price has crossed *into* the item's own
 * expected range from above — the previous recorded price was over the
 * expected max, and the current one isn't. In practice this is always
 * also a price drop (you can't cross a fixed ceiling downward without
 * the price having fallen), so it's a subset of `didPriceDrop` in every
 * normal case — but it's kept as its own named, tested condition rather
 * than assumed, so the "why" stays explicit and survives a future change
 * to either function's definition. `services/watchlist.service.ts` ORs
 * this with `didPriceDrop` to decide whether to flag the item.
 */
export function enteredExpectedRange(
  current: number,
  previous: number | null,
  expectedMaxMinor: number | null,
): boolean {
  if (expectedMaxMinor === null || previous === null) return false;
  return previous > expectedMaxMinor && current <= expectedMaxMinor;
}

/**
 * True when the current price is over the item's own expected maximum —
 * drives the red/normal price color on `/watchlist`. Never true on a
 * currency mismatch between the observed price and the expected range:
 * comparing minor-unit amounts across currencies without an explicit
 * conversion is exactly what CLAUDE.md's money rule forbids, so a
 * mismatch is treated as "nothing to compare," not silently compared
 * anyway.
 */
export function isOverExpectedRange(
  currentMinor: number,
  currentCurrency: string,
  expectedMaxMinor: number | null,
  expectedCurrency: string | null,
): boolean {
  if (expectedMaxMinor === null || expectedCurrency === null) return false;
  if (currentCurrency !== expectedCurrency) return false;
  return currentMinor > expectedMaxMinor;
}
