'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { watchlistItemInputSchema } from '@/lib/validation/watchlist';
import { parseAmountToMinorUnits } from '@/lib/money';
import {
  getRecommendedStores,
  findWatchlistCandidates,
  createWatchlistItem,
  deleteWatchlistItem,
  checkWatchlistItemPrice,
  markWatchlistSeen,
  type PriceCheckResult,
} from '@/server/services/watchlist.service';
import type { ProductCandidate } from '@/server/domain/watchlist-candidates';

export interface WatchlistItemFormFields {
  name: string;
  category: string;
  brand: string | null;
  variant: string | null;
  notes: string | null;
  expectedPriceMin: string | null;
  expectedPriceMax: string | null;
  trackedSellers: string[];
}

/**
 * Shared by `getRecommendedStoresAction` and `findWatchlistCandidatesAction`
 * — both need the same subset of the wizard's fields, validated the same
 * way, before making a real API/LLM call.
 */
function parseDetails(fields: Pick<WatchlistItemFormFields, 'name' | 'category' | 'brand' | 'variant'>) {
  const name = fields.name.trim();
  const category = fields.category.trim();
  if (!name || !category) return null;
  return {
    name,
    category,
    brand: fields.brand?.trim() ? fields.brand.trim() : null,
    variant: fields.variant?.trim() ? fields.variant.trim() : null,
  };
}

/** "Recommend stores" button — interactive only, called before the rest of the form is submitted. */
export async function getRecommendedStoresAction(
  fields: Pick<WatchlistItemFormFields, 'name' | 'category' | 'brand' | 'variant'>,
): Promise<string[]> {
  const details = parseDetails(fields);
  if (!details) return [];
  return getRecommendedStores(details);
}

/**
 * "Find this product" step — real search + validation, called before
 * the item is actually created. `expectedPriceMin`/`expectedPriceMax`
 * are passed through to the search itself, not just stored for later —
 * see `services/watchlist.service.ts#findWatchlistCandidates`'s doc
 * comment for why that turned out to matter far more than expected.
 */
export async function findWatchlistCandidatesAction(
  fields: Pick<
    WatchlistItemFormFields,
    'name' | 'category' | 'brand' | 'variant' | 'notes' | 'expectedPriceMin' | 'expectedPriceMax'
  >,
): Promise<ProductCandidate[]> {
  const details = parseDetails(fields);
  if (!details) return [];
  return findWatchlistCandidates({
    ...details,
    notes: fields.notes?.trim() ? fields.notes.trim() : null,
    expectedPriceMinMinor: fields.expectedPriceMin ? parseAmountToMinorUnits(fields.expectedPriceMin) : null,
    expectedPriceMaxMinor: fields.expectedPriceMax ? parseAmountToMinorUnits(fields.expectedPriceMax) : null,
  });
}

export interface CreateWatchlistItemState {
  error: string | null;
}

/**
 * Final step: validates the whole form, then creates the item using
 * whichever candidate the user confirmed on the "Find this product"
 * step. `chosen` is passed alongside the form fields rather than
 * re-derived, since it came from a real search result the user picked,
 * not something to reconstruct from form data.
 */
export async function createWatchlistItemAction(
  fields: WatchlistItemFormFields,
  chosen: ProductCandidate,
): Promise<CreateWatchlistItemState> {
  const parsed = watchlistItemInputSchema.safeParse({
    name: fields.name,
    category: fields.category,
    brand: fields.brand,
    variant: fields.variant,
    notes: fields.notes,
    expectedPriceMinMinor: fields.expectedPriceMin
      ? parseAmountToMinorUnits(fields.expectedPriceMin)
      : null,
    expectedPriceMaxMinor: fields.expectedPriceMax
      ? parseAmountToMinorUnits(fields.expectedPriceMax)
      : null,
    expectedPriceCurrency:
      fields.expectedPriceMin || fields.expectedPriceMax ? 'USD' : null,
    trackedSellers: fields.trackedSellers,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  }

  await createWatchlistItem(parsed.data, chosen);
  revalidatePath('/watchlist');
  revalidatePath('/', 'layout');
  redirect('/watchlist');
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
