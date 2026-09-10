import { eq } from 'drizzle-orm';
import { db, type DbClient } from '@/server/db';
import { emailAccounts } from '@/server/db/schema';

export type EmailAccountRow = typeof emailAccounts.$inferSelect;
export type NewEmailAccount = typeof emailAccounts.$inferInsert;

/** Fetches every connected inbox, regardless of status. */
export async function getAllEmailAccounts(client: DbClient = db): Promise<EmailAccountRow[]> {
  return client.select().from(emailAccounts);
}

export async function getEmailAccountById(
  id: string,
  client: DbClient = db,
): Promise<EmailAccountRow | undefined> {
  const [row] = await client.select().from(emailAccounts).where(eq(emailAccounts.id, id));
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
