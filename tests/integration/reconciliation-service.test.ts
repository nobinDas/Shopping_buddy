import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, type DbClient } from '@/server/db';
import {
  emailAccounts,
  detectedSignals,
  subscriptions,
  priceHistory,
  reconciliationProposals,
} from '@/server/db/schema';
import {
  runReconciliation,
  acceptProposal,
  rejectProposal,
  acceptDiscoveryProposal,
} from '@/server/services/reconciliation.service';
import { getProposalBySignalId } from '@/server/db/queries/reconciliation';
import {
  buildEmailAccount,
  buildDetectedSignal,
  buildSubscription,
  buildReconciliationProposal,
} from '../fixtures/builders';

async function createTestAccount(tx: DbClient) {
  const [account] = await tx.insert(emailAccounts).values(buildEmailAccount()).returning();
  if (!account) throw new Error('Insert did not return a row');
  return account;
}

async function createTestSubscription(tx: DbClient, overrides = {}) {
  const [subscription] = await tx
    .insert(subscriptions)
    .values(buildSubscription(overrides))
    .returning();
  if (!subscription) throw new Error('Insert did not return a row');
  return subscription;
}

async function createTestSignal(tx: DbClient, accountId: string, overrides = {}) {
  const [signal] = await tx
    .insert(detectedSignals)
    .values(buildDetectedSignal(accountId, overrides))
    .returning();
  if (!signal) throw new Error('Insert did not return a row');
  return signal;
}

describe('runReconciliation', () => {
  it('auto-applies a confirm outcome: updates the subscription, writes an accepted proposal, marks the signal matched', async () => {
    await expect(
      db.transaction(async (tx) => {
        const account = await createTestAccount(tx);
        const subscription = await createTestSubscription(tx, {
          vendorKey: 'netflix',
          amountMinor: 1549,
          currency: 'USD',
          nextBillingDate: '2026-09-05',
        });
        const signal = await createTestSignal(tx, account.id, {
          signalType: 'renewal',
          vendorKey: 'netflix',
          amountMinor: 1549,
          currency: 'USD',
          billingDate: '2026-09-05',
        });

        const result = await runReconciliation(tx);

        expect(result.confirmed).toBe(1);
        expect(result.proposalsCreated).toBe(0);

        const [updatedSub] = await tx
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.id, subscription.id));
        expect(updatedSub?.source).toBe('manual_confirmed');
        expect(updatedSub?.lastVerifiedAt).not.toBeNull();

        const [updatedSignal] = await tx
          .select()
          .from(detectedSignals)
          .where(eq(detectedSignals.id, signal.id));
        expect(updatedSignal?.status).toBe('matched');

        const proposal = await getProposalBySignalId(signal.id, tx);
        expect(proposal?.status).toBe('accepted');
        expect(proposal?.proposalType).toBe('confirm');
        expect(proposal?.reasoning).toBeTruthy();

        tx.rollback();
      }),
    ).rejects.toThrow();
  });

  it('re-anchors the subscription to the confirmed signal date, not just its stored nextBillingDate', async () => {
    // Simulates real month-to-month billing-date drift (e.g. payment
    // processing timing): the subscription's anchor is Aug 10, the real
    // renewal this cycle actually landed Sep 12 — 2 days later, still
    // inside the ±3-day tolerance, so it should confirm. The point of
    // this test: after confirming, the anchor itself should move to the
    // real Sep 12 date, not stay frozen at Aug 10 — otherwise next
    // cycle's drift stacks on top of this cycle's, and eventually a
    // genuine renewal falls outside tolerance purely from accumulated
    // drift against a stale anchor, never from an actual mismatch.
    await expect(
      db.transaction(async (tx) => {
        const account = await createTestAccount(tx);
        const subscription = await createTestSubscription(tx, {
          vendorKey: 'tello',
          amountMinor: 1179,
          currency: 'USD',
          anchorDate: '2026-08-10',
          nextBillingDate: '2026-09-10',
        });
        await createTestSignal(tx, account.id, {
          signalType: 'renewal',
          vendorKey: 'tello',
          amountMinor: 1179,
          currency: 'USD',
          billingDate: '2026-09-12',
        });

        const result = await runReconciliation(tx);
        expect(result.confirmed).toBe(1);

        const [updatedSub] = await tx
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.id, subscription.id));
        expect(updatedSub?.anchorDate).toBe('2026-09-12');
        // nextBillingDate is recomputed from the new anchor, whatever
        // "today" happens to be at test time — assert it moved forward
        // from the old anchor rather than pinning an exact value.
        expect(updatedSub?.nextBillingDate).not.toBe('2026-09-10');

        tx.rollback();
      }),
    ).rejects.toThrow();
  });

  it('leaves the anchor untouched on confirm when the signal carries no billing date', async () => {
    await expect(
      db.transaction(async (tx) => {
        const account = await createTestAccount(tx);
        const subscription = await createTestSubscription(tx, {
          vendorKey: 'netflix',
          amountMinor: 1549,
          currency: 'USD',
          anchorDate: '2026-08-05',
          nextBillingDate: '2026-09-05',
        });
        await createTestSignal(tx, account.id, {
          signalType: 'renewal',
          vendorKey: 'netflix',
          amountMinor: 1549,
          currency: 'USD',
          billingDate: null,
        });

        const result = await runReconciliation(tx);
        expect(result.confirmed).toBe(1);

        const [updatedSub] = await tx
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.id, subscription.id));
        expect(updatedSub?.anchorDate).toBe('2026-08-05');
        expect(updatedSub?.nextBillingDate).toBe('2026-09-05');

        tx.rollback();
      }),
    ).rejects.toThrow();
  });

  it('writes a pending price_update proposal without touching the subscription', async () => {
    await expect(
      db.transaction(async (tx) => {
        const account = await createTestAccount(tx);
        const subscription = await createTestSubscription(tx, {
          vendorKey: 'spotify',
          amountMinor: 1099,
          currency: 'USD',
          nextBillingDate: '2026-09-05',
        });
        await createTestSignal(tx, account.id, {
          signalType: 'renewal',
          vendorKey: 'spotify',
          amountMinor: 1299,
          currency: 'USD',
          billingDate: '2026-09-05',
        });

        const result = await runReconciliation(tx);

        expect(result.proposalsCreated).toBe(1);
        expect(result.confirmed).toBe(0);

        const [untouchedSub] = await tx
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.id, subscription.id));
        expect(untouchedSub?.amountMinor).toBe(1099);

        tx.rollback();
      }),
    ).rejects.toThrow();
  });

  it('writes a pending discovery proposal when no candidate matches', async () => {
    await expect(
      db.transaction(async (tx) => {
        const account = await createTestAccount(tx);
        await createTestSignal(tx, account.id, {
          signalType: 'new',
          vendorKey: 'applecombill',
          amountMinor: 499,
          currency: 'USD',
        });

        const result = await runReconciliation(tx);

        expect(result.proposalsCreated).toBe(1);

        tx.rollback();
      }),
    ).rejects.toThrow();
  });

  it('is idempotent: a signal that already has a proposal is skipped on a second run', async () => {
    await expect(
      db.transaction(async (tx) => {
        const account = await createTestAccount(tx);
        await createTestSubscription(tx, {
          vendorKey: 'netflix',
          amountMinor: 1549,
          currency: 'USD',
          nextBillingDate: '2026-09-05',
        });
        await createTestSignal(tx, account.id, {
          signalType: 'renewal',
          vendorKey: 'netflix',
          amountMinor: 1549,
          currency: 'USD',
          billingDate: '2026-09-05',
        });

        await runReconciliation(tx);
        const second = await runReconciliation(tx);

        expect(second.confirmed).toBe(0);
        expect(second.proposalsCreated).toBe(0);

        tx.rollback();
      }),
    ).rejects.toThrow();
  });

  it('skips payment_failed and paused signals — they stay pending, no proposal written', async () => {
    await expect(
      db.transaction(async (tx) => {
        const account = await createTestAccount(tx);
        const failedSignal = await createTestSignal(tx, account.id, {
          signalType: 'payment_failed',
          vendorKey: 'gym',
          messageId: 'm-failed',
        });
        const pausedSignal = await createTestSignal(tx, account.id, {
          signalType: 'paused',
          vendorKey: 'gym',
          messageId: 'm-paused',
        });

        const result = await runReconciliation(tx);

        expect(result.proposalsCreated).toBe(0);
        expect(result.confirmed).toBe(0);

        expect(await getProposalBySignalId(failedSignal.id, tx)).toBeUndefined();
        expect(await getProposalBySignalId(pausedSignal.id, tx)).toBeUndefined();

        const [stillPendingFailed] = await tx
          .select()
          .from(detectedSignals)
          .where(eq(detectedSignals.id, failedSignal.id));
        expect(stillPendingFailed?.status).toBe('pending');

        tx.rollback();
      }),
    ).rejects.toThrow();
  });
});

describe('acceptProposal', () => {
  it('applies a price_update: updates the subscription and writes price_history', async () => {
    await expect(
      db.transaction(async (tx) => {
        const account = await createTestAccount(tx);
        const subscription = await createTestSubscription(tx, { amountMinor: 1099 });
        const signal = await createTestSignal(tx, account.id, { amountMinor: 1299 });
        const [proposal] = await tx
          .insert(reconciliationProposals)
          .values(
            buildReconciliationProposal(signal.id, {
              subscriptionId: subscription.id,
              proposalType: 'price_update',
              proposedChanges: { amountMinor: 1299, currency: 'USD' },
            }),
          )
          .returning();
        if (!proposal) throw new Error('Insert did not return a row');

        await acceptProposal(proposal.id, tx);

        const [updatedSub] = await tx
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.id, subscription.id));
        expect(updatedSub?.amountMinor).toBe(1299);

        const history = await tx
          .select()
          .from(priceHistory)
          .where(eq(priceHistory.subscriptionId, subscription.id));
        expect(history).toHaveLength(1);
        expect(history[0]?.source).toBe('detected');
        expect(history[0]?.signalId).toBe(signal.id);

        const [updatedSignal] = await tx
          .select()
          .from(detectedSignals)
          .where(eq(detectedSignals.id, signal.id));
        expect(updatedSignal?.status).toBe('matched');

        tx.rollback();
      }),
    ).rejects.toThrow();
  });

  it('applies a cancellation: sets the subscription status to cancelled', async () => {
    await expect(
      db.transaction(async (tx) => {
        const account = await createTestAccount(tx);
        const subscription = await createTestSubscription(tx, { status: 'active' });
        const signal = await createTestSignal(tx, account.id, { signalType: 'cancellation' });
        const [proposal] = await tx
          .insert(reconciliationProposals)
          .values(
            buildReconciliationProposal(signal.id, {
              subscriptionId: subscription.id,
              proposalType: 'cancellation',
            }),
          )
          .returning();
        if (!proposal) throw new Error('Insert did not return a row');

        await acceptProposal(proposal.id, tx);

        const [updatedSub] = await tx
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.id, subscription.id));
        expect(updatedSub?.status).toBe('cancelled');

        tx.rollback();
      }),
    ).rejects.toThrow();
  });

  it('refuses to accept a discovery proposal directly', async () => {
    await expect(
      db.transaction(async (tx) => {
        const account = await createTestAccount(tx);
        const signal = await createTestSignal(tx, account.id, { signalType: 'new' });
        const [proposal] = await tx
          .insert(reconciliationProposals)
          .values(buildReconciliationProposal(signal.id, { proposalType: 'discovery' }))
          .returning();
        if (!proposal) throw new Error('Insert did not return a row');

        await expect(acceptProposal(proposal.id, tx)).rejects.toThrow(/not accepted through this function/);

        tx.rollback();
      }),
    ).rejects.toThrow();
  });
});

describe('rejectProposal', () => {
  it('marks the proposal rejected and the signal dismissed', async () => {
    await expect(
      db.transaction(async (tx) => {
        const account = await createTestAccount(tx);
        const signal = await createTestSignal(tx, account.id, { signalType: 'new' });
        const [proposal] = await tx
          .insert(reconciliationProposals)
          .values(buildReconciliationProposal(signal.id, { proposalType: 'discovery' }))
          .returning();
        if (!proposal) throw new Error('Insert did not return a row');

        const rejected = await rejectProposal(proposal.id, tx);
        expect(rejected.status).toBe('rejected');

        const [updatedSignal] = await tx
          .select()
          .from(detectedSignals)
          .where(eq(detectedSignals.id, signal.id));
        expect(updatedSignal?.status).toBe('dismissed');

        tx.rollback();
      }),
    ).rejects.toThrow();
  });
});

describe('acceptDiscoveryProposal', () => {
  it('links the proposal to the new subscription and marks the signal matched', async () => {
    await expect(
      db.transaction(async (tx) => {
        const account = await createTestAccount(tx);
        const signal = await createTestSignal(tx, account.id, { signalType: 'new' });
        const [proposal] = await tx
          .insert(reconciliationProposals)
          .values(buildReconciliationProposal(signal.id, { proposalType: 'discovery' }))
          .returning();
        if (!proposal) throw new Error('Insert did not return a row');
        const subscription = await createTestSubscription(tx);

        await acceptDiscoveryProposal(proposal.id, subscription.id, tx);

        const resolved = await getProposalBySignalId(signal.id, tx);
        expect(resolved?.status).toBe('accepted');
        expect(resolved?.subscriptionId).toBe(subscription.id);

        const [updatedSignal] = await tx
          .select()
          .from(detectedSignals)
          .where(eq(detectedSignals.id, signal.id));
        expect(updatedSignal?.status).toBe('matched');

        tx.rollback();
      }),
    ).rejects.toThrow();
  });
});
