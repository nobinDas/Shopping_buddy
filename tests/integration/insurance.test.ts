import { describe, expect, it } from 'vitest';
import { db } from '@/server/db';
import { insurancePolicies } from '@/server/db/schema';
import { getActivePolicies, getAllPolicies } from '@/server/db/queries/insurance';
import { buildPolicy } from '../fixtures/builders';

describe('getActivePolicies', () => {
  it('returns only policies with status = active', async () => {
    await expect(
      db.transaction(async (tx) => {
        const [active] = await tx
          .insert(insurancePolicies)
          .values(buildPolicy({ insurer: 'Active Insurer', status: 'active' }))
          .returning();
        await tx
          .insert(insurancePolicies)
          .values(buildPolicy({ insurer: 'Archived Insurer', status: 'archived' }));
        if (!active) {
          throw new Error('Insert did not return a row');
        }

        const result = await getActivePolicies(tx);

        expect(result.map((p) => p.id)).toEqual([active.id]);
        expect(result[0]?.insurer).toBe('Active Insurer');

        tx.rollback();
      }),
    ).rejects.toThrow();
  });

  it('returns an empty array when there are no active policies', async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.insert(insurancePolicies).values(buildPolicy({ status: 'archived' }));

        const result = await getActivePolicies(tx);

        expect(result).toEqual([]);

        tx.rollback();
      }),
    ).rejects.toThrow();
  });
});

describe('getAllPolicies', () => {
  it('returns every policy regardless of status', async () => {
    await expect(
      db.transaction(async (tx) => {
        const active = await tx
          .insert(insurancePolicies)
          .values(buildPolicy({ status: 'active' }))
          .returning();
        const archived = await tx
          .insert(insurancePolicies)
          .values(buildPolicy({ status: 'archived' }))
          .returning();

        const result = await getAllPolicies(tx);

        expect(result).toHaveLength(2);
        expect(result.map((p) => p.id).sort()).toEqual([active[0]?.id, archived[0]?.id].sort());

        tx.rollback();
      }),
    ).rejects.toThrow();
  });
});
