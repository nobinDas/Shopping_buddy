import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, type DbClient } from '@/server/db';
import { emailAccounts, detectedSignals } from '@/server/db/schema';
import {
  insertDetectedSignal,
  getPendingSignalsForAccount,
  markSignalDuplicate,
} from '@/server/db/queries/detection';
import { buildEmailAccount, buildDetectedSignal } from '../fixtures/builders';

async function createTestAccount(tx: DbClient) {
  const [account] = await tx.insert(emailAccounts).values(buildEmailAccount()).returning();
  if (!account) throw new Error('Insert did not return a row');
  return account;
}

describe('insertDetectedSignal', () => {
  it('inserts a new signal', async () => {
    await expect(
      db.transaction(async (tx) => {
        const account = await createTestAccount(tx);

        const signal = await insertDetectedSignal(buildDetectedSignal(account.id), tx);

        expect(signal?.signalType).toBe('renewal');
        expect(signal?.status).toBe('pending');

        tx.rollback();
      }),
    ).rejects.toThrow();
  });

  it('does nothing on a repeat (accountId, messageId) — a sync retry is a no-op', async () => {
    await expect(
      db.transaction(async (tx) => {
        const account = await createTestAccount(tx);

        await insertDetectedSignal(buildDetectedSignal(account.id, { messageId: 'm1' }), tx);
        const result = await insertDetectedSignal(
          buildDetectedSignal(account.id, { messageId: 'm1', vendorKey: 'different vendor' }),
          tx,
        );

        expect(result).toBeUndefined();

        const all = await tx.select().from(detectedSignals).where(eq(detectedSignals.accountId, account.id));
        expect(all).toHaveLength(1);
        expect(all[0]?.vendorKey).toBe('test vendor');

        tx.rollback();
      }),
    ).rejects.toThrow();
  });
});

describe('getPendingSignalsForAccount / markSignalDuplicate', () => {
  it('returns only pending signals, and excludes ones already marked duplicate', async () => {
    await expect(
      db.transaction(async (tx) => {
        const account = await createTestAccount(tx);

        const survivor = await insertDetectedSignal(
          buildDetectedSignal(account.id, { messageId: 'm1' }),
          tx,
        );
        const loser = await insertDetectedSignal(
          buildDetectedSignal(account.id, { messageId: 'm2' }),
          tx,
        );
        if (!survivor || !loser) throw new Error('Insert did not return a row');

        await markSignalDuplicate(loser.id, survivor.id, tx);

        const pending = await getPendingSignalsForAccount(account.id, tx);
        expect(pending.map((s) => s.id)).toEqual([survivor.id]);

        tx.rollback();
      }),
    ).rejects.toThrow();
  });
});
