import { describe, expect, it } from 'vitest';
import { parseGoogleShoppingResponse } from '@/server/providers/google-shopping';

describe('parseGoogleShoppingResponse', () => {
  it('picks the minimum-priced result, not the first one', () => {
    const result = parseGoogleShoppingResponse({
      shopping_results: [
        { title: 'TV at Best Buy', extracted_price: 899.99, source: 'Best Buy' },
        { title: 'TV at Amazon', extracted_price: 849.0, source: 'Amazon' },
        { title: 'TV at Target', extracted_price: 879.5, source: 'Target' },
      ],
    });

    expect(result).toEqual({
      title: 'TV at Amazon',
      unitPriceMinor: 84900,
      currency: 'USD',
      sellerName: 'Amazon',
      productLink: null,
    });
  });

  it('converts decimal dollars to exact integer minor units', () => {
    const result = parseGoogleShoppingResponse({
      shopping_results: [{ title: 'Item', extracted_price: 19.98 }],
    });
    expect(result?.unitPriceMinor).toBe(1998);
  });

  it('skips entries with no extracted_price rather than crashing', () => {
    const result = parseGoogleShoppingResponse({
      shopping_results: [{ title: 'No price listed' }, { title: 'Priced', extracted_price: 10 }],
    });
    expect(result?.title).toBe('Priced');
  });

  it('returns null when there are no priced results', () => {
    expect(parseGoogleShoppingResponse({ shopping_results: [] })).toBeNull();
    expect(parseGoogleShoppingResponse({ shopping_results: [{ title: 'No price' }] })).toBeNull();
  });

  it('returns null when shopping_results is missing entirely', () => {
    expect(parseGoogleShoppingResponse({})).toBeNull();
  });
});
