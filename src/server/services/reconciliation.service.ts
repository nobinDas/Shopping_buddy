import { format } from 'date-fns';
import { db, type DbClient } from '@/server/db';
import {
  getAllPendingSignals,
  updateSignalStatus,
  type DetectedSignalRow,
} from '@/server/db/queries/detection';
import {
  getSubscriptionsForMatching,
  updateSubscriptionRow,
  getSubscriptionById,
  insertPriceHistory,
  type SubscriptionRow,
} from '@/server/db/queries/subscriptions';
import {
  insertReconciliationProposal,
  getProposalBySignalId,
  getProposalById,
  markProposalResolved,
  resolveDiscoveryProposal,
  type ReconciliationProposalRow,
} from '@/server/db/queries/reconciliation';
import {
  reconcileSignal,
  isReconcilableSignalType,
  type SignalForMatching,
  type CandidateSubscription,
} from '@/server/domain/reconcile';
import { computeNextBillingDate } from '@/server/domain/billing-cycle';

function today(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export interface ReconciliationResult {
  signalsProcessed: number;
  confirmed: number;
  proposalsCreated: number;
}

function toSignalForMatching(signal: DetectedSignalRow): SignalForMatching | null {
  if (!isReconcilableSignalType(signal.signalType)) {
    return null;
  }
  return {
    signalType: signal.signalType,
    vendorKey: signal.vendorKey,
    amountMinor: signal.amountMinor,
    currency: signal.currency,
    billingDate: signal.billingDate,
  };
}

/**
 * The comparison point for Step 2's "billing date within ±3 days of
 * expected" test is the stored `next_billing_date` column, deliberately
 * *not* recomputed live from today — `computeNextBillingDate` only ever
 * returns a date on or after whatever "asOf" it's given, so recomputing
 * from today() would always project *past* a billing date that already
 * happened, which is exactly the normal case here (a renewal email is
 * reporting something that already occurred by the time sync catches up
 * to it, hours or days later). The stored column stays a meaningful
 * comparison point specifically because `reconcileOneSignal` re-anchors
 * it to the real confirmed date on every `confirm` — see there for why
 * that, not a live recompute, is the actual fix for drift over time.
 */
function toCandidateSubscription(subscription: SubscriptionRow): CandidateSubscription {
  return {
    id: subscription.id,
    name: subscription.name,
    vendorKey: subscription.vendorKey,
    amountMinor: subscription.amountMinor,
    currency: subscription.currency,
    nextBillingDate: subscription.nextBillingDate,
  };
}

/**
 * Runs `domain/reconcile.ts` over one signal and applies the result — see
 * docs/DATA_MODEL.md's "The invariant": a `confirm` outcome is safe to
 * apply automatically (it asserts nothing new about a user-entered
 * value), so this writes the subscription update, an already-`accepted`
 * proposal, and moves the signal to `matched`, all in one transaction.
 * Every other outcome only ever writes a `pending` proposal — the
 * subscription and the signal are untouched until the user acts on it
 * via `acceptProposal`/`rejectProposal`.
 */
async function reconcileOneSignal(
  signal: DetectedSignalRow,
  subscriptions: CandidateSubscription[],
  client: DbClient,
): Promise<'confirmed' | 'proposed' | 'skipped'> {
  const forMatching = toSignalForMatching(signal);
  if (!forMatching) {
    return 'skipped';
  }

  const existingProposal = await getProposalBySignalId(signal.id, client);
  if (existingProposal) {
    return 'skipped';
  }

  const outcome = reconcileSignal(forMatching, subscriptions);

  return client.transaction(async (tx) => {
    if (outcome.type === 'confirm') {
      const verifiedFields: Partial<SubscriptionRow> = {
        source: 'manual_confirmed',
        lastVerifiedAt: new Date(),
      };

      // Re-anchor the schedule to the real date this signal just
      // confirmed, rather than only verifying against whatever
      // anchorDate happened to be on file. A cycle projected forward
      // from a single original anchor is exact calendar math, but a
      // real billing date can drift by a day or two cycle to cycle
      // (payment processing timing, weekends, etc.) — nudging the
      // anchor forward on every confirmed match keeps the ±3-day
      // comparison window centered on reality instead of accumulating
      // that drift, cycle after cycle, until a real confirm eventually
      // falls outside tolerance against a stale, months-old anchor.
      if (forMatching.billingDate) {
        // outcome.subscriptionId came from the `subscriptions` candidate
        // list built from a real query moments ago, so this row exists —
        // fetched fresh (rather than carried on CandidateSubscription,
        // which deliberately doesn't need cycle/cycleDays for matching)
        // purely to get the cycle fields computeNextBillingDate needs.
        const current = await getSubscriptionById(outcome.subscriptionId, tx);
        if (current) {
          verifiedFields.anchorDate = forMatching.billingDate;
          verifiedFields.nextBillingDate = computeNextBillingDate({
            anchorDate: forMatching.billingDate,
            cycle: current.cycle,
            cycleDays: current.cycleDays,
            asOf: today(),
          });
        }
      }

      await updateSubscriptionRow(outcome.subscriptionId, verifiedFields, tx);
      await insertReconciliationProposal(
        {
          signalId: signal.id,
          subscriptionId: outcome.subscriptionId,
          proposalType: 'confirm',
          proposedChanges: {},
          reasoning: outcome.reasoning,
          status: 'accepted',
          resolvedAt: new Date(),
        },
        tx,
      );
      await updateSignalStatus(signal.id, 'matched', tx);
      return 'confirmed';
    }

    await insertReconciliationProposal(
      {
        signalId: signal.id,
        subscriptionId: outcome.subscriptionId,
        proposalType: outcome.type,
        proposedChanges: 'proposedChanges' in outcome ? outcome.proposedChanges : {},
        reasoning: outcome.reasoning,
        status: 'pending',
      },
      tx,
    );
    return 'proposed';
  });
}

/**
 * Runs docs/DATA_MODEL.md's reconciliation over every `pending` signal
 * across every connected account — a subscription in the manual record
 * has no notion of which inbox a matching signal came from, so this is
 * global, not per-account. Called at the end of
 * `services/detection.service.ts#syncAccount`, after that sync's own
 * dedup step, per "Runs after deduplication, on pending signals."
 *
 * Idempotent: a signal that already has a `reconciliation_proposals` row
 * (from an earlier run) is skipped, so calling this repeatedly — e.g.
 * once per account on every sync — never double-proposes the same
 * signal. `payment_failed`/`paused` signals are also skipped; see
 * `domain/reconcile.ts`'s module doc for why they're out of this
 * function's scope.
 */
export async function runReconciliation(client: DbClient = db): Promise<ReconciliationResult> {
  const [pendingSignals, subscriptionRows] = await Promise.all([
    getAllPendingSignals(client),
    getSubscriptionsForMatching(client),
  ]);
  const subscriptions = subscriptionRows.map(toCandidateSubscription);

  let confirmed = 0;
  let proposalsCreated = 0;

  for (const signal of pendingSignals) {
    let outcome: 'confirmed' | 'proposed' | 'skipped';
    try {
      outcome = await reconcileOneSignal(signal, subscriptions, client);
    } catch (error) {
      // One bad signal doesn't abort the whole batch — same resilience
      // pattern as detection.service.ts#syncAccount's per-message loop.
      console.error('runReconciliation: failed to reconcile signal', {
        signalId: signal.id,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
      });
      continue;
    }
    if (outcome === 'confirmed') confirmed += 1;
    if (outcome === 'proposed') proposalsCreated += 1;
  }

  return {
    signalsProcessed: pendingSignals.length,
    confirmed,
    proposalsCreated,
  };
}

/**
 * Accepts a pending `price_update`, `date_update`, or `cancellation`
 * proposal — the three types where accepting means mutating the
 * existing subscription record directly. `discovery` is deliberately
 * excluded: per CLAUDE.md ("manual entry is the primary data source...
 * never write code that treats email as authoritative over a
 * user-entered record"), accepting a discovery routes the user through
 * the normal "Add subscription" form instead of this function silently
 * inserting a full subscription row with a guessed billing cycle (which
 * no detected signal ever carries) — see
 * `acceptDiscoveryProposal`/docs/DECISIONS.md ADR-020. `confirm` is
 * excluded because it's never left `pending` in the first place —
 * `runReconciliation` applies it immediately.
 */
export async function acceptProposal(
  proposalId: string,
  client: DbClient = db,
): Promise<ReconciliationProposalRow> {
  const proposal = await getProposalById(proposalId, client);
  if (!proposal) {
    throw new Error(`acceptProposal: no proposal with id ${proposalId}`);
  }
  if (proposal.status !== 'pending') {
    throw new Error(`acceptProposal: proposal ${proposalId} is already ${proposal.status}`);
  }
  if (proposal.proposalType === 'discovery' || proposal.proposalType === 'confirm') {
    throw new Error(
      `acceptProposal: proposal type '${proposal.proposalType}' is not accepted through this function`,
    );
  }
  const subscriptionId = proposal.subscriptionId;
  if (!subscriptionId) {
    throw new Error(`acceptProposal: proposal ${proposalId} has no subscription to update`);
  }

  return client.transaction(async (tx) => {
    const subscription = await getSubscriptionById(subscriptionId, tx);
    if (!subscription) {
      throw new Error(`acceptProposal: no subscription with id ${subscriptionId}`);
    }

    if (proposal.proposalType === 'price_update') {
      const changes = proposal.proposedChanges as { amountMinor: number; currency: string };
      await updateSubscriptionRow(
        subscription.id,
        {
          amountMinor: changes.amountMinor,
          currency: changes.currency,
          lastVerifiedAt: new Date(),
        },
        tx,
      );
      await insertPriceHistory(
        {
          subscriptionId: subscription.id,
          amountMinor: changes.amountMinor,
          currency: changes.currency,
          effectiveFrom: today(),
          source: 'detected',
          signalId: proposal.signalId,
        },
        tx,
      );
    } else if (proposal.proposalType === 'date_update') {
      const changes = proposal.proposedChanges as { billingDate: string };
      const nextBillingDate = computeNextBillingDate({
        anchorDate: changes.billingDate,
        cycle: subscription.cycle,
        cycleDays: subscription.cycleDays,
        asOf: today(),
      });
      await updateSubscriptionRow(
        subscription.id,
        { anchorDate: changes.billingDate, nextBillingDate, lastVerifiedAt: new Date() },
        tx,
      );
    } else if (proposal.proposalType === 'cancellation') {
      await updateSubscriptionRow(
        subscription.id,
        { status: 'cancelled', lastVerifiedAt: new Date() },
        tx,
      );
    }

    await updateSignalStatus(proposal.signalId, 'matched', tx);
    return markProposalResolved(proposalId, 'accepted', tx);
  });
}

/**
 * Rejects any pending proposal, `discovery` included — the one place
 * `discovery` proposals ever get resolved without creating a
 * subscription. The subscription record (if any) is left untouched
 * either way; only the proposal and its signal move to a terminal state.
 */
export async function rejectProposal(
  proposalId: string,
  client: DbClient = db,
): Promise<ReconciliationProposalRow> {
  return client.transaction(async (tx) => {
    const proposal = await getProposalById(proposalId, tx);
    if (!proposal) {
      throw new Error(`rejectProposal: no proposal with id ${proposalId}`);
    }
    if (proposal.status !== 'pending') {
      throw new Error(`rejectProposal: proposal ${proposalId} is already ${proposal.status}`);
    }

    await updateSignalStatus(proposal.signalId, 'dismissed', tx);
    return markProposalResolved(proposalId, 'rejected', tx);
  });
}

/**
 * Finishes accepting a `discovery` proposal after the user has completed
 * and submitted the (pre-filled) "Add subscription" form —
 * `app/(dashboard)/subscriptions/actions.ts#createSubscriptionAction`
 * calls this once the new subscription row actually exists, linking the
 * proposal to it and marking the originating signal `matched`.
 */
export async function acceptDiscoveryProposal(
  proposalId: string,
  subscriptionId: string,
  client: DbClient = db,
): Promise<void> {
  const proposal = await getProposalById(proposalId, client);
  if (!proposal) {
    throw new Error(`acceptDiscoveryProposal: no proposal with id ${proposalId}`);
  }

  await client.transaction(async (tx) => {
    await resolveDiscoveryProposal(proposalId, subscriptionId, tx);
    await updateSignalStatus(proposal.signalId, 'matched', tx);
  });
}
