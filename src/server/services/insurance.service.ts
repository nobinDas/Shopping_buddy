import { format } from 'date-fns';
import { db, type DbClient } from '@/server/db';
import { insertPolicy, updatePolicyRow, type PolicyRow } from '@/server/db/queries/insurance';
import { computeNextBillingDate } from '@/server/domain/billing-cycle';
import type { InsuranceInput } from '@/lib/validation/insurance';

function today(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

/**
 * Creates a manually entered policy. `nextBillingDate` is always derived
 * here, never taken from the caller — same rule subscription.service.ts
 * follows for the same reason (docs/DATA_MODEL.md: derived, never
 * hand-edited).
 */
export async function createPolicy(
  input: InsuranceInput,
  client: DbClient = db,
): Promise<PolicyRow> {
  const nextBillingDate = computeNextBillingDate({
    anchorDate: input.anchorDate,
    cycle: input.cycle,
    cycleDays: input.cycleDays ?? null,
    asOf: today(),
  });

  return insertPolicy(
    {
      type: input.type,
      insurer: input.insurer,
      policyNumber: input.policyNumber,
      premiumMinor: input.premiumMinor,
      currency: input.currency,
      cycle: input.cycle,
      cycleDays: input.cycleDays ?? null,
      anchorDate: input.anchorDate,
      nextBillingDate,
      reminderLeadDays: input.reminderLeadDays,
      status: 'active',
    },
    client,
  );
}

/**
 * Updates a policy's editable fields, recomputing nextBillingDate from
 * the (possibly changed) anchorDate/cycle — no price-history-equivalent
 * table for insurance (out of scope for this phase), so a premium change
 * just overwrites the stored value.
 */
export async function updatePolicy(
  id: string,
  input: InsuranceInput,
  client: DbClient = db,
): Promise<PolicyRow> {
  const nextBillingDate = computeNextBillingDate({
    anchorDate: input.anchorDate,
    cycle: input.cycle,
    cycleDays: input.cycleDays ?? null,
    asOf: today(),
  });

  return updatePolicyRow(
    id,
    {
      type: input.type,
      insurer: input.insurer,
      policyNumber: input.policyNumber,
      premiumMinor: input.premiumMinor,
      currency: input.currency,
      cycle: input.cycle,
      cycleDays: input.cycleDays ?? null,
      anchorDate: input.anchorDate,
      nextBillingDate,
      reminderLeadDays: input.reminderLeadDays,
    },
    client,
  );
}

/**
 * Archives a policy. A status change, not a delete — the record stays,
 * it just drops out of getActivePolicies and the aggregate burn.
 */
export async function archivePolicy(id: string, client: DbClient = db): Promise<PolicyRow> {
  return updatePolicyRow(id, { status: 'archived' }, client);
}

/**
 * Restores an archived policy to active. Built alongside archivePolicy
 * from the start — see docs/MEMORY.md, 2026-09-09, for why
 * subscription.service.ts didn't and needed a same-day follow-up once
 * the mobile redesign's UI promised a Restore button it couldn't call.
 */
export async function restorePolicy(id: string, client: DbClient = db): Promise<PolicyRow> {
  return updatePolicyRow(id, { status: 'active' }, client);
}
