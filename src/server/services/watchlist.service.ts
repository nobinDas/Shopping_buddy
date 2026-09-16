import { db, type DbClient } from '@/server/db';
import {
  insertWatchlistItem,
  deleteWatchlistItemRow,
  getWatchlistItemById,
  getAllWatchlistItems,
  updateWatchlistItemRow,
  insertWatchlistPriceHistory,
  clearAllPriceDropFlags,
  type WatchlistItemRow,
} from '@/server/db/queries/watchlist';
import {
  searchProductCandidates,
  getImmersiveProductOffers,
  InvalidPageTokenError,
} from '@/server/providers/google-shopping';
import {
  planWatchlistQuery,
  recommendWatchlistStores,
  validateShoppingCandidates,
} from '@/server/providers/anthropic';
import { buildShoppingQuery } from '@/server/domain/watchlist-query';
import {
  dedupeByProductId,
  filterByExpectedPriceRange,
  type ProductCandidate,
} from '@/server/domain/watchlist-candidates';
import { isLikelyAccessory } from '@/server/domain/watchlist-result-filter';
import { pickTrackedLowestOffer } from '@/server/domain/watchlist-offers';
import { didPriceDrop, enteredExpectedRange } from '@/server/domain/price-trend';
import type { WatchlistItemInput } from '@/lib/validation/watchlist';

// Shown to the user as "which product is this" choices on the add-item
// form — kept small so it stays a real, scannable decision rather than a
// second unfiltered results list.
const MAX_CANDIDATES_SHOWN = 3;

// The two earlier wizard steps (recommend stores, find candidates) run
// before the full form validates — `category` is still a plain string
// here, not yet narrowed to the real enum. Only `createWatchlistItem`
// (the final step) takes the already-`watchlistItemInputSchema`-validated
// `WatchlistItemInput`, which is where that narrowing actually happens.
interface WatchlistDetailsDraft {
  name: string;
  category: string;
  brand: string | null;
  variant: string | null;
  notes: string | null;
  // Used to filter the raw search candidates by price, not just for the
  // post-add display/notification logic — see
  // `findWatchlistCandidates`'s own doc comment for why this turned out
  // to matter far more than expected, and why it's applied post-fetch
  // rather than as a search parameter.
  expectedPriceMinMinor: number | null;
  expectedPriceMaxMinor: number | null;
}

/**
 * Store/seller suggestions for the add-item form's "Recommend stores"
 * button (docs/DECISIONS.md's watchlist identity-resolution ADR) —
 * interactive only, never automatic. Empty array on any failure rather
 * than throwing: the user can always type stores in manually instead.
 */
export async function getRecommendedStores(input: {
  name: string;
  category: string;
  brand: string | null;
  variant: string | null;
}): Promise<string[]> {
  try {
    const stores = await recommendWatchlistStores(input);
    return stores ?? [];
  } catch {
    return [];
  }
}

/**
 * Finds candidate products for the add-item form's "Find this product"
 * step — the one place a search + LLM validation pipeline runs, since
 * every later price check polls the confirmed `resolvedPageToken`
 * directly instead (see `checkWatchlistItemPrice`). Pipeline: plan a
 * query → search → filter by expected price range → dedupe by product →
 * drop likely accessories (heuristic, then an LLM pass over whatever's
 * left) → cap at `MAX_CANDIDATES_SHOWN`.
 *
 * Deliberately does *not* filter by `trackedSellers` here — which
 * seller's listing happened to surface a product in this search is
 * unrelated to whether that product is actually available from a
 * tracked seller; `google_immersive_product` returns the full current
 * seller list for whatever product the user confirms, and *that* result
 * is what gets filtered by `trackedSellers`, at check-time
 * (`domain/watchlist-offers.ts#pickTrackedLowestOffer`). Filtering here
 * too would risk hiding the correct product from the confirmation list
 * just because this particular keyword search didn't happen to surface
 * it via a tracked seller's own listing.
 *
 * The expected price range, when the user set one, filters the raw
 * candidates after the fact (`filterByExpectedPriceRange`) rather than
 * as a search-time API parameter — confirmed live (2026-09-15) that
 * SerpApi's `google_shopping` engine silently ignores both its
 * documented `tbs` price filter and the `low_price`/`high_price` params,
 * so a search-level filter was never actually working despite an
 * earlier "confirmed live" note to the contrary. Filtering the returned
 * candidates by price instead is just as effective in practice —
 * accessories are almost always priced far outside a real product's
 * range — without depending on a provider feature that doesn't work.
 * See `domain/watchlist-candidates.ts#filterByExpectedPriceRange`.
 */
export async function findWatchlistCandidates(
  input: WatchlistDetailsDraft,
): Promise<ProductCandidate[]> {
  const plan = await planWatchlistQuery(input).catch(() => null);
  const query = plan ? buildShoppingQuery(plan) : input.name;
  const excludeTerms = plan?.excludeTerms ?? [];

  // A transient provider failure (confirmed live — a real 503 from
  // SerpApi) degrades to "no candidates" rather than crashing the whole
  // add-item flow, same graceful-degradation posture as the planner and
  // validator calls below. The "no listings found, try adjusting your
  // search" message this shows either way already points the user at
  // the right recovery action (retry), even though it doesn't
  // distinguish a genuine empty result from a failed request.
  const rawCandidates = await searchProductCandidates(query).catch(() => []);
  const priceFiltered = filterByExpectedPriceRange(
    rawCandidates,
    input.expectedPriceMinMinor,
    input.expectedPriceMaxMinor,
  );
  const deduped = dedupeByProductId(priceFiltered);
  const notAccessory = deduped.filter((candidate) => !isLikelyAccessory(candidate.title, excludeTerms));

  if (notAccessory.length === 0) {
    return [];
  }

  const validated = await validateShoppingCandidates(
    input.name,
    notAccessory.map((candidate) => candidate.title),
  ).catch(() => null);

  // A failed/unusable LLM validation pass falls back to the heuristic-only
  // result rather than failing the whole search — the user still gets to
  // make the final call on the confirmation screen either way.
  const survivors = validated
    ? notAccessory.filter((_, index) => validated[index])
    : notAccessory;

  return survivors.slice(0, MAX_CANDIDATES_SHOWN);
}

/**
 * Creates the watchlist item once the user has confirmed which search
 * candidate is actually their product — `chosen` becomes the row's
 * permanent `resolvedProductId`/`resolvedPageToken`/`resolvedTitle`/
 * `resolvedSourceUrl`. `resolvedPageToken` is what every later price
 * check actually polls by (`checkWatchlistItemPrice`); `resolvedProductId`
 * is kept for display/debugging only — see `providers/google-shopping.ts`'s
 * top-of-file doc comment for why the two split apart.
 */
export async function createWatchlistItem(
  input: WatchlistItemInput,
  chosen: ProductCandidate,
  client: DbClient = db,
): Promise<WatchlistItemRow> {
  return insertWatchlistItem(
    {
      name: input.name,
      category: input.category,
      brand: input.brand,
      variant: input.variant,
      notes: input.notes,
      expectedPriceMinMinor: input.expectedPriceMinMinor,
      expectedPriceMaxMinor: input.expectedPriceMaxMinor,
      expectedPriceCurrency: input.expectedPriceCurrency,
      trackedSellers: input.trackedSellers,
      resolvedProductId: chosen.productId,
      resolvedPageToken: chosen.pageToken,
      resolvedTitle: chosen.title,
      resolvedSourceUrl: chosen.productLink,
    },
    client,
  );
}

export async function deleteWatchlistItem(id: string, client: DbClient = db): Promise<void> {
  await deleteWatchlistItemRow(id, client);
}

export type PriceCheckResult =
  | { status: 'found'; item: WatchlistItemRow }
  | { status: 'not_found' }
  // The resolved product no longer resolves at all (delisted/changed) —
  // surfaced to the user rather than silently falling back to a fresh,
  // unconfirmed search. See docs/DECISIONS.md's watchlist
  // identity-resolution ADR.
  | { status: 'needs_reresolution' }
  | { status: 'error'; message: string };

/**
 * Checks one watchlist item's current price — called both from an
 * explicit user action (the check icon on `/watchlist`) and from the
 * monthly cron batch (`checkAllWatchlistItemPrices`, `/api/cron/
 * watchlist-check`). No manual/bulk distinction inside this function
 * itself; every caller gets the same behavior.
 *
 * No search, no LLM call: fetches `google_immersive_product` offers for
 * the item's own `resolvedPageToken` directly. This is the entire point
 * of resolving identity once at add-time — every poll targets the exact
 * same product, so price history stays genuinely comparable across
 * checks instead of silently drifting to whatever a fresh search
 * happened to match best this time.
 */
export async function checkWatchlistItemPrice(
  itemId: string,
  client: DbClient = db,
): Promise<PriceCheckResult> {
  const item = await getWatchlistItemById(itemId, client);
  if (!item) {
    return { status: 'error', message: 'Item not found.' };
  }

  if (item.resolutionStatus === 'needs_reresolution') {
    return { status: 'needs_reresolution' };
  }

  // A null token means an item resolved before resolvedPageToken existed
  // (added before this column, see schema.ts's own comment on it) —
  // treated the same as a resolution that stopped working, since there's
  // nothing to poll.
  if (item.resolvedPageToken === null) {
    await updateWatchlistItemRow(itemId, { resolutionStatus: 'needs_reresolution' }, client);
    return { status: 'needs_reresolution' };
  }

  let offers: Awaited<ReturnType<typeof getImmersiveProductOffers>>;
  try {
    offers = await getImmersiveProductOffers(item.resolvedPageToken);
  } catch (error) {
    if (error instanceof InvalidPageTokenError) {
      // Confirmed live (2026-09-15): SerpApi rejects an invalid/expired
      // page_token with a distinct error rather than an empty result —
      // treated the same as the empty-offers case below, since either
      // way the resolved identity no longer works.
      await updateWatchlistItemRow(itemId, { resolutionStatus: 'needs_reresolution' }, client);
      return { status: 'needs_reresolution' };
    }
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Price lookup failed.',
    };
  }

  if (offers.length === 0) {
    await updateWatchlistItemRow(itemId, { resolutionStatus: 'needs_reresolution' }, client);
    return { status: 'needs_reresolution' };
  }

  const best = pickTrackedLowestOffer(offers, item.trackedSellers);
  if (!best) {
    // The product still resolves, it's just not currently listed by any
    // of the user's tracked sellers — a normal "not found this time,"
    // not a sign of a stale/wrong resolution. Never falls back to an
    // untracked seller's price.
    return { status: 'not_found' };
  }

  await insertWatchlistPriceHistory(
    {
      itemId,
      unitPriceMinor: best.unitPriceMinor,
      currency: best.currency,
      sellerName: best.sellerName,
      productLink: best.productLink,
    },
    client,
  );

  const dropped = didPriceDrop(best.unitPriceMinor, item.latestPriceMinor);
  const entered = enteredExpectedRange(best.unitPriceMinor, item.latestPriceMinor, item.expectedPriceMaxMinor);

  const updated = await updateWatchlistItemRow(
    itemId,
    {
      latestPriceMinor: best.unitPriceMinor,
      latestCurrency: best.currency,
      latestSellerName: best.sellerName,
      lastCheckedAt: new Date(),
      ...(dropped || entered ? { hasPriceDrop: true } : {}),
    },
    client,
  );

  return { status: 'found', item: updated };
}

/** Clears the price-drop nav badges — called once when /watchlist is opened. */
export async function markWatchlistSeen(client: DbClient = db): Promise<void> {
  await clearAllPriceDropFlags(client);
}

/**
 * Checks every watchlist item's price in one pass — the monthly cron
 * batch (`/api/cron/watchlist-check`, `vercel.json`'s `0 14 1 * *`
 * schedule), the automatic counterpart to the manual per-item check
 * button. Reuses `checkWatchlistItemPrice` unchanged for each item, so
 * an item's price history stays exactly as comparable whether a check
 * came from the cron or from the user — same identity-anchored poll,
 * same tracked-seller filtering, same needs_reresolution handling.
 *
 * Sequential, not `Promise.all`, deliberately: this is a real paid-API
 * call per item against SerpApi's rate limits, unlike the daily email
 * sync cron's `Promise.all` over a small, fixed number of inboxes — a
 * watchlist can grow to however many items the user is tracking, and
 * bursting that many concurrent SerpApi calls once a month is exactly
 * the kind of self-inflicted rate-limit risk this project has hit
 * before (docs/LEARNED.md's 503-under-load entries from testing this
 * feature). Each item's failure is caught individually so one bad
 * item — a real provider error, or anything else — never stops the
 * batch partway through; `checkWatchlistItemPrice` already resolves to
 * an `{ status: 'error' }` result rather than throwing for its own
 * known failure modes, but this still guards against anything
 * unexpected (e.g. a DB hiccup) escaping that.
 */
export async function checkAllWatchlistItemPrices(
  client: DbClient = db,
): Promise<{ itemId: string; result: PriceCheckResult }[]> {
  const items = await getAllWatchlistItems(client);
  const results: { itemId: string; result: PriceCheckResult }[] = [];

  for (const item of items) {
    try {
      results.push({ itemId: item.id, result: await checkWatchlistItemPrice(item.id, client) });
    } catch (error) {
      results.push({
        itemId: item.id,
        result: {
          status: 'error',
          message: error instanceof Error ? error.message : 'Price check failed.',
        },
      });
    }
  }

  return results;
}
