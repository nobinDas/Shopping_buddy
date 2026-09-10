'use server';

import { revalidatePath } from 'next/cache';
import { insuranceInputSchema } from '@/lib/validation/insurance';
import { parseAmountToMinorUnits } from '@/lib/money';
import {
  createPolicy,
  updatePolicy,
  archivePolicy,
  restorePolicy,
} from '@/server/services/insurance.service';

export interface PolicyFormState {
  error: string | null;
}

// Unlike subscriptions/actions.ts, these don't redirect() on success — the
// add/edit form lives in a Dialog on the same /insurance page, not a
// separate route, so the client closes the dialog itself once { error:
// null } comes back.

/** `FormData.get` returns `FormDataEntryValue | null` — a text field is a
 * `string`, never a `File`, so this narrows without needing a cast. */
function getFormString(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === 'string' ? value : null;
}

function parsePolicyForm(formData: FormData): ReturnType<typeof insuranceInputSchema.safeParse> {
  const premiumMinor = parseAmountToMinorUnits(getFormString(formData, 'premiumMinor') ?? '');
  const cycleDaysRaw = getFormString(formData, 'cycleDays');
  const reminderLeadDaysRaw = getFormString(formData, 'reminderLeadDays');

  return insuranceInputSchema.safeParse({
    type: getFormString(formData, 'type'),
    insurer: getFormString(formData, 'insurer'),
    policyNumber: getFormString(formData, 'policyNumber'),
    premiumMinor,
    currency: getFormString(formData, 'currency'),
    cycle: getFormString(formData, 'cycle'),
    cycleDays: cycleDaysRaw ? Number(cycleDaysRaw) : null,
    anchorDate: getFormString(formData, 'anchorDate'),
    reminderLeadDays: reminderLeadDaysRaw ? Number(reminderLeadDaysRaw) : null,
  });
}

export async function createPolicyAction(formData: FormData): Promise<PolicyFormState> {
  const parsed = parsePolicyForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  }

  await createPolicy(parsed.data);
  revalidatePath('/insurance');
  revalidatePath('/');
  return { error: null };
}

export async function updatePolicyAction(id: string, formData: FormData): Promise<PolicyFormState> {
  const parsed = parsePolicyForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  }

  await updatePolicy(id, parsed.data);
  revalidatePath('/insurance');
  revalidatePath('/');
  return { error: null };
}

export async function archivePolicyAction(id: string): Promise<void> {
  await archivePolicy(id);
  revalidatePath('/insurance');
  revalidatePath('/');
}

export async function restorePolicyAction(id: string): Promise<void> {
  await restorePolicy(id);
  revalidatePath('/insurance');
  revalidatePath('/');
}
