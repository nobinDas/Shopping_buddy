'use server';

import { revalidatePath } from 'next/cache';
import { deleteStore } from '@/server/db/queries/stores';
import { addStore } from '@/server/services/stores.service';
import { autocompleteAddress, type AddressSuggestion } from '@/server/providers/google-maps';

/**
 * Backs the address typeahead on the add-store form. Non-fatal on any
 * provider error or missing API key — an empty list just means no
 * suggestions show, same "unknown, not blocking" posture as store-hours
 * resolution.
 */
export async function getAddressSuggestionsAction(query: string): Promise<AddressSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];
  try {
    return await autocompleteAddress(trimmed);
  } catch {
    return [];
  }
}

export async function addStoreAction(formData: FormData): Promise<void> {
  const nameValue = formData.get('name');
  const addressValue = formData.get('address');
  const placeIdValue = formData.get('placeId');
  const name = typeof nameValue === 'string' ? nameValue.trim() : '';
  const address = typeof addressValue === 'string' ? addressValue.trim() : '';
  const placeId = typeof placeIdValue === 'string' ? placeIdValue.trim() : '';
  // placeId only ever gets set by picking a typeahead suggestion (see
  // PreferredStoresList) — its presence is what rules out a hand-typed
  // address, not just the UI disabling the Add button.
  if (!name || !address || !placeId) return;

  await addStore(name, address);
  revalidatePath('/stores');
  revalidatePath('/shopping');
  revalidatePath('/trips');
}

export async function removeStoreAction(id: string): Promise<void> {
  await deleteStore(id);
  revalidatePath('/stores');
  revalidatePath('/shopping');
  revalidatePath('/trips');
}
