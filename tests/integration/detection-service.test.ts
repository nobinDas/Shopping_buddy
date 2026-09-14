import { describe, expect, it, vi, beforeEach } from 'vitest';
import { db, type DbClient } from '@/server/db';
import { emailAccounts, detectedSignals } from '@/server/db/schema';
import { eq } from 'drizzle-orm';
import { syncAccount } from '@/server/services/detection.service';
import { encryptToken } from '@/server/providers/crypto';
import { buildEmailAccount } from '../fixtures/builders';

// docs/TESTING.md: "External providers mocked at the adapter boundary in
// src/server/providers/" — providers/gmail.ts and providers/anthropic.ts are
// mocked here; the DB side runs for real against Postgres inside a
// rolled-back transaction.
vi.mock('@/server/providers/gmail', () => ({
  listHistory: vi.fn(),
  getMessageMetadata: vi.fn(),
  getMessageBody: vi.fn(),
}));
vi.mock('@/server/providers/anthropic', () => ({
  classifyEmail: vi.fn(),
}));

const gmail = await import('@/server/providers/gmail');
const anthropic = await import('@/server/providers/anthropic');

beforeEach(() => {
  vi.mocked(gmail.listHistory).mockReset();
  vi.mocked(gmail.getMessageMetadata).mockReset();
  vi.mocked(gmail.getMessageBody).mockReset();
  vi.mocked(anthropic.classifyEmail).mockReset();
});

// process.env['TOKEN_ENCRYPTION_KEY'] is already set for the whole suite
// (see vitest.config.mts) — real encryptToken output, so
// getValidAccessToken's decrypt step is exercised for real, only the
// external Gmail/Claude calls are mocked.
async function createTestAccount(tx: DbClient) {
  const [account] = await tx
    .insert(emailAccounts)
    .values(
      buildEmailAccount({
        accessTokenEnc: encryptToken('test-access-token'),
        tokenExpiresAt: new Date(Date.now() + 3600_000),
      }),
    )
    .returning();
  if (!account) throw new Error('Insert did not return a row');
  return account;
}

describe('syncAccount', () => {
  it('creates no signal for a message that fails the pre-filter', async () => {
    await expect(
      db.transaction(async (tx) => {
        const account = await createTestAccount(tx);

        vi.mocked(gmail.listHistory).mockResolvedValue({ messageIds: ['m1'], newHistoryId: 'h1' });
        vi.mocked(gmail.getMessageMetadata).mockResolvedValue({
          subject: 'Dinner Friday?',
          from: 'friend@example.com',
          snippet: 'Want to grab dinner?',
        });

        const result = await syncAccount(account.id, tx);

        expect(result.signalsCreated).toBe(0);
        expect(gmail.getMessageBody).not.toHaveBeenCalled();
        expect(anthropic.classifyEmail).not.toHaveBeenCalled();

        tx.rollback();
      }),
    ).rejects.toThrow();
  });

  it('creates a signal with the right fields for a classified message', async () => {
    await expect(
      db.transaction(async (tx) => {
        const account = await createTestAccount(tx);

        vi.mocked(gmail.listHistory).mockResolvedValue({ messageIds: ['m1'], newHistoryId: 'h1' });
        vi.mocked(gmail.getMessageMetadata).mockResolvedValue({
          subject: 'Your Netflix receipt',
          from: 'billing@netflix.com',
          snippet: 'You were charged $15.49',
        });
        vi.mocked(gmail.getMessageBody).mockResolvedValue({
          subject: 'Your Netflix receipt',
          from: 'billing@netflix.com',
          body: 'You were charged $15.49 for your monthly subscription.',
          receivedAt: '2026-09-01',
        });
        vi.mocked(anthropic.classifyEmail).mockResolvedValue({
          signalType: 'renewal',
          vendorName: 'Netflix',
          amountMinor: 1549,
          currency: 'USD',
          billingDate: '2026-09-01',
          confidence: 0.95,
        });

        const result = await syncAccount(account.id, tx);

        expect(result.signalsCreated).toBe(1);

        const [signal] = await tx
          .select()
          .from(detectedSignals)
          .where(eq(detectedSignals.accountId, account.id));
        expect(signal?.vendorKey).toBe('netflix');
        expect(signal?.amountMinor).toBe(1549);
        expect(signal?.signalType).toBe('renewal');

        tx.rollback();
      }),
    ).rejects.toThrow();
  });

  it('is a no-op on a repeat sync of the same message', async () => {
    await expect(
      db.transaction(async (tx) => {
        const account = await createTestAccount(tx);

        vi.mocked(gmail.listHistory).mockResolvedValue({ messageIds: ['m1'], newHistoryId: 'h1' });
        vi.mocked(gmail.getMessageMetadata).mockResolvedValue({
          subject: 'Your Netflix receipt',
          from: 'billing@netflix.com',
          snippet: 'Charged $15.49',
        });
        vi.mocked(gmail.getMessageBody).mockResolvedValue({
          subject: 'Your Netflix receipt',
          from: 'billing@netflix.com',
          body: 'Charged $15.49',
          receivedAt: '2026-09-01',
        });
        vi.mocked(anthropic.classifyEmail).mockResolvedValue({
          signalType: 'renewal',
          vendorName: 'Netflix',
          amountMinor: 1549,
          currency: 'USD',
          billingDate: '2026-09-01',
          confidence: 0.9,
        });

        await syncAccount(account.id, tx);
        // Second sync sees the same message id again (e.g. the account's
        // syncCursor didn't advance for some reason) — must not duplicate.
        const second = await syncAccount(account.id, tx);

        expect(second.signalsCreated).toBe(0);

        const all = await tx
          .select()
          .from(detectedSignals)
          .where(eq(detectedSignals.accountId, account.id));
        expect(all).toHaveLength(1);

        tx.rollback();
      }),
    ).rejects.toThrow();
  });

  it('collapses two duplicate messages via dedup, keeping the higher-confidence one', async () => {
    await expect(
      db.transaction(async (tx) => {
        const account = await createTestAccount(tx);

        vi.mocked(gmail.listHistory).mockResolvedValue({
          messageIds: ['m1', 'm2'],
          newHistoryId: 'h1',
        });
        vi.mocked(gmail.getMessageMetadata).mockResolvedValue({
          subject: 'Your Netflix receipt',
          from: 'billing@netflix.com',
          snippet: 'Charged $15.49',
        });
        vi.mocked(gmail.getMessageBody).mockResolvedValue({
          subject: 'Your Netflix receipt',
          from: 'billing@netflix.com',
          body: 'Charged $15.49',
          receivedAt: '2026-09-01',
        });
        vi.mocked(anthropic.classifyEmail)
          .mockResolvedValueOnce({
            signalType: 'renewal',
            vendorName: 'Netflix',
            amountMinor: 1549,
            currency: 'USD',
            billingDate: '2026-09-01',
            confidence: 0.7,
          })
          .mockResolvedValueOnce({
            signalType: 'renewal',
            vendorName: 'Netflix',
            amountMinor: 1549,
            currency: 'USD',
            billingDate: '2026-09-01',
            confidence: 0.95,
          });

        const result = await syncAccount(account.id, tx);

        expect(result.signalsCreated).toBe(2);
        expect(result.duplicatesMerged).toBe(1);

        const all = await tx
          .select()
          .from(detectedSignals)
          .where(eq(detectedSignals.accountId, account.id));
        const pending = all.filter((s) => s.status === 'pending');
        const merged = all.filter((s) => s.status === 'merged_duplicate');
        expect(pending).toHaveLength(1);
        expect(merged).toHaveLength(1);
        expect(Number(pending[0]?.confidence)).toBeCloseTo(0.95);

        tx.rollback();
      }),
    ).rejects.toThrow();
  });

  it('does not abort the whole sync when classification fails for one message', async () => {
    await expect(
      db.transaction(async (tx) => {
        const account = await createTestAccount(tx);

        vi.mocked(gmail.listHistory).mockResolvedValue({
          messageIds: ['m1', 'm2'],
          newHistoryId: 'h1',
        });
        vi.mocked(gmail.getMessageMetadata).mockResolvedValue({
          subject: 'Your Netflix receipt',
          from: 'billing@netflix.com',
          snippet: 'Charged $15.49',
        });
        vi.mocked(gmail.getMessageBody)
          .mockRejectedValueOnce(new Error('Gmail API responded 500'))
          .mockResolvedValueOnce({
            subject: 'Your Netflix receipt',
            from: 'billing@netflix.com',
            body: 'Charged $15.49',
            receivedAt: '2026-09-01',
          });
        vi.mocked(anthropic.classifyEmail).mockResolvedValue({
          signalType: 'renewal',
          vendorName: 'Netflix',
          amountMinor: 1549,
          currency: 'USD',
          billingDate: '2026-09-01',
          confidence: 0.9,
        });

        const result = await syncAccount(account.id, tx);

        expect(result.signalsCreated).toBe(1);

        tx.rollback();
      }),
    ).rejects.toThrow();
  });

  it('updates the account syncCursor and lastSyncedAt', async () => {
    await expect(
      db.transaction(async (tx) => {
        const account = await createTestAccount(tx);
        expect(account.syncCursor).toBeNull();

        vi.mocked(gmail.listHistory).mockResolvedValue({ messageIds: [], newHistoryId: 'h-new' });

        await syncAccount(account.id, tx);

        const [updated] = await tx.select().from(emailAccounts).where(eq(emailAccounts.id, account.id));
        expect(updated?.syncCursor).toBe('h-new');
        expect(updated?.lastSyncedAt).not.toBeNull();

        tx.rollback();
      }),
    ).rejects.toThrow();
  });
});
