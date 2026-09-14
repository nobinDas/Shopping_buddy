import { and, desc, eq, ne } from 'drizzle-orm';
import { db, type DbClient } from '@/server/db';
import { reconciliationProposals, detectedSignals, subscriptions } from '@/server/db/schema';

export type ReconciliationProposalRow = typeof reconciliationProposals.$inferSelect;
export type NewReconciliationProposal = typeof reconciliationProposals.$inferInsert;

/**
 * A proposal joined with the display context `/review` needs but doesn't
 * live on `reconciliation_proposals` itself: the signal's `messageId`
 * ("Go to email") and vendor, and the matched subscription's name when
 * there is one (never for `discovery`, where `subscriptionId` is null
 * until the user accepts it — see
 * `services/reconciliation.service.ts#acceptDiscoveryProposal`).
 */
export interface ProposalView {
  id: string;
  proposalType: ReconciliationProposalRow['proposalType'];
  proposedChanges: unknown;
  reasoning: string;
  status: ReconciliationProposalRow['status'];
  createdAt: Date;
  resolvedAt: Date | null;
  messageId: string;
  vendorKey: string;
  subscriptionName: string | null;
  // The matched subscription's values *before* this proposal — lets
  // /review show an "old → new" summary line for price_update/date_update
  // rather than only the new value. Null for discovery (no subscription
  // yet) and meaningless for confirm/cancellation (nothing changes).
  subscriptionAmountMinor: number | null;
  subscriptionCurrency: string | null;
  subscriptionNextBillingDate: string | null;
}

function selectProposalView(client: DbClient) {
  return client
    .select({
      id: reconciliationProposals.id,
      proposalType: reconciliationProposals.proposalType,
      proposedChanges: reconciliationProposals.proposedChanges,
      reasoning: reconciliationProposals.reasoning,
      status: reconciliationProposals.status,
      createdAt: reconciliationProposals.createdAt,
      resolvedAt: reconciliationProposals.resolvedAt,
      messageId: detectedSignals.messageId,
      vendorKey: detectedSignals.vendorKey,
      subscriptionName: subscriptions.name,
      subscriptionAmountMinor: subscriptions.amountMinor,
      subscriptionCurrency: subscriptions.currency,
      subscriptionNextBillingDate: subscriptions.nextBillingDate,
    })
    .from(reconciliationProposals)
    .innerJoin(detectedSignals, eq(reconciliationProposals.signalId, detectedSignals.id))
    .leftJoin(subscriptions, eq(reconciliationProposals.subscriptionId, subscriptions.id));
}

export async function insertReconciliationProposal(
  values: NewReconciliationProposal,
  client: DbClient = db,
): Promise<ReconciliationProposalRow> {
  const [row] = await client.insert(reconciliationProposals).values(values).returning();
  if (!row) {
    throw new Error('insertReconciliationProposal: insert did not return a row');
  }
  return row;
}

export async function getProposalById(
  id: string,
  client: DbClient = db,
): Promise<ReconciliationProposalRow | undefined> {
  const [row] = await client
    .select()
    .from(reconciliationProposals)
    .where(eq(reconciliationProposals.id, id));
  return row;
}

/** /review's pending tab — every proposal still awaiting the user. */
export async function getPendingProposals(client: DbClient = db): Promise<ProposalView[]> {
  return selectProposalView(client)
    .where(eq(reconciliationProposals.status, 'pending'))
    .orderBy(desc(reconciliationProposals.createdAt));
}

/**
 * /review's resolved tab — every accepted or rejected proposal, including
 * `confirm` outcomes reconciliation applies automatically (already
 * `accepted` the moment they're written). No time window here, unlike
 * `detected_signals`' needs-review rows (ADR-018's explicit 1-month
 * cutoff) — docs/DATA_MODEL.md doesn't specify one for proposals, and
 * `reasoning` is meant to stay an audit trail, not something that quietly
 * stops being queryable.
 */
export async function getResolvedProposals(client: DbClient = db): Promise<ProposalView[]> {
  return selectProposalView(client)
    .where(ne(reconciliationProposals.status, 'pending'))
    .orderBy(desc(reconciliationProposals.resolvedAt));
}

export async function markProposalResolved(
  id: string,
  status: 'accepted' | 'rejected',
  client: DbClient = db,
): Promise<ReconciliationProposalRow> {
  const [row] = await client
    .update(reconciliationProposals)
    .set({ status, resolvedAt: new Date() })
    .where(eq(reconciliationProposals.id, id))
    .returning();
  if (!row) {
    throw new Error(`markProposalResolved: no proposal with id ${id}`);
  }
  return row;
}

/**
 * Links a `discovery` proposal to the subscription the user just created
 * from it — see `services/reconciliation.service.ts#acceptDiscoveryProposal`.
 * Kept separate from `markProposalResolved` since this is the one status
 * transition that also sets `subscriptionId`, which starts null on a
 * discovery.
 */
export async function resolveDiscoveryProposal(
  id: string,
  subscriptionId: string,
  client: DbClient = db,
): Promise<ReconciliationProposalRow> {
  const [row] = await client
    .update(reconciliationProposals)
    .set({ status: 'accepted', resolvedAt: new Date(), subscriptionId })
    .where(and(eq(reconciliationProposals.id, id), eq(reconciliationProposals.proposalType, 'discovery')))
    .returning();
  if (!row) {
    throw new Error(`resolveDiscoveryProposal: no discovery proposal with id ${id}`);
  }
  return row;
}

/** Whether a signal already has a proposal — reconciliation must not run twice over the same signal. */
export async function getProposalBySignalId(
  signalId: string,
  client: DbClient = db,
): Promise<ReconciliationProposalRow | undefined> {
  const [row] = await client
    .select()
    .from(reconciliationProposals)
    .where(eq(reconciliationProposals.signalId, signalId));
  return row;
}
