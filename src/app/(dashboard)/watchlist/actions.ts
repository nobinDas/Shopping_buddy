'use server';

import { revalidatePath } from 'next/cache';
import {
  addWatchlistItem,
  deleteWatchlistItem,
  checkWatchlistItemPrice,
  markWatchlistSeen,
  type PriceCheckResult,
} from '@/server/services/watchlist.service';

export async function addWatchlistItemAction(formData: FormData): Promise<void> {
  const value = formData.get('name');
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name) return;

  await addWatchlistItem(name);
  revalidatePath('/watchlist');
  revalidatePath('/', 'layout');
}

export async function deleteWatchlistItemAction(id: string): Promise<void> {
  await deleteWatchlistItem(id);
  revalidatePath('/watchlist');
  revalidatePath('/', 'layout');
}

export async function checkWatchlistItemPriceAction(id: string): Promise<PriceCheckResult> {
  const result = await checkWatchlistItemPrice(id);
  revalidatePath('/watchlist');
  revalidatePath('/', 'layout');
  return result;
}

export async function markWatchlistSeenAction(): Promise<void> {
  await markWatchlistSeen();
  revalidatePath('/', 'layout');
}
