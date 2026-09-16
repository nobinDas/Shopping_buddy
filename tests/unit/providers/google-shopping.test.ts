import { describe, expect, it } from 'vitest';
import {
  parseGoogleShoppingCandidates,
  parseImmersiveProductOffers,
  assertSerpApiSucceeded,
} from '@/server/providers/google-shopping';

describe('parseGoogleShoppingCandidates', () => {
  it('returns every priced, identified candidate — no relevance filtering at this layer', () => {
    const result = parseGoogleShoppingCandidates({
      shopping_results: [
        {
          title: 'iPhone 18 Pro 256GB',
          product_id: 'p1',
          immersive_product_page_token: 'token1',
          extracted_price: 999.0,
          source: 'Best Buy',
          product_link: 'https://example.com/p1',
        },
        {
          title: 'iPhone 18 Pro Silicone Case',
          product_id: 'p2',
          extracted_price: 29.99,
          source: 'Amazon',
        },
      ],
    });

    expect(result).toEqual([
      {
        productId: 'p1',
        pageToken: 'token1',
        title: 'iPhone 18 Pro 256GB',
        unitPriceMinor: 99900,
        currency: 'USD',
        sellerName: 'Best Buy',
        productLink: 'https://example.com/p1',
      },
      {
        productId: 'p2',
        pageToken: null,
        title: 'iPhone 18 Pro Silicone Case',
        unitPriceMinor: 2999,
        currency: 'USD',
        sellerName: 'Amazon',
        productLink: null,
      },
    ]);
  });

  it('skips entries missing a title, product_id, or extracted_price', () => {
    const result = parseGoogleShoppingCandidates({
      shopping_results: [
        { title: 'No product_id', extracted_price: 10 },
        { product_id: 'p1', extracted_price: 10 },
        { title: 'No price', product_id: 'p1' },
        { title: 'Complete', product_id: 'p2', extracted_price: 10 },
      ],
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.productId).toBe('p2');
  });

  it('returns an empty array when shopping_results is missing entirely', () => {
    expect(parseGoogleShoppingCandidates({})).toEqual([]);
  });
});

describe('parseImmersiveProductOffers', () => {
  it('parses each store using extracted_total, not the headline price', () => {
    // Deliberately the total, not price — a carrier financing offer's
    // headline `price` can be a single monthly payment far below the
    // real total. See providers/google-shopping.ts's own doc comment.
    const result = parseImmersiveProductOffers({
      product_results: {
        stores: [
          { name: 'Best Buy', link: 'https://example.com/bb', price: '$38.01', extracted_price: 38.01, total: '$38.01', extracted_total: 38.01 },
          { name: 'Verizon', price: '$30.55', extracted_price: 30.55, total: '$1,099.80', extracted_total: 1099.8 },
        ],
      },
    });

    expect(result).toEqual([
      { unitPriceMinor: 3801, currency: 'USD', sellerName: 'Best Buy', productLink: 'https://example.com/bb' },
      { unitPriceMinor: 109980, currency: 'USD', sellerName: 'Verizon', productLink: null },
    ]);
  });

  it('falls back to parsing the total display string when extracted_total is missing', () => {
    const result = parseImmersiveProductOffers({
      product_results: {
        stores: [{ name: 'Fallback Seller', total: '$10.00' }],
      },
    });
    expect(result).toEqual([
      { unitPriceMinor: 1000, currency: 'USD', sellerName: 'Fallback Seller', productLink: null },
    ]);
  });

  it('drops a store row whose total does not parse, rather than throwing', () => {
    const result = parseImmersiveProductOffers({
      product_results: {
        stores: [
          { name: 'Bad Row', total: 'Contact for price' },
          { name: 'Good Row', total: '$10.00' },
        ],
      },
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.sellerName).toBe('Good Row');
  });

  it('returns an empty array when product_results/stores is missing', () => {
    expect(parseImmersiveProductOffers({})).toEqual([]);
    expect(parseImmersiveProductOffers({ product_results: {} })).toEqual([]);
  });
});

describe('assertSerpApiSucceeded', () => {
  it('does not throw when search_metadata.status is Success, even with an informational error message', () => {
    // A real, deliberate zero-result answer — confirmed live, an
    // over-constrained google_shopping query — still reports Success.
    expect(() => {
      assertSerpApiSucceeded(
        { search_metadata: { status: 'Success' }, error: "Google hasn't returned any results for this query." },
        'google_shopping',
      );
    }).not.toThrow();
  });

  it('does not throw when search_metadata is absent entirely', () => {
    expect(() => {
      assertSerpApiSucceeded({ shopping_results: [] }, 'google_shopping');
    }).not.toThrow();
  });

  it('throws when search_metadata.status is anything other than Success', () => {
    // A real, observed upstream failure — confirmed live while
    // debugging this feature, distinct in shape from a genuine
    // zero-result answer.
    expect(() => {
      assertSerpApiSucceeded(
        { search_metadata: { status: 'Error' }, error: 'Please try again later.' },
        'google_shopping',
      );
    }).toThrow(/Please try again later/);
  });
});
