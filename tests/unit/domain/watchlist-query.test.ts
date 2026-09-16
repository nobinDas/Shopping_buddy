import { describe, expect, it } from 'vitest';
import { buildShoppingQuery, type WatchlistQueryPlan } from '@/server/domain/watchlist-query';

function plan(overrides: Partial<WatchlistQueryPlan> = {}): WatchlistQueryPlan {
  return {
    brand: 'Apple',
    productLine: 'iPhone',
    model: '18 Pro',
    variant: null,
    excludeTerms: ['case', 'cover'],
    ...overrides,
  };
}

describe('buildShoppingQuery', () => {
  it('joins brand/productLine/model/variant into one quoted phrase', () => {
    expect(buildShoppingQuery(plan({ variant: '256GB' }))).toBe('"Apple iPhone 18 Pro 256GB"');
  });

  it('omits null fields rather than leaving gaps', () => {
    expect(buildShoppingQuery(plan({ brand: null, variant: null }))).toBe('"iPhone 18 Pro"');
  });

  it('returns an empty string when every identifying field is null', () => {
    expect(
      buildShoppingQuery({
        brand: null,
        productLine: null,
        model: null,
        variant: null,
        excludeTerms: ['case'],
      }),
    ).toBe('');
  });

  it('never appends exclude terms to the query string', () => {
    // Confirmed live (2026-09-15): a single negated word collapsed a
    // search that otherwise returned real phone listings down to
    // accessory-only results — see this function's own doc comment.
    // excludeTerms is still on the plan, but only for post-fetch title
    // filtering (watchlist-result-filter.ts#isLikelyAccessory), never
    // for the query itself.
    expect(
      buildShoppingQuery(plan({ excludeTerms: ['case', 'cover', 'charger', 'screen protector'] })),
    ).toBe('"Apple iPhone 18 Pro"');
  });
});
