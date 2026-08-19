import { describe, expect, it } from 'vitest';
import { computeNextBillingDate } from '@/server/domain/billing-cycle';

describe('computeNextBillingDate', () => {
  it('returns the anchor date unchanged when it is still in the future', () => {
    const result = computeNextBillingDate({
      anchorDate: '2026-03-15',
      cycle: 'monthly',
      asOf: '2026-01-01',
    });

    expect(result).toBe('2026-03-15');
  });

  it('returns the anchor date unchanged when asOf lands exactly on it', () => {
    const result = computeNextBillingDate({
      anchorDate: '2026-03-15',
      cycle: 'monthly',
      asOf: '2026-03-15',
    });

    expect(result).toBe('2026-03-15');
  });

  it('advances a monthly cycle to the following month', () => {
    const result = computeNextBillingDate({
      anchorDate: '2026-01-15',
      cycle: 'monthly',
      asOf: '2026-01-20',
    });

    expect(result).toBe('2026-02-15');
  });

  describe('month-end rollover', () => {
    it('clamps Jan 31 to Feb 28 in a non-leap year', () => {
      const result = computeNextBillingDate({
        anchorDate: '2025-01-31',
        cycle: 'monthly',
        asOf: '2025-02-01',
      });

      expect(result).toBe('2025-02-28');
    });

    it('clamps Jan 31 to Feb 29 in a leap year', () => {
      const result = computeNextBillingDate({
        anchorDate: '2024-01-31',
        cycle: 'monthly',
        asOf: '2024-02-01',
      });

      expect(result).toBe('2024-02-29');
    });

    it('recovers the 31st in March rather than staying collapsed at 28', () => {
      // This is the case that breaks a naive "chain from the previous
      // result" implementation: Feb 28 + 1 month = Mar 28, not Mar 31.
      // Measuring every occurrence from the original anchor avoids that.
      const result = computeNextBillingDate({
        anchorDate: '2025-01-31',
        cycle: 'monthly',
        asOf: '2025-03-01',
      });

      expect(result).toBe('2025-03-31');
    });
  });

  describe('leap years', () => {
    it('handles a quarterly cycle crossing Feb 29', () => {
      const result = computeNextBillingDate({
        anchorDate: '2023-11-30',
        cycle: 'quarterly',
        asOf: '2024-02-01',
      });

      // Nov 30 + 3 months = Feb 29 2024 (leap year) — no clamping needed
      // since Nov has 30 days and Feb 2024 has 29.
      expect(result).toBe('2024-02-29');
    });
  });

  describe('annual billing anchored on Feb 29', () => {
    it('clamps to Feb 28 in the following, non-leap year', () => {
      const result = computeNextBillingDate({
        anchorDate: '2024-02-29',
        cycle: 'annual',
        asOf: '2025-01-01',
      });

      expect(result).toBe('2025-02-28');
    });

    it('lands back on Feb 29 four years later, the next leap year', () => {
      const result = computeNextBillingDate({
        anchorDate: '2024-02-29',
        cycle: 'annual',
        asOf: '2028-01-01',
      });

      expect(result).toBe('2028-02-29');
    });
  });

  describe('custom intervals', () => {
    it('advances by the exact number of cycleDays', () => {
      const result = computeNextBillingDate({
        anchorDate: '2026-01-01',
        cycle: 'custom',
        cycleDays: 10,
        asOf: '2026-01-15',
      });

      // Occurrences: Jan 11, Jan 21 — first one on or after Jan 15.
      expect(result).toBe('2026-01-21');
    });

    it('throws when cycleDays is missing', () => {
      expect(() =>
        computeNextBillingDate({
          anchorDate: '2026-01-01',
          cycle: 'custom',
          asOf: '2026-01-15',
        }),
      ).toThrow("cycleDays must be a positive integer when cycle is 'custom'");
    });

    it('throws when cycleDays is zero or negative', () => {
      expect(() =>
        computeNextBillingDate({
          anchorDate: '2026-01-01',
          cycle: 'custom',
          cycleDays: 0,
          asOf: '2026-01-15',
        }),
      ).toThrow("cycleDays must be a positive integer when cycle is 'custom'");
    });

    it('throws when cycleDays is set on a non-custom cycle', () => {
      expect(() =>
        computeNextBillingDate({
          anchorDate: '2026-01-01',
          cycle: 'monthly',
          cycleDays: 10,
          asOf: '2026-01-15',
        }),
      ).toThrow("cycleDays must not be set when cycle is 'monthly'");
    });
  });

  describe('DST boundaries', () => {
    // The real risk here isn't the DST transition itself — it's parsing a
    // bare 'yyyy-MM-dd' string with the native Date constructor, which JS
    // treats as UTC midnight and then reads back through local-timezone
    // getters, silently shifting the calendar date by a day in negative-UTC
    // offset zones. parseISO (used internally) reads a date-only string as
    // local midnight instead, so no such shift occurs. These cases pin dates
    // either side of the US "spring forward" and "fall back" transitions.
    it('advances correctly across the March DST transition', () => {
      const result = computeNextBillingDate({
        anchorDate: '2026-03-01',
        cycle: 'monthly',
        asOf: '2026-03-20',
      });

      expect(result).toBe('2026-04-01');
    });

    it('advances correctly across the November DST transition', () => {
      const result = computeNextBillingDate({
        anchorDate: '2026-11-01',
        cycle: 'monthly',
        asOf: '2026-11-20',
      });

      expect(result).toBe('2026-12-01');
    });
  });

  it('throws rather than looping forever on a pathological gap between anchor and asOf', () => {
    expect(() =>
      computeNextBillingDate({
        anchorDate: '1900-01-01',
        cycle: 'custom',
        cycleDays: 1,
        asOf: '2026-01-01',
      }),
    ).toThrow('exceeded max iterations');
  });

  describe('quarterly and semiannual', () => {
    it('advances a quarterly cycle by three months', () => {
      const result = computeNextBillingDate({
        anchorDate: '2026-01-01',
        cycle: 'quarterly',
        asOf: '2026-02-01',
      });

      expect(result).toBe('2026-04-01');
    });

    it('advances a semiannual cycle by six months', () => {
      const result = computeNextBillingDate({
        anchorDate: '2026-01-01',
        cycle: 'semiannual',
        asOf: '2026-02-01',
      });

      expect(result).toBe('2026-07-01');
    });
  });
});
