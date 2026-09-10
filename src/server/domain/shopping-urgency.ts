import type { IsoDateString } from './billing-cycle';

/**
 * The subset of a shopping item's fields the urgency calculations need —
 * not imported from db/schema.ts, same independence-from-db/ convention
 * domain/burn.ts already follows.
 */
export interface UrgencyItem {
  dueAt: IsoDateString | null;
}

/**
 * Ascending by due date; items with no due date sort last (least urgent,
 * not most). Stable for equal/absent dates — callers that need a
 * secondary sort key apply it before calling this.
 */
export function sortItemsByUrgency<T extends UrgencyItem>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.dueAt === null && b.dueAt === null) return 0;
    if (a.dueAt === null) return 1;
    if (b.dueAt === null) return -1;
    return a.dueAt.localeCompare(b.dueAt);
  });
}

/**
 * The single soonest due date among a store's outstanding items, or null
 * if none of them have one. This is deliberately the only thing a store's
 * urgency badge exposes — no item names — per docs/DECISIONS.md's Phase 4
 * ADR.
 */
export function storeUrgency(items: UrgencyItem[]): IsoDateString | null {
  const dueDates = items
    .map((item) => item.dueAt)
    .filter((dueAt): dueAt is IsoDateString => dueAt !== null);
  if (dueDates.length === 0) return null;
  return dueDates.reduce((soonest, dueAt) => (dueAt < soonest ? dueAt : soonest));
}

/** True when a due date has passed as of `today`, exclusive of today itself. */
export function isOverdue(dueAt: IsoDateString | null, today: IsoDateString): boolean {
  if (dueAt === null) return false;
  return dueAt < today;
}
