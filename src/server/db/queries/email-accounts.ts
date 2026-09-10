import { and, eq } from 'drizzle-orm';
import { db, type DbClient } from '@/server/db';
import { emailAccounts } from '@/server/db/schema';

export type EmailAccountRow = typeof emailAccounts.$inferSelect;
export type NewEmailAccount = typeof emailAccounts.$inferInsert;

/**
 * The subset of a connected account's columns safe to render — every
 * field except the two encrypted-token buffers. Used for anything that
 * crosses a Server → Client Component boundary: see docs/SECURITY.md,
 * "Tokens never leave src/server/. Never returned from an API route,
 * never in a Server Component's serialised props." Selecting these
 * columns explicitly at the query level means a future caller can't
 * accidentally leak the ciphertext by forgetting to strip it downstream.
 */
export type EmailAccountSummary = Omit<EmailAccountRow, 'accessTokenEnc' | 'refreshTokenEnc'>;

/**
 * Fetches every connected inbox, regardless of status, for anything that
 * only needs to render the list — never returns the token columns. Use
 * getEmailAccountById (or a full select) when the caller actually needs
 * to decrypt a token, e.g. a services/ function refreshing or revoking.
 */
export async function getAllEmailAccounts(client: DbClient = db): Promise<EmailAccountSummary[]> {
  return client
    .select({
      id: emailAccounts.id,
      provider: emailAccounts.provider,
      emailAddress: emailAccounts.emailAddress,
      tokenExpiresAt: emailAccounts.tokenExpiresAt,
      syncCursor: emailAccounts.syncCursor,
      lastSyncedAt: emailAccounts.lastSyncedAt,
      status: emailAccounts.status,
      createdAt: emailAccounts.createdAt,
      updatedAt: emailAccounts.updatedAt,
    })
    .from(emailAccounts);
}

export async function getEmailAccountById(
  id: string,
  client: DbClient = db,
): Promise<EmailAccountRow | undefined> {
  const [row] = await client.select().from(emailAccounts).where(eq(emailAccounts.id, id));
  return row;
}

/**
 * Finds an account by (provider, emailAddress) — lets the connect flow
 * find-or-update instead of inserting a duplicate row when the same
 * address is connected again (a genuine reconnect, or clicking Connect
 * twice). No separate reconnect code path exists because of this.
 */
export async function getEmailAccountByProviderAndEmail(
  provider: EmailAccountRow['provider'],
  emailAddress: string,
  client: DbClient = db,
): Promise<EmailAccountRow | undefined> {
  const [row] = await client
    .select()
    .from(emailAccounts)
    .where(and(eq(emailAccounts.provider, provider), eq(emailAccounts.emailAddress, emailAddress)));
  return row;
}

export async function insertEmailAccount(
  values: NewEmailAccount,
  client: DbClient = db,
): Promise<EmailAccountRow> {
  const [row] = await client.insert(emailAccounts).values(values).returning();
  if (!row) {
    throw new Error('insertEmailAccount: insert did not return a row');
  }
  return row;
}

/**
 * Updates arbitrary columns on one connected account — e.g. a refreshed
 * token pair after a successful token-refresh call, a new sync_cursor and
 * last_synced_at after a sync run, or status: 'needs_reauth' when a
 * refresh fails. No business logic here; a services layer (not built this
 * pass — see docs/PHASES.md 1c) decides what changes.
 */
export async function updateEmailAccountRow(
  id: string,
  values: Partial<NewEmailAccount>,
  client: DbClient = db,
): Promise<EmailAccountRow> {
  const [row] = await client
    .update(emailAccounts)
    .set(values)
    .where(eq(emailAccounts.id, id))
    .returning();
  if (!row) {
    throw new Error(`updateEmailAccountRow: no email account with id ${id}`);
  }
  return row;
}

/**
 * Permanently deletes a connected account's row. Unlike subscriptions'
 * soft-archive pattern, this is a real hard delete — see docs/SECURITY.md:
 * "Disconnecting an account revokes the token with the provider *and*
 * deletes the local record. Deleting locally without revoking leaves live
 * access behind." Revoking with the provider is the caller's
 * responsibility (a services-layer concern, not built this pass); this
 * function only removes the local row.
 */
export async function deleteEmailAccount(id: string, client: DbClient = db): Promise<void> {
  await client.delete(emailAccounts).where(eq(emailAccounts.id, id));
}
