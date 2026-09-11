import { eq, sql } from 'drizzle-orm';
import { db, type DbClient } from '@/server/db';
import { watchlistItems, watchlistPriceHistory } from '@/server/db/schema';

export type WatchlistItemRow = typeof watchlistItems.$inferSelect;
export type NewWatchlistItem = typeof watchlistItems.$inferInsert;
export type WatchlistPriceHistoryRow = typeof watchlistPriceHistory.$inferSelect;
export type NewWatchlistPriceHistory = typeof watchlistPriceHistory.$inferInsert;

export interface WatchlistItemWithHistory extends WatchlistItemRow {
  history: WatchlistPriceHistoryRow[];
}

/**
 * Every watchlist item with its price history attached, history ordered
 * oldest-first (for the sparkline). Two queries + in-memory grouping —
 * same shape as queries/shopping.ts#getAllLists.
 */
export async function getAllWatchlistItems(client: DbClient = db): Promise<WatchlistItemWithHistory[]> {
  const items = await client.select().from(watchlistItems);
  const history = await client
    .select()
    .from(watchlistPriceHistory)
    .orderBy(watchlistPriceHistory.checkedAt);

  return items.map((item) => ({
    ...item,
    history: history.filter((row) => row.itemId === item.id),
  }));
}

export async function getWatchlistItemById(
  id: string,
  client: DbClient = db,
): Promise<WatchlistItemRow | undefined> {
  const [row] = await client.select().from(watchlistItems).where(eq(watchlistItems.id, id));
  return row;
}

export async function insertWatchlistItem(
  name: string,
  client: DbClient = db,
): Promise<WatchlistItemRow> {
  const [row] = await client.insert(watchlistItems).values({ name }).returning();
  if (!row) {
    throw new Error('insertWatchlistItem: insert did not return a row');
  }
  return row;
}

export async function updateWatchlistItemRow(
  id: string,
  values: Partial<NewWatchlistItem>,
  client: DbClient = db,
): Promise<WatchlistItemRow> {
  const [row] = await client
    .update(watchlistItems)
    .set(values)
    .where(eq(watchlistItems.id, id))
    .returning();
  if (!row) {
    throw new Error(`updateWatchlistItemRow: no item with id ${id}`);
  }
  return row;
}

export async function deleteWatchlistItemRow(id: string, client: DbClient = db): Promise<void> {
  await client.delete(watchlistItems).where(eq(watchlistItems.id, id));
}

/** Appends one price_history row. Insert-only — never UPDATEd. */
export async function insertWatchlistPriceHistory(
  values: NewWatchlistPriceHistory,
  client: DbClient = db,
): Promise<void> {
  await client.insert(watchlistPriceHistory).values(values);
}

/** Read by the nav badges (BottomNav's More tab, and the Watchlist row inside /more). */
export async function getWatchlistDropCount(client: DbClient = db): Promise<number> {
  const [row] = await client
    .select({ count: sql<number>`count(*)::int` })
    .from(watchlistItems)
    .where(eq(watchlistItems.hasPriceDrop, true));
  return row?.count ?? 0;
}

/** Clears hasPriceDrop on every item — called once when /watchlist is opened. */
export async function clearAllPriceDropFlags(client: DbClient = db): Promise<void> {
  await client.update(watchlistItems).set({ hasPriceDrop: false }).where(eq(watchlistItems.hasPriceDrop, true));
}
