import { describe, expect, it, vi, beforeEach } from 'vitest';
import { db, type DbClient } from '@/server/db';
import { shoppingLists, shoppingListItems, itemPriceHistory } from '@/server/db/schema';
import { eq } from 'drizzle-orm';
import {
  addItem,
  updateItem,
  deleteItem,
  toggleItemChecked,
  checkItemPrice,
} from '@/server/services/shopping.service';
import { buildShoppingList } from '../fixtures/builders';

// docs/TESTING.md: "External providers mocked at the adapter boundary in
// src/server/providers/" — providers/serpapi.ts is mocked here; the DB
// side runs for real against Postgres inside a rolled-back transaction.
vi.mock('@/server/providers/serpapi', () => ({
  searchWalmartPrice: vi.fn(),
}));

const serpapi = await import('@/server/providers/serpapi');

beforeEach(() => {
  vi.mocked(serpapi.searchWalmartPrice).mockReset();
});

async function createTestList(tx: DbClient) {
  const [list] = await tx.insert(shoppingLists).values(buildShoppingList()).returning();
  if (!list) throw new Error('Insert did not return a row');
  return list;
}

describe('addItem / updateItem / deleteItem', () => {
  it('adds an item with the given fields', async () => {
    await expect(
      db.transaction(async (tx) => {
        const list = await createTestList(tx);

        const item = await addItem(
          list.id,
          { name: 'Milk, 1gal', quantity: 2, notes: 'organic', store: "Trader Joe's" },
          tx,
        );

        expect(item.name).toBe('Milk, 1gal');
        expect(item.quantity).toBe(2);
        expect(item.notes).toBe('organic');
        expect(item.store).toBe("Trader Joe's");

        tx.rollback();
      }),
    ).rejects.toThrow();
  });

  it('updates an item’s editable fields', async () => {
    await expect(
      db.transaction(async (tx) => {
        const list = await createTestList(tx);
        const item = await addItem(list.id, { name: 'Milk', quantity: 1, notes: null, store: null }, tx);

        const updated = await updateItem(
          item.id,
          { name: 'Milk, 1gal', quantity: 3, notes: null, store: 'Costco' },
          tx,
        );

        expect(updated.quantity).toBe(3);
        expect(updated.store).toBe('Costco');

        tx.rollback();
      }),
    ).rejects.toThrow();
  });

  it('permanently removes the item on delete', async () => {
    await expect(
      db.transaction(async (tx) => {
        const list = await createTestList(tx);
        const item = await addItem(list.id, { name: 'Milk', quantity: 1, notes: null, store: null }, tx);

        await deleteItem(item.id, tx);

        const [remaining] = await tx
          .select()
          .from(shoppingListItems)
          .where(eq(shoppingListItems.id, item.id));
        expect(remaining).toBeUndefined();

        tx.rollback();
      }),
    ).rejects.toThrow();
  });
});

describe('toggleItemChecked', () => {
  it('flips checked from false to true and back', async () => {
    await expect(
      db.transaction(async (tx) => {
        const list = await createTestList(tx);
        const item = await addItem(list.id, { name: 'Milk', quantity: 1, notes: null, store: null }, tx);

        const checked = await toggleItemChecked(item, tx);
        expect(checked.checked).toBe(true);

        const unchecked = await toggleItemChecked(checked, tx);
        expect(unchecked.checked).toBe(false);

        tx.rollback();
      }),
    ).rejects.toThrow();
  });
});

describe('checkItemPrice', () => {
  it('writes a price_history row and updates the item on a match', async () => {
    await expect(
      db.transaction(async (tx) => {
        const list = await createTestList(tx);
        const item = await addItem(list.id, { name: 'Milk, 1gal', quantity: 1, notes: null, store: null }, tx);

        vi.mocked(serpapi.searchWalmartPrice).mockResolvedValue({
          title: 'Great Value Milk, 1gal',
          unitPriceMinor: 449,
          currency: 'USD',
        });

        const result = await checkItemPrice(item.id, tx);

        expect(result.status).toBe('found');
        if (result.status === 'found') {
          expect(result.item.unitPriceMinor).toBe(449);
          expect(result.item.lastPriceCheckedAt).not.toBeNull();
        }

        const history = await tx
          .select()
          .from(itemPriceHistory)
          .where(eq(itemPriceHistory.itemId, item.id));
        expect(history).toHaveLength(1);
        expect(history[0]?.source).toBe('walmart');
        expect(history[0]?.unitPriceMinor).toBe(449);

        tx.rollback();
      }),
    ).rejects.toThrow();
  });

  it('returns not_found and writes no history row when nothing matches', async () => {
    await expect(
      db.transaction(async (tx) => {
        const list = await createTestList(tx);
        const item = await addItem(
          list.id,
          { name: 'Something very obscure', quantity: 1, notes: null, store: null },
          tx,
        );

        vi.mocked(serpapi.searchWalmartPrice).mockResolvedValue(null);

        const result = await checkItemPrice(item.id, tx);

        expect(result.status).toBe('not_found');

        const history = await tx
          .select()
          .from(itemPriceHistory)
          .where(eq(itemPriceHistory.itemId, item.id));
        expect(history).toHaveLength(0);

        tx.rollback();
      }),
    ).rejects.toThrow();
  });

  it('returns an error result when the provider throws, without writing history', async () => {
    await expect(
      db.transaction(async (tx) => {
        const list = await createTestList(tx);
        const item = await addItem(list.id, { name: 'Milk', quantity: 1, notes: null, store: null }, tx);

        vi.mocked(serpapi.searchWalmartPrice).mockRejectedValue(new Error('SerpApi responded 429'));

        const result = await checkItemPrice(item.id, tx);

        expect(result).toEqual({ status: 'error', message: 'SerpApi responded 429' });

        const history = await tx
          .select()
          .from(itemPriceHistory)
          .where(eq(itemPriceHistory.itemId, item.id));
        expect(history).toHaveLength(0);

        tx.rollback();
      }),
    ).rejects.toThrow();
  });
});
