import { describe, expect, it, vi, beforeEach } from 'vitest';
import { db } from '@/server/db';
import { emailAccounts } from '@/server/db/schema';
import {
  connectGoogleAccount,
  disconnectAccount,
  refreshAccountToken,
} from '@/server/services/email-account.service';
import { getEmailAccountById } from '@/server/db/queries/email-accounts';
import { encryptToken, decryptToken } from '@/server/providers/crypto';
import { buildEmailAccount } from '../fixtures/builders';

// docs/TESTING.md: "External providers mocked at the adapter boundary in
// src/server/providers/ — never mock Drizzle, or the tests stop testing
// the queries." So providers/google.ts is mocked here; the DB side runs
// for real against Postgres inside a rolled-back transaction, same
// pattern every other integration test file uses.
vi.mock('@/server/providers/google', () => ({
  exchangeCodeForTokens: vi.fn(),
  refreshAccessToken: vi.fn(),
  revokeToken: vi.fn(),
  getUserInfo: vi.fn(),
}));

const google = await import('@/server/providers/google');

beforeEach(() => {
  vi.mocked(google.exchangeCodeForTokens).mockReset();
  vi.mocked(google.refreshAccessToken).mockReset();
  vi.mocked(google.revokeToken).mockReset();
  vi.mocked(google.getUserInfo).mockReset();
});

// A real TOKEN_ENCRYPTION_KEY must already be set in .env.local for
// providers/crypto.ts (loaded by vitest.config.mts) — same requirement
// every crypto-touching test in this file relies on, not re-asserted per
// test.

describe('connectGoogleAccount', () => {
  it('inserts a new row with encrypted tokens that decrypt back to the originals', async () => {
    await expect(
      db.transaction(async (tx) => {
        vi.mocked(google.exchangeCodeForTokens).mockResolvedValue({
          accessToken: 'real-access-token',
          refreshToken: 'real-refresh-token',
          expiresIn: 3600,
        });
        vi.mocked(google.getUserInfo).mockResolvedValue({ email: 'sam@gmail.com' });

        const account = await connectGoogleAccount('some-auth-code', tx);

        expect(account.provider).toBe('google');
        expect(account.emailAddress).toBe('sam@gmail.com');
        expect(account.status).toBe('active');
        expect(decryptToken(account.accessTokenEnc)).toBe('real-access-token');
        expect(decryptToken(account.refreshTokenEnc)).toBe('real-refresh-token');

        tx.rollback();
      }),
    ).rejects.toThrow();
  });

  it('updates the existing row instead of duplicating when the same (provider, email) connects again', async () => {
    await expect(
      db.transaction(async (tx) => {
        vi.mocked(google.exchangeCodeForTokens).mockResolvedValue({
          accessToken: 'first-token',
          refreshToken: 'first-refresh',
          expiresIn: 3600,
        });
        vi.mocked(google.getUserInfo).mockResolvedValue({ email: 'sam@gmail.com' });
        const first = await connectGoogleAccount('code-1', tx);

        vi.mocked(google.exchangeCodeForTokens).mockResolvedValue({
          accessToken: 'second-token',
          refreshToken: 'second-refresh',
          expiresIn: 3600,
        });
        const second = await connectGoogleAccount('code-2', tx);

        expect(second.id).toBe(first.id);
        expect(decryptToken(second.accessTokenEnc)).toBe('second-token');

        tx.rollback();
      }),
    ).rejects.toThrow();
  });
});

describe('disconnectAccount', () => {
  it('revokes the refresh token with Google, then deletes the row', async () => {
    await expect(
      db.transaction(async (tx) => {
        const [created] = await tx
          .insert(emailAccounts)
          .values(buildEmailAccount({ refreshTokenEnc: encryptToken('the-real-refresh-token') }))
          .returning();
        if (!created) throw new Error('Insert did not return a row');

        const calls: string[] = [];
        vi.mocked(google.revokeToken).mockImplementation((token) => {
          calls.push(token);
          return Promise.resolve();
        });

        await disconnectAccount(created, tx);

        expect(calls).toEqual(['the-real-refresh-token']);
        const fetched = await getEmailAccountById(created.id, tx);
        expect(fetched).toBeUndefined();

        tx.rollback();
      }),
    ).rejects.toThrow();
  });
});

describe('refreshAccountToken', () => {
  it('re-encrypts a new access token on success and keeps status active', async () => {
    await expect(
      db.transaction(async (tx) => {
        const [created] = await tx
          .insert(emailAccounts)
          .values(buildEmailAccount({ status: 'active' }))
          .returning();
        if (!created) throw new Error('Insert did not return a row');

        vi.mocked(google.refreshAccessToken).mockResolvedValue({
          accessToken: 'refreshed-access-token',
          expiresIn: 3600,
        });

        const updated = await refreshAccountToken(created, tx);

        expect(updated.status).toBe('active');
        expect(decryptToken(updated.accessTokenEnc)).toBe('refreshed-access-token');

        tx.rollback();
      }),
    ).rejects.toThrow();
  });

  it('moves the account to needs_reauth when Google rejects the refresh token', async () => {
    await expect(
      db.transaction(async (tx) => {
        const [created] = await tx
          .insert(emailAccounts)
          .values(buildEmailAccount({ status: 'active' }))
          .returning();
        if (!created) throw new Error('Insert did not return a row');

        vi.mocked(google.refreshAccessToken).mockRejectedValue(new Error('invalid_grant'));

        const updated = await refreshAccountToken(created, tx);

        expect(updated.status).toBe('needs_reauth');

        tx.rollback();
      }),
    ).rejects.toThrow();
  });
});
