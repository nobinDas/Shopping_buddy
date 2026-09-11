import { describe, expect, it } from 'vitest';
import { db, type DbClient } from '@/server/db';
import { shoppingLists, shoppingListItems } from '@/server/db/schema';
import { eq } from 'drizzle-orm';
import { addItem, updateItem, deleteItem, toggleItemChecked } from '@/server/services/shopping.service';
import { buildShoppingList } from '../fixtures/builders';

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
          { name: 'Milk, 1gal', quantity: 2, notes: 'organic', store: "Trader Joe's", dueAt: null },
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
        const item = await addItem(
          list.id,
          { name: 'Milk', quantity: 1, notes: null, store: null, dueAt: null },
          tx,
        );

        const updated = await updateItem(
          item.id,
          { name: 'Milk, 1gal', quantity: 3, notes: null, store: 'Costco', dueAt: null },
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
        const item = await addItem(
          list.id,
          { name: 'Milk', quantity: 1, notes: null, store: null, dueAt: null },
          tx,
        );

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
        const item = await addItem(
          list.id,
          { name: 'Milk', quantity: 1, notes: null, store: null, dueAt: null },
          tx,
        );

        const checked = await toggleItemChecked(item, tx);
        expect(checked.checked).toBe(true);

        const unchecked = await toggleItemChecked(checked, tx);
        expect(unchecked.checked).toBe(false);

        tx.rollback();
      }),
    ).rejects.toThrow();
  });

  it('stamps checkedAt on check, clears it on uncheck', async () => {
    await expect(
      db.transaction(async (tx) => {
        const list = await createTestList(tx);
        const item = await addItem(
          list.id,
          { name: 'Milk', quantity: 1, notes: null, store: null, dueAt: null },
          tx,
        );

        const checked = await toggleItemChecked(item, tx);
        expect(checked.checkedAt).not.toBeNull();

        const unchecked = await toggleItemChecked(checked, tx);
        expect(unchecked.checkedAt).toBeNull();

        tx.rollback();
      }),
    ).rejects.toThrow();
  });
});
