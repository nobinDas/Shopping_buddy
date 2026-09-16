import { describe, expect, it } from 'vitest';
import {
  dedupeByProductId,
  filterByExpectedPriceRange,
  type ProductCandidate,
} from '@/server/domain/watchlist-candidates';

function candidate(overrides: Partial<ProductCandidate> = {}): ProductCandidate {
  return {
    productId: 'p1',
    pageToken: 'token-p1',
    title: 'iPhone 18 Pro',
    unitPriceMinor: 99999,
    currency: 'USD',
    sellerName: 'Best Buy',
    productLink: null,
    ...overrides,
  };
}

describe('dedupeByProductId', () => {
  it('collapses multiple sellers of the same product into one, keeping the lowest price', () => {
    const result = dedupeByProductId([
      candidate({ productId: 'p1', unitPriceMinor: 99999, sellerName: 'Best Buy' }),
      candidate({ productId: 'p1', unitPriceMinor: 94999, sellerName: 'Amazon' }),
      candidate({ productId: 'p1', unitPriceMinor: 97999, sellerName: 'Target' }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.sellerName).toBe('Amazon');
    expect(result[0]?.unitPriceMinor).toBe(94999);
  });

  it('leaves distinct products untouched', () => {
    const result = dedupeByProductId([
      candidate({ productId: 'p1' }),
      candidate({ productId: 'p2', title: 'iPhone 18 Pro Case' }),
    ]);

    expect(result.map((c) => c.productId).sort()).toEqual(['p1', 'p2']);
  });

  it('returns an empty array for empty input', () => {
    expect(dedupeByProductId([])).toEqual([]);
  });
});

describe('filterByExpectedPriceRange', () => {
  it('drops candidates priced below the minimum or above the maximum', () => {
    const result = filterByExpectedPriceRange(
      [
        candidate({ productId: 'accessory', unitPriceMinor: 3999 }),
        candidate({ productId: 'real-phone', unitPriceMinor: 109999 }),
        candidate({ productId: 'too-expensive', unitPriceMinor: 200000 }),
      ],
      80000,
      120000,
    );

    expect(result.map((c) => c.productId)).toEqual(['real-phone']);
  });

  it('treats a missing bound as unconstrained on that side', () => {
    const candidates = [
      candidate({ productId: 'cheap', unitPriceMinor: 1000 }),
      candidate({ productId: 'mid', unitPriceMinor: 100000 }),
      candidate({ productId: 'expensive', unitPriceMinor: 500000 }),
    ];

    expect(filterByExpectedPriceRange(candidates, 80000, null).map((c) => c.productId)).toEqual([
      'mid',
      'expensive',
    ]);
    expect(filterByExpectedPriceRange(candidates, null, 120000).map((c) => c.productId)).toEqual([
      'cheap',
      'mid',
    ]);
  });

  it('passes every candidate through unchanged when no range is set', () => {
    const candidates = [candidate({ productId: 'a' }), candidate({ productId: 'b' })];
    expect(filterByExpectedPriceRange(candidates, null, null)).toEqual(candidates);
  });

  it('returns an empty array for empty input', () => {
    expect(filterByExpectedPriceRange([], 80000, 120000)).toEqual([]);
  });
});
