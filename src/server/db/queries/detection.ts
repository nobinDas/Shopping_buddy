import { and, eq } from 'drizzle-orm';
import { db, type DbClient } from '@/server/db';
import { detectedSignals } from '@/server/db/schema';

export type DetectedSignalRow = typeof detectedSignals.$inferSelect;
export type NewDetectedSignal = typeof detectedSignals.$inferInsert;

/**
 * Inserts one signal, or does nothing if this (accountId, messageId) was
 * already processed — the unique index is what makes a sync retry safe,
 * see docs/DATA_MODEL.md. Returns undefined on conflict, same
 * onConflictDoNothing pattern used by db/queries/stores.ts#insertStore.
 */
export async function insertDetectedSignal(
  values: NewDetectedSignal,
  client: DbClient = db,
): Promise<DetectedSignalRow | undefined> {
  const [row] = await client
    .insert(detectedSignals)
    .values(values)
    .onConflictDoNothing()
    .returning();
  return row;
}

/** Every `pending` signal for one account — dedup runs over this set after a sync batch. */
export async function getPendingSignalsForAccount(
  accountId: string,
  client: DbClient = db,
): Promise<DetectedSignalRow[]> {
  return client
    .select()
    .from(detectedSignals)
    .where(and(eq(detectedSignals.accountId, accountId), eq(detectedSignals.status, 'pending')));
}

export async function markSignalDuplicate(
  id: string,
  supersededBy: string,
  client: DbClient = db,
): Promise<void> {
  await client
    .update(detectedSignals)
    .set({ status: 'merged_duplicate', supersededBy })
    .where(eq(detectedSignals.id, id));
}
