import { eq } from 'drizzle-orm';
import { db, type DbClient } from '@/server/db';
import { subscriptions } from '@/server/db/schema';

export type ActiveSubscription = typeof subscriptions.$inferSelect;

/**
 * Fetches every subscription with status = 'active'. A thin I/O wrapper
 * around Drizzle — no business logic lives here. Callers shape the result
 * into whatever domain/ functions need next (burn.ts's BurnSubscription,
 * billing-cycle.ts's NextBillingDateInput), since domain/ can't import
 * this file itself (see docs/ARCHITECTURE.md).
 *
 * No ordering is applied here — the "next billing date" a consumer cares
 * about is usually recomputed from anchorDate/cycle rather than trusted
 * from the stored column (see src/app/(dashboard)/page.tsx for why), so
 * this function makes no assumption about which order a caller wants.
 *
 * Accepts an optional client, defaulting to the module-level `db`
 * singleton, so integration tests can pass a transaction and see rows
 * inserted earlier in that same transaction before it's rolled back.
 */
export async function getActiveSubscriptions(client: DbClient = db): Promise<ActiveSubscription[]> {
  return client.select().from(subscriptions).where(eq(subscriptions.status, 'active'));
}