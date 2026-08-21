import { format } from 'date-fns';
import { db, type DbClient } from '@/server/db';
import {
  insertSubscription,
  updateSubscriptionRow,
  insertPriceHistory,
  getSubscriptionById,
  type SubscriptionRow,
} from '@/server/db/queries/subscriptions';
import { computeNextBillingDate } from '@/server/domain/billing-cycle';
import { normalizeVendorKey } from '@/server/domain/vendor-key';
import type { SubscriptionInput } from '@/lib/validation/subscription';

function today(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

/**
 * Creates a manually entered subscription. `vendor_key` and
 * `next_billing_date` are always derived here, never taken from the
 * caller — see docs/DATA_MODEL.md: the latter is "derived, never
 * hand-edited." Also writes the starting price_history row: every price a
 * subscription has ever had belongs in price_history, including the first
 * — otherwise a subscription with exactly one later price change shows only
 * the new amount, with the original price it changed from unrecoverable.
 * That row is effective from the anchor date, not today: the price has
 * held since the subscription started, not since it was typed in.
 */
export async function createSubscription(
  input: SubscriptionInput,
  client: DbClient = db,
): Promise<SubscriptionRow> {
  return client.transaction(async (tx) => {
    const nextBillingDate = computeNextBillingDate({
      anchorDate: input.anchorDate,
      cycle: input.cycle,
      cycleDays: input.cycleDays ?? null,
      asOf: today(),
    });

    const created = await insertSubscription(
      {
        name: input.name,
        vendorKey: normalizeVendorKey(input.name),
        amountMinor: input.amountMinor,
        currency: input.currency,
        cycle: input.cycle,
        cycleDays: input.cycleDays ?? null,
        anchorDate: input.anchorDate,
        nextBillingDate,
        category: input.category,
        notes: input.notes ?? null,
        source: 'manual',
        status: 'active',
      },
      tx,
    );

    await insertPriceHistory(
      {
        subscriptionId: created.id,
        amountMinor: input.amountMinor,
        currency: input.currency,
        effectiveFrom: input.anchorDate,
        source: 'manual',
      },
      tx,
    );

    return created;
  });
}

/**
 * Updates a subscription's editable fields. If the amount or currency
 * changed, also appends a price_history row rather than only overwriting
 * the current value in place — see docs/DATA_MODEL.md: "Never update a
 * subscription's amount in place; write history and recompute." The
 * subscription row and its price_history entry are written in one
 * transaction so the two never disagree if a write fails partway through.
 * `client` defaults to the module `db`, but accepts an outer transaction —
 * the transaction opened here nests as a savepoint in that case, so a
 * caller (e.g. an integration test) can still roll the whole thing back.
 */
export async function updateSubscription(
  id: string,
  input: SubscriptionInput,
  client: DbClient = db,
): Promise<SubscriptionRow> {
  return client.transaction(async (tx) => {
    const existing = await getSubscriptionById(id, tx);
    if (!existing) {
      throw new Error(`updateSubscription: no subscription with id ${id}`);
    }

    const priceChanged =
      existing.amountMinor !== input.amountMinor || existing.currency !== input.currency;
    const effectiveFrom = today();

    const nextBillingDate = computeNextBillingDate({
      anchorDate: input.anchorDate,
      cycle: input.cycle,
      cycleDays: input.cycleDays ?? null,
      asOf: effectiveFrom,
    });

    const updated = await updateSubscriptionRow(
      id,
      {
        name: input.name,
        vendorKey: normalizeVendorKey(input.name),
        amountMinor: input.amountMinor,
        currency: input.currency,
        cycle: input.cycle,
        cycleDays: input.cycleDays ?? null,
        anchorDate: input.anchorDate,
        nextBillingDate,
        category: input.category,
        notes: input.notes ?? null,
      },
      tx,
    );

    if (priceChanged) {
      await insertPriceHistory(
        {
          subscriptionId: id,
          amountMinor: input.amountMinor,
          currency: input.currency,
          effectiveFrom,
          source: 'manual',
        },
        tx,
      );
    }

    return updated;
  });
}

/**
 * Archives a subscription. A status change, not a delete — the record and
 * its price_history stay, they just drop out of `getActiveSubscriptions`
 * and the burn total.
 */
export async function archiveSubscription(
  id: string,
  client: DbClient = db,
): Promise<SubscriptionRow> {
  return updateSubscriptionRow(id, { status: 'archived' }, client);
}
