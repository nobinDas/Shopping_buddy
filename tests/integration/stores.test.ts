import { describe, expect, it } from 'vitest';
import { db } from '@/server/db';
import { preferredStores } from '@/server/db/schema';
import { getAllStores, insertStore, updateStoreHours, deleteStore } from '@/server/db/queries/stores';
import { readOpeningPeriods } from '@/server/domain/store-hours';
import { buildPreferredStore } from '../fixtures/builders';

describe('insertStore', () => {
  it('inserts a new store', async () => {
    await expect(
      db.transaction(async (tx) => {
        const created = await insertStore('Trader Joe’s', '123 Main St, Testville, TS 00000', tx);

        expect(created?.name).toBe('Trader Joe’s');

        tx.rollback();
      }),
    ).rejects.toThrow();
  });

  it('does nothing when the name already exists, rather than duplicating', async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.insert(preferredStores).values(buildPreferredStore({ name: 'Costco' }));

        const result = await insertStore('Costco', '456 Other St, Testville, TS 00000', tx);

        const all = await getAllStores(tx);
        expect(all.filter((s) => s.name === 'Costco')).toHaveLength(1);
        expect(result).toBeUndefined();

        tx.rollback();
      }),
    ).rejects.toThrow();
  });
});

describe('updateStoreHours', () => {
  it('writes placeId, opening hours text, and normalized periods onto the store', async () => {
    await expect(
      db.transaction(async (tx) => {
        const [created] = await tx
          .insert(preferredStores)
          .values(buildPreferredStore())
          .returning();
        if (!created) throw new Error('Insert did not return a row');

        await updateStoreHours(
          created.id,
          {
            placeId: 'place-1',
            openingHoursText: ['Monday: 9:00 AM – 9:00 PM'],
            openingHoursPeriods: [{ day: 1, opensAt: '09:00', closesAt: '21:00' }],
          },
          tx,
        );

        const all = await getAllStores(tx);
        const row = all.find((s) => s.id === created.id);
        expect(row?.placeId).toBe('place-1');
        expect(row?.openingHoursText).toEqual(['Monday: 9:00 AM – 9:00 PM']);
        expect(row && readOpeningPeriods(row.openingHoursPeriods)).toEqual([
          { day: 1, opensAt: '09:00', closesAt: '21:00' },
        ]);

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
