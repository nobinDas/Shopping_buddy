'use server';

import { revalidatePath } from 'next/cache';
import { setHomeAddress } from '@/server/db/queries/settings';
import { updateListDefaultStore } from '@/server/db/queries/shopping';

export async function setHomeAddressAction(formData: FormData): Promise<void> {
  const value = formData.get('homeAddress');
  const address = typeof value === 'string' ? value.trim() : '';
  if (!address) return;

  await setHomeAddress(address);
  revalidatePath('/settings');
  revalidatePath('/trips');
}

/** `store` empty/blank means "no default" — clears it back to null. */
export async function setListDefaultStoreAction(listId: string, store: string): Promise<void> {
  await updateListDefaultStore(listId, store.trim() ? store.trim() : null);
  revalidatePath('/settings');
  revalidatePath('/shopping');
}
