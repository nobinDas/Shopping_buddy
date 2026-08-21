import { describe, expect, it } from 'vitest';
import {
  addMoney,
  formatMoney,
  parseAmountToMinorUnits,
  minorUnitsToAmountString,
} from '@/lib/money';

describe('addMoney', () => {
  it('adds two amounts in the same currency', () => {
    const a = { amountMinor: 1299, currency: 'USD' };
    const b = { amountMinor: 501, currency: 'USD' };

    const result = addMoney(a, b);

    expect(result).toEqual({ amountMinor: 1800, currency: 'USD' });
  });

  it('throws rather than silently mixing currencies', () => {
    const usd = { amountMinor: 1299, currency: 'USD' };
    const eur = { amountMinor: 501, currency: 'EUR' };

    expect(() => addMoney(usd, eur)).toThrow('Cannot add different currencies: USD and EUR');
  });
});

describe('formatMoney', () => {
  it('formats a USD amount with two decimal places', () => {
    expect(formatMoney({ amountMinor: 1299, currency: 'USD' })).toBe('$12.99');
  });

  it('formats a zero amount as a real zero, not blank', () => {
    expect(formatMoney({ amountMinor: 0, currency: 'USD' })).toBe('$0.00');
  });

  it('formats a negative amount with a leading minus sign', () => {
    expect(formatMoney({ amountMinor: -500, currency: 'USD' })).toBe('-$5.00');
  });

  it('formats a non-USD currency with its own symbol', () => {
    expect(formatMoney({ amountMinor: 900, currency: 'EUR' })).toBe('€9.00');
  });
});

describe('parseAmountToMinorUnits', () => {
  it('parses a whole-and-cents amount', () => {
    expect(parseAmountToMinorUnits('15.99')).toBe(1599);
  });

  it('parses a whole-dollar amount with no decimal part', () => {
    expect(parseAmountToMinorUnits('15')).toBe(1500);
  });

  it('pads a single decimal digit to two', () => {
    expect(parseAmountToMinorUnits('15.9')).toBe(1590);
  });

  it('parses a sub-dollar amount', () => {
    expect(parseAmountToMinorUnits('0.05')).toBe(5);
  });

  it('parses zero', () => {
    expect(parseAmountToMinorUnits('0')).toBe(0);
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseAmountToMinorUnits('  15.99  ')).toBe(1599);
  });

  it('rejects more than two decimal places', () => {
    expect(parseAmountToMinorUnits('15.999')).toBeNull();
  });

  it('rejects a negative amount', () => {
    expect(parseAmountToMinorUnits('-15.99')).toBeNull();
  });

  it('rejects non-numeric input', () => {
    expect(parseAmountToMinorUnits('abc')).toBeNull();
  });

  it('rejects an empty string', () => {
    expect(parseAmountToMinorUnits('')).toBeNull();
  });

  it('never produces a float for values that trip float multiplication', () => {
    // 0.1 * 100 in a naive float implementation is 9.999999999999998, not 10.
    expect(parseAmountToMinorUnits('0.10')).toBe(10);
    expect(Number.isInteger(parseAmountToMinorUnits('0.10'))).toBe(true);
  });
});

describe('minorUnitsToAmountString', () => {
  it('formats whole cents as a two-decimal string', () => {
    expect(minorUnitsToAmountString(1599)).toBe('15.99');
  });

  it('formats zero', () => {
    expect(minorUnitsToAmountString(0)).toBe('0.00');
  });

  it('round-trips through parseAmountToMinorUnits', () => {
    expect(parseAmountToMinorUnits(minorUnitsToAmountString(1599))).toBe(1599);
  });
});