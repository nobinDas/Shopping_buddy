'use server';

import { revalidatePath } from 'next/cache';
import {
  addItem,
  updateItem,
  deleteItem,
  toggleItemChecked,
  checkItemPrice,
  type PriceCheckResult,
} from '@/server/services/shopping.service';
import { getItemById } from '@/server/db/queries/shopping';

/** `FormData.get` returns `FormDataEntryValue | null` — a text field is a
 * `string`, never a `File`, so this narrows without needing a cast. */
function getFormString(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === 'string' ? value : null;
}

function parseItemForm(formData: FormData) {
  const name = getFormString(formData, 'name')?.trim();
  const quantityRaw = getFormString(formData, 'quantity');
  const notesRaw = getFormString(formData, 'notes');
  const storeRaw = getFormString(formData, 'store');

  if (!name) {
    return null;
  }

  const quantity = quantityRaw ? Number(quantityRaw) : 1;
  return {
    name,
    quantity: Number.isFinite(quantity) && quantity > 0 ? Math.trunc(quantity) : 1,
    notes: notesRaw?.trim() ? notesRaw.trim() : null,
    store: storeRaw?.trim() ? storeRaw.trim() : null,
  };
}

export async function addItemAction(listId: string, formData: FormData): Promise<void> {
  const input = parseItemForm(formData);
  if (!input) return;

  await addItem(listId, input);
  revalidatePath('/shopping');
}

export async function updateItemAction(id: string, formData: FormData): Promise<void> {
  const input = parseItemForm(formData);
  if (!input) return;

  await updateItem(id, input);
  revalidatePath('/shopping');
}

export async function deleteItemAction(id: string): Promise<void> {
  await deleteItem(id);
  revalidatePath('/shopping');
}

export async function toggleItemCheckedAction(id: string): Promise<void> {
  const item = await getItemById(id);
  if (!item) return;

  await toggleItemChecked(item);
  revalidatePath('/shopping');
}

export async function checkItemPriceAction(id: string): Promise<PriceCheckResult> {
  const result = await checkItemPrice(id);
  revalidatePath('/shopping');
  return result;
}
