import { describe, expect, it } from 'vitest';
import { db } from '@/server/db';
import {
  getAllEmailAccounts,
  getEmailAccountById,
  insertEmailAccount,
  updateEmailAccountRow,
  deleteEmailAccount,
} from '@/server/db/queries/email-accounts';
import { buildEmailAccount } from '../fixtures/builders';

// Same pattern as tests/integration/db.test.ts: tx.rollback() throws
// internally, so db.transaction() rejects — that rejection is the
// expected, successful outcome, not a failure.

describe('insertEmailAccount / getEmailAccountById', () => {
  it('inserts a row and reads it back', async () => {
    await expect(
      db.transaction(async (tx) => {
        const created = await insertEmailAccount(
          buildEmailAccount({ emailAddress: 'sam@gmail.com' }),
          tx,
        );

        expect(created.emailAddress).toBe('sam@gmail.com');
        expect(created.provider).toBe('google');
        expect(created.status).toBe('active');

        const fetched = await getEmailAccountById(created.id, tx);
        expect(fetched?.id).toBe(created.id);

        tx.rollback();
      }),
    ).rejects.toThrow();
  });

  it('returns undefined for an id that does not exist', async () => {
    await expect(
      db.transaction(async (tx) => {
        const result = await getEmailAccountById('00000000-0000-0000-0000-000000000000', tx);
        expect(result).toBeUndefined();

        tx.rollback();
      }),
    ).rejects.toThrow();
  });
});

describe('getAllEmailAccounts', () => {
  it('returns every account regardless of status', async () => {
    await expect(
      db.transaction(async (tx) => {
        const active = await insertEmailAccount(
          buildEmailAccount({ emailAddress: 'active@example.com', status: 'active' }),
          tx,
        );
        const disconnected = await insertEmailAccount(
          buildEmailAccount({
            emailAddress: 'disconnected@example.com',
            status: 'disconnected',
          }),
          tx,
        );

        const result = await getAllEmailAccounts(tx);

        expect(result.map((a) => a.id).sort()).toEqual([active.id, disconnected.id].sort());

        tx.rollback();
      }),
    ).rejects.toThrow();
  });
});

describe('updateEmailAccountRow', () => {
  it('updates the given columns and leaves the rest untouched', async () => {
    await expect(
      db.transaction(async (tx) => {
        const created = await insertEmailAccount(
          buildEmailAccount({ status: 'active', syncCursor: null }),
          tx,
        );

        const updated = await updateEmailAccountRow(
          created.id,
          { syncCursor: 'cursor-123', lastSyncedAt: new Date('2026-01-02T00:00:00Z') },
          tx,
        );

        expect(updated.syncCursor).toBe('cursor-123');
        expect(updated.emailAddress).toBe(created.emailAddress);
        expect(updated.status).toBe('active');

        tx.rollback();
      }),
    ).rejects.toThrow();
  });

  it('can move an account to needs_reauth', async () => {
    await expect(
      db.transaction(async (tx) => {
        const created = await insertEmailAccount(buildEmailAccount({ status: 'active' }), tx);

        const updated = await updateEmailAccountRow(created.id, { status: 'needs_reauth' }, tx);

        expect(updated.status).toBe('needs_reauth');

        tx.rollback();
      }),
    ).rejects.toThrow();
  });

  it('throws for an id that does not exist', async () => {
    await expect(
      db.transaction(async (tx) => {
        await updateEmailAccountRow(
          '00000000-0000-0000-0000-000000000000',
          { status: 'active' },
          tx,
        );
      }),
    ).rejects.toThrow();
  });
});

describe('deleteEmailAccount', () => {
  it('permanently removes the row', async () => {
    await expect(
      db.transaction(async (tx) => {
        const created = await insertEmailAccount(buildEmailAccount(), tx);

        await deleteEmailAccount(created.id, tx);

        const fetched = await getEmailAccountById(created.id, tx);
        expect(fetched).toBeUndefined();

        tx.rollback();
      }),
    ).rejects.toThrow();
  });
});
