'use server';

import { revalidatePath } from 'next/cache';
import { deleteStore } from '@/server/db/queries/stores';
import { addStore } from '@/server/services/stores.service';

export async function addStoreAction(formData: FormData): Promise<void> {
  const nameValue = formData.get('name');
  const addressValue = formData.get('address');
  const name = typeof nameValue === 'string' ? nameValue.trim() : '';
  const address = typeof addressValue === 'string' ? addressValue.trim() : '';
  if (!name || !address) return;

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
