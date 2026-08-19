import { describe, expect, it } from 'vitest';
import { calculateMonthlyBurn } from '@/server/domain/burn';

describe('calculateMonthlyBurn', () => {
  it('returns an empty array for an empty input', () => {
    expect(calculateMonthlyBurn([])).toEqual([]);
  });

  it('passes a monthly subscription through unchanged', () => {
    const result = calculateMonthlyBurn([{ amountMinor: 1500, currency: 'USD', cycle: 'monthly' }]);

    expect(result).toEqual([{ amountMinor: 1500, currency: 'USD' }]);
  });

  it('divides a quarterly subscription by three', () => {
    const result = calculateMonthlyBurn([
      { amountMinor: 3000, currency: 'USD', cycle: 'quarterly' },
    ]);

    expect(result).toEqual([{ amountMinor: 1000, currency: 'USD' }]);
  });

  it('divides a semiannual subscription by six', () => {
    const result = calculateMonthlyBurn([
      { amountMinor: 6000, currency: 'USD', cycle: 'semiannual' },
    ]);

    expect(result).toEqual([{ amountMinor: 1000, currency: 'USD' }]);
  });

  it('divides an annual subscription by twelve', () => {
    const result = calculateMonthlyBurn([{ amountMinor: 12000, currency: 'USD', cycle: 'annual' }]);

    expect(result).toEqual([{ amountMinor: 1000, currency: 'USD' }]);
  });

  describe('rounding', () => {
    it('rounds a non-exact quarterly division to the nearest cent', () => {
      // 1000 / 3 = 333.33... — must round, never truncate or carry a float.
      const result = calculateMonthlyBurn([
        { amountMinor: 1000, currency: 'USD', cycle: 'quarterly' },
      ]);

      expect(result).toEqual([{ amountMinor: 333, currency: 'USD' }]);
    });

    it('returns an integer even when the exact division is not one', () => {
      const result = calculateMonthlyBurn([{ amountMinor: 100, currency: 'USD', cycle: 'annual' }]);

      const [total] = result;
      expect(Number.isInteger(total?.amountMinor)).toBe(true);
    });
  });

  describe('custom intervals', () => {
    it('normalizes a custom cycle using average days per month', () => {
      // $10.00 every 7 days ≈ $10.00 * (30.4375 / 7) ≈ $43.48/month.
      const result = calculateMonthlyBurn([
        { amountMinor: 1000, currency: 'USD', cycle: 'custom', cycleDays: 7 },
      ]);

      expect(result).toEqual([{ amountMinor: 4348, currency: 'USD' }]);
    });

    it('throws when cycleDays is missing on a custom cycle', () => {
      expect(() =>
        calculateMonthlyBurn([{ amountMinor: 1000, currency: 'USD', cycle: 'custom' }]),
      ).toThrow("cycleDays must be a positive integer when cycle is 'custom'");
    });

    it('throws when cycleDays is zero or negative', () => {
      expect(() =>
        calculateMonthlyBurn([
          { amountMinor: 1000, currency: 'USD', cycle: 'custom', cycleDays: -3 },
        ]),
      ).toThrow("cycleDays must be a positive integer when cycle is 'custom'");
    });

    it('throws when cycleDays is set on a non-custom cycle', () => {
      expect(() =>
        calculateMonthlyBurn([
          { amountMinor: 1000, currency: 'USD', cycle: 'monthly', cycleDays: 7 },
        ]),
      ).toThrow("cycleDays must not be set when cycle is 'monthly'");
    });
  });

  describe('mixed cycles, same currency', () => {
    it('sums normalized amounts across different cycles', () => {
      const result = calculateMonthlyBurn([
        { amountMinor: 1000, currency: 'USD', cycle: 'monthly' }, // 1000
        { amountMinor: 3000, currency: 'USD', cycle: 'quarterly' }, // 1000
        { amountMinor: 12000, currency: 'USD', cycle: 'annual' }, // 1000
      ]);

      expect(result).toEqual([{ amountMinor: 3000, currency: 'USD' }]);
    });
  });

  describe('mixed currencies', () => {
    it('returns a separate entry per currency rather than blending them', () => {
      const result = calculateMonthlyBurn([
        { amountMinor: 1000, currency: 'USD', cycle: 'monthly' },
        { amountMinor: 900, currency: 'EUR', cycle: 'monthly' },
      ]);

      expect(result).toEqual([
        { amountMinor: 1000, currency: 'USD' },
        { amountMinor: 900, currency: 'EUR' },
      ]);
    });

    it('sums within each currency independently', () => {
      const result = calculateMonthlyBurn([
        { amountMinor: 1000, currency: 'USD', cycle: 'monthly' },
        { amountMinor: 500, currency: 'USD', cycle: 'monthly' },
        { amountMinor: 900, currency: 'EUR', cycle: 'monthly' },
      ]);

      expect(result).toEqual([
        { amountMinor: 1500, currency: 'USD' },
        { amountMinor: 900, currency: 'EUR' },
      ]);
    });

    it('orders currencies by first appearance in the input', () => {
      const result = calculateMonthlyBurn([
        { amountMinor: 500, currency: 'EUR', cycle: 'monthly' },
        { amountMinor: 1000, currency: 'USD', cycle: 'monthly' },
        { amountMinor: 300, currency: 'GBP', cycle: 'monthly' },
      ]);

      expect(result.map((m) => m.currency)).toEqual(['EUR', 'USD', 'GBP']);
    });
  });

  describe('zero and negative amounts', () => {
    it('includes a zero-amount subscription without affecting the total', () => {
      const result = calculateMonthlyBurn([
        { amountMinor: 0, currency: 'USD', cycle: 'monthly' },
        { amountMinor: 1000, currency: 'USD', cycle: 'monthly' },
      ]);

      expect(result).toEqual([{ amountMinor: 1000, currency: 'USD' }]);
    });

    it('a solely zero-amount subscription produces a zero total, not an empty result', () => {
      const result = calculateMonthlyBurn([{ amountMinor: 0, currency: 'USD', cycle: 'monthly' }]);

      expect(result).toEqual([{ amountMinor: 0, currency: 'USD' }]);
    });

    it('lets a negative amount (e.g. a tracked credit) offset the total', () => {
      const result = calculateMonthlyBurn([
        { amountMinor: 1000, currency: 'USD', cycle: 'monthly' },
        { amountMinor: -400, currency: 'USD', cycle: 'monthly' },
      ]);

      expect(result).toEqual([{ amountMinor: 600, currency: 'USD' }]);
    });

    it('normalizes a negative amount across cycles the same as a positive one', () => {
      const result = calculateMonthlyBurn([
        { amountMinor: -3000, currency: 'USD', cycle: 'quarterly' },
      ]);

      expect(result).toEqual([{ amountMinor: -1000, currency: 'USD' }]);
    });
  });
});
