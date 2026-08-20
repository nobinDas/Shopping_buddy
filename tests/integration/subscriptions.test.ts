import { describe, expect, it } from 'vitest';
import { db } from '@/server/db';
import { subscriptions } from '@/server/db/schema';
import { getActiveSubscriptions } from '@/server/db/queries/subscriptions';
import { buildSubscription } from '../fixtures/builders';

describe('getActiveSubscriptions', () => {
  // Same pattern as tests/integration/db.test.ts: tx.rollback() throws
  // internally, so db.transaction() rejects — that rejection is the
  // expected, successful outcome, not a failure.

  it('returns only subscriptions with status = active', async () => {
    await expect(
      db.transaction(async (tx) => {
        const [active] = await tx
          .insert(subscriptions)
          .values(buildSubscription({ name: 'Active Sub', status: 'active' }))
          .returning();
        await tx
          .insert(subscriptions)
          .values(buildSubscription({ name: 'Paused Sub', status: 'paused' }));
        await tx
          .insert(subscriptions)
          .values(buildSubscription({ name: 'Cancelled Sub', status: 'cancelled' }));
        if (!active) {
          throw new Error('Insert did not return a row');
        }

        const result = await getActiveSubscriptions(tx);

        expect(result.map((s) => s.id)).toEqual([active.id]);
        expect(result[0]?.name).toBe('Active Sub');

        tx.rollback();
      }),
    ).rejects.toThrow();
  });

  it('returns an empty array when there are no active subscriptions', async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.insert(subscriptions).values(buildSubscription({ status: 'paused' }));

        const result = await getActiveSubscriptions(tx);

        expect(result).toEqual([]);

        tx.rollback();
      }),
    ).rejects.toThrow();
  });
});