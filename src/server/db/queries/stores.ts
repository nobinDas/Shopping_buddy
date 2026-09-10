import { eq } from 'drizzle-orm';
import { db, type DbClient } from '@/server/db';
import { preferredStores } from '@/server/db/schema';

export type PreferredStoreRow = typeof preferredStores.$inferSelect;

export async function getAllStores(client: DbClient = db): Promise<PreferredStoreRow[]> {
  return client.select().from(preferredStores);
}

/**
 * Inserts a store, or does nothing if the name already exists —
 * enforced by the database (preferred_stores_name_idx), not by
 * client-side array scanning the way the Phase 1.5 mock did it.
 * Returns the row either way isn't guaranteed by onConflictDoNothing,
 * so callers that need the row back should re-select if this returns
 * undefined.
 */
export async function insertStore(
  name: string,
  client: DbClient = db,
): Promise<PreferredStoreRow | undefined> {
  const [row] = await client
    .insert(preferredStores)
    .values({ name })
    .onConflictDoNothing()
    .returning();
  return row;
}

export async function deleteStore(id: string, client: DbClient = db): Promise<void> {
  await client.delete(preferredStores).where(eq(preferredStores.id, id));
}
