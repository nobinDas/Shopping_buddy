import { describe, expect, it, vi, beforeEach } from 'vitest';
import { db, type DbClient } from '@/server/db';
import { preferredStores } from '@/server/db/schema';
import { setHomeAddress } from '@/server/db/queries/settings';
import { planRoute } from '@/server/services/route.service';
import { buildPreferredStore } from '../fixtures/builders';

// docs/TESTING.md: "External providers mocked at the adapter boundary in
// src/server/providers/" — providers/google-maps.ts is mocked here; the DB
// side runs for real against Postgres inside a rolled-back transaction.
vi.mock('@/server/providers/google-maps', () => ({
  computeShortestRoute: vi.fn(),
}));

const googleMaps = await import('@/server/providers/google-maps');

beforeEach(() => {
  vi.mocked(googleMaps.computeShortestRoute).mockReset();
});

async function createTestStore(
  tx: DbClient,
  overrides: Parameters<typeof buildPreferredStore>[0] = {},
) {
  const [store] = await tx
    .insert(preferredStores)
    .values(buildPreferredStore(overrides))
    .returning();
  if (!store) throw new Error('Insert did not return a row');
  return store;
}

describe('planRoute', () => {
  it('returns missing_home_address when none is set', async () => {
    await expect(
      db.transaction(async (tx) => {
        const store = await createTestStore(tx);

        const result = await planRoute([store.id], tx);
        expect(result).toEqual({ status: 'missing_home_address' });

        tx.rollback();
      }),
    ).rejects.toThrow();
  });

  it('maps the optimized order back to store ids on success', async () => {
    await expect(
      db.transaction(async (tx) => {
        await setHomeAddress('1 Home St, Testville, TS 00000', tx);
        const storeA = await createTestStore(tx, { name: 'Store A', address: '2 A St' });
        const storeB = await createTestStore(tx, { name: 'Store B', address: '3 B St' });

        vi.mocked(googleMaps.computeShortestRoute).mockResolvedValue({
          order: [1, 0],
          legMinutes: [10, 5],
        });

        const result = await planRoute([storeA.id, storeB.id], tx);
        expect(result).toEqual({
          status: 'planned',
          order: [storeB.id, storeA.id],
          legMinutes: [10, 5],
        });

        tx.rollback();
      }),
    ).rejects.toThrow();
  });

  it('returns an error result when the provider throws', async () => {
    await expect(
      db.transaction(async (tx) => {
        await setHomeAddress('1 Home St, Testville, TS 00000', tx);
        const store = await createTestStore(tx);

        vi.mocked(googleMaps.computeShortestRoute).mockRejectedValue(
          new Error('Google Routes responded 429'),
        );

        const result = await planRoute([store.id], tx);
        expect(result).toEqual({ status: 'error', message: 'Google Routes responded 429' });

        tx.rollback();
      }),
    ).rejects.toThrow();
  });
});
