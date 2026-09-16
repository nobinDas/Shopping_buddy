import { describe, expect, it, vi, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, type DbClient } from '@/server/db';
import { watchlistItems } from '@/server/db/schema';
import {
  getRecommendedStores,
  findWatchlistCandidates,
  createWatchlistItem,
  deleteWatchlistItem,
  checkWatchlistItemPrice,
  markWatchlistSeen,
} from '@/server/services/watchlist.service';
import { buildWatchlistItem } from '../fixtures/builders';

// docs/TESTING.md: "External providers mocked at the adapter boundary in
// src/server/providers/" — google-shopping.ts and the watchlist-related
// anthropic.ts calls are mocked here; the DB side runs for real against
// Postgres inside a rolled-back transaction. InvalidPageTokenError needs
// a real class (not a plain vi.fn()) so `error instanceof
// InvalidPageTokenError` in the service under test still works against
// values constructed here.
vi.mock('@/server/providers/google-shopping', () => ({
  searchProductCandidates: vi.fn(),
  getImmersiveProductOffers: vi.fn(),
  InvalidPageTokenError: class InvalidPageTokenError extends Error {},
}));
vi.mock('@/server/providers/anthropic', () => ({
  planWatchlistQuery: vi.fn(),
  recommendWatchlistStores: vi.fn(),
  validateShoppingCandidates: vi.fn(),
}));

const googleShopping = await import('@/server/providers/google-shopping');
const anthropic = await import('@/server/providers/anthropic');

beforeEach(() => {
  vi.mocked(googleShopping.searchProductCandidates).mockReset();
  vi.mocked(googleShopping.getImmersiveProductOffers).mockReset();
  vi.mocked(anthropic.planWatchlistQuery).mockReset();
  vi.mocked(anthropic.recommendWatchlistStores).mockReset();
  vi.mocked(anthropic.validateShoppingCandidates).mockReset();
});

async function insertItem(tx: DbClient, overrides = {}) {
  const [row] = await tx.insert(watchlistItems).values(buildWatchlistItem(overrides)).returning();
  if (!row) throw new Error('Insert did not return a row');
  return row;
}

describe('getRecommendedStores', () => {
  it('returns the provider result', async () => {
    vi.mocked(anthropic.recommendWatchlistStores).mockResolvedValue(['Best Buy', 'Amazon']);
    const stores = await getRecommendedStores({
      name: 'iPhone 18 Pro',
      category: 'electronics',
      brand: 'Apple',
      variant: null,
    });
    expect(stores).toEqual(['Best Buy', 'Amazon']);
  });

  it('returns an empty array rather than throwing when the provider fails', async () => {
    vi.mocked(anthropic.recommendWatchlistStores).mockRejectedValue(new Error('API down'));
    const stores = await getRecommendedStores({
      name: 'iPhone 18 Pro',
      category: 'electronics',
      brand: null,
      variant: null,
    });
    expect(stores).toEqual([]);
  });
});

describe('findWatchlistCandidates', () => {
  it('excludes accessory titles and returns the rest', async () => {
    vi.mocked(anthropic.planWatchlistQuery).mockResolvedValue({
      brand: 'Apple',
      productLine: 'iPhone',
      model: '18 Pro',
      variant: null,
      excludeTerms: ['case', 'cover'],
    });
    vi.mocked(googleShopping.searchProductCandidates).mockResolvedValue([
      { productId: 'p1', pageToken: 'token1', title: 'Apple iPhone 18 Pro', unitPriceMinor: 99900, currency: 'USD', sellerName: 'Best Buy', productLink: null },
      { productId: 'p2', pageToken: 'token2', title: 'iPhone 18 Pro Silicone Case', unitPriceMinor: 2999, currency: 'USD', sellerName: 'Amazon', productLink: null },
    ]);
    vi.mocked(anthropic.validateShoppingCandidates).mockResolvedValue([true]);

    const candidates = await findWatchlistCandidates({
      name: 'iPhone 18 Pro',
      category: 'electronics',
      brand: 'Apple',
      variant: null,
      notes: null,
      expectedPriceMinMinor: null,
      expectedPriceMaxMinor: null,
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.productId).toBe('p1');
  });

  it('deduplicates multiple sellers of the same product before validating', async () => {
    vi.mocked(anthropic.planWatchlistQuery).mockResolvedValue(null);
    vi.mocked(googleShopping.searchProductCandidates).mockResolvedValue([
      { productId: 'p1', pageToken: 'token-a', title: 'iPhone 18 Pro', unitPriceMinor: 99900, currency: 'USD', sellerName: 'Best Buy', productLink: null },
      { productId: 'p1', pageToken: 'token-b', title: 'iPhone 18 Pro', unitPriceMinor: 94900, currency: 'USD', sellerName: 'Amazon', productLink: null },
    ]);
    vi.mocked(anthropic.validateShoppingCandidates).mockResolvedValue([true]);

    const candidates = await findWatchlistCandidates({
      name: 'iPhone 18 Pro',
      category: 'electronics',
      brand: null,
      variant: null,
      notes: null,
      expectedPriceMinMinor: null,
      expectedPriceMaxMinor: null,
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.sellerName).toBe('Amazon'); // the lower-priced of the two
    expect(anthropic.validateShoppingCandidates).toHaveBeenCalledWith('iPhone 18 Pro', ['iPhone 18 Pro']);
  });

  it('returns an empty array rather than throwing when the search provider fails', async () => {
    // Confirmed live: a real transient 503 from SerpApi, unhandled here,
    // crashed the whole add-item request into a raw 500. Same
    // graceful-degradation posture as the planner/validator calls.
    vi.mocked(anthropic.planWatchlistQuery).mockResolvedValue(null);
    vi.mocked(googleShopping.searchProductCandidates).mockRejectedValue(
      new Error('SerpApi (google_shopping) responded 503'),
    );

    const candidates = await findWatchlistCandidates({
      name: 'iPhone 18 Pro',
      category: 'electronics',
      brand: null,
      variant: null,
      notes: null,
      expectedPriceMinMinor: null,
      expectedPriceMaxMinor: null,
    });

    expect(candidates).toEqual([]);
  });

  it('falls back to the raw name as the query when the planner fails', async () => {
    vi.mocked(anthropic.planWatchlistQuery).mockRejectedValue(new Error('API down'));
    vi.mocked(googleShopping.searchProductCandidates).mockResolvedValue([
      { productId: 'p1', pageToken: 'token1', title: 'Vacuum', unitPriceMinor: 20000, currency: 'USD', sellerName: null, productLink: null },
    ]);
    vi.mocked(anthropic.validateShoppingCandidates).mockResolvedValue([true]);

    await findWatchlistCandidates({
      name: 'Robot Vacuum',
      category: 'appliances',
      brand: null,
      variant: null,
      notes: null,
      expectedPriceMinMinor: null,
      expectedPriceMaxMinor: null,
    });

    expect(googleShopping.searchProductCandidates).toHaveBeenCalledWith('Robot Vacuum');
  });

  it('falls back to the heuristic-only result when LLM validation fails', async () => {
    vi.mocked(anthropic.planWatchlistQuery).mockResolvedValue(null);
    vi.mocked(googleShopping.searchProductCandidates).mockResolvedValue([
      { productId: 'p1', pageToken: 'token1', title: 'Robot Vacuum', unitPriceMinor: 20000, currency: 'USD', sellerName: null, productLink: null },
    ]);
    vi.mocked(anthropic.validateShoppingCandidates).mockRejectedValue(new Error('API down'));

    const candidates = await findWatchlistCandidates({
      name: 'Robot Vacuum',
      category: 'appliances',
      brand: null,
      variant: null,
      notes: null,
      expectedPriceMinMinor: null,
      expectedPriceMaxMinor: null,
    });

    expect(candidates).toHaveLength(1);
  });

  it('drops candidates outside the expected price range, even when they survive the accessory heuristic', async () => {
    // Confirmed live (2026-09-15): SerpApi's google_shopping engine
    // silently ignores its own tbs/low_price/high_price price filters,
    // so this can no longer be enforced as a search-time parameter — see
    // domain/watchlist-candidates.ts#filterByExpectedPriceRange. Filtering
    // the returned candidates by price instead catches exactly the case
    // that motivated this: an accessory whose title contains none of the
    // exclude terms, priced far outside the expected range.
    vi.mocked(anthropic.planWatchlistQuery).mockResolvedValue(null);
    vi.mocked(googleShopping.searchProductCandidates).mockResolvedValue([
      { productId: 'p1', pageToken: 'token1', title: 'iPhone 18 Pro', unitPriceMinor: 99900, currency: 'USD', sellerName: 'Best Buy', productLink: null },
      { productId: 'p2', pageToken: 'token2', title: 'iPhone 18 Pro/17 Pro', unitPriceMinor: 3999, currency: 'USD', sellerName: 'Catalyst Case', productLink: null },
    ]);
    vi.mocked(anthropic.validateShoppingCandidates).mockResolvedValue([true]);

    const candidates = await findWatchlistCandidates({
      name: 'iPhone 18 Pro',
      category: 'electronics',
      brand: null,
      variant: null,
      notes: null,
      expectedPriceMinMinor: 80000,
      expectedPriceMaxMinor: 120000,
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.productId).toBe('p1');
    expect(anthropic.validateShoppingCandidates).toHaveBeenCalledWith('iPhone 18 Pro', ['iPhone 18 Pro']);
  });

  it('returns an empty array when every candidate looks like an accessory', async () => {
    vi.mocked(anthropic.planWatchlistQuery).mockResolvedValue({
      brand: null,
      productLine: null,
      model: null,
      variant: null,
      excludeTerms: ['case'],
    });
    vi.mocked(googleShopping.searchProductCandidates).mockResolvedValue([
      { productId: 'p1', pageToken: 'token1', title: 'Phone Case', unitPriceMinor: 1999, currency: 'USD', sellerName: null, productLink: null },
    ]);

    const candidates = await findWatchlistCandidates({
      name: 'Phone',
      category: 'electronics',
      brand: null,
      variant: null,
      notes: null,
      expectedPriceMinMinor: null,
      expectedPriceMaxMinor: null,
    });

    expect(candidates).toEqual([]);
    expect(anthropic.validateShoppingCandidates).not.toHaveBeenCalled();
  });
});

describe('createWatchlistItem / deleteWatchlistItem', () => {
  it('creates an item with the confirmed candidate as its resolved identity', async () => {
    await expect(
      db.transaction(async (tx) => {
        const item = await createWatchlistItem(
          {
            name: '4K OLED TV, 55"',
            category: 'electronics',
            brand: null,
            variant: null,
            notes: null,
            expectedPriceMinMinor: null,
            expectedPriceMaxMinor: null,
            expectedPriceCurrency: null,
            trackedSellers: ['Best Buy'],
          },
          {
            productId: 'p1',
            pageToken: 'page-token-1',
            title: 'Real 4K OLED TV 55"',
            unitPriceMinor: 129900,
            currency: 'USD',
            sellerName: 'Best Buy',
            productLink: 'https://example.com',
          },
          tx,
        );

        expect(item.resolvedProductId).toBe('p1');
        expect(item.resolvedPageToken).toBe('page-token-1');
        expect(item.resolvedTitle).toBe('Real 4K OLED TV 55"');
        expect(item.resolutionStatus).toBe('resolved');
        expect(item.hasPriceDrop).toBe(false);

        tx.rollback();
      }),
    ).rejects.toThrow();
  });

  it('permanently removes the item on delete', async () => {
    await expect(
      db.transaction(async (tx) => {
        const item = await insertItem(tx);
        await deleteWatchlistItem(item.id, tx);

        const [remaining] = await tx.select().from(watchlistItems).where(eq(watchlistItems.id, item.id));
        expect(remaining).toBeUndefined();

        tx.rollback();
      }),
    ).rejects.toThrow();
  });
});

describe('checkWatchlistItemPrice', () => {
  it('writes history and caches the latest price on the first check, without flagging a drop', async () => {
    await expect(
      db.transaction(async (tx) => {
        const item = await insertItem(tx, { trackedSellers: ['Amazon'] });

        vi.mocked(googleShopping.getImmersiveProductOffers).mockResolvedValue([
          { unitPriceMinor: 40000, currency: 'USD', sellerName: 'Amazon', productLink: 'https://example.com' },
        ]);

        const result = await checkWatchlistItemPrice(item.id, tx);

        expect(result.status).toBe('found');
        if (result.status === 'found') {
          expect(result.item.latestPriceMinor).toBe(40000);
          expect(result.item.hasPriceDrop).toBe(false);
        }

        tx.rollback();
      }),
    ).rejects.toThrow();
  });

  it('sets hasPriceDrop when a later check is lower than the cached price', async () => {
    await expect(
      db.transaction(async (tx) => {
        const item = await insertItem(tx, { trackedSellers: ['Tire Rack'] });

        vi.mocked(googleShopping.getImmersiveProductOffers).mockResolvedValueOnce([
          { unitPriceMinor: 40000, currency: 'USD', sellerName: 'Tire Rack', productLink: null },
        ]);
        await checkWatchlistItemPrice(item.id, tx);

        vi.mocked(googleShopping.getImmersiveProductOffers).mockResolvedValueOnce([
          { unitPriceMinor: 35000, currency: 'USD', sellerName: 'Tire Rack', productLink: null },
        ]);
        const result = await checkWatchlistItemPrice(item.id, tx);

        expect(result.status).toBe('found');
        if (result.status === 'found') {
          expect(result.item.hasPriceDrop).toBe(true);
          expect(result.item.latestPriceMinor).toBe(35000);
        }

        tx.rollback();
      }),
    ).rejects.toThrow();
  });

  it('does not flag a drop when the price rises or stays the same', async () => {
    await expect(
      db.transaction(async (tx) => {
        const item = await insertItem(tx, { trackedSellers: ['Any'] });

        vi.mocked(googleShopping.getImmersiveProductOffers).mockResolvedValueOnce([
          { unitPriceMinor: 35000, currency: 'USD', sellerName: 'Any', productLink: null },
        ]);
        await checkWatchlistItemPrice(item.id, tx);

        vi.mocked(googleShopping.getImmersiveProductOffers).mockResolvedValueOnce([
          { unitPriceMinor: 35000, currency: 'USD', sellerName: 'Any', productLink: null },
        ]);
        const result = await checkWatchlistItemPrice(item.id, tx);

        expect(result.status).toBe('found');
        if (result.status === 'found') {
          expect(result.item.hasPriceDrop).toBe(false);
        }

        tx.rollback();
      }),
    ).rejects.toThrow();
  });

  it('flags hasPriceDrop when the price enters the expected range from above, even without a matching prior check', async () => {
    await expect(
      db.transaction(async (tx) => {
        const item = await insertItem(tx, {
          trackedSellers: ['Any'],
          latestPriceMinor: 130000,
          expectedPriceMaxMinor: 100000,
          expectedPriceCurrency: 'USD',
        });

        vi.mocked(googleShopping.getImmersiveProductOffers).mockResolvedValue([
          { unitPriceMinor: 95000, currency: 'USD', sellerName: 'Any', productLink: null },
        ]);
        const result = await checkWatchlistItemPrice(item.id, tx);

        expect(result.status).toBe('found');
        if (result.status === 'found') {
          expect(result.item.hasPriceDrop).toBe(true);
        }

        tx.rollback();
      }),
    ).rejects.toThrow();
  });

  it('returns not_found when no offer is from a tracked seller', async () => {
    await expect(
      db.transaction(async (tx) => {
        const item = await insertItem(tx, { trackedSellers: ['Best Buy'] });

        vi.mocked(googleShopping.getImmersiveProductOffers).mockResolvedValue([
          { unitPriceMinor: 10000, currency: 'USD', sellerName: 'Some Random Reseller', productLink: null },
        ]);

        const result = await checkWatchlistItemPrice(item.id, tx);
        expect(result.status).toBe('not_found');

        tx.rollback();
      }),
    ).rejects.toThrow();
  });

  it('flags needs_reresolution when the product no longer resolves at all', async () => {
    await expect(
      db.transaction(async (tx) => {
        const item = await insertItem(tx);

        vi.mocked(googleShopping.getImmersiveProductOffers).mockResolvedValue([]);

        const result = await checkWatchlistItemPrice(item.id, tx);
        expect(result.status).toBe('needs_reresolution');

        const [updated] = await tx.select().from(watchlistItems).where(eq(watchlistItems.id, item.id));
        expect(updated?.resolutionStatus).toBe('needs_reresolution');

        tx.rollback();
      }),
    ).rejects.toThrow();
  });

  it('flags needs_reresolution when the provider rejects the page token as invalid or expired', async () => {
    await expect(
      db.transaction(async (tx) => {
        const item = await insertItem(tx);

        vi.mocked(googleShopping.getImmersiveProductOffers).mockRejectedValue(
          new googleShopping.InvalidPageTokenError('Invalid `page_token` parameter.'),
        );

        const result = await checkWatchlistItemPrice(item.id, tx);
        expect(result.status).toBe('needs_reresolution');

        const [updated] = await tx.select().from(watchlistItems).where(eq(watchlistItems.id, item.id));
        expect(updated?.resolutionStatus).toBe('needs_reresolution');

        tx.rollback();
      }),
    ).rejects.toThrow();
  });

  it('flags needs_reresolution without calling the provider when resolvedPageToken is null', async () => {
    // An item resolved before resolvedPageToken existed (schema.ts's own
    // comment on the column) — nothing to poll, so this is treated the
    // same as a resolution that stopped working rather than calling the
    // provider with nothing.
    await expect(
      db.transaction(async (tx) => {
        const item = await insertItem(tx, { resolvedPageToken: null });

        const result = await checkWatchlistItemPrice(item.id, tx);
        expect(result.status).toBe('needs_reresolution');
        expect(googleShopping.getImmersiveProductOffers).not.toHaveBeenCalled();

        tx.rollback();
      }),
    ).rejects.toThrow();
  });

  it('short-circuits without calling the provider when already flagged needs_reresolution', async () => {
    await expect(
      db.transaction(async (tx) => {
        const item = await insertItem(tx, { resolutionStatus: 'needs_reresolution' });

        const result = await checkWatchlistItemPrice(item.id, tx);

        expect(result.status).toBe('needs_reresolution');
        expect(googleShopping.getImmersiveProductOffers).not.toHaveBeenCalled();

        tx.rollback();
      }),
    ).rejects.toThrow();
  });

  it('returns an error result when the provider throws', async () => {
    await expect(
      db.transaction(async (tx) => {
        const item = await insertItem(tx);

        vi.mocked(googleShopping.getImmersiveProductOffers).mockRejectedValue(new Error('SerpApi responded 429'));

        const result = await checkWatchlistItemPrice(item.id, tx);

        expect(result).toEqual({ status: 'error', message: 'SerpApi responded 429' });

        tx.rollback();
      }),
    ).rejects.toThrow();
  });
});

describe('markWatchlistSeen', () => {
  it('clears hasPriceDrop on every item', async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.insert(watchlistItems).values(buildWatchlistItem({ name: 'A', hasPriceDrop: true }));
        await tx.insert(watchlistItems).values(buildWatchlistItem({ name: 'B', hasPriceDrop: true }));

        await markWatchlistSeen(tx);

        const all = await tx.select().from(watchlistItems);
        expect(all.every((item) => !item.hasPriceDrop)).toBe(true);

        tx.rollback();
      }),
    ).rejects.toThrow();
  });
});
