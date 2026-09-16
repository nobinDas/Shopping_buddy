import { describe, expect, it } from 'vitest';
import { didPriceDrop, enteredExpectedRange, isOverExpectedRange } from '@/server/domain/price-trend';

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

describe('enteredExpectedRange', () => {
  it('is true when the price crosses from above the max to at-or-under it', () => {
    expect(enteredExpectedRange(1000, 1200, 1100)).toBe(true);
    expect(enteredExpectedRange(1100, 1200, 1100)).toBe(true); // lands exactly on the max
  });

  it('is false when the previous price was already within the max', () => {
    expect(enteredExpectedRange(1000, 1050, 1100)).toBe(false);
  });

  it('is false when the current price is still over the max', () => {
    expect(enteredExpectedRange(1150, 1300, 1100)).toBe(false);
  });

  it('is false with no expected max set', () => {
    expect(enteredExpectedRange(1000, 1200, null)).toBe(false);
  });

  it('is false with no previous price', () => {
    expect(enteredExpectedRange(1000, null, 1100)).toBe(false);
  });
});

describe('isOverExpectedRange', () => {
  it('is true when the price exceeds the expected max in the same currency', () => {
    expect(isOverExpectedRange(1200, 'USD', 1100, 'USD')).toBe(true);
  });

  it('is false when the price is at or under the expected max', () => {
    expect(isOverExpectedRange(1100, 'USD', 1100, 'USD')).toBe(false);
    expect(isOverExpectedRange(900, 'USD', 1100, 'USD')).toBe(false);
  });

  it('is false with no expected max set', () => {
    expect(isOverExpectedRange(1200, 'USD', null, null)).toBe(false);
  });

  it('is false on a currency mismatch, even if the raw numbers look over — never compares across currencies', () => {
    expect(isOverExpectedRange(120000, 'JPY', 1100, 'USD')).toBe(false);
  });
});
