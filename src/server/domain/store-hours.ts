/**
 * Normalized weekly hours — not imported from providers/google-maps.ts,
 * same independence-from-adapters convention every other domain/ file
 * follows (see domain/burn.ts's note on staying independent of db/
 * schema.ts). providers/google-maps.ts and db/queries/stores.ts both
 * import this type from here, not the other way around.
 */
export interface OpeningPeriod {
  /** 0 = Sunday, matching Google Places' own day numbering. */
  day: number;
  opensAt: string;
  closesAt: string;
}

/**
 * `openingHoursPeriods` is a `jsonb` column, untyped (`unknown`) at the
 * schema level by design — schema.ts stays independent of every other
 * layer's types. This is the one place the cast happens; a plain
 * function (not tied to db/queries/stores.ts's PreferredStoreRow, same
 * independence-from-db convention as the rest of this file) so it's
 * safe to call from a Client Component, unlike anything in db/queries/.
 */
export function readOpeningPeriods(openingHoursPeriods: unknown): OpeningPeriod[] | null {
  return (openingHoursPeriods as OpeningPeriod[] | null) ?? null;
}

/**
 * Whether a store is open at `now`, given its weekly periods. Returns
 * `null` — not `false` — when hours are unknown, so callers can render
 * "hours unknown" distinctly from "closed."
 */
export function isOpenNow(periods: OpeningPeriod[] | null, now: Date): boolean | null {
  if (periods === null || periods.length === 0) return null;

  const day = now.getDay();
  const period = periods.find((p) => p.day === day);
  if (!period) return false;

  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const [openH = 0, openM = 0] = period.opensAt.split(':').map(Number);
  const [closeH = 0, closeM = 0] = period.closesAt.split(':').map(Number);
  const opensAtMinutes = openH * 60 + openM;
  const closesAtMinutes = closeH * 60 + closeM;

  return minutesNow >= opensAtMinutes && minutesNow <= closesAtMinutes;
}
