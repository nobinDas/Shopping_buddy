import { eq } from 'drizzle-orm';
import { db, type DbClient } from '@/server/db';
import { shoppingLists, shoppingListItems, itemPriceHistory } from '@/server/db/schema';

export type ShoppingListRow = typeof shoppingLists.$inferSelect;
export type ShoppingItemRow = typeof shoppingListItems.$inferSelect;
export type NewShoppingItem = typeof shoppingListItems.$inferInsert;
export type ItemPriceHistoryRow = typeof itemPriceHistory.$inferSelect;
export type NewItemPriceHistory = typeof itemPriceHistory.$inferInsert;

export interface ListWithItems extends ShoppingListRow {
  items: ShoppingItemRow[];
}

export interface OutstandingItem extends ShoppingItemRow {
  listName: string;
}

/**
 * Fetches every list with its items attached. Two queries + in-memory
 * grouping rather than a join — simpler to reason about at this data
 * volume (a handful of lists, a few dozen items each), and keeps each
 * query's shape a plain table select.
 */
export async function getAllLists(client: DbClient = db): Promise<ListWithItems[]> {
  const lists = await client.select().from(shoppingLists);
  const items = await client.select().from(shoppingListItems);

  return lists.map((list) => ({
    ...list,
    items: items.filter((item) => item.listId === list.id),
  }));
}

/**
 * Every unchecked item across every list, with its list's name attached —
 * the /trips view's data source. Unlike getAllLists, this never includes
 * checked items: /trips only ever shows what's left to shop, so there's
 * no midnight-visibility rule to apply here (that's /shopping's concern,
 * via domain/shopping-visibility.ts).
 */
export async function getAllOutstandingItems(client: DbClient = db): Promise<OutstandingItem[]> {
  const rows = await client
    .select({ item: shoppingListItems, listName: shoppingLists.name })
    .from(shoppingListItems)
    .innerJoin(shoppingLists, eq(shoppingListItems.listId, shoppingLists.id))
    .where(eq(shoppingListItems.checked, false));

  return rows.map(({ item, listName }) => ({ ...item, listName }));
}

export async function getItemById(
  id: string,
  client: DbClient = db,
): Promise<ShoppingItemRow | undefined> {
  const [row] = await client.select().from(shoppingListItems).where(eq(shoppingListItems.id, id));
  return row;
}

export async function insertItem(
  values: NewShoppingItem,
  client: DbClient = db,
): Promise<ShoppingItemRow> {
  const [row] = await client.insert(shoppingListItems).values(values).returning();
  if (!row) {
    throw new Error('insertItem: insert did not return a row');
  }
  return row;
}

export async function updateItemRow(
  id: string,
  values: Partial<NewShoppingItem>,
  client: DbClient = db,
): Promise<ShoppingItemRow> {
  const [row] = await client
    .update(shoppingListItems)
    .set(values)
    .where(eq(shoppingListItems.id, id))
    .returning();
  if (!row) {
    throw new Error(`updateItemRow: no item with id ${id}`);
  }
  return row;
}

export async function deleteItemRow(id: string, client: DbClient = db): Promise<void> {
  await client.delete(shoppingListItems).where(eq(shoppingListItems.id, id));
}

/** Appends one price_history row. Insert-only — never UPDATEd. */
export async function insertItemPriceHistory(
  values: NewItemPriceHistory,
  client: DbClient = db,
): Promise<void> {
  await client.insert(itemPriceHistory).values(values);
}
