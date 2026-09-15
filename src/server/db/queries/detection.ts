import { and, desc, eq, gte, isNotNull, sql } from 'drizzle-orm';
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

/**
 * Every `pending` signal across every account — reconciliation
 * (`services/reconciliation.service.ts`) runs globally, not per-account,
 * since a subscription in the manual record has no notion of which
 * inbox a matching signal came from. Deduplication (dedupeSignals) has
 * already run per-sync by the time this is read.
 */
export async function getAllPendingSignals(client: DbClient = db): Promise<DetectedSignalRow[]> {
  return client.select().from(detectedSignals).where(eq(detectedSignals.status, 'pending'));
}

/**
 * Transitions a signal to `matched` (a reconciliation outcome was
 * applied or its proposal accepted) or `dismissed` (its proposal was
 * rejected) — the two terminal, non-duplicate statuses reconciliation
 * can put a signal into. Distinct from `markSignalDuplicate`, which also
 * sets `supersededBy`; this never does.
 */
export async function updateSignalStatus(
  id: string,
  status: 'matched' | 'dismissed',
  client: DbClient = db,
): Promise<void> {
  await client.update(detectedSignals).set({ status }).where(eq(detectedSignals.id, id));
}

/**
 * Real "needs review" signals for /review's needs-review section
 * (docs/DECISIONS.md ADR-018) — deliberately separate from the mock
 * proposal cards on that page. 'pending': still awaiting the user, has a
 * brief. 'resolved': archived within the last month — an older archived
 * row stays in the table (nothing auto-deletes) but stops being queried,
 * per the 1-month display window.
 */
export async function getNeedsReviewSignals(
  reviewStatus: 'pending' | 'resolved',
  client: DbClient = db,
): Promise<DetectedSignalRow[]> {
  if (reviewStatus === 'pending') {
    return client
      .select()
      .from(detectedSignals)
      .where(and(eq(detectedSignals.status, 'pending'), isNotNull(detectedSignals.reviewBrief)))
      .orderBy(desc(detectedSignals.createdAt));
  }
  return client
    .select()
    .from(detectedSignals)
    .where(
      and(
        eq(detectedSignals.status, 'dismissed'),
        isNotNull(detectedSignals.resolvedAt),
        gte(detectedSignals.resolvedAt, sql`now() - interval '1 month'`),
      ),
    )
    .orderBy(desc(detectedSignals.resolvedAt));
}

/**
 * Archives one needs-review card — the only action that moves a signal
 * from the pending list to the resolved list. "Go to email" is a plain
 * link with no server call and must never reach this function.
 */
export async function archiveSignal(id: string, client: DbClient = db): Promise<void> {
  await client
    .update(detectedSignals)
    .set({ status: 'dismissed', resolvedAt: new Date() })
    .where(eq(detectedSignals.id, id));
}

/**
 * Count-only version of `getNeedsReviewSignals('pending')` — the bottom
 * nav's Review badge (`components/dashboard/BottomNav.tsx`) needs just
 * the number, not the rows themselves.
 */
export async function getNeedsReviewPendingCount(client: DbClient = db): Promise<number> {
  const [row] = await client
    .select({ count: sql<number>`count(*)::int` })
    .from(detectedSignals)
    .where(and(eq(detectedSignals.status, 'pending'), isNotNull(detectedSignals.reviewBrief)));
  return row?.count ?? 0;
}
