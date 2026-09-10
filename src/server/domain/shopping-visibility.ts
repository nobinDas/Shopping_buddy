import { isSameDay } from 'date-fns';

/**
 * The subset of a shopping item's fields visibility needs. `checkedAt` is
 * set the moment `checked` flips true and cleared back to null if
 * unchecked — see schema.ts's comment on shoppingListItems.checkedAt.
 */
export interface VisibilityItem {
  checked: boolean;
  checkedAt: Date | null;
}

/**
 * An unchecked item is always visible on the active shopping list. A
 * checked item stays visible through the rest of the calendar day it was
 * checked, then drops out — the row and any price history stay in
 * Postgres regardless, this only governs what /shopping renders. `now` is
 * injected rather than read internally so the midnight boundary is
 * testable without waiting for it.
 */
export function isVisibleOnShoppingList(item: VisibilityItem, now: Date): boolean {
  if (!item.checked) return true;
  if (item.checkedAt === null) return true;
  return isSameDay(item.checkedAt, now);
}
