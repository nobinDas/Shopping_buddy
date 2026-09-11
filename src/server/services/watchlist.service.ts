import { db, type DbClient } from '@/server/db';
import {
  insertWatchlistItem,
  deleteWatchlistItemRow,
  getWatchlistItemById,
  updateWatchlistItemRow,
  insertWatchlistPriceHistory,
  clearAllPriceDropFlags,
  type WatchlistItemRow,
} from '@/server/db/queries/watchlist';
import { searchLowestPrice } from '@/server/providers/google-shopping';
import { didPriceDrop } from '@/server/domain/price-trend';

export async function addWatchlistItem(name: string, client: DbClient = db): Promise<WatchlistItemRow> {
  return insertWatchlistItem(name, client);
}

export async function deleteWatchlistItem(id: string, client: DbClient = db): Promise<void> {
  await deleteWatchlistItemRow(id, client);
}

export type PriceCheckResult =
  | { status: 'found'; item: WatchlistItemRow }
  | { status: 'not_found' }
  | { status: 'error'; message: string };

/**
 * Checks one watchlist item's price against Google Shopping, via
 * providers/google-shopping.ts — on an explicit user action only, never
 * automatic or bulk, same rate-limit-conscious posture Phase 3 established
 * for SerpApi's free tier.
 *
 * Compares the new price against the item's currently-cached latest price
 * (domain/price-trend.ts#didPriceDrop) *before* overwriting it, so the
 * comparison is always "this check vs. the previous one," not "this check
 * vs. itself."
 */
export async function checkWatchlistItemPrice(
  itemId: string,
  client: DbClient = db,
): Promise<PriceCheckResult> {
  const item = await getWatchlistItemById(itemId, client);
  if (!item) {
    return { status: 'error', message: 'Item not found.' };
  }

  let result: Awaited<ReturnType<typeof searchLowestPrice>>;
  try {
    result = await searchLowestPrice(item.name);
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Price lookup failed.',
    };
  }

  if (!result) {
    return { status: 'not_found' };
  }

  await insertWatchlistPriceHistory(
    {
      itemId,
      unitPriceMinor: result.unitPriceMinor,
      currency: result.currency,
      sellerName: result.sellerName,
      productLink: result.productLink,
    },
    client,
  );

  const dropped = didPriceDrop(result.unitPriceMinor, item.latestPriceMinor);

  const updated = await updateWatchlistItemRow(
    itemId,
    {
      latestPriceMinor: result.unitPriceMinor,
      latestCurrency: result.currency,
      latestSellerName: result.sellerName,
      lastCheckedAt: new Date(),
      ...(dropped ? { hasPriceDrop: true } : {}),
    },
    client,
  );

  return { status: 'found', item: updated };
}

/** Clears the price-drop nav badges — called once when /watchlist is opened. */
export async function markWatchlistSeen(client: DbClient = db): Promise<void> {
  await clearAllPriceDropFlags(client);
}
