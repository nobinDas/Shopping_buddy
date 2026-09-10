import { describe, expect, it } from 'vitest';
import { parseWalmartSearchResponse } from '@/server/providers/serpapi';

describe('parseWalmartSearchResponse', () => {
  it('extracts title, price, and currency from a valid response', () => {
    const result = parseWalmartSearchResponse({
      organic_results: [
        { title: 'Bimbo Soft White Bread, 20 oz', primary_offer: { offer_price: 1.98 } },
      ],
    });

    expect(result).toEqual({
      title: 'Bimbo Soft White Bread, 20 oz',
      unitPriceMinor: 198,
      currency: 'USD',
    });
  });

  it('converts the decimal price to integer minor units exactly', () => {
    const result = parseWalmartSearchResponse({
      organic_results: [{ title: 'Milk, 1gal', primary_offer: { offer_price: 4.49 } }],
    });

    expect(result?.unitPriceMinor).toBe(449);
    expect(Number.isInteger(result?.unitPriceMinor)).toBe(true);
  });

  it('takes only the first (top) result when several are present', () => {
    const result = parseWalmartSearchResponse({
      organic_results: [
        { title: 'First match', primary_offer: { offer_price: 1.0 } },
        { title: 'Second match', primary_offer: { offer_price: 2.0 } },
      ],
    });

    expect(result?.title).toBe('First match');
  });

  it('returns null when organic_results is empty', () => {
    expect(parseWalmartSearchResponse({ organic_results: [] })).toBeNull();
  });

  it('returns null when organic_results is missing entirely', () => {
    expect(parseWalmartSearchResponse({})).toBeNull();
  });

  it('returns null when the top result has no price', () => {
    const result = parseWalmartSearchResponse({
      organic_results: [{ title: 'No price listed' }],
    });

    expect(result).toBeNull();
  });

  it('returns null when the top result has no title', () => {
    const result = parseWalmartSearchResponse({
      organic_results: [{ primary_offer: { offer_price: 1.5 } }],
    });

    expect(result).toBeNull();
  });
});
