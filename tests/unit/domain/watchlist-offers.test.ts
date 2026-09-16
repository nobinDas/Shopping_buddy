import { describe, expect, it } from 'vitest';
import { pickTrackedLowestOffer, type ProductOffer } from '@/server/domain/watchlist-offers';

function offer(overrides: Partial<ProductOffer> = {}): ProductOffer {
  return {
    unitPriceMinor: 99999,
    currency: 'USD',
    sellerName: 'Best Buy',
    productLink: null,
    ...overrides,
  };
}

describe('pickTrackedLowestOffer', () => {
  it('picks the lowest-priced offer among tracked sellers', () => {
    const result = pickTrackedLowestOffer(
      [
        offer({ sellerName: 'Best Buy', unitPriceMinor: 99999 }),
        offer({ sellerName: 'Amazon', unitPriceMinor: 94999 }),
      ],
      ['Best Buy', 'Amazon'],
    );
    expect(result?.sellerName).toBe('Amazon');
  });

  it('excludes offers from sellers not in the tracked list', () => {
    const result = pickTrackedLowestOffer(
      [
        offer({ sellerName: 'Some Random Reseller', unitPriceMinor: 49999 }),
        offer({ sellerName: 'Best Buy', unitPriceMinor: 99999 }),
      ],
      ['Best Buy'],
    );
    expect(result?.sellerName).toBe('Best Buy');
    expect(result?.unitPriceMinor).toBe(99999);
  });

  it('matches when the tracked seller is more specific than the returned name', () => {
    const result = pickTrackedLowestOffer(
      [offer({ sellerName: 'Amazon', unitPriceMinor: 94999 })],
      ['Amazon.com'],
    );
    expect(result).not.toBeNull();
  });

  it('matches when the returned name is more specific than the tracked seller', () => {
    const result = pickTrackedLowestOffer(
      [offer({ sellerName: 'Best Buy Marketplace', unitPriceMinor: 94999 })],
      ['Best Buy'],
    );
    expect(result).not.toBeNull();
  });

  it('returns null when no offer is from a tracked seller — never falls back to an untracked one', () => {
    const result = pickTrackedLowestOffer(
      [offer({ sellerName: 'Some Random Reseller' })],
      ['Best Buy', 'Amazon'],
    );
    expect(result).toBeNull();
  });

  it('returns null for an offer with no seller name at all', () => {
    const result = pickTrackedLowestOffer([offer({ sellerName: null })], ['Best Buy']);
    expect(result).toBeNull();
  });

  it('returns null for empty offers', () => {
    expect(pickTrackedLowestOffer([], ['Best Buy'])).toBeNull();
  });
});
