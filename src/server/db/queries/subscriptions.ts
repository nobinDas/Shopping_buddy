import { asc, eq, ne } from 'drizzle-orm';
import { db, type DbClient } from '@/server/db';
import { subscriptions, priceHistory } from '@/server/db/schema';

export type SubscriptionRow = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type PriceHistoryRow = typeof priceHistory.$inferSelect;
export type NewPriceHistory = typeof priceHistory.$inferInsert;

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
export async function getActiveSubscriptions(client: DbClient = db): Promise<SubscriptionRow[]> {
  return client.select().from(subscriptions).where(eq(subscriptions.status, 'active'));
}

/** Fetches every subscription regardless of status — the list view's source. */
export async function getAllSubscriptions(client: DbClient = db): Promise<SubscriptionRow[]> {
  return client.select().from(subscriptions);
}

/**
 * Every subscription reconciliation may match a signal against — every
 * status except `archived`. `archived` is deliberately excluded: the user
 * removed it on purpose, and re-surfacing it as a match candidate (e.g. a
 * `renewal` signal auto-confirming a subscription they archived) would
 * silently undo that. `paused`/`cancelled` stay eligible: a `renewal`
 * signal against a `cancelled` subscription is exactly the kind of
 * disagreement reconciliation exists to surface — see
 * docs/DATA_MODEL.md's reconciliation section.
 */
export async function getSubscriptionsForMatching(
  client: DbClient = db,
): Promise<SubscriptionRow[]> {
  return client.select().from(subscriptions).where(ne(subscriptions.status, 'archived'));
}

export async function getSubscriptionById(
  id: string,
  client: DbClient = db,
): Promise<SubscriptionRow | undefined> {
  const [row] = await client.select().from(subscriptions).where(eq(subscriptions.id, id));
  return row;
}

export async function insertSubscription(
  values: NewSubscription,
  client: DbClient = db,
): Promise<SubscriptionRow> {
  const [row] = await client.insert(subscriptions).values(values).returning();
  if (!row) {
    throw new Error('insertSubscription: insert did not return a row');
  }
  return row;
}

/**
 * Updates arbitrary columns on one subscription. No business logic —
 * services/subscription.service.ts decides what changes (recomputing
 * `nextBillingDate`, deciding whether a price_history row is also needed)
 * and passes the final column values in.
 */
export async function updateSubscriptionRow(
  id: string,
  values: Partial<NewSubscription>,
  client: DbClient = db,
): Promise<SubscriptionRow> {
  const [row] = await client
    .update(subscriptions)
    .set(values)
    .where(eq(subscriptions.id, id))
    .returning();
  if (!row) {
    throw new Error(`updateSubscriptionRow: no subscription with id ${id}`);
  }
  return row;
}

/**
 * Appends one price_history row. Insert-only, by convention — see
 * docs/DATA_MODEL.md: a subscription's price is never edited in place.
 */
export async function insertPriceHistory(
  values: NewPriceHistory,
  client: DbClient = db,
): Promise<void> {
  await client.insert(priceHistory).values(values);
}

/**
 * Fetches one subscription's price_history, oldest first — the order the
 * detail page needs to compute the delta between each entry and the one
 * before it (see docs/DESIGN.md: "Netflix went from $15.49 to $17.99 on
 * 3 March").
 */
export async function getPriceHistoryForSubscription(
  subscriptionId: string,
  client: DbClient = db,
): Promise<PriceHistoryRow[]> {
  return client
    .select()
    .from(priceHistory)
    .where(eq(priceHistory.subscriptionId, subscriptionId))
    .orderBy(asc(priceHistory.effectiveFrom));
}
