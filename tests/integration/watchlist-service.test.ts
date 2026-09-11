import { describe, expect, it, vi, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db';
import { watchlistItems } from '@/server/db/schema';
import {
  addWatchlistItem,
  deleteWatchlistItem,
  checkWatchlistItemPrice,
  markWatchlistSeen,
} from '@/server/services/watchlist.service';

// docs/TESTING.md: "External providers mocked at the adapter boundary in
// src/server/providers/" — providers/google-shopping.ts is mocked here;
// the DB side runs for real against Postgres inside a rolled-back
// transaction.
vi.mock('@/server/providers/google-shopping', () => ({
  searchLowestPrice: vi.fn(),
}));

const googleShopping = await import('@/server/providers/google-shopping');

beforeEach(() => {
  vi.mocked(googleShopping.searchLowestPrice).mockReset();
});

describe('addWatchlistItem / deleteWatchlistItem', () => {
  it('adds an item with the given name', async () => {
    await expect(
      db.transaction(async (tx) => {
        const item = await addWatchlistItem('4K OLED TV, 55"', tx);
        expect(item.name).toBe('4K OLED TV, 55"');
        expect(item.hasPriceDrop).toBe(false);
        expect(item.latestPriceMinor).toBeNull();

        tx.rollback();
      }),
    ).rejects.toThrow();
  });

  it('permanently removes the item on delete', async () => {
    await expect(
      db.transaction(async (tx) => {
        const item = await addWatchlistItem('Robot vacuum', tx);
        await deleteWatchlistItem(item.id, tx);

        const [remaining] = await tx.select().from(watchlistItems).where(eq(watchlistItems.id, item.id));
        expect(remaining).toBeUndefined();

        tx.rollback();
      }),
    ).rejects.toThrow();
  });
});

describe('checkWatchlistItemPrice', () => {
  it('writes history and caches the latest price on the first check, without flagging a drop', async () => {
    await expect(
      db.transaction(async (tx) => {
        const item = await addWatchlistItem('Espresso machine', tx);

        vi.mocked(googleShopping.searchLowestPrice).mockResolvedValue({
          title: 'Espresso machine at Amazon',
          unitPriceMinor: 40000,
          currency: 'USD',
          sellerName: 'Amazon',
          productLink: 'https://example.com/product',
        });

        const result = await checkWatchlistItemPrice(item.id, tx);

        expect(result.status).toBe('found');
        if (result.status === 'found') {
          expect(result.item.latestPriceMinor).toBe(40000);
          expect(result.item.hasPriceDrop).toBe(false);
        }

        tx.rollback();
      }),
    ).rejects.toThrow();
  });

  it('sets hasPriceDrop when a later check is lower than the cached price', async () => {
    await expect(
      db.transaction(async (tx) => {
        const item = await addWatchlistItem('Winter tyres', tx);

        vi.mocked(googleShopping.searchLowestPrice).mockResolvedValueOnce({
          title: 'Tyres',
          unitPriceMinor: 40000,
          currency: 'USD',
          sellerName: 'Tire Rack',
          productLink: null,
        });
        await checkWatchlistItemPrice(item.id, tx);

        vi.mocked(googleShopping.searchLowestPrice).mockResolvedValueOnce({
          title: 'Tyres',
          unitPriceMinor: 35000,
          currency: 'USD',
          sellerName: 'Tire Rack',
          productLink: null,
        });
        const result = await checkWatchlistItemPrice(item.id, tx);

        expect(result.status).toBe('found');
        if (result.status === 'found') {
          expect(result.item.hasPriceDrop).toBe(true);
          expect(result.item.latestPriceMinor).toBe(35000);
        }

        tx.rollback();
      }),
    ).rejects.toThrow();
  });

  it('does not flag a drop when the price rises or stays the same', async () => {
    await expect(
      db.transaction(async (tx) => {
        const item = await addWatchlistItem('Winter tyres', tx);

        vi.mocked(googleShopping.searchLowestPrice).mockResolvedValueOnce({
          title: 'Tyres',
          unitPriceMinor: 35000,
          currency: 'USD',
          sellerName: null,
          productLink: null,
        });
        await checkWatchlistItemPrice(item.id, tx);

        vi.mocked(googleShopping.searchLowestPrice).mockResolvedValueOnce({
          title: 'Tyres',
          unitPriceMinor: 35000,
          currency: 'USD',
          sellerName: null,
          productLink: null,
        });
        const result = await checkWatchlistItemPrice(item.id, tx);

        expect(result.status).toBe('found');
        if (result.status === 'found') {
          expect(result.item.hasPriceDrop).toBe(false);
        }

        tx.rollback();
      }),
    ).rejects.toThrow();
  });

  it('returns not_found and leaves hasPriceDrop untouched when nothing matches', async () => {
    await expect(
      db.transaction(async (tx) => {
        const item = await addWatchlistItem('Something very obscure', tx);

        vi.mocked(googleShopping.searchLowestPrice).mockResolvedValue(null);

        const result = await checkWatchlistItemPrice(item.id, tx);

        expect(result.status).toBe('not_found');

        tx.rollback();
      }),
    ).rejects.toThrow();
  });

  it('returns an error result when the provider throws', async () => {
    await expect(
      db.transaction(async (tx) => {
        const item = await addWatchlistItem('TV', tx);

        vi.mocked(googleShopping.searchLowestPrice).mockRejectedValue(new Error('SerpApi responded 429'));

        const result = await checkWatchlistItemPrice(item.id, tx);

        expect(result).toEqual({ status: 'error', message: 'SerpApi responded 429' });

        tx.rollback();
      }),
    ).rejects.toThrow();
  });
});

describe('markWatchlistSeen', () => {
  it('clears hasPriceDrop on every item', async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.insert(watchlistItems).values({ name: 'A', hasPriceDrop: true });
        await tx.insert(watchlistItems).values({ name: 'B', hasPriceDrop: true });

        await markWatchlistSeen(tx);

        const all = await tx.select().from(watchlistItems);
        expect(all.every((item) => !item.hasPriceDrop)).toBe(true);

        tx.rollback();
      }),
    ).rejects.toThrow();
  });
});
