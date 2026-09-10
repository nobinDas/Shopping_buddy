'use server';

import { revalidatePath } from 'next/cache';
import { insertStore, deleteStore } from '@/server/db/queries/stores';

export async function addStoreAction(formData: FormData): Promise<void> {
  const value = formData.get('name');
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name) return;

  await insertStore(name);
  revalidatePath('/stores');
  revalidatePath('/shopping');
}

export async function removeStoreAction(id: string): Promise<void> {
  await deleteStore(id);
  revalidatePath('/stores');
  revalidatePath('/shopping');
}
