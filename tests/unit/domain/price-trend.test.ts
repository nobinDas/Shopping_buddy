import { describe, expect, it } from 'vitest';
import { didPriceDrop } from '@/server/domain/price-trend';

describe('didPriceDrop', () => {
  it('is false when there is no previous price', () => {
    expect(didPriceDrop(999, null)).toBe(false);
  });

  it('is true when the current price is lower', () => {
    expect(didPriceDrop(899, 999)).toBe(true);
  });

  it('is false when the price rose', () => {
    expect(didPriceDrop(1099, 999)).toBe(false);
  });

  it('is false when the price is unchanged', () => {
    expect(didPriceDrop(999, 999)).toBe(false);
  });
});
