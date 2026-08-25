import { describe, expect, it } from 'vitest';
import { db } from '@/server/db';
import { subscriptions, priceHistory } from '@/server/db/schema';
import {
  getActiveSubscriptions,
  getPriceHistoryForSubscription,
} from '@/server/db/queries/subscriptions';
import { buildSubscription, buildPriceHistory } from '../fixtures/builders';

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

describe('getPriceHistoryForSubscription', () => {
  it('returns rows oldest first regardless of insertion order', async () => {
    await expect(
      db.transaction(async (tx) => {
        const [sub] = await tx.insert(subscriptions).values(buildSubscription()).returning();
        if (!sub) {
          throw new Error('Insert did not return a row');
        }

        // Inserted newest-first, on purpose — the query's own ORDER BY is
        // what must produce oldest-first, not insertion order.
        await tx
          .insert(priceHistory)
          .values(buildPriceHistory(sub.id, { amountMinor: 1799, effectiveFrom: '2026-03-01' }));
        await tx
          .insert(priceHistory)
          .values(buildPriceHistory(sub.id, { amountMinor: 1599, effectiveFrom: '2026-01-01' }));

        const history = await getPriceHistoryForSubscription(sub.id, tx);

        expect(history.map((row) => row.effectiveFrom)).toEqual(['2026-01-01', '2026-03-01']);
        expect(history.map((row) => row.amountMinor)).toEqual([1599, 1799]);

        tx.rollback();
      }),
    ).rejects.toThrow();
  });

  it('returns an empty array for a subscription with no price history', async () => {
    await expect(
      db.transaction(async (tx) => {
        const [sub] = await tx.insert(subscriptions).values(buildSubscription()).returning();
        if (!sub) {
          throw new Error('Insert did not return a row');
        }

        const history = await getPriceHistoryForSubscription(sub.id, tx);

        expect(history).toEqual([]);

        tx.rollback();
      }),
    ).rejects.toThrow();
  });
});