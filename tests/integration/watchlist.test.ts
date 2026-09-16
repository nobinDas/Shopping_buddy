import { describe, expect, it } from 'vitest';
import { db } from '@/server/db';
import { watchlistItems, watchlistPriceHistory } from '@/server/db/schema';
import {
  getAllWatchlistItems,
  insertWatchlistItem,
  deleteWatchlistItemRow,
  getWatchlistDropCount,
} from '@/server/db/queries/watchlist';
import { buildWatchlistItem, buildWatchlistPriceHistory } from '../fixtures/builders';

describe('insertWatchlistItem / getAllWatchlistItems', () => {
  it('attaches each item its own price history only, oldest first', async () => {
    await expect(
      db.transaction(async (tx) => {
        const itemA = await insertWatchlistItem(buildWatchlistItem({ name: 'TV' }), tx);
        const itemB = await insertWatchlistItem(buildWatchlistItem({ name: 'Vacuum' }), tx);

        await tx
          .insert(watchlistPriceHistory)
          .values(buildWatchlistPriceHistory(itemA.id, { unitPriceMinor: 20000 }));
        await tx
          .insert(watchlistPriceHistory)
          .values(buildWatchlistPriceHistory(itemA.id, { unitPriceMinor: 19000 }));
        await tx
          .insert(watchlistPriceHistory)
          .values(buildWatchlistPriceHistory(itemB.id, { unitPriceMinor: 5000 }));

        const items = await getAllWatchlistItems(tx);
        const a = items.find((i) => i.id === itemA.id);
        const b = items.find((i) => i.id === itemB.id);

        expect(a?.history.map((h) => h.unitPriceMinor)).toEqual([20000, 19000]);
        expect(b?.history.map((h) => h.unitPriceMinor)).toEqual([5000]);

        tx.rollback();
      }),
    ).rejects.toThrow();
  });

  it('returns an empty history array for an item never checked', async () => {
    await expect(
      db.transaction(async (tx) => {
        const item = await insertWatchlistItem(buildWatchlistItem({ name: 'Espresso machine' }), tx);

        const items = await getAllWatchlistItems(tx);
        const found = items.find((i) => i.id === item.id);

        expect(found?.history).toEqual([]);

        tx.rollback();
      }),
    ).rejects.toThrow();
  });
});

describe('deleteWatchlistItemRow', () => {
  it('permanently removes the row', async () => {
    await expect(
      db.transaction(async (tx) => {
        const [created] = await tx.insert(watchlistItems).values(buildWatchlistItem()).returning();
        if (!created) throw new Error('Insert did not return a row');

        await deleteWatchlistItemRow(created.id, tx);

        const all = await getAllWatchlistItems(tx);
        expect(all.find((i) => i.id === created.id)).toBeUndefined();

        tx.rollback();
      }),
    ).rejects.toThrow();
  });
});

describe('getWatchlistDropCount', () => {
  it('counts only items with hasPriceDrop set', async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.insert(watchlistItems).values(buildWatchlistItem({ hasPriceDrop: true }));
        await tx.insert(watchlistItems).values(buildWatchlistItem({ hasPriceDrop: true }));
        await tx.insert(watchlistItems).values(buildWatchlistItem({ hasPriceDrop: false }));

        expect(await getWatchlistDropCount(tx)).toBe(2);

        tx.rollback();
      }),
    ).rejects.toThrow();
  });
});
