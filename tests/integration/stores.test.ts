import { describe, expect, it } from 'vitest';
import { db } from '@/server/db';
import { preferredStores } from '@/server/db/schema';
import { getAllStores, insertStore, deleteStore } from '@/server/db/queries/stores';
import { buildPreferredStore } from '../fixtures/builders';

describe('insertStore', () => {
  it('inserts a new store', async () => {
    await expect(
      db.transaction(async (tx) => {
        const created = await insertStore('Trader Joe’s', tx);

        expect(created?.name).toBe('Trader Joe’s');

        tx.rollback();
      }),
    ).rejects.toThrow();
  });

  it('does nothing when the name already exists, rather than duplicating', async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.insert(preferredStores).values(buildPreferredStore({ name: 'Costco' }));

        const result = await insertStore('Costco', tx);

        const all = await getAllStores(tx);
        expect(all.filter((s) => s.name === 'Costco')).toHaveLength(1);
        expect(result).toBeUndefined();

        tx.rollback();
      }),
    ).rejects.toThrow();
  });
});

describe('deleteStore', () => {
  it('permanently removes the row', async () => {
    await expect(
      db.transaction(async (tx) => {
        const [created] = await tx
          .insert(preferredStores)
          .values(buildPreferredStore())
          .returning();
        if (!created) throw new Error('Insert did not return a row');

        await deleteStore(created.id, tx);

        const all = await getAllStores(tx);
        expect(all.find((s) => s.id === created.id)).toBeUndefined();

        tx.rollback();
      }),
    ).rejects.toThrow();
  });
});
