import { db, type DbClient } from '@/server/db';
import {
  insertEmailAccount,
  updateEmailAccountRow,
  deleteEmailAccount,
  getEmailAccountByProviderAndEmail,
  type EmailAccountRow,
} from '@/server/db/queries/email-accounts';
import {
  exchangeCodeForTokens,
  refreshAccessToken,
  revokeToken,
  getUserInfo,
} from '@/server/providers/google';
import { encryptToken, decryptToken } from '@/server/providers/crypto';

/**
 * Completes a Google OAuth connect (or reconnect): exchanges the
 * authorization code, finds out which address it belongs to, encrypts
 * both tokens, and finds-or-updates the email_accounts row by (provider,
 * email) — see db/queries/email-accounts.ts's
 * getEmailAccountByProviderAndEmail for why connect and reconnect share
 * one code path rather than two.
 */
export async function connectGoogleAccount(
  code: string,
  client: DbClient = db,
): Promise<EmailAccountRow> {
  const tokens = await exchangeCodeForTokens(code);
  const { email } = await getUserInfo(tokens.accessToken);

  const values = {
    provider: 'google' as const,
    emailAddress: email,
    accessTokenEnc: encryptToken(tokens.accessToken),
    refreshTokenEnc: encryptToken(tokens.refreshToken),
    tokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
    status: 'active' as const,
  };

  const existing = await getEmailAccountByProviderAndEmail('google', email, client);
  if (existing) {
    return updateEmailAccountRow(existing.id, values, client);
  }
  return insertEmailAccount(values, client);
}

/**
 * Disconnects an account: revokes the token with Google first, then
 * deletes the local row. Both steps, in that order — see
 * docs/SECURITY.md: "Disconnecting an account revokes the token with the
 * provider *and* deletes the local record. Deleting locally without
 * revoking leaves live access behind."
 */
export async function disconnectAccount(
  account: EmailAccountRow,
  client: DbClient = db,
): Promise<void> {
  const refreshTokenPlain = decryptToken(account.refreshTokenEnc);
  await revokeToken(refreshTokenPlain);
  await deleteEmailAccount(account.id, client);
}

/**
 * Refreshes an account's access token. On failure — Google rejects the
 * refresh token because it was revoked or expired — moves the account to
 * needs_reauth rather than throwing an opaque error up to the caller,
 * since that's a normal, expected state (docs/PHASES.md 1c: "a clear
 * reconnect path when refresh fails"), not an exceptional one.
 *
 * Not called by anything yet — nothing fetches Gmail messages until
 * Phase 1d exists to need a fresh access token — but built and tested
 * now since it's explicitly scoped to 1c.
 */
export async function refreshAccountToken(
  account: EmailAccountRow,
  client: DbClient = db,
): Promise<EmailAccountRow> {
  const refreshTokenPlain = decryptToken(account.refreshTokenEnc);

  try {
    const { accessToken, expiresIn } = await refreshAccessToken(refreshTokenPlain);
    return await updateEmailAccountRow(
      account.id,
      {
        accessTokenEnc: encryptToken(accessToken),
        tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
        status: 'active',
      },
      client,
    );
  } catch {
    return updateEmailAccountRow(account.id, { status: 'needs_reauth' }, client);
  }
}
