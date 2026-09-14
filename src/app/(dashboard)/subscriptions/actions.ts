'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { subscriptionInputSchema } from '@/lib/validation/subscription';
import { parseAmountToMinorUnits } from '@/lib/money';
import {
  createSubscription,
  updateSubscription,
  archiveSubscription,
  restoreSubscription,
} from '@/server/services/subscription.service';
import { acceptDiscoveryProposal } from '@/server/services/reconciliation.service';

export interface SubscriptionFormState {
  error: string | null;
}

/**
 * Reads the raw form fields and validates them with the shared boundary
 * schema — see docs/CLAUDE.md: "Zod-validate at every boundary." The dollar
 * amount is converted to minor units before validation, not inside the
 * schema, since that conversion can itself fail (e.g. three decimal places)
 * independently of the schema's own rules.
 */
/** `FormData.get` returns `FormDataEntryValue | null` — a text field is a
 * `string`, never a `File`, so this narrows without needing a cast. */
function getFormString(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === 'string' ? value : null;
}

function parseSubscriptionForm(
  formData: FormData,
): ReturnType<typeof subscriptionInputSchema.safeParse> {
  const amountMinor = parseAmountToMinorUnits(getFormString(formData, 'amountMinor') ?? '');
  const cycleDaysRaw = getFormString(formData, 'cycleDays');
  const notesRaw = getFormString(formData, 'notes');

  return subscriptionInputSchema.safeParse({
    name: getFormString(formData, 'name'),
    amountMinor,
    currency: getFormString(formData, 'currency'),
    cycle: getFormString(formData, 'cycle'),
    cycleDays: cycleDaysRaw ? Number(cycleDaysRaw) : null,
    anchorDate: getFormString(formData, 'anchorDate'),
    category: getFormString(formData, 'category'),
    notes: notesRaw === '' ? null : notesRaw,
  });
}

export async function createSubscriptionAction(
  _prevState: SubscriptionFormState,
  formData: FormData,
): Promise<SubscriptionFormState> {
  const parsed = parseSubscriptionForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  }

  const created = await createSubscription(parsed.data);

  // Set only when this form was opened from a discovery proposal's "Add
  // subscription" link (docs/DECISIONS.md ADR-020) — links the proposal
  // to the subscription the user just chose to save, and marks its
  // originating signal matched. The subscription itself is still created
  // as an ordinary manual entry (`source: 'manual'`, unchanged above):
  // the user reviewed and can freely have edited the pre-filled values,
  // so this is their assertion, not the email's.
  const proposalId = getFormString(formData, 'proposalId');
  if (proposalId) {
    await acceptDiscoveryProposal(proposalId, created.id);
    revalidatePath('/review');
  }

  revalidatePath('/subscriptions');
  revalidatePath('/');
  redirect('/subscriptions');
}

// Bound with `id` from the edit page before being passed as a form action —
// see src/app/(auth)/auth/confirm/actions.ts for the same pattern.
export async function updateSubscriptionAction(
  id: string,
  _prevState: SubscriptionFormState,
  formData: FormData,
): Promise<SubscriptionFormState> {
  const parsed = parseSubscriptionForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  }

  await updateSubscription(id, parsed.data);
  revalidatePath('/subscriptions');
  revalidatePath('/');
  redirect('/subscriptions');
}

export async function archiveSubscriptionAction(id: string): Promise<void> {
  await archiveSubscription(id);
  revalidatePath('/subscriptions');
  revalidatePath('/');
}

export async function restoreSubscriptionAction(id: string): Promise<void> {
  await restoreSubscription(id);
  revalidatePath('/subscriptions');
  revalidatePath('/');
}
