import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db';
import { priceHistory, subscriptions } from '@/server/db/schema';
import {
  createSubscription,
  updateSubscription,
  archiveSubscription,
} from '@/server/services/subscription.service';
import { buildSubscription } from '../fixtures/builders';

// Same pattern as tests/integration/db.test.ts: tx.rollback() throws
// internally, so db.transaction() rejects — that rejection is the
// expected, successful outcome, not a failure. Each service function
// accepts the outer `tx` as its own client, so its internal
// db.transaction/insert calls become nested savepoints inside this
// rolled-back transaction rather than a separate, uncontrolled write.

const validInput = {
  name: 'Netflix',
  amountMinor: 1599,
  currency: 'USD',
  cycle: 'monthly' as const,
  anchorDate: '2026-01-15',
  category: 'media' as const,
};

describe('createSubscription', () => {
  it('derives vendorKey and nextBillingDate rather than trusting caller input', async () => {
    await expect(
      db.transaction(async (tx) => {
        const created = await createSubscription(validInput, tx);

        expect(created.vendorKey).toBe('netflix');
        expect(created.nextBillingDate).toBe('2026-01-15');
        expect(created.source).toBe('manual');
        expect(created.status).toBe('active');

        tx.rollback();
      }),
    ).rejects.toThrow();
  });

  it('writes a starting price_history row effective from the anchor date', async () => {
    await expect(
      db.transaction(async (tx) => {
        const created = await createSubscription(validInput, tx);

        const history = await tx
          .select()
          .from(priceHistory)
          .where(eq(priceHistory.subscriptionId, created.id));
        expect(history).toHaveLength(1);
        expect(history[0]?.amountMinor).toBe(1599);
        expect(history[0]?.effectiveFrom).toBe('2026-01-15');
        expect(history[0]?.source).toBe('manual');

        tx.rollback();
      }),
    ).rejects.toThrow();
  });
});

describe('updateSubscription', () => {
  it('does not write a new price_history row when the amount is unchanged', async () => {
    await expect(
      db.transaction(async (tx) => {
        const created = await createSubscription(validInput, tx);

        await updateSubscription(created.id, { ...validInput, name: 'Netflix Premium' }, tx);

        // Only the starting row from createSubscription — the no-op price
        // update must not add a second one.
        const history = await tx
          .select()
          .from(priceHistory)
          .where(eq(priceHistory.subscriptionId, created.id));
        expect(history).toHaveLength(1);
        expect(history[0]?.amountMinor).toBe(1599);

        tx.rollback();
      }),
    ).rejects.toThrow();
  });

  it('appends a second price_history row when the amount changes', async () => {
    await expect(
      db.transaction(async (tx) => {
        const created = await createSubscription(validInput, tx);

        const updated = await updateSubscription(
          created.id,
          { ...validInput, amountMinor: 1799 },
          tx,
        );

        expect(updated.amountMinor).toBe(1799);

        const history = await tx
          .select()
          .from(priceHistory)
          .where(eq(priceHistory.subscriptionId, created.id));
        expect(history).toHaveLength(2);
        expect(history.map((row) => row.amountMinor).sort()).toEqual([1599, 1799]);
        expect(history.every((row) => row.source === 'manual')).toBe(true);

        tx.rollback();
      }),
    ).rejects.toThrow();
  });

  it('throws for a subscription id that does not exist', async () => {
    await expect(
      db.transaction(async (tx) => {
        await updateSubscription('00000000-0000-0000-0000-000000000000', validInput, tx);
      }),
    ).rejects.toThrow();
  });
});

describe('archiveSubscription', () => {
  it('sets status to archived without deleting the row', async () => {
    await expect(
      db.transaction(async (tx) => {
        const [created] = await tx
          .insert(subscriptions)
          .values(buildSubscription({ status: 'active' }))
          .returning();
        if (!created) {
          throw new Error('Insert did not return a row');
        }

        const archived = await archiveSubscription(created.id, tx);

        expect(archived.status).toBe('archived');
        expect(archived.id).toBe(created.id);

        tx.rollback();
      }),
    ).rejects.toThrow();
  });
});
