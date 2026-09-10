'use server';

import { revalidatePath } from 'next/cache';
import { setHomeAddress } from '@/server/db/queries/settings';

export async function setHomeAddressAction(formData: FormData): Promise<void> {
  const value = formData.get('homeAddress');
  const address = typeof value === 'string' ? value.trim() : '';
  if (!address) return;

  await setHomeAddress(address);
  revalidatePath('/settings');
  revalidatePath('/trips');
}
