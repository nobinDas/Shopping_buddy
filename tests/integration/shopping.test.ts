import { describe, expect, it } from 'vitest';
import { db } from '@/server/db';
import { shoppingLists, shoppingListItems } from '@/server/db/schema';
import {
  getAllLists,
  getItemById,
  insertItem,
  deleteItemRow,
  getAllOutstandingItems,
} from '@/server/db/queries/shopping';
import { buildShoppingList, buildShoppingItem } from '../fixtures/builders';

describe('getAllLists', () => {
  it('attaches each list its own items only', async () => {
    await expect(
      db.transaction(async (tx) => {
        const [listA] = await tx
          .insert(shoppingLists)
          .values(buildShoppingList({ name: 'A' }))
          .returning();
        const [listB] = await tx
          .insert(shoppingLists)
          .values(buildShoppingList({ name: 'B' }))
          .returning();
        if (!listA || !listB) throw new Error('Insert did not return a row');

        await tx.insert(shoppingListItems).values(buildShoppingItem(listA.id, { name: 'Item A' }));
        await tx.insert(shoppingListItems).values(buildShoppingItem(listB.id, { name: 'Item B' }));

        const lists = await getAllLists(tx);
        const a = lists.find((l) => l.id === listA.id);
        const b = lists.find((l) => l.id === listB.id);

        expect(a?.items.map((i) => i.name)).toEqual(['Item A']);
        expect(b?.items.map((i) => i.name)).toEqual(['Item B']);

        tx.rollback();
      }),
    ).rejects.toThrow();
  });

  it('returns an empty items array for a list with nothing on it', async () => {
    await expect(
      db.transaction(async (tx) => {
        const [list] = await tx.insert(shoppingLists).values(buildShoppingList()).returning();
        if (!list) throw new Error('Insert did not return a row');

        const lists = await getAllLists(tx);
        const found = lists.find((l) => l.id === list.id);

        expect(found?.items).toEqual([]);

        tx.rollback();
      }),
    ).rejects.toThrow();
  });
});

describe('insertItem / getItemById / deleteItemRow', () => {
  it('inserts an item with sensible defaults and reads it back', async () => {
    await expect(
      db.transaction(async (tx) => {
        const [list] = await tx.insert(shoppingLists).values(buildShoppingList()).returning();
        if (!list) throw new Error('Insert did not return a row');

        const created = await insertItem(buildShoppingItem(list.id, { name: 'Milk' }), tx);

        expect(created.name).toBe('Milk');
        expect(created.quantity).toBe(1);
        expect(created.checked).toBe(false);
        expect(created.unitPriceMinor).toBeNull();

        const fetched = await getItemById(created.id, tx);
        expect(fetched?.id).toBe(created.id);

        tx.rollback();
      }),
    ).rejects.toThrow();
  });

  it('permanently removes the row on delete', async () => {
    await expect(
      db.transaction(async (tx) => {
        const [list] = await tx.insert(shoppingLists).values(buildShoppingList()).returning();
        if (!list) throw new Error('Insert did not return a row');

        const created = await insertItem(buildShoppingItem(list.id), tx);
        await deleteItemRow(created.id, tx);

        const fetched = await getItemById(created.id, tx);
        expect(fetched).toBeUndefined();

        tx.rollback();
      }),
    ).rejects.toThrow();
  });

  it('round-trips dueAt', async () => {
    await expect(
      db.transaction(async (tx) => {
        const [list] = await tx.insert(shoppingLists).values(buildShoppingList()).returning();
        if (!list) throw new Error('Insert did not return a row');

        const created = await insertItem(buildShoppingItem(list.id, { dueAt: '2026-09-20' }), tx);
        expect(created.dueAt).toBe('2026-09-20');

        tx.rollback();
      }),
    ).rejects.toThrow();
  });
});

describe('getAllOutstandingItems', () => {
  it("returns only unchecked items, with each one's list name attached", async () => {
    await expect(
      db.transaction(async (tx) => {
        const [list] = await tx
          .insert(shoppingLists)
          .values(buildShoppingList({ name: 'Grocery' }))
          .returning();
        if (!list) throw new Error('Insert did not return a row');

        await tx
          .insert(shoppingListItems)
          .values(buildShoppingItem(list.id, { name: 'Bought', checked: true }));
        await insertItem(buildShoppingItem(list.id, { name: 'Still needed' }), tx);

        const outstanding = await getAllOutstandingItems(tx);
        const names = outstanding.map((i) => i.name);
        expect(names).toContain('Still needed');
        expect(names).not.toContain('Bought');
        expect(outstanding.find((i) => i.name === 'Still needed')?.listName).toBe('Grocery');

        tx.rollback();
      }),
    ).rejects.toThrow();
  });
});
